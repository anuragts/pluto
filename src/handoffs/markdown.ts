import path from "node:path";
import type { ConflictEntry, SelectedSession, SessionDecision, SessionFeature, SessionRecord } from "./types.js";
import { cleanText } from "./utils.js";

function renderFileLinks(projectRoot: string, baseDir: string, files: string[]): string {
  if (files.length === 0) {
    return "_None_";
  }

  return files
    .map((file) => {
      const absolute = path.join(projectRoot, file);
      const relative = path.relative(baseDir, absolute).split(path.sep).join("/");
      return `[${file}](${relative})`;
    })
    .join(", ");
}

function renderFeature(projectRoot: string, baseDir: string, feature: SessionFeature): string {
  return [
    `- Feature: ${feature.name}`,
    `  - Why: ${feature.why || "_Not recorded_"}`,
    `  - Status: ${feature.status}`,
    `  - Files: ${renderFileLinks(projectRoot, baseDir, feature.files)}`,
  ].join("\n");
}

function renderDecision(projectRoot: string, baseDir: string, decision: SessionDecision): string {
  return [
    `- Decision: ${decision.decision}`,
    `  - Why: ${decision.why || "_Not recorded_"}`,
    `  - Files: ${renderFileLinks(projectRoot, baseDir, decision.files)}`,
  ].join("\n");
}

export function renderPatchMarkdown(record: SessionRecord, patchFilePath: string): string {
  const baseDir = path.dirname(patchFilePath);
  const changesMade =
    record.changesMade && record.changesMade.length > 0
      ? record.changesMade.map((change) => `- ${change}`).join("\n")
      : record.features.length > 0
        ? record.features.map((feature) => `- ${feature.name}`).join("\n")
        : "- No explicit change summary recorded";

  const relatedSessions =
    record.parentSessionIds.length > 0
      ? record.parentSessionIds.map((sessionId) => `- ${sessionId}`).join("\n")
      : "- None";

  const topFiles =
    record.filesTouched.length > 0
      ? record.filesTouched
          .slice(0, 10)
          .map((file, index) => `${index + 1}. ${file.path} (${file.count})`)
          .join("\n")
      : "1. None";

  const blockers = record.blockers.length > 0 ? record.blockers.map((item) => `- ${item}`).join("\n") : "- None";
  const questions =
    record.openQuestions.length > 0 ? record.openQuestions.map((item) => `- ${item}`).join("\n") : "- None";
  const tests = record.testsRun.length > 0 ? record.testsRun.map((item) => `- ${item}`).join("\n") : "- None";
  const features =
    record.features.length > 0
      ? record.features.map((feature) => renderFeature(record.projectRoot, baseDir, feature)).join("\n")
      : "- No feature rationale recorded";
  const decisions =
    record.decisions.length > 0
      ? record.decisions.map((decision) => renderDecision(record.projectRoot, baseDir, decision)).join("\n")
      : "- No design decisions recorded";

  return [
    `# Session ${record.sessionId}: ${record.title}`,
    "",
    "## Goal",
    cleanText(record.goal) || record.summary || "_Not recorded_",
    "",
    "## Changes Made",
    changesMade,
    "",
    "## Why These Changes Were Made",
    features,
    "",
    "## Important Decisions",
    decisions,
    "",
    "## Files Touched Most",
    topFiles,
    "",
    "## Tests Run",
    tests,
    "",
    "## Risks / Blockers",
    blockers,
    "",
    "## Open Questions",
    questions,
    "",
    "## Related Sessions",
    relatedSessions,
    "",
    "## Resume Prompt",
    cleanText(record.resumePrompt) || "_Not recorded_",
    "",
  ].join("\n");
}

export function renderMergedContextMarkdown(input: {
  selectedSessions: SelectedSession[];
  currentSessionId?: string;
  branch: string | null;
  dirtyFiles: string[];
  features: Array<{ from: string; feature: SessionFeature }>;
  decisions: Array<{ from: string; decision: SessionDecision }>;
  relevantFiles: Array<{ path: string; count: number }>;
  topFiles: Array<{ path: string; count: number }>;
  conflicts: ConflictEntry[];
  tests: string[];
  openQuestions: string[];
  resumePrompt: string;
  questionSummary: string;
}): string {
  const selected =
    input.selectedSessions.length > 0
      ? input.selectedSessions
          .map(
            (session) =>
              `- ${session.sessionId} - ${session.title} - ${session.reasonSelected.join(", ") || "explicit selection"}`
          )
          .join("\n")
      : "- None";

  const features =
    input.features.length > 0
      ? input.features
          .map(
            ({ from, feature }) =>
              `- ${feature.name}\n  - why: ${feature.why || "_Not recorded_"}\n  - from: ${from}\n  - files: ${
                feature.files.join(", ") || "_None_"
              }`
          )
          .join("\n")
      : "- None";

  const decisions =
    input.decisions.length > 0
      ? input.decisions
          .map(
            ({ from, decision }) =>
              `- ${decision.decision}\n  - why: ${decision.why || "_Not recorded_"}\n  - from: ${from}\n  - files: ${
                decision.files.join(", ") || "_None_"
              }`
          )
          .join("\n")
      : "- None";

  const topFiles =
    input.topFiles.length > 0
      ? input.topFiles.map((file, index) => `${index + 1}. ${file.path} - ${file.count}`).join("\n")
      : "1. None";

  const relevantFiles =
    input.relevantFiles.length > 0
      ? input.relevantFiles.map((file, index) => `${index + 1}. ${file.path} - ${file.count}`).join("\n")
      : "1. None";

  const conflicts =
    input.conflicts.length > 0
      ? input.conflicts
          .map(
            (conflict) =>
              `- ${conflict.path}\n  - sessions: ${conflict.sessions.join(", ")}\n  - differing rationale: ${
                conflict.labels.join(" | ") || conflict.reason
              }`
          )
          .join("\n")
      : "- None";

  const tests = input.tests.length > 0 ? input.tests.map((test) => `- ${test}`).join("\n") : "- None";
  const questions =
    input.openQuestions.length > 0 ? input.openQuestions.map((question) => `- ${question}`).join("\n") : "- None";

  return [
    "# Merged Context",
    "",
    "## Selected Sessions",
    selected,
    "",
    "## Current Task Context",
    `- branch: ${input.branch ?? "unknown"}`,
    `- current session id: ${input.currentSessionId ?? "unknown"}`,
    `- current dirty files: ${input.dirtyFiles.join(", ") || "none"}`,
    "",
    "## Features and Why",
    features,
    "",
    "## Decisions",
    decisions,
    "",
    "## Question Summary",
    cleanText(input.questionSummary) || "_Not recorded_",
    "",
    "## Relevant Files",
    relevantFiles,
    "",
    "## Files Touched Most",
    topFiles,
    "",
    "## Conflict Risks",
    conflicts,
    "",
    "## Tests To Re-run",
    tests,
    "",
    "## Open Questions",
    questions,
    "",
    "## Resume Prompt",
    cleanText(input.resumePrompt) || "_Not recorded_",
    "",
  ].join("\n");
}
