import type { MemberVoteRecord } from "@/lib/legislation/reflection-score";
import { dedupeVotesByBill } from "@/lib/legislation/dedupe-votes-by-bill";
import { pickIssueMatch } from "@/lib/legislation/pick-issue-match";
import { pickIssueSlug } from "@/lib/legislation/pick-issue-slug";
import { buildStateVoteDisplayFields } from "@/lib/legislation/state-bill-display";
import { normalizeStatePosition } from "@/lib/legislation/state-position";
import type { IssueTagPreference } from "@/lib/types/issue-tags";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { FetchMemberVotesOptions } from "@/lib/legislation/member-votes-db";

export interface StateMemberVoteRow {
  person_id: string;
  position: string;
  vote_id: string;
  voted_at: string;
  chamber: string;
  state: string;
  session: string;
  motion_text: string | null;
  motion_classification: string[] | null;
  result: string | null;
  related_bill_id: string | null;
  bill_identifier: string | null;
  bill_title: string | null;
  bill_summary: string | null;
  bill_issue_slugs: string[] | null;
  scoring_relevant: boolean | null;
}

async function getLegislationClient() {
  const service = await createServiceClient();
  if (service) return service;
  return createClient();
}

function resolvePreferences(options: FetchMemberVotesOptions): IssueTagPreference[] {
  if (options.preferences?.length) return options.preferences;
  return (options.userTags ?? []).map((slug) => ({
    slug,
    weight: 3,
    stance: "support" as const,
  }));
}

function mapRowToMemberVoteRecord(
  row: StateMemberVoteRow,
  preferences: IssueTagPreference[],
  scoringOnly: boolean,
): MemberVoteRecord | null {
  const vote = normalizeStatePosition(row.position);
  if (!vote) return null;

  const match = pickIssueMatch(row.bill_issue_slugs, preferences);
  if (scoringOnly && !match) return null;

  const issueSlug =
    match?.issueSlug ??
    pickIssueSlug(row.bill_issue_slugs, preferences.map((p) => p.slug));
  const userStance = match?.userStance ?? "support";
  const billId = row.related_bill_id ?? row.vote_id;

  const display = buildStateVoteDisplayFields({
    billId,
    voteId: row.vote_id,
    motionText: row.motion_text,
    motionClassification: row.motion_classification,
    result: row.result,
    chamber: row.chamber,
    billIdentifier: row.bill_identifier,
    billTitle: row.bill_title,
    billSummary: row.bill_summary,
  });

  return {
    voteId: row.vote_id,
    billId,
    title: display.title,
    summary: display.summary,
    voteContext: display.voteContext,
    question: row.motion_text,
    votedAt: row.voted_at,
    issueSlug,
    userStance,
    vote,
    userSupportsBill: userStance === "support",
  };
}

/**
 * Fetches roll-call votes for a state legislator (ocd-person id) from ingested data.
 */
export async function fetchStateMemberVotesFromDb(
  personId: string,
  options: FetchMemberVotesOptions = {},
): Promise<MemberVoteRecord[]> {
  const limit = options.limit ?? 25;
  const preferences = resolvePreferences(options);
  const scoringOnly = options.scoringOnly ?? false;
  const supabase = await getLegislationClient();

  let query = supabase
    .from("state_member_votes_enriched")
    .select(
      "person_id, position, vote_id, voted_at, chamber, state, session, motion_text, motion_classification, result, related_bill_id, bill_identifier, bill_title, bill_summary, bill_issue_slugs, scoring_relevant",
    )
    .eq("person_id", personId)
    .order("voted_at", { ascending: false });

  if (!options.includeProcedural) {
    query = query.eq("scoring_relevant", true);
  }

  const fetchLimit = scoringOnly ? Math.min(limit * 4, 200) : limit;
  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error("state_member_votes_enriched query failed", error.message);
    return [];
  }

  const rows = (data ?? []) as StateMemberVoteRow[];
  const records: MemberVoteRecord[] = [];

  for (const row of rows) {
    const mapped = mapRowToMemberVoteRecord(row, preferences, scoringOnly);
    if (mapped) records.push(mapped);
  }

  if (scoringOnly) {
    return dedupeVotesByBill(records).slice(0, limit);
  }

  return records;
}

export async function countStateMemberVotesInDb(personId: string): Promise<number> {
  const supabase = await getLegislationClient();
  const { count, error } = await supabase
    .from("state_roll_call_positions")
    .select("*", { count: "exact", head: true })
    .eq("person_id", personId);

  if (error) return 0;
  return count ?? 0;
}
