import dotenv from "dotenv";
import path from "node:path";

export interface StateTagCliOptions {
  dryRun: boolean;
  all: boolean;
  limit?: number;
  force: boolean;
  quiet: boolean;
  state?: string;
  session?: string;
  allVotes: boolean;
}

export interface StateOllamaCliOptions extends StateTagCliOptions {
  delayMs: number;
  model?: string;
}

export function loadTagStateEnv(scriptDir: string): void {
  dotenv.config({ path: path.resolve(scriptDir, ".env") });
  dotenv.config({ path: path.resolve(scriptDir, "../../.env.local") });
}

export function parseStateTagArgs(argv: string[]): StateTagCliOptions {
  const opts: StateTagCliOptions = {
    dryRun: false,
    all: false,
    force: false,
    quiet: false,
    allVotes: false,
  };

  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--all") opts.all = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a === "--all-votes") opts.allVotes = true;
    else if (a.startsWith("--limit=")) opts.limit = Number(a.split("=")[1]);
    else if (a.startsWith("--state=")) opts.state = a.split("=")[1]?.toUpperCase();
    else if (a.startsWith("--session=")) opts.session = a.split("=")[1];
  }

  return opts;
}

export function parseStateOllamaArgs(argv: string[]): StateOllamaCliOptions {
  const opts: StateOllamaCliOptions = {
    ...parseStateTagArgs(argv),
    delayMs: 250,
  };

  for (const a of argv) {
    if (a.startsWith("--delay-ms=")) opts.delayMs = Number(a.split("=")[1]);
    else if (a.startsWith("--model=")) opts.model = a.split("=")[1];
  }

  return opts;
}

export function printStateTagHelp(): void {
  console.log(`Usage: npm run tag -- [options]

Options:
  --dry-run           Preview tags without writing
  --quiet             One-line dry-run summary only
  --limit=N           Cap bills processed
  --all               All untagged bills (not just vote-linked)
  --force             Re-tag even if issue_slugs already set
  --state=FL          Filter by state
  --session=2026      Filter by session identifier
  --all-votes         Include bills linked only to committee/procedural votes
                      (default: scoring-relevant votes only)
`);
}
