import { parse } from "csv-parse/sync";
import unzipper from "unzipper";

export async function readCsvFromZip(
  zipPath: string,
  nameIncludes: string,
): Promise<Record<string, string>[]> {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find(
    (f) => f.path.includes(nameIncludes) && f.path.endsWith(".csv"),
  );

  if (!entry) {
    throw new Error(`CSV matching "${nameIncludes}" not found in ${zipPath}`);
  }

  const buffer = await entry.buffer();
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as Record<string, string>[];
}

/** Parse Open States CSV list literals like "['passage']" or "['a', 'b']". */
export function parseListField(raw: string | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "[]") return [];

  try {
    const jsonish = trimmed.replace(/'/g, '"');
    const parsed = JSON.parse(jsonish) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function normalizeStatePosition(option: string): string | null {
  const value = option.trim().toLowerCase();
  if (value === "yes" || value === "yea") return "Yea";
  if (value === "no" || value === "nay") return "Nay";
  if (value === "not voting" || value === "excused" || value === "other" || value === "absent") {
    return "Not Voting";
  }
  if (value === "present") return "Present";
  return null;
}

export function chamberFromClassification(value: string | undefined): "lower" | "upper" | null {
  const c = (value ?? "").toLowerCase();
  if (c === "lower" || c === "upper") return c;
  return null;
}
