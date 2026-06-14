import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");

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

export function peopleJsonPath(dataRoot: string, stateAbbr: string): string {
  return path.join(stateDir(dataRoot, stateAbbr), "people", "current.json");
}
