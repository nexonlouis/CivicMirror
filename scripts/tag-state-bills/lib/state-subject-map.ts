import {
  inferIssueSlugsDetailed,
  type BillTagInput,
  type TagInferenceResult,
  type TagMatch,
} from "../../tag-bills/lib/subject-map.js";
import { filterAllowedSlugs, type IssueSlug } from "../../tag-bills/lib/issue-slugs.js";

/**
 * Open States / state legislature subject phrases (e.g. Florida subject index).
 * Federal subject-map substring rules catch many; these cover state-specific labels.
 */
const STATE_SUBJECT_TO_SLUGS: Record<string, IssueSlug[]> = {
  "taxation and finance": ["tax-relief"],
  "social welfare": ["poverty", "childcare"],
  "real and personal property": ["housing-affordability"],
  "criminal procedure and corrections": ["criminal-justice-reform", "crime-prevention"],
  appropriations: ["less-government-spending"],
  insurance: ["healthcare"],
  "public transportation": ["infrastructure-transportation"],
  "alcoholic beverages and tobacco": ["healthcare"],
  "health care": ["healthcare"],
  "higher education": ["student-loans", "public-schools"],
  "k-12 education": ["public-schools"],
  "public safety": ["crime-prevention", "national-security"],
  "natural resources": ["climate-environment"],
  "water quality": ["climate-environment"],
  elections: ["civil-rights"],
  "local government": ["less-government-spending"],
  veterans: ["national-security", "healthcare"],
  agriculture: ["agriculture"],
  gaming: ["crime-prevention"],
  "reclamation, and use": ["climate-environment"],
};

function normalizeSubject(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchStateSubjectDetailed(subject: string): TagMatch[] {
  const normalized = normalizeSubject(subject);
  const matches: TagMatch[] = [];

  const direct = STATE_SUBJECT_TO_SLUGS[normalized];
  if (direct) {
    for (const slug of direct) {
      matches.push({
        slug,
        source: "subject",
        rule: `state subject map "${normalized}"`,
        sourceText: subject,
      });
    }
    return matches;
  }

  for (const [key, slugs] of Object.entries(STATE_SUBJECT_TO_SLUGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      for (const slug of slugs) {
        matches.push({
          slug,
          source: "subject",
          rule: `state subject overlaps "${key}"`,
          sourceText: subject,
        });
      }
    }
  }

  return matches;
}

function dedupeMatches(matches: TagMatch[]): TagMatch[] {
  const seen = new Set<string>();
  const out: TagMatch[] = [];

  for (const m of matches) {
    const key = `${m.slug}|${m.source}|${m.rule}|${m.sourceText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
}

/**
 * Infer issue slugs for state bills: state subject vocabulary + federal subject/title rules.
 */
export function inferStateIssueSlugsDetailed(
  bill: BillTagInput,
  maxSlugs = 3,
): TagInferenceResult {
  const stateSubjectMatches: TagMatch[] = [];
  for (const subject of bill.subjects ?? []) {
    stateSubjectMatches.push(...matchStateSubjectDetailed(subject));
  }

  const federal = inferIssueSlugsDetailed(bill, maxSlugs);
  const allMatches = dedupeMatches([...stateSubjectMatches, ...federal.matches]);

  const orderedSlugs: string[] = [];
  for (const m of allMatches) {
    if (!orderedSlugs.includes(m.slug)) orderedSlugs.push(m.slug);
  }

  const slugs = filterAllowedSlugs(orderedSlugs).slice(0, maxSlugs);
  const keptMatches = allMatches.filter((m) => slugs.includes(m.slug));

  return {
    slugs,
    matches: keptMatches,
    maxSlugs,
    input: bill,
  };
}

export function inferStateIssueSlugs(bill: BillTagInput, maxSlugs = 3): IssueSlug[] {
  return inferStateIssueSlugsDetailed(bill, maxSlugs).slugs;
}
