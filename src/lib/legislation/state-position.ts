/** Open States position strings → federal roll-call labels for scoring. */
export function normalizeStatePosition(
  raw: string,
): "Yea" | "Nay" | "Not Voting" | "Present" | null {
  const value = raw.trim().toLowerCase();
  if (value === "yes" || value === "yea") return "Yea";
  if (value === "no" || value === "nay") return "Nay";
  if (value === "not voting" || value === "excused" || value === "other" || value === "absent") {
    return "Not Voting";
  }
  if (value === "present") return "Present";
  return null;
}
