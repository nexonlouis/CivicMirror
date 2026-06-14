import type { Representative } from "@/lib/types";

const API_ROOT = "https://v3.openstates.org";

interface OpenStatesJurisdiction {
  id: string;
  name: string;
  classification: string;
  division_id?: string;
}

interface OpenStatesPerson {
  id: string;
  name: string;
  party?: string;
  image?: string;
  email?: string;
  jurisdiction?: OpenStatesJurisdiction;
  current_role?: {
    title?: string;
    org_classification?: string;
    district?: string | number;
    division_id?: string;
  };
}

interface PeopleGeoResponse {
  results: OpenStatesPerson[];
}

export interface StateLegislatorLookupResult {
  representatives: Representative[];
  stateHouseDistrict: string | null;
  stateSenateDistrict: string | null;
}

function resolveApiKey(): string | null {
  return (
    process.env.OPENSTATES_PLURAL_API_KEY?.trim() ||
    process.env.OPENSTATES_API_KEY?.trim() ||
    null
  );
}

function stateAbbrFromJurisdiction(j: OpenStatesJurisdiction): string | null {
  const fromDivision = j.division_id?.match(/state:([a-z]{2})$/i)?.[1];
  if (fromDivision) return fromDivision.toUpperCase();
  const fromId = j.id.match(/state:([a-z]{2})\//i)?.[1];
  return fromId ? fromId.toUpperCase() : null;
}

function mapStatePerson(person: OpenStatesPerson, expectedState: string): Representative | null {
  const jurisdiction = person.jurisdiction;
  if (!jurisdiction || jurisdiction.classification !== "state") return null;

  const personState = stateAbbrFromJurisdiction(jurisdiction);
  if (personState !== expectedState.toUpperCase()) return null;

  const orgClass = person.current_role?.org_classification?.toLowerCase();
  if (orgClass !== "lower" && orgClass !== "upper") return null;

  const districtRaw = person.current_role?.district;
  const district =
    districtRaw === undefined || districtRaw === null || districtRaw === ""
      ? null
      : String(districtRaw);

  return {
    bioguideId: person.id,
    personId: person.id,
    fullName: person.name,
    chamber: "state",
    stateLegislativeChamber: orgClass,
    party: person.party ?? null,
    photoUrl: person.image ?? null,
    state: personState,
    district,
    officialWebsite: null,
    officePhone: null,
  };
}

/**
 * State legislators at a lat/lng via Open States people.geo.
 * Federal members in the response are ignored.
 */
export async function lookupStateLegislatorsAtGeo(
  lat: number,
  lng: number,
  stateCode: string,
): Promise<StateLegislatorLookupResult> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return { representatives: [], stateHouseDistrict: null, stateSenateDistrict: null };
  }

  const url = new URL(`${API_ROOT}/people.geo`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey,
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    console.error("Open States people.geo error", res.status, await res.text());
    return { representatives: [], stateHouseDistrict: null, stateSenateDistrict: null };
  }

  const data = (await res.json()) as PeopleGeoResponse;
  const expectedState = stateCode.toUpperCase();
  const byPersonId = new Map<string, Representative>();

  for (const person of data.results ?? []) {
    const rep = mapStatePerson(person, expectedState);
    if (rep) byPersonId.set(rep.personId!, rep);
  }

  const representatives = [...byPersonId.values()].sort((a, b) => {
    const order = { lower: 0, upper: 1 };
    const aKey = a.stateLegislativeChamber ? order[a.stateLegislativeChamber] : 2;
    const bKey = b.stateLegislativeChamber ? order[b.stateLegislativeChamber] : 2;
    return aKey - bKey;
  });

  const house = representatives.find((r) => r.stateLegislativeChamber === "lower");
  const senate = representatives.find((r) => r.stateLegislativeChamber === "upper");

  return {
    representatives,
    stateHouseDistrict: house?.district ?? null,
    stateSenateDistrict: senate?.district ?? null,
  };
}
