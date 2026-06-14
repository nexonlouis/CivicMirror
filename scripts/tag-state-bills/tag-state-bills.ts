#!/usr/bin/env npx tsx
/**
 * Batch-tag state_bills.issue_slugs from subjects + title keywords.
 * Run after ingest-state. Does not call external LLM APIs.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminClient } from "../ingest-state/lib/supabase-admin.js";
import { printSubjectMapReport } from "../tag-bills/lib/tag-report.js";
import {
  loadTagStateEnv,
  parseStateTagArgs,
  printStateTagHelp,
} from "./lib/cli-args.js";
import {
  fetchStateBills,
  fetchVoteContextByBill,
  fetchVoteLinkedBillIds,
  type StateBillFilters,
} from "./lib/state-bills-query.js";
import { inferStateIssueSlugsDetailed } from "./lib/state-subject-map.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  loadTagStateEnv(SCRIPT_DIR);

  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printStateTagHelp();
    return;
  }

  const opts = parseStateTagArgs(args);
  const supabase = createAdminClient();

  const filters: StateBillFilters = {
    state: opts.state,
    session: opts.session,
    scoringVotesOnly: !opts.allVotes,
  };

  const billIds = opts.all ? null : await fetchVoteLinkedBillIds(supabase, filters);
  let bills = await fetchStateBills(supabase, billIds, opts.force, filters);

  if (opts.limit) bills = bills.slice(0, opts.limit);

  const voteContext = await fetchVoteContextByBill(
    supabase,
    bills.map((b) => b.bill_id),
    { scoringVotesOnly: filters.scoringVotesOnly },
  );

  const explain = opts.dryRun && !opts.quiet;
  const scope = opts.all ? "all untagged" : opts.allVotes ? "vote-linked" : "scoring-vote-linked";
  const filterNote = [
    opts.state ? `state=${opts.state}` : null,
    opts.session ? `session=${opts.session}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  console.log(
    `Tagging ${bills.length} state bill(s) (${scope}${filterNote ? `; ${filterNote}` : ""})${opts.dryRun ? " [dry-run]" : ""}${explain ? " — showing tag decisions" : ""}`,
  );

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (const bill of bills) {
    const context = voteContext.get(bill.bill_id) ?? null;
    const result = inferStateIssueSlugsDetailed({
      title: bill.title,
      subjects: bill.subjects,
      voteContext: context,
    });

    if (explain) {
      printSubjectMapReport(bill.bill_id, result, context);
    }

    if (result.slugs.length === 0) {
      skipped++;
      if (!explain && skipped <= 5) {
        const hint =
          bill.title?.slice(0, 60) ??
          context?.slice(0, 60) ??
          bill.identifier ??
          "(no title)";
        console.log("[skip]", bill.state, bill.identifier, hint);
      }
      continue;
    }

    if (opts.dryRun) {
      if (!explain) {
        const hint = bill.title?.slice(0, 50) ?? context?.slice(0, 50) ?? bill.identifier;
        console.log(
          "[dry-run]",
          bill.state,
          bill.identifier,
          "→",
          result.slugs.join(", "),
          "|",
          hint,
        );
      }
      tagged++;
      continue;
    }

    const { error } = await supabase
      .from("state_bills")
      .update({ issue_slugs: result.slugs })
      .eq("bill_id", bill.bill_id);

    if (error) {
      errors++;
      if (errors <= 5) console.error("[error]", bill.bill_id, error.message);
      continue;
    }

    tagged++;
    if (!explain && tagged <= 10) {
      console.log(
        "[tagged]",
        bill.state,
        bill.identifier,
        "→",
        result.slugs.join(", "),
      );
    }
  }

  console.log(`Done. tagged=${tagged} skipped=${skipped} errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
