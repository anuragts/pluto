import fs from "node:fs/promises";
import path from "node:path";
import type {
  ConflictEntry,
  CurrentContext,
  GetContextArgs,
  GetContextResult,
  HandoffIndex,
  PrefetchShortlist,
  SelectedSession,
  SessionDecision,
  SessionFeature,
  SessionFileTouch,
  SessionRecord,
} from "./types.js";
import { DEFAULT_MAX_AUTO_SESSIONS, MAX_CONFLICT_FILES } from "./types.js";
import { renderMergedContextMarkdown } from "./markdown.js";
import { saveMaterializedContext } from "./storage.js";
import type { HandoffPaths } from "./storage.js";
import { cleanText, shortHash, sortByCountDescending, tokenize, topLevelDirectory, uniq } from "./utils.js";

interface CandidateScore {
  record: SessionRecord;
  score: number;
  reasons: string[];
  exactOverlap: number;
}

function mapTouchCounts(records: SessionRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const file of record.filesTouched) {
      counts.set(file.path, (counts.get(file.path) ?? 0) + file.count);
    }
  }
  return counts;
}

function aggregateTopFiles(records: SessionRecord[]): SessionFileTouch[] {
  return sortByCountDescending(
    Array.from(mapTouchCounts(records), ([file, count]) => ({
      path: file,
      count,
    }))
  ).slice(0, 10);
}

function aggregateFeatures(records: SessionRecord[]): Array<{ from: string; feature: SessionFeature }> {
  return records.flatMap((record) => record.features.map((feature) => ({ from: record.sessionId, feature })));
}

function aggregateDecisions(records: SessionRecord[]): Array<{ from: string; decision: SessionDecision }> {
  return records.flatMap((record) => record.decisions.map((decision) => ({ from: record.sessionId, decision })));
}

function aggregateTests(records: SessionRecord[]): string[] {
  return uniq(records.flatMap((record) => record.testsRun.filter(Boolean))).sort();
}

function aggregateOpenQuestions(records: SessionRecord[]): string[] {
  return uniq(records.flatMap((record) => record.openQuestions.filter(Boolean))).sort();
}

function chooseResumePrompt(records: SessionRecord[]): string {
  for (const record of records) {
    if (cleanText(record.resumePrompt)) {
      return cleanText(record.resumePrompt);
    }
  }

  for (const record of records) {
    if (cleanText(record.summary)) {
      return cleanText(record.summary);
    }
  }

  return "No recorded resume prompt yet.";
}

export function detectConflicts(records: SessionRecord[]): ConflictEntry[] {
  const byFile = new Map<
    string,
    Array<{
      sessionId: string;
      label: string;
      why: string;
      tests: string[];
    }>
  >();

  for (const record of records) {
    for (const feature of record.features) {
      for (const file of feature.files) {
        const existing = byFile.get(file) ?? [];
        existing.push({
          sessionId: record.sessionId,
          label: feature.name,
          why: feature.why,
          tests: record.testsRun,
        });
        byFile.set(file, existing);
      }
    }

    for (const decision of record.decisions) {
      for (const file of decision.files) {
        const existing = byFile.get(file) ?? [];
        existing.push({
          sessionId: record.sessionId,
          label: decision.decision,
          why: decision.why,
          tests: record.testsRun,
        });
        byFile.set(file, existing);
      }
    }
  }

  const conflicts: ConflictEntry[] = [];

  for (const [file, entries] of byFile.entries()) {
    const rationaleValues = uniq(entries.map((entry) => cleanText(`${entry.label} ${entry.why}`)).filter(Boolean));
    if (entries.length >= 2 && rationaleValues.length > 1) {
      conflicts.push({
        path: file,
        sessions: uniq(entries.map((entry) => entry.sessionId)).sort(),
        reason: "same file touched with different rationale entries",
        labels: uniq(entries.map((entry) => entry.label).filter(Boolean)),
        suggestedTests: uniq(entries.flatMap((entry) => entry.tests)).sort(),
      });
    }
  }

  const touchCounts = mapTouchCounts(records);
  return conflicts
    .sort((left, right) => (touchCounts.get(right.path) ?? 0) - (touchCounts.get(left.path) ?? 0))
    .slice(0, MAX_CONFLICT_FILES);
}

function scoreRecord(
  record: SessionRecord,
  context: CurrentContext,
  shortlist: PrefetchShortlist | null
): CandidateScore {
  let score = 0;
  let exactOverlap = 0;
  const reasons: string[] = [];
  const recordFiles = new Set(record.filesTouched.map((file) => file.path));
  const exactMatches = uniq(
    [...context.dirtyFiles, ...context.fileHints].filter((file) => recordFiles.has(file))
  );
  exactOverlap = exactMatches.length;

  if (exactMatches.length > 0) {
    score += exactMatches.length * 5;
    reasons.push("file overlap");
  }

  const contextDirectories = uniq(
    [...context.dirtyFiles, ...context.fileHints].map((file) => topLevelDirectory(file)).filter(Boolean)
  );
  const recordDirectories = uniq(record.filesTouched.map((file) => topLevelDirectory(file.path)).filter(Boolean));
  const overlappingDirectories = contextDirectories.filter((directory) => recordDirectories.includes(directory));
  if (overlappingDirectories.length > 0) {
    score += overlappingDirectories.length * 2;
    reasons.push("directory overlap");
  }

  if (context.branch && record.branch && context.branch === record.branch) {
    score += 4;
    reasons.push("branch match");
  }

  const recordUpdated = new Date(record.updatedAt).getTime();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (recordUpdated >= sevenDaysAgo) {
    score += 2;
    reasons.push("recent");
  }

  if (record.status === "finalized") {
    score += 2;
    reasons.push("finalized");
  }

  const queryTokens = uniq(tokenize(context.query ?? ""));
  if (queryTokens.length > 0) {
    const haystack = new Set(
      tokenize([
        record.title,
        record.summary,
        ...record.features.flatMap((feature) => [feature.name, feature.why]),
        ...record.decisions.flatMap((decision) => [decision.decision, decision.why]),
      ].join(" "))
    );

    if (queryTokens.some((token) => haystack.has(token))) {
      score += 2;
      reasons.push("query match");
    }
  }

  if (shortlist?.candidates.some((candidate) => candidate.sessionId === record.sessionId)) {
    score += 1;
    reasons.push("prefetch shortlist");
  }

  return { record, score, reasons: uniq(reasons), exactOverlap };
}

export function buildPrefetchShortlist(
  index: HandoffIndex,
  currentSessionId: string,
  context: CurrentContext,
  records: SessionRecord[]
): PrefetchShortlist {
  const shortlist = records
    .filter((record) => record.sessionId !== currentSessionId)
    .map((record) => scoreRecord(record, context, null))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.exactOverlap !== left.exactOverlap) {
        return right.exactOverlap - left.exactOverlap;
      }
      if (left.record.status !== right.record.status) {
        return left.record.status === "finalized" ? -1 : 1;
      }
      return right.record.updatedAt.localeCompare(left.record.updatedAt);
    })
    .slice(0, 8)
    .map<SelectedSession>((candidate) => ({
      sessionId: candidate.record.sessionId,
      title: candidate.record.title,
      score: candidate.score,
      reasonSelected: candidate.reasons,
    }));

  return {
    schemaVersion: index.schemaVersion,
    sessionId: currentSessionId,
    createdAt: new Date().toISOString(),
    candidates: shortlist,
  };
}

function selectAutoRecords(
  records: SessionRecord[],
  context: CurrentContext,
  shortlist: PrefetchShortlist | null,
  maxSessions: number,
  currentSessionId?: string
): SelectedSession[] {
  return records
    .filter((record) => record.sessionId !== currentSessionId)
    .map((record) => scoreRecord(record, context, shortlist))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.exactOverlap !== left.exactOverlap) {
        return right.exactOverlap - left.exactOverlap;
      }
      if (left.record.status !== right.record.status) {
        return left.record.status === "finalized" ? -1 : 1;
      }
      return right.record.updatedAt.localeCompare(left.record.updatedAt);
    })
    .slice(0, maxSessions)
    .map((candidate) => ({
      sessionId: candidate.record.sessionId,
      title: candidate.record.title,
      score: candidate.score,
      reasonSelected: candidate.reasons,
    }));
}

function buildSummary(records: SessionRecord[], conflicts: ConflictEntry[]): string {
  if (records.length === 0) {
    return "No handoff data available yet.";
  }

  const featureNames = uniq(records.flatMap((record) => record.features.map((feature) => feature.name))).slice(0, 4);
  const parts = [`Merged ${records.length} session${records.length === 1 ? "" : "s"}`];
  if (featureNames.length > 0) {
    parts.push(`features: ${featureNames.join(", ")}`);
  }
  if (conflicts.length > 0) {
    parts.push(`conflicts: ${conflicts.length}`);
  }
  return parts.join(" | ");
}

export async function buildContextResult(input: {
  paths: HandoffPaths;
  selectedSessions: SelectedSession[];
  records: SessionRecord[];
  currentContext: CurrentContext;
  warnings: string[];
}): Promise<GetContextResult> {
  const topFiles = aggregateTopFiles(input.records);
  const conflicts = detectConflicts(input.records);
  const resumePrompt = chooseResumePrompt(input.records);
  const markdown = renderMergedContextMarkdown({
    selectedSessions: input.selectedSessions,
    currentSessionId: input.currentContext.sessionId,
    branch: input.currentContext.branch,
    dirtyFiles: input.currentContext.dirtyFiles,
    features: aggregateFeatures(input.records),
    decisions: aggregateDecisions(input.records),
    topFiles: topFiles.map((file) => ({ path: file.path, count: file.count })),
    conflicts,
    tests: aggregateTests(input.records),
    openQuestions: aggregateOpenQuestions(input.records),
    resumePrompt,
  });

  const hash = shortHash(
    JSON.stringify({
      sessions: input.selectedSessions.map((session) => session.sessionId),
      branch: input.currentContext.branch,
      dirtyFiles: input.currentContext.dirtyFiles,
      warnings: input.warnings,
    })
  );
  const fileName = `context-${hash}.md`;
  const mergedContextPath = await saveMaterializedContext(input.paths, fileName, markdown);
  return {
    selectedSessions: input.selectedSessions,
    mergedContextPath: path.relative(input.paths.root, mergedContextPath).split(path.sep).join("/"),
    summary: buildSummary(input.records, conflicts),
    topFiles,
    conflicts,
    resumePrompt,
    warnings: input.warnings,
  };
}

export async function resolveContext(input: {
  paths: HandoffPaths;
  records: SessionRecord[];
  shortlist: PrefetchShortlist | null;
  args: GetContextArgs;
  currentContext: CurrentContext;
  currentDraft?: SessionRecord | null;
}): Promise<GetContextResult> {
  const warnings: string[] = [];
  const includeCurrentSession = input.args.includeCurrentSession ?? true;
  const maxSessions = input.args.maxSessions ?? DEFAULT_MAX_AUTO_SESSIONS;
  const selected: SelectedSession[] = [];
  const selectedRecords: SessionRecord[] = [];
  const recordsById = new Map(input.records.map((record) => [record.sessionId, record]));

  if (input.args.mode === "ids") {
    for (const sessionId of input.args.sessionIds ?? []) {
      const record = recordsById.get(sessionId);
      if (!record) {
        warnings.push(`Unknown session ID: ${sessionId}`);
        continue;
      }

      selected.push({
        sessionId: record.sessionId,
        title: record.title,
        score: 0,
        reasonSelected: ["explicit selection"],
      });
      selectedRecords.push(record);
    }
  } else {
    const matches = selectAutoRecords(
      input.records,
      {
        ...input.currentContext,
        query: input.args.query ?? input.currentContext.query,
        fileHints: uniq([...input.currentContext.fileHints, ...(input.args.fileHints ?? [])]),
      },
      input.shortlist,
      maxSessions,
      input.currentContext.sessionId
    );

    for (const match of matches) {
      const record = recordsById.get(match.sessionId);
      if (!record) {
        continue;
      }
      selected.push(match);
      selectedRecords.push(record);
    }
  }

  if (includeCurrentSession && input.currentDraft) {
    const exists = selected.some((session) => session.sessionId === input.currentDraft?.sessionId);
    if (!exists) {
      selected.push({
        sessionId: input.currentDraft.sessionId,
        title: input.currentDraft.title,
        score: 0,
        reasonSelected: ["current session"],
      });
      selectedRecords.push(input.currentDraft);
    }
  }

  if (selectedRecords.length === 0) {
    warnings.push("No matching session handoffs found.");
  }

  return buildContextResult({
    paths: input.paths,
    selectedSessions: selected,
    records: selectedRecords,
    currentContext: input.currentContext,
    warnings,
  });
}

export async function readDirtyFiles(projectRoot: string): Promise<string[]> {
  const candidates = [".git"];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      break;
    } catch {
      return [];
    }
  }

  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: projectRoot },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const files = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.slice(3).trim())
          .filter(Boolean);
        resolve(uniq(files));
      }
    );
  });
}
