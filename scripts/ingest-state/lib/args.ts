import fs from "node:fs/promises";
import path from "node:path";
import { peopleJsonPath, resolveDataRoot, sessionDir, stateDir } from "./paths.js";

export interface IngestCliOptions {
  state: string;
  year?: number;
  session?: string;
  includeSpecialSessions: boolean;
  dryRun: boolean;
  votesOnly: boolean;
  billsOnly: boolean;
  limit?: number;
}

export function parseArgs(argv: string[]): IngestCliOptions {
  const opts: IngestCliOptions = {
    state: "",
    includeSpecialSessions: false,
    dryRun: false,
    votesOnly: false,
    billsOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--votes-only") opts.votesOnly = true;
    else if (arg === "--bills-only") opts.billsOnly = true;
    else if (arg === "--include-special-sessions") opts.includeSpecialSessions = true;
    else if (arg.startsWith("--state=")) opts.state = arg.split("=")[1].toUpperCase();
    else if (arg === "--state") opts.state = argv[++i].toUpperCase();
    else if (arg.startsWith("--year=")) opts.year = Number(arg.split("=")[1]);
    else if (arg === "--year") opts.year = Number(argv[++i]);
    else if (arg.startsWith("--session=")) opts.session = arg.split("=")[1];
    else if (arg === "--session") opts.session = argv[++i];
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.split("=")[1]);
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!opts.state) {
    throw new Error("Specify --state FL");
  }

  return opts;
}

export function printHelp(): void {
  console.log(`CivicMirror — ingest Open States CSV archives into Supabase

Usage:
  npm run ingest -- --state FL --year 2026
  npm run ingest:dry -- --state FL --session 2026
  npm run ingest -- --state FL --year 2026 --votes-only --limit 50

Options:
  --state <ABBR>              State postal code (required)
  --year <YYYY>               Ingest matching sessions (regular only by default)
  --session <id>              Single session (e.g. 2026, 2026D)
  --include-special-sessions  With --year, include special sessions
  --dry-run                   Parse and log without writing
  --votes-only / --bills-only Limit which entities are upserted
  --limit <n>                 Cap votes processed (debug)

Requires migration 009_state_legislation.sql and OPENSTATES_DATA_DIR downloads.
`);
}

export interface SessionBundle {
  stateAbbr: string;
  sessionId: string;
  zipPath: string;
  peopleJsonPath: string;
}

function sessionMatchesFilters(
  sessionId: string,
  opts: IngestCliOptions,
): boolean {
  if (opts.session) return sessionId === opts.session;
  if (opts.year === undefined) return true;
  const yearStr = String(opts.year);
  if (!sessionId.startsWith(yearStr)) return false;
  if (opts.includeSpecialSessions) return true;
  return sessionId === yearStr;
}

export async function discoverSessionBundles(
  opts: IngestCliOptions,
): Promise<SessionBundle[]> {
  const dataRoot = resolveDataRoot();
  const statePath = stateDir(dataRoot, opts.state);
  const peoplePath = peopleJsonPath(dataRoot, opts.state);

  let entries: string[];
  try {
    entries = await fs.readdir(statePath);
  } catch {
    throw new Error(
      `No data for ${opts.state} at ${statePath}. Run scripts/download-openstates first.`,
    );
  }

  const bundles: SessionBundle[] = [];

  for (const sessionId of entries) {
    if (!sessionMatchesFilters(sessionId, opts)) continue;

    const dir = sessionDir(dataRoot, opts.state, sessionId);
    const files = await fs.readdir(dir);
    const zip = files.find((f) => f.endsWith(".zip"));
    if (!zip) continue;

    bundles.push({
      stateAbbr: opts.state,
      sessionId,
      zipPath: path.join(dir, zip),
      peopleJsonPath: peoplePath,
    });
  }

  bundles.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  return bundles;
}
