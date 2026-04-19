import fs from "node:fs/promises";
import path from "node:path";
import { renderPatchMarkdown } from "./markdown.js";
import type { HandoffIndex, HandoffIndexSession, PrefetchShortlist, SessionRecord } from "./types.js";
import { HANDOFF_SCHEMA_VERSION } from "./types.js";
import { cleanText, normalizeRepoPath, sortByCountDescending, tokenize, uniq } from "./utils.js";

export interface HandoffPaths {
  root: string;
  handoffsDir: string;
  sessionsDir: string;
  patchesDir: string;
  materializedDir: string;
  cacheDir: string;
  indexFile: string;
}

export function createHandoffPaths(projectRoot: string): HandoffPaths {
  const handoffsDir = path.join(projectRoot, ".handoffs");
  return {
    root: projectRoot,
    handoffsDir,
    sessionsDir: path.join(handoffsDir, "sessions"),
    patchesDir: path.join(handoffsDir, "patches"),
    materializedDir: path.join(handoffsDir, "materialized"),
    cacheDir: path.join(handoffsDir, "cache"),
    indexFile: path.join(handoffsDir, "index.json"),
  };
}

export async function ensureHandoffLayout(paths: HandoffPaths): Promise<void> {
  await Promise.all([
    fs.mkdir(paths.sessionsDir, { recursive: true }),
    fs.mkdir(paths.patchesDir, { recursive: true }),
    fs.mkdir(paths.materializedDir, { recursive: true }),
    fs.mkdir(paths.cacheDir, { recursive: true }),
  ]);

  try {
    await fs.access(paths.indexFile);
  } catch {
    await saveIndex(paths, {
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projectRoot: paths.root,
      updatedAt: new Date().toISOString(),
      sessions: {},
      files: {},
    });
  }
}

export async function loadIndex(paths: HandoffPaths): Promise<HandoffIndex> {
  try {
    const raw = await fs.readFile(paths.indexFile, "utf8");
    const parsed = JSON.parse(raw) as HandoffIndex;
    return {
      schemaVersion: parsed.schemaVersion ?? HANDOFF_SCHEMA_VERSION,
      projectRoot: parsed.projectRoot ?? paths.root,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      sessions: parsed.sessions ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return {
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projectRoot: paths.root,
      updatedAt: new Date().toISOString(),
      sessions: {},
      files: {},
    };
  }
}

export async function saveIndex(paths: HandoffPaths, index: HandoffIndex): Promise<void> {
  index.updatedAt = new Date().toISOString();
  await fs.writeFile(paths.indexFile, JSON.stringify(index, null, 2));
}

export function createIndexEntry(record: SessionRecord): HandoffIndexSession {
  const keywords = uniq(
    [
      record.title,
      record.summary,
      record.goal ?? "",
      ...record.features.flatMap((feature) => [feature.name, feature.why]),
      ...record.decisions.flatMap((decision) => [decision.decision, decision.why]),
    ].flatMap((value) => tokenize(value))
  ).sort();

  return {
    sessionId: record.sessionId,
    title: record.title,
    branch: record.branch,
    updatedAt: record.updatedAt,
    status: record.status,
    filesTouched: sortByCountDescending(record.filesTouched),
    keywords,
  };
}

export async function updateIndex(paths: HandoffPaths, record: SessionRecord): Promise<HandoffIndex> {
  const index = await loadIndex(paths);
  index.sessions[record.sessionId] = createIndexEntry(record);

  for (const [file, sessions] of Object.entries(index.files)) {
    index.files[file] = sessions.filter((sessionId) => sessionId !== record.sessionId);
    if (index.files[file].length === 0) {
      delete index.files[file];
    }
  }

  for (const file of record.filesTouched.map((entry) => normalizeRepoPath(paths.root, entry.path))) {
    index.files[file] = uniq([...(index.files[file] ?? []), record.sessionId]).sort();
  }

  await saveIndex(paths, index);
  return index;
}

export function getSessionRecordPath(paths: HandoffPaths, sessionId: string): string {
  return path.join(paths.sessionsDir, `${sessionId}.json`);
}

export function getPatchPath(paths: HandoffPaths, sessionId: string): string {
  return path.join(paths.patchesDir, `${sessionId}.md`);
}

export function getShortlistPath(paths: HandoffPaths, sessionId: string): string {
  return path.join(paths.cacheDir, `shortlist-${sessionId}.json`);
}

export async function saveSessionRecord(paths: HandoffPaths, record: SessionRecord): Promise<void> {
  const sessionPath = getSessionRecordPath(paths, record.sessionId);
  const patchPath = getPatchPath(paths, record.sessionId);
  await fs.writeFile(sessionPath, `${JSON.stringify(record, null, 2)}\n`);
  await fs.writeFile(patchPath, renderPatchMarkdown(record, patchPath));
  await updateIndex(paths, record);
}

export async function loadSessionRecord(paths: HandoffPaths, sessionId: string): Promise<SessionRecord | null> {
  try {
    const raw = await fs.readFile(getSessionRecordPath(paths, sessionId), "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export async function loadAllSessionRecords(paths: HandoffPaths): Promise<SessionRecord[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(paths.sessionsDir);
  } catch {
    return [];
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await fs.readFile(path.join(paths.sessionsDir, file), "utf8")) as SessionRecord)
  );

  return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveShortlist(paths: HandoffPaths, shortlist: PrefetchShortlist): Promise<void> {
  await fs.writeFile(getShortlistPath(paths, shortlist.sessionId), `${JSON.stringify(shortlist, null, 2)}\n`);
}

export async function loadShortlist(paths: HandoffPaths, sessionId: string): Promise<PrefetchShortlist | null> {
  try {
    const raw = await fs.readFile(getShortlistPath(paths, sessionId), "utf8");
    return JSON.parse(raw) as PrefetchShortlist;
  } catch {
    return null;
  }
}

export async function saveMaterializedContext(paths: HandoffPaths, name: string, markdown: string): Promise<string> {
  const filePath = path.join(paths.materializedDir, name);
  await fs.writeFile(filePath, cleanText(markdown) + "\n");
  return filePath;
}
