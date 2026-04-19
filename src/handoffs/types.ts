export const HANDOFF_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_AUTO_SESSIONS = 4;
export const MAX_CONFLICT_FILES = 20;
export const DEFAULT_BACKFILL_COUNT = 20;
export const DEFAULT_AUTO_BACKFILL_INTERVAL_MS = 10 * 60 * 1000;

export type HandoffStatus = "draft" | "finalized";
export type FeatureStatus = "done" | "partial" | "planned";
export type ContextIntent = "resume" | "merge" | "debug";
export type ContextMode = "auto" | "ids";

export interface SessionFeature {
  name: string;
  why: string;
  status: FeatureStatus;
  files: string[];
}

export interface SessionDecision {
  decision: string;
  why: string;
  files: string[];
}

export interface SessionToolUsage {
  name: string;
  count: number;
}

export interface SessionFileTouch {
  path: string;
  count: number;
}

export interface SessionRecord {
  schemaVersion: number;
  sessionId: string;
  projectRoot: string;
  branch: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  source: "opencode-local";
  status: HandoffStatus;
  parentSessionIds: string[];
  shareUrl: string | null;
  summary: string;
  goal?: string;
  changesMade?: string[];
  features: SessionFeature[];
  decisions: SessionDecision[];
  blockers: string[];
  openQuestions: string[];
  testsRun: string[];
  toolsUsed: SessionToolUsage[];
  filesTouched: SessionFileTouch[];
  resumePrompt: string;
}

export interface StructuredHandoffPayload {
  summary?: string;
  goal?: string;
  changesMade?: string[];
  features?: SessionFeature[];
  decisions?: SessionDecision[];
  blockers?: string[];
  openQuestions?: string[];
  testsRun?: string[];
  resumePrompt?: string;
}

export interface HandoffIndexSession {
  sessionId: string;
  title: string;
  branch: string | null;
  updatedAt: string;
  status: HandoffStatus;
  filesTouched: SessionFileTouch[];
  keywords: string[];
}

export interface HandoffIndex {
  schemaVersion: number;
  projectRoot: string;
  updatedAt: string;
  sessions: Record<string, HandoffIndexSession>;
  files: Record<string, string[]>;
}

export interface SelectedSession {
  sessionId: string;
  title: string;
  score: number;
  reasonSelected: string[];
}

export interface ConflictEntry {
  path: string;
  sessions: string[];
  reason: string;
  labels: string[];
  suggestedTests: string[];
}

export interface GetContextArgs {
  mode: ContextMode;
  sessionIds?: string[];
  intent?: ContextIntent;
  includeCurrentSession?: boolean;
  maxSessions?: number;
  fileHints?: string[];
  query?: string;
}

export interface GetContextResult {
  selectedSessions: SelectedSession[];
  mergedContextPath: string;
  summary: string;
  topFiles: SessionFileTouch[];
  conflicts: ConflictEntry[];
  resumePrompt: string;
  warnings: string[];
}

export interface PrefetchShortlist {
  schemaVersion: number;
  sessionId: string;
  createdAt: string;
  candidates: SelectedSession[];
}

export interface CurrentContext {
  sessionId?: string;
  branch: string | null;
  dirtyFiles: string[];
  fileHints: string[];
  query?: string;
}

export interface BackfillResult {
  importedSessionIds: string[];
  skippedSessionIds: string[];
  warnings: string[];
}

export interface SessionInfoLike {
  id: string;
  directory?: string;
  parentID?: string;
  share?: {
    url?: string;
  };
  title?: string;
  time?: {
    created?: number;
    updated?: number;
  };
}
