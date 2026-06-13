import fs from "node:fs/promises";
import path from "node:path";
import type { LegislativeSession } from "./openstates-client.js";
import {
  fetchStatePeople,
  pickSessionCsvDownload,
} from "./openstates-client.js";
import { jurisdictionId, peopleJsonPath, sessionArchivePath } from "./paths.js";

function apiKey(): string {
  const key =
    process.env.OPENSTATES_PLURAL_API_KEY?.trim() ||
    process.env.OPENSTATES_API_KEY?.trim();
  if (!key) throw new Error("Missing Open States API key");
  return key;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(url: string, destPath: string, force: boolean): Promise<"skipped" | "downloaded"> {
  if (!force && (await fileExists(destPath))) {
    return "skipped";
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });

  const res = await fetch(url, {
    headers: { "X-API-KEY": apiKey() },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Download failed ${res.status} ${url}\n${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return "downloaded";
}

export async function downloadPeopleJson(
  dataRoot: string,
  stateAbbr: string,
  opts: { dryRun: boolean; force: boolean },
): Promise<void> {
  const dest = peopleJsonPath(dataRoot, stateAbbr);
  const jid = jurisdictionId(stateAbbr);

  if (opts.dryRun) {
    console.log(`  [dry-run] people → ${dest}`);
    console.log(`            API GET /people?jurisdiction=${jid}`);
    return;
  }

  if (!opts.force && (await fileExists(dest))) {
    console.log(`  people/current.json: skipped → ${dest}`);
    return;
  }

  const people = await fetchStatePeople(jid);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(
    dest,
    JSON.stringify(
      {
        state: stateAbbr,
        jurisdiction_id: jid,
        fetched_at: new Date().toISOString(),
        count: people.length,
        people,
      },
      null,
      2,
    ),
  );
  console.log(`  people/current.json: downloaded ${people.length} legislators → ${dest}`);
}

export async function downloadSessionArchive(
  dataRoot: string,
  stateAbbr: string,
  session: LegislativeSession,
  opts: { dryRun: boolean; force: boolean },
): Promise<void> {
  const url = pickSessionCsvDownload(session);
  if (!url) {
    console.warn(`  session ${session.identifier}: no CSV download URL — skipping`);
    return;
  }

  const dest = sessionArchivePath(dataRoot, stateAbbr, session.identifier, url);
  const metaPath = path.join(path.dirname(dest), "manifest.json");
  const manifest = {
    state: stateAbbr,
    session_identifier: session.identifier,
    session_name: session.name,
    download_url: url,
    downloaded_at: new Date().toISOString(),
  };

  if (opts.dryRun) {
    console.log(`  [dry-run] ${session.identifier} (${session.name})`);
    console.log(`            → ${dest}`);
    console.log(`            ${url}`);
    return;
  }

  const result = await downloadToFile(url, dest, opts.force);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(manifest, null, 2));
  console.log(`  ${session.identifier} (${session.name}): ${result}`);
}
