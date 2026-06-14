import type { SupabaseClient } from "@supabase/supabase-js";
import { isStateLegislatorId } from "@/lib/legislators/id-map";

export type AlignmentOverrideMap = Map<string, boolean>;

export async function fetchAlignmentOverrides(
  supabase: SupabaseClient,
  userId: string,
  officialId: string,
): Promise<AlignmentOverrideMap> {
  let query = supabase
    .from("user_reflection_overrides")
    .select("bill_id, aligned")
    .eq("user_id", userId);

  if (isStateLegislatorId(officialId)) {
    query = query.eq("person_id", officialId);
  } else {
    query = query.eq("bioguide_id", officialId.toUpperCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchAlignmentOverrides failed", error.message);
    return new Map();
  }

  const map: AlignmentOverrideMap = new Map();
  for (const row of data ?? []) {
    map.set(row.bill_id, row.aligned);
  }
  return map;
}

export async function upsertAlignmentOverride(
  supabase: SupabaseClient,
  userId: string,
  officialId: string,
  billId: string,
  aligned: boolean,
): Promise<{ error: string | null }> {
  const isState = isStateLegislatorId(officialId);
  const { error } = await supabase.from("user_reflection_overrides").upsert(
    {
      user_id: userId,
      bioguide_id: isState ? officialId : officialId.toUpperCase(),
      person_id: isState ? officialId : null,
      bill_id: billId,
      aligned,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,bioguide_id,bill_id" },
  );

  return { error: error?.message ?? null };
}

export async function deleteAlignmentOverride(
  supabase: SupabaseClient,
  userId: string,
  officialId: string,
  billId: string,
): Promise<{ error: string | null }> {
  let query = supabase
    .from("user_reflection_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("bill_id", billId);

  if (isStateLegislatorId(officialId)) {
    query = query.eq("person_id", officialId);
  } else {
    query = query.eq("bioguide_id", officialId.toUpperCase());
  }

  const { error } = await query;

  return { error: error?.message ?? null };
}
