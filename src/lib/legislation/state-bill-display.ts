import type { VoteDisplayFields } from "@/lib/legislation/bill-display";
import { formatVoteContext } from "@/lib/legislation/vote-question";

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildStateVoteDisplayFields(input: {
  billId: string;
  voteId: string;
  motionText: string | null;
  motionClassification: string[] | null;
  result: string | null;
  chamber: string | null;
  billIdentifier: string | null;
  billTitle: string | null;
  billSummary: string | null;
}): VoteDisplayFields {
  const identifier = normalizeText(input.billIdentifier);
  const billTitle = normalizeText(input.billTitle);
  const title =
    identifier && billTitle
      ? `${identifier}: ${billTitle}`
      : billTitle ?? identifier ?? normalizeText(input.motionText) ?? `Roll call ${input.voteId}`;

  const summary = normalizeText(input.billSummary);

  const motionLabel =
    input.motionClassification?.length ?
      input.motionClassification.join(", ")
    : null;

  const voteContext =
    summary === null
      ? formatVoteContext({
          procedure: normalizeText(input.motionText),
          category: motionLabel,
          result: input.result,
          chamber: input.chamber === "lower" ? "house" : input.chamber === "upper" ? "senate" : input.chamber,
        })
      : null;

  return { title, summary, voteContext };
}
