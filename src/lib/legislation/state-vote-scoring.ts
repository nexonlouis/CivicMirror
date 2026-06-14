/**
 * Whether a state roll-call vote should affect reflection scoring.
 * Open States motion_classification values vary by state; FL is committee-heavy.
 */

const EXCLUDED_CLASSIFICATIONS = new Set([
  "committee-passage",
  "amendment",
  "amendment-passage",
  "amendment-failure",
  "reading",
  "introduction",
  "receipt",
  "referral",
  "re-introduction",
  "re-referral",
  "substitution",
  "veto-override",
]);

export function isStateScoringRelevantVote(input: {
  motionClassification?: string[] | null;
  motionText?: string | null;
}): boolean {
  const classifications = input.motionClassification ?? [];
  if (classifications.some((c) => EXCLUDED_CLASSIFICATIONS.has(c.toLowerCase()))) {
    return false;
  }

  if (classifications.includes("passage")) {
    return true;
  }

  const motion = (input.motionText ?? "").trim().toLowerCase();
  if (motion.includes("third reading") || motion === "passed") {
    return true;
  }

  if (classifications.length === 0 && motion) {
    return !motion.includes("favorable");
  }

  return classifications.length > 0 && !classifications.every((c) => EXCLUDED_CLASSIFICATIONS.has(c));
}
