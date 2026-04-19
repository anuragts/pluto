import type { BackfillResult, SessionFeature, SessionInfoLike, SessionRecord, StructuredHandoffPayload } from "./types.js";
import { HANDOFF_SCHEMA_VERSION } from "./types.js";
import { extractHandoffPayload, stripHandoffBlock } from "./compaction.js";
import { saveSessionRecord } from "./storage.js";
import type { HandoffPaths } from "./storage.js";
import { cleanText, normalizeRepoPath, toIsoString, uniq } from "./utils.js";

export interface CommandRunner {
  run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

function walk(value: unknown, visit: (node: unknown) => void): void {
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      walk(child, visit);
    }
  }
}

function collectTextParts(exportPayload: unknown): string[] {
  const texts: string[] = [];
  walk(exportPayload, (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const candidate = node as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") {
      texts.push(candidate.text);
    }
  });
  return texts;
}

function collectDiffFiles(exportPayload: unknown, projectRoot: string): string[] {
  const files: string[] = [];
  walk(exportPayload, (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const candidate = node as { file?: unknown; path?: unknown; additions?: unknown; deletions?: unknown };
    if (typeof candidate.file === "string") {
      files.push(normalizeRepoPath(projectRoot, candidate.file));
    } else if (
      typeof candidate.path === "string" &&
      (typeof candidate.additions === "number" || typeof candidate.deletions === "number")
    ) {
      files.push(normalizeRepoPath(projectRoot, candidate.path));
    }
  });
  return files;
}

function findSessionInfo(exportPayload: unknown): SessionInfoLike | null {
  let found: SessionInfoLike | null = null;
  walk(exportPayload, (node) => {
    if (found || !node || typeof node !== "object") {
      return;
    }
    const candidate = node as SessionInfoLike;
    if (typeof candidate.id === "string" && (typeof candidate.title === "string" || candidate.time)) {
      found = candidate;
    }
  });
  return found;
}

function summarizeFeatures(payload: StructuredHandoffPayload): string[] {
  return (payload.features ?? []).map((feature) => feature.name).filter(Boolean);
}

function createRecordFromExport(input: {
  projectRoot: string;
  sessionId: string;
  branch: string | null;
  payload: unknown;
}): SessionRecord {
  const sessionInfo = findSessionInfo(input.payload);
  const texts = collectTextParts(input.payload);
  const diffFiles = collectDiffFiles(input.payload, input.projectRoot);
  const structured = texts.map((text) => extractHandoffPayload(text)).find(Boolean) ?? null;
  const bestText = texts.find((text) => cleanText(text)) ?? "";
  const summary =
    structured?.summary ?? (stripHandoffBlock(bestText) || "Imported from OpenCode export.");
  const derivedTitle = summarizeFeatures(structured ?? {}).join(", ");

  const featureFiles = uniq((structured?.features ?? []).flatMap((feature) => feature.files));
  const decisionFiles = uniq((structured?.decisions ?? []).flatMap((decision) => decision.files));
  const filesTouched = uniq([...diffFiles, ...featureFiles, ...decisionFiles]).map((file) => ({
    path: file,
    count: 1,
  }));

  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    sessionId: sessionInfo?.id ?? input.sessionId,
    projectRoot: input.projectRoot,
    branch: input.branch,
    title: sessionInfo?.title ?? (derivedTitle || `Imported session ${input.sessionId}`),
    createdAt: toIsoString(sessionInfo?.time?.created),
    updatedAt: toIsoString(sessionInfo?.time?.updated),
    source: "opencode-local",
    status: structured ? "finalized" : "draft",
    parentSessionIds: sessionInfo?.parentID ? [sessionInfo.parentID] : [],
    shareUrl: sessionInfo?.share?.url ?? null,
    summary,
    goal: structured?.goal,
    changesMade: structured?.changesMade ?? summarizeFeatures(structured ?? {}),
    features: normalizeFeatures(structured?.features ?? []),
    decisions: normalizeDecisions(structured?.decisions ?? []),
    blockers: structured?.blockers ?? [],
    openQuestions: structured?.openQuestions ?? [],
    testsRun: structured?.testsRun ?? [],
    toolsUsed: [],
    filesTouched,
    resumePrompt: structured?.resumePrompt ?? summary,
  };
}

function normalizeFeatures(features: StructuredHandoffPayload["features"]): SessionFeature[] {
  return (features ?? []).map((feature) => ({
    name: cleanText(feature.name) || "Unnamed feature",
    why: cleanText(feature.why),
    status: feature.status ?? "done",
    files: uniq(feature.files.map((file) => cleanText(file)).filter(Boolean)),
  }));
}

function normalizeDecisions(decisions: StructuredHandoffPayload["decisions"]): SessionRecord["decisions"] {
  return (decisions ?? []).map((decision) => ({
    decision: cleanText(decision.decision) || "Unnamed decision",
    why: cleanText(decision.why),
    files: uniq(decision.files.map((file) => cleanText(file)).filter(Boolean)),
  }));
}

function findProjectRootListEntry(sessionListPayload: unknown, projectRoot: string): Array<{ id: string }> {
  if (!Array.isArray(sessionListPayload)) {
    return [];
  }

  return sessionListPayload
    .filter((entry): entry is { id: string; directory?: string } => !!entry && typeof entry === "object" && "id" in entry)
    .filter((entry) => !entry.directory || entry.directory === projectRoot);
}

export async function runBackfill(input: {
  paths: HandoffPaths;
  projectRoot: string;
  branch: string | null;
  count: number;
  runner: CommandRunner;
}): Promise<BackfillResult> {
  const result: BackfillResult = {
    importedSessionIds: [],
    skippedSessionIds: [],
    warnings: [],
  };

  const sessionsResponse = await input.runner.run("opencode", ["session", "list", "--format", "json"], input.projectRoot);
  if (sessionsResponse.exitCode !== 0) {
    result.warnings.push(cleanText(sessionsResponse.stderr) || "Failed to list OpenCode sessions.");
    return result;
  }

  let parsedSessions: unknown;
  try {
    parsedSessions = JSON.parse(sessionsResponse.stdout);
  } catch {
    result.warnings.push("Could not parse OpenCode session list JSON.");
    return result;
  }

  const sessions = findProjectRootListEntry(parsedSessions, input.projectRoot).slice(0, input.count);
  for (const session of sessions) {
    const exportResponse = await input.runner.run("opencode", ["export", session.id], input.projectRoot);
    if (exportResponse.exitCode !== 0) {
      result.skippedSessionIds.push(session.id);
      result.warnings.push(`Failed to export session ${session.id}: ${cleanText(exportResponse.stderr)}`);
      continue;
    }

    let exportPayload: unknown;
    try {
      exportPayload = JSON.parse(exportResponse.stdout);
    } catch {
      result.skippedSessionIds.push(session.id);
      result.warnings.push(`Could not parse exported session ${session.id}.`);
      continue;
    }

    const record = createRecordFromExport({
      projectRoot: input.projectRoot,
      sessionId: session.id,
      branch: input.branch,
      payload: exportPayload,
    });
    await saveSessionRecord(input.paths, record);
    result.importedSessionIds.push(record.sessionId);
  }

  return result;
}
