#!/usr/bin/env npx tsx
/**
 * Tag state_bills.issue_slugs via local Ollama (default model: gemma4).
 * Use after subject-map tagging for bills the keyword map misses.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminClient } from "../ingest-state/lib/supabase-admin.js";
import {
  assertOllamaModel,
  resolveOllamaConfig,
  sleep,
  tagBillWithOllamaDetailed,
} from "../tag-bills/lib/ollama-client.js";
import { printOllamaReport } from "../tag-bills/lib/tag-report.js";
import { loadTagStateEnv, parseStateOllamaArgs } from "./lib/cli-args.js";
import {
  fetchStateBills,
  fetchVoteContextByBill,
  fetchVoteLinkedBillIds,
  type StateBillFilters,
} from "./lib/state-bills-query.js";
import { toOllamaBillInput, buildStateOllamaSystemPrompt } from "./lib/state-ollama.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  loadTagStateEnv(SCRIPT_DIR);

  const opts = parseStateOllamaArgs(process.argv.slice(2));
  const config = resolveOllamaConfig();
  if (opts.model) config.model = opts.model;

  await assertOllamaModel(config);

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
  const scope = opts.all ? "all" : opts.allVotes ? "vote-linked" : "scoring-vote-linked";
  const filter = opts.force ? "including already tagged" : "untagged only";
  const filterNote = [
    opts.state ? `state=${opts.state}` : null,
    opts.session ? `session=${opts.session}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  console.log(
    `Ollama tagging ${bills.length} state bill(s) with ${config.model} (${scope}, ${filter}${filterNote ? `; ${filterNote}` : ""})${opts.dryRun ? " [dry-run]" : ""}${explain ? " — showing model input + response" : ""}`,
  );

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const context = voteContext.get(bill.bill_id) ?? null;

    try {
      const result = await tagBillWithOllamaDetailed(
        toOllamaBillInput(bill),
        context,
        config,
        { systemPrompt: buildStateOllamaSystemPrompt() },
      );

      if (explain) {
        printOllamaReport(bill.bill_id, result, config.model);
      }

      if (result.slugs.length === 0) {
        skipped++;
        if (!explain && skipped <= 5) {
          const hint =
            bill.title?.slice(0, 50) ?? context?.slice(0, 50) ?? bill.identifier;
          console.log("[skip]", bill.state, bill.identifier, hint);
        }
      } else if (opts.dryRun) {
        tagged++;
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
      } else {
        const { error } = await supabase
          .from("state_bills")
          .update({ issue_slugs: result.slugs })
          .eq("bill_id", bill.bill_id);

        if (error) throw new Error(error.message);

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
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errors <= 5) console.error("[error]", bill.bill_id, msg);
    }

    if (i < bills.length - 1 && opts.delayMs > 0) {
      await sleep(opts.dryRun ? Math.min(opts.delayMs, 100) : opts.delayMs);
    }

    if (!explain && (i + 1) % 25 === 0) {
      console.log(`… progress ${i + 1}/${bills.length}`);
    }
  }

  console.log(`Done. tagged=${tagged} skipped=${skipped} errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
