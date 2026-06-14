import { NextResponse } from "next/server";
import { parsePreferencesFromQuery } from "@/lib/legislation/issue-tag-preferences";
import { fetchMemberVotesFromDb } from "@/lib/legislation/member-votes-db";
import { fetchStateMemberVotesFromDb } from "@/lib/legislation/state-member-votes-db";
import { isStateLegislatorId } from "@/lib/legislators/id-map";
import { votingRecordsQuerySchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = votingRecordsQuerySchema.safeParse({
    bioguideId: searchParams.get("bioguideId"),
    limit: searchParams.get("limit") ?? undefined,
    tags: searchParams.get("tags") ?? undefined,
    includeProcedural: searchParams.get("includeProcedural") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "bioguideId is required" }, { status: 400 });
  }

  const officialId = parsed.data.bioguideId;
  const isState = isStateLegislatorId(officialId);

  const tagList = parsed.data.tags
    ? parsed.data.tags.split(",").filter(Boolean)
    : [];
  const preferences = parsePreferencesFromQuery(tagList, searchParams);

  const votes = isState
    ? await fetchStateMemberVotesFromDb(officialId, {
        limit: parsed.data.limit ?? 25,
        preferences,
        includeProcedural: parsed.data.includeProcedural,
      })
    : await fetchMemberVotesFromDb(officialId, {
        limit: parsed.data.limit ?? 25,
        preferences,
        includeProcedural: parsed.data.includeProcedural,
      });

  return NextResponse.json({
    bioguideId: officialId,
    jurisdiction: isState ? "state" : "federal",
    votes,
    source: "database",
    scoringFilter: parsed.data.includeProcedural ? "all" : "policy-relevant",
    note:
      votes.length === 0
        ? isState
          ? "No ingested state votes for this legislator. Run scripts/ingest-state and tag-state-bills."
          : "No ingested votes for this member. Run scripts/ingest-congress or check bioguide ID."
        : undefined,
  });
}
