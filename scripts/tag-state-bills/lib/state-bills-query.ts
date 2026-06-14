import type { createAdminClient } from "../../ingest-state/lib/supabase-admin.js";

type Supabase = ReturnType<typeof createAdminClient>;

/** PostgREST `.in()` uses GET; long ocd-bill IDs exceed URL limits above ~300 ids. */
const BILL_ID_IN_CHUNK = 200;
const PAGE_SIZE = 500;

export interface StateBillRow {
  bill_id: string;
  state: string;
  session: string;
  identifier: string;
  title: string | null;
  summary: string | null;
  subjects: string[] | null;
  issue_slugs: string[] | null;
}

export interface StateBillFilters {
  state?: string;
  session?: string;
  scoringVotesOnly: boolean;
}

export function isUntagged(slugs: string[] | null | undefined): boolean {
  return !slugs || slugs.length === 0;
}

export async function fetchVoteLinkedBillIds(
  supabase: Supabase,
  filters: StateBillFilters,
): Promise<string[]> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("state_roll_call_votes")
      .select("related_bill_id")
      .not("related_bill_id", "is", null);

    if (filters.state) query = query.eq("state", filters.state.toUpperCase());
    if (filters.session) query = query.eq("session", filters.session);
    if (filters.scoringVotesOnly) query = query.eq("scoring_relevant", true);

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) throw new Error(`state_roll_call_votes: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      if (row.related_bill_id) ids.add(row.related_bill_id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return [...ids];
}

export async function fetchStateBills(
  supabase: Supabase,
  billIds: string[] | null,
  force: boolean,
  filters: Pick<StateBillFilters, "state" | "session">,
): Promise<StateBillRow[]> {
  const out: StateBillRow[] = [];

  if (billIds && billIds.length === 0) return out;

  const select =
    "bill_id, state, session, identifier, title, summary, subjects, issue_slugs";

  const applyFilters = <T extends { eq: (col: string, val: string) => T }>(q: T): T => {
    let next = q;
    if (filters.state) next = next.eq("state", filters.state.toUpperCase());
    if (filters.session) next = next.eq("session", filters.session);
    return next;
  };

  if (billIds) {
    for (let i = 0; i < billIds.length; i += BILL_ID_IN_CHUNK) {
      const chunk = billIds.slice(i, i + BILL_ID_IN_CHUNK);
      let query = supabase.from("state_bills").select(select).in("bill_id", chunk);
      query = applyFilters(query);

      const { data, error } = await query;
      if (error) throw new Error(`state_bills: ${error.message}`);

      for (const row of (data ?? []) as StateBillRow[]) {
        if (force || isUntagged(row.issue_slugs)) out.push(row);
      }
    }
    return out;
  }

  let from = 0;
  while (true) {
    let query = supabase.from("state_bills").select(select);
    query = applyFilters(query);

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`state_bills: ${error.message}`);
    if (!data?.length) break;

    for (const row of data as StateBillRow[]) {
      if (force || isUntagged(row.issue_slugs)) out.push(row);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return out;
}

export async function fetchVoteContextByBill(
  supabase: Supabase,
  billIds: string[],
  filters: Pick<StateBillFilters, "scoringVotesOnly">,
): Promise<Map<string, string>> {
  const context = new Map<string, string>();

  for (let i = 0; i < billIds.length; i += BILL_ID_IN_CHUNK) {
    const chunk = billIds.slice(i, i + BILL_ID_IN_CHUNK);
    let query = supabase
      .from("state_roll_call_votes")
      .select("related_bill_id, motion_text, result")
      .in("related_bill_id", chunk);

    if (filters.scoringVotesOnly) query = query.eq("scoring_relevant", true);

    const { data, error } = await query;
    if (error) throw new Error(`vote context: ${error.message}`);

    for (const row of data ?? []) {
      if (!row.related_bill_id) continue;
      const piece = [row.motion_text, row.result].filter(Boolean).join(" ");
      const prev = context.get(row.related_bill_id) ?? "";
      if (piece && !prev.includes(piece)) {
        context.set(row.related_bill_id, `${prev} ${piece}`.trim());
      }
    }
  }

  return context;
}
