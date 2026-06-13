import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (scripts/download-openstates/lib → ../../../) */
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");

/** Default cache root: repo-root/data/openstates */
export function resolveDataRoot(): string {
  const fromEnv = process.env.OPENSTATES_DATA_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(REPO_ROOT, fromEnv);
  }
  return path.join(REPO_ROOT, "data/openstates");
}

export function stateDir(dataRoot: string, stateAbbr: string): string {
  return path.join(dataRoot, stateAbbr.toUpperCase());
}

export function sessionDir(dataRoot: string, stateAbbr: string, sessionId: string): string {
  return path.join(stateDir(dataRoot, stateAbbr), sessionId);
}

export function peopleCsvPath(dataRoot: string, stateAbbr: string): string {
  return path.join(stateDir(dataRoot, stateAbbr), "people", "current.csv");
}

export function peopleJsonPath(dataRoot: string, stateAbbr: string): string {
  return path.join(stateDir(dataRoot, stateAbbr), "people", "current.json");
}

export function sessionArchivePath(
  dataRoot: string,
  stateAbbr: string,
  sessionId: string,
  url: string,
): string {
  const filename = url.split("/").pop() ?? `${sessionId}.zip`;
  return path.join(sessionDir(dataRoot, stateAbbr, sessionId), filename);
}

export function jurisdictionId(stateAbbr: string): string {
  return `ocd-jurisdiction/country:us/state:${stateAbbr.toLowerCase()}/government`;
}
