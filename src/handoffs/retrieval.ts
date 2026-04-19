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
  semanticScore: number;
}

function isInternalHandoffPath(filePath: string): boolean {
  const normalized = cleanText(filePath);
  return (
    normalized.startsWith(".handoffs/") ||
    normalized.startsWith(".opencode/") ||
    normalized.startsWith("*** Begin Patch") ||
    normalized === "." ||
    normalized.includes("/shortlist-") ||
    normalized.includes("/context-")
  );
}

const QUERY_STOP_WORDS = new Set([
  "a",
  "all",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "check",
  "do",
  "find",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "session",
  "sessions",
  "tell",
  "the",
  "to",
  "was",
  "what",
  "whats",
  "who",
  "with",
]);

function meaningfulQueryTokens(query: string | undefined): string[] {
  return uniq(
    tokenize(query ?? "").filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token))
  );
}

function buildRecordSearchText(record: SessionRecord): {
  titleText: string;
  summaryText: string;
  rationaleText: string;
  wholeText: string;
} {
  const titleText = cleanText(record.title).toLowerCase();
  const summaryText = cleanText(
    [
      record.summary,
      record.goal ?? "",
      ...(record.changesMade ?? []),
      ...record.blockers,
      ...record.openQuestions,
      ...record.testsRun,
      record.resumePrompt,
    ].join(" ")
  ).toLowerCase();
  const rationaleText = cleanText(
    [
      record.branch ?? "",
      ...record.features.flatMap((feature) => [feature.name, feature.why]),
      ...record.decisions.flatMap((decision) => [decision.decision, decision.why]),
    ].join(" ")
  ).toLowerCase();
  const wholeText = cleanText([titleText, summaryText, rationaleText].join(" ")).toLowerCase();
  return { titleText, summaryText, rationaleText, wholeText };
}

function scoreQueryMatch(record: SessionRecord, query: string | undefined): { score: number; reasons: string[] } {
  const queryTokens = meaningfulQueryTokens(query);
  if (queryTokens.length === 0) {
    return { score: 0, reasons: [] };
  }

  const search = buildRecordSearchText(record);
  const titleTokens = new Set(tokenize(search.titleText));
  const summaryTokens = new Set(tokenize(search.summaryText));
  const rationaleTokens = new Set(tokenize(search.rationaleText));
  const matchedTitleTokens = queryTokens.filter((token) => titleTokens.has(token));
  const matchedSummaryTokens = queryTokens.filter((token) => summaryTokens.has(token));
  const matchedRationaleTokens = queryTokens.filter((token) => rationaleTokens.has(token));
  const matchedTokens = uniq([
    ...matchedTitleTokens,
    ...matchedSummaryTokens,
    ...matchedRationaleTokens,
  ]);

  let score = 0;
  const reasons: string[] = [];
  if (matchedTitleTokens.length > 0) {
    score += matchedTitleTokens.length * 8;
    reasons.push("query title match");
  }
  if (matchedSummaryTokens.length > 0) {
    score += matchedSummaryTokens.length * 5;
    reasons.push("query summary match");
  }
  if (matchedRationaleTokens.length > 0) {
    score += matchedRationaleTokens.length * 3;
    reasons.push("query rationale match");
  }
  if (matchedTokens.length === queryTokens.length) {
    score += queryTokens.length > 1 ? 6 : 4;
    reasons.push("query intent match");
  }

  return { score, reasons };
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

function aggregateRelevantFiles(records: SessionRecord[]): SessionFileTouch[] {
  const touchCounts = mapTouchCounts(records);
  const rationaleFiles = uniq(
    records.flatMap((record) => [
      ...record.features.flatMap((feature) => feature.files),
      ...record.decisions.flatMap((decision) => decision.files),
    ])
  ).filter((file) => !isInternalHandoffPath(file));

  const touchedProjectFiles = aggregateTopFiles(records).filter((file) => !isInternalHandoffPath(file.path));

  const deduped = new Map<string, SessionFileTouch>();
  for (const file of rationaleFiles) {
    deduped.set(file, {
      path: file,
      count: touchCounts.get(file) ?? 0,
    });
  }
  for (const file of touchedProjectFiles) {
    if (!deduped.has(file.path)) {
      deduped.set(file.path, file);
    }
  }

  const relevant = Array.from(deduped.values()).slice(0, 10);
  return relevant.length > 0 ? relevant : aggregateTopFiles(records).slice(0, 10);
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

  const queryMatch = scoreQueryMatch(record, context.query);
  score += queryMatch.score;
  reasons.push(...queryMatch.reasons);

  if (shortlist?.candidates.some((candidate) => candidate.sessionId === record.sessionId)) {
    score += 1;
    reasons.push("prefetch shortlist");
  }

  return {
    record,
    score,
    reasons: uniq(reasons),
    exactOverlap,
    semanticScore: queryMatch.score,
  };
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
  const queryTokens = meaningfulQueryTokens(context.query);
  const candidates = records
    .filter((record) => record.sessionId !== currentSessionId)
    .map((record) => scoreRecord(record, context, shortlist))
    .filter((candidate) => candidate.score > 0);

  const queryMatchedCandidates =
    queryTokens.length > 0 ? candidates.filter((candidate) => candidate.semanticScore > 0) : [];
  const rankedCandidates = queryMatchedCandidates.length > 0 ? queryMatchedCandidates : candidates;

  return rankedCandidates
    .sort((left, right) => {
      if (queryMatchedCandidates.length > 0 && right.semanticScore !== left.semanticScore) {
        return right.semanticScore - left.semanticScore;
      }
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

function buildQuestionSummary(
  records: SessionRecord[],
  query: string | undefined,
  relevantFiles: SessionFileTouch[]
): string {
  if (records.length === 0) {
    return "No matching session handoffs found.";
  }

  const primary = records[0];
  const normalizedQuery = cleanText(query).toLowerCase();

  if (normalizedQuery.includes("name")) {
    const text = cleanText(
      [
        primary.title,
        primary.summary,
        primary.goal ?? "",
        ...(primary.changesMade ?? []),
        ...primary.features.flatMap((feature) => [feature.name, feature.why]),
        ...primary.decisions.flatMap((decision) => [decision.decision, decision.why]),
        primary.resumePrompt,
      ].join(" ")
    );
    const explicitName = text.match(/\bmy name is ([a-z][a-z0-9_-]*)\b/i);
    if (explicitName?.[1]) {
      return `The stored session context says the name is ${explicitName[1]}.`;
    }
    const fromName = text.match(/\bfrom ([A-Z][a-zA-Z0-9_-]*)\b/);
    if (fromName?.[1]) {
      return `The stored session context points to the name ${fromName[1]}.`;
    }
  }

  if (normalizedQuery.includes("file") && normalizedQuery.includes("touch")) {
    if (relevantFiles.length > 0) {
      return `The relevant touched files were ${relevantFiles.map((file) => file.path).join(", ")}.`;
    }
    return "No touched files were recorded for the selected sessions.";
  }

  if (cleanText(primary.summary)) {
    return cleanText(primary.summary);
  }

  if (relevantFiles.length > 0) {
    return `Relevant files from the selected sessions: ${relevantFiles.map((file) => file.path).join(", ")}.`;
  }

  return "Context loaded, but no concise narrative was recorded.";
}

export async function buildContextResult(input: {
  paths: HandoffPaths;
  selectedSessions: SelectedSession[];
  records: SessionRecord[];
  currentContext: CurrentContext;
  warnings: string[];
  query?: string;
}): Promise<GetContextResult> {
  const topFiles = aggregateTopFiles(input.records);
  const relevantFiles = aggregateRelevantFiles(input.records);
  const conflicts = detectConflicts(input.records);
  const resumePrompt = chooseResumePrompt(input.records);
  const questionSummary = buildQuestionSummary(input.records, input.query ?? input.currentContext.query, relevantFiles);
  const markdown = renderMergedContextMarkdown({
    selectedSessions: input.selectedSessions,
    currentSessionId: input.currentContext.sessionId,
    branch: input.currentContext.branch,
    dirtyFiles: input.currentContext.dirtyFiles,
    features: aggregateFeatures(input.records),
    decisions: aggregateDecisions(input.records),
    relevantFiles: relevantFiles.map((file) => ({ path: file.path, count: file.count })),
    topFiles: topFiles.map((file) => ({ path: file.path, count: file.count })),
    conflicts,
    tests: aggregateTests(input.records),
    openQuestions: aggregateOpenQuestions(input.records),
    resumePrompt,
    questionSummary,
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
    relevantFiles,
    questionSummary,
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
    query: input.args.query,
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
