import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Event, Message, Part, Session } from "@opencode-ai/sdk";
import { extractHandoffPayload, stripHandoffBlock, COMPACTION_CONTEXT } from "./compaction.js";
import { runBackfill, type CommandRunner } from "./backfill.js";
import {
  createHandoffPaths,
  ensureHandoffLayout,
  getPatchPath,
  getSessionRecordPath,
  loadAllSessionRecords,
  loadIndex,
  loadSessionRecord,
  loadShortlist,
  saveSessionRecord,
  saveShortlist,
  type HandoffPaths,
} from "./storage.js";
import {
  buildPrefetchShortlist,
  readDirtyFiles,
  resolveContext,
} from "./retrieval.js";
import type {
  BackfillResult,
  CurrentContext,
  GetContextArgs,
  GetContextResult,
  SessionsContextArgs,
  SessionsContextResult,
  SessionFeature,
  SessionInfoLike,
  SessionRecord,
  StructuredHandoffPayload,
} from "./types.js";
import {
  DEFAULT_AUTO_BACKFILL_INTERVAL_MS,
  DEFAULT_BACKFILL_COUNT,
  DEFAULT_MAX_AUTO_SESSIONS,
  HANDOFF_SCHEMA_VERSION,
} from "./types.js";
import { cleanText, normalizeRepoPath, toIsoString, uniq } from "./utils.js";

const execFileAsync = promisify(execFile);

export interface Logger {
  info(message: string, extra?: Record<string, unknown>): Promise<void> | void;
  warn(message: string, extra?: Record<string, unknown>): Promise<void> | void;
  error(message: string, extra?: Record<string, unknown>): Promise<void> | void;
}

const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const LOW_SIGNAL_TEXT = new Set(["", "ok", "okay", "done", "clear", "na", "n/a", "none", "-", "yes", "no"]);

function normalizeFeatureList(features: StructuredHandoffPayload["features"], projectRoot: string): SessionFeature[] {
  return (features ?? []).map((feature) => ({
    name: cleanText(feature.name) || "Unnamed feature",
    why: cleanText(feature.why),
    status: feature.status ?? "done",
    files: uniq(
      (feature.files ?? [])
        .map((file) => cleanText(file))
        .filter(Boolean)
        .map((file) => normalizeRepoPath(projectRoot, file))
    ),
  }));
}

function normalizeDecisionList(
  decisions: StructuredHandoffPayload["decisions"],
  projectRoot: string
): SessionRecord["decisions"] {
  return (decisions ?? []).map((decision) => ({
    decision: cleanText(decision.decision) || "Unnamed decision",
    why: cleanText(decision.why),
    files: uniq(
      (decision.files ?? [])
        .map((file) => cleanText(file))
        .filter(Boolean)
        .map((file) => normalizeRepoPath(projectRoot, file))
    ),
  }));
}

function sortFileTouches(record: SessionRecord): void {
  record.filesTouched.sort((left, right) => right.count - left.count || left.path.localeCompare(right.path));
  record.toolsUsed.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function isDefaultSessionTitle(title: string): boolean {
  const normalized = cleanText(title).toLowerCase();
  return normalized.startsWith("session ") || normalized.startsWith("new session");
}

function hasMeaningfulNarrative(text: string | undefined): boolean {
  const normalized = cleanText(text).toLowerCase();
  if (LOW_SIGNAL_TEXT.has(normalized)) {
    return false;
  }
  return normalized.length >= 12 || normalized.split(/\s+/).length >= 3;
}

function isFallbackSummary(text: string | undefined, title: string): boolean {
  const normalized = cleanText(text);
  return (
    normalized === cleanText(title) ||
    normalized === "Session created with no significant edits recorded yet."
  );
}

function isFallbackResumePrompt(text: string | undefined, title: string): boolean {
  const normalized = cleanText(text);
  return (
    normalized === `Continue ${title}. Review the session context and decide the next change.` ||
    normalized === "Review the session context and decide the next change."
  );
}

function summarizeTouchedFiles(record: SessionRecord): string {
  const topFiles = record.filesTouched.slice(0, 3).map((file) => file.path);
  if (topFiles.length === 0) {
    return "";
  }
  return `Touched ${record.filesTouched.length} file${record.filesTouched.length === 1 ? "" : "s"}, including ${topFiles.join(", ")}.`;
}

function summarizeTools(record: SessionRecord): string {
  const topTools = record.toolsUsed.slice(0, 3).map((tool) => tool.name);
  if (topTools.length === 0) {
    return "";
  }
  return `Used tools: ${topTools.join(", ")}.`;
}

function deriveSummary(record: SessionRecord): string {
  const pieces: string[] = [];
  if (!isDefaultSessionTitle(record.title)) {
    pieces.push(record.title);
  }

  if (record.features.length > 0) {
    const featureNames = record.features.slice(0, 3).map((feature) => feature.name);
    pieces.push(`Worked on ${featureNames.join(", ")}.`);
  } else if (record.decisions.length > 0) {
    const decisions = record.decisions.slice(0, 2).map((decision) => decision.decision);
    pieces.push(`Made decisions around ${decisions.join(", ")}.`);
  } else {
    const fileSummary = summarizeTouchedFiles(record);
    if (fileSummary) {
      pieces.push(fileSummary);
    }
  }

  if (pieces.length === 0) {
    const toolSummary = summarizeTools(record);
    if (toolSummary) {
      pieces.push(toolSummary);
    }
  }

  if (pieces.length === 0) {
    pieces.push("Session created with no significant edits recorded yet.");
  }

  return cleanText(pieces.join(" "));
}

function deriveResumePrompt(record: SessionRecord): string {
  const topFiles = record.filesTouched.slice(0, 3).map((file) => file.path);
  if (record.features.length > 0) {
    const featureNames = record.features.slice(0, 3).map((feature) => feature.name).join(", ");
    const filesPart = topFiles.length > 0 ? ` Inspect ${topFiles.join(", ")} first.` : "";
    return `Continue work on ${featureNames}.${filesPart}`;
  }

  if (topFiles.length > 0) {
    return `Continue ${record.title}. Inspect ${topFiles.join(", ")} first.`;
  }

  if (!isDefaultSessionTitle(record.title)) {
    return `Continue ${record.title}. Review the session context and decide the next change.`;
  }

  return "Review the session context and decide the next change.";
}

function applyFallbackNarrative(record: SessionRecord): void {
  const fallbackSummary = deriveSummary(record);
  if (!hasMeaningfulNarrative(record.summary) || isFallbackSummary(record.summary, record.title)) {
    record.summary = fallbackSummary;
  }

  const fallbackResumePrompt = deriveResumePrompt(record);
  if (!hasMeaningfulNarrative(record.resumePrompt) || isFallbackResumePrompt(record.resumePrompt, record.title)) {
    record.resumePrompt = fallbackResumePrompt;
  }
}

function incrementFileTouch(record: SessionRecord, filePath: string, amount = 1): void {
  const normalized = normalizeRepoPath(record.projectRoot, filePath);
  const existing = record.filesTouched.find((entry) => entry.path === normalized);
  if (existing) {
    existing.count += amount;
  } else {
    record.filesTouched.push({ path: normalized, count: amount });
  }
}

function incrementToolUsage(record: SessionRecord, toolName: string): void {
  const existing = record.toolsUsed.find((entry) => entry.name === toolName);
  if (existing) {
    existing.count += 1;
  } else {
    record.toolsUsed.push({ name: toolName, count: 1 });
  }
}

function createDraft(projectRoot: string, session: SessionInfoLike, branch: string | null): SessionRecord {
  const record: SessionRecord = {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    sessionId: session.id,
    projectRoot,
    branch,
    title: session.title ?? `Session ${session.id}`,
    createdAt: toIsoString(session.time?.created),
    updatedAt: toIsoString(session.time?.updated),
    source: "opencode-local",
    status: "draft",
    parentSessionIds: session.parentID ? [session.parentID] : [],
    shareUrl: session.share?.url ?? null,
    summary: "",
    features: [],
    decisions: [],
    blockers: [],
    openQuestions: [],
    testsRun: [],
    toolsUsed: [],
    filesTouched: [],
    resumePrompt: "",
  };
  applyFallbackNarrative(record);
  return record;
}

function collectFileCandidates(toolName: string, args: unknown): string[] {
  if (!args || typeof args !== "object") {
    return [];
  }

  const normalizedTool = toolName.toLowerCase();
  const toolLooksMutating =
    normalizedTool.includes("edit") ||
    normalizedTool.includes("write") ||
    normalizedTool.includes("patch") ||
    normalizedTool.includes("delete") ||
    normalizedTool.includes("move");
  if (!toolLooksMutating) {
    return [];
  }

  const files = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.includes("/") || value.includes("\\")) {
        files.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /file|path|target|source/i.test(key)) {
        files.add(child);
      } else {
        visit(child);
      }
    }
  };

  visit(args);
  return Array.from(files);
}

function isAssistantSummaryMessage(info: Message): boolean {
  if (info.role !== "assistant") {
    return false;
  }
  return Boolean((info as Message & { summary?: boolean }).summary);
}

function matchesSessionQuery(record: SessionRecord, query: string | undefined): boolean {
  const normalizedQuery = cleanText(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = cleanText(
    [
      record.sessionId,
      record.title,
      record.summary,
      record.goal ?? "",
      ...(record.changesMade ?? []),
      ...record.features.flatMap((feature) => [feature.name, feature.why, ...feature.files]),
      ...record.decisions.flatMap((decision) => [decision.decision, decision.why, ...decision.files]),
      ...record.blockers,
      ...record.openQuestions,
      ...record.testsRun,
      ...record.filesTouched.map((file) => file.path),
      record.resumePrompt,
      record.branch ?? "",
    ].join(" ")
  ).toLowerCase();

  return normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export interface HandoffServiceOptions {
  projectRoot: string;
  logger?: Logger;
  commandRunner?: CommandRunner;
  autoBackfill?:
    | boolean
    | {
        enabled?: boolean;
        intervalMs?: number;
        count?: number;
      };
}

export class HandoffService {
  readonly paths: HandoffPaths;
  private readonly logger: Logger;
  private readonly commandRunner: CommandRunner;
  private readonly autoBackfillEnabled: boolean;
  private readonly autoBackfillIntervalMs: number;
  private readonly autoBackfillCount: number;
  private readonly drafts = new Map<string, SessionRecord>();
  private readonly summaryMessageIdsBySession = new Map<string, string>();
  private readonly summaryTextByMessage = new Map<string, string>();
  private readonly persistTimers = new Map<string, NodeJS.Timeout>();
  private autoBackfillTimer: NodeJS.Timeout | null = null;
  private backfillInFlight: Promise<BackfillResult> | null = null;
  private initialized = false;
  private branch: string | null = null;

  constructor(private readonly options: HandoffServiceOptions) {
    this.paths = createHandoffPaths(options.projectRoot);
    this.logger = options.logger ?? noopLogger;
    this.commandRunner =
      options.commandRunner ??
      ({
        run: async (command: string, args: string[], cwd: string) => {
          try {
            const { stdout, stderr } = await execFileAsync(command, args, { cwd });
            return {
              stdout: stdout.toString(),
              stderr: stderr.toString(),
              exitCode: 0,
            };
          } catch (error) {
            const cast = error as NodeJS.ErrnoException & { stdout?: string | Buffer; stderr?: string | Buffer };
            return {
              stdout: cast.stdout?.toString() ?? "",
              stderr: cast.stderr?.toString() ?? cast.message,
              exitCode: typeof cast.code === "number" ? cast.code : 1,
            };
          }
        },
      } satisfies CommandRunner);

    const autoBackfillConfig =
      typeof options.autoBackfill === "object"
        ? options.autoBackfill
        : {
            enabled: options.autoBackfill,
          };
    this.autoBackfillEnabled = autoBackfillConfig.enabled ?? true;
    this.autoBackfillIntervalMs = autoBackfillConfig.intervalMs ?? DEFAULT_AUTO_BACKFILL_INTERVAL_MS;
    this.autoBackfillCount = autoBackfillConfig.count ?? DEFAULT_BACKFILL_COUNT;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await ensureHandoffLayout(this.paths);
    this.branch = await this.readBranch();
    this.initialized = true;
    await this.startAutomaticBackfill();
  }

  async handleEvent(event: Event): Promise<void> {
    await this.init();

    switch (event.type) {
      case "session.created":
        await this.onSessionCreated(event.properties.info);
        break;
      case "session.updated":
        await this.onSessionUpdated(event.properties.info);
        break;
      case "session.compacted":
        await this.onSessionCompacted(event.properties.sessionID);
        break;
      case "session.diff":
        await this.onSessionDiff(event.properties.sessionID, event.properties.diff.map((entry) => entry.file));
        break;
      case "file.edited":
        await this.onBestEffortFileEdited(event.properties.file);
        break;
      case "message.updated":
        await this.onMessageUpdated(event.properties.info);
        break;
      case "message.part.updated":
        await this.onMessagePartUpdated(event.properties.part);
        break;
      case "vcs.branch.updated":
        this.branch = event.properties.branch ?? null;
        break;
      default:
        break;
    }
  }

  async handleToolExecuteAfter(input: { tool: string; sessionID: string; args: unknown }): Promise<void> {
    await this.init();
    const record = await this.getOrCreateDraft(input.sessionID);
    incrementToolUsage(record, input.tool);
    for (const file of collectFileCandidates(input.tool, input.args)) {
      incrementFileTouch(record, file);
    }
    await this.persistDraft(record.sessionId);
  }

  async handleSessionCompacting(output: { context: string[] }): Promise<void> {
    await this.init();
    output.context.push(COMPACTION_CONTEXT);
  }

  async getContext(args: GetContextArgs, currentSessionId?: string): Promise<GetContextResult> {
    await this.init();
    const currentDraft = currentSessionId ? await this.getDraftOrStoredRecord(currentSessionId) : null;
    const dirtyFiles = await readDirtyFiles(this.paths.root);
    const fileHints = uniq((args.fileHints ?? []).map((file) => normalizeRepoPath(this.paths.root, file)));
    const records = await loadAllSessionRecords(this.paths);
    const shortlist = currentSessionId ? await loadShortlist(this.paths, currentSessionId) : null;
    return resolveContext({
      paths: this.paths,
      records,
      shortlist,
      args: {
        ...args,
        maxSessions: args.maxSessions ?? DEFAULT_MAX_AUTO_SESSIONS,
      },
      currentContext: {
        sessionId: currentSessionId,
        branch: this.branch,
        dirtyFiles,
        fileHints,
        query: args.query,
      },
      currentDraft,
    });
  }

  async backfill(count: number): Promise<BackfillResult> {
    await this.init();
    return this.runBackfillOnce(count, "manual");
  }

  async getSessionsContext(args: SessionsContextArgs = {}): Promise<SessionsContextResult> {
    await this.init();
    const status = args.status ?? "all";
    const normalizedLimit =
      typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0
        ? Math.floor(args.limit)
        : null;
    const records = await loadAllSessionRecords(this.paths);
    const filtered = records
      .filter((record) => status === "all" || record.status === status)
      .filter((record) => matchesSessionQuery(record, args.query));
    const selected = normalizedLimit ? filtered.slice(0, normalizedLimit) : filtered;

    return {
      totalSessions: records.length,
      returnedSessions: selected.length,
      filters: {
        status,
        query: cleanText(args.query) || null,
        limit: normalizedLimit,
      },
      sessionsDir: this.paths.sessionsDir,
      patchesDir: this.paths.patchesDir,
      sessions: selected.map((record) => ({
        sessionId: record.sessionId,
        sessionPath: getSessionRecordPath(this.paths, record.sessionId),
        patchPath: getPatchPath(this.paths, record.sessionId),
        record,
      })),
    };
  }

  async dispose(): Promise<void> {
    if (this.autoBackfillTimer) {
      clearInterval(this.autoBackfillTimer);
      this.autoBackfillTimer = null;
    }

    await this.backfillInFlight;

    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }

    const sessionIds = [...this.persistTimers.keys()];
    this.persistTimers.clear();
    await Promise.all(sessionIds.map((sessionId) => this.flushDraft(sessionId)));
  }

  private async onSessionCreated(info: Session): Promise<void> {
    const draft = createDraft(this.paths.root, info, this.branch);
    this.drafts.set(draft.sessionId, draft);
    await saveSessionRecord(this.paths, draft);
    await this.buildAndSaveShortlist(draft.sessionId);
    await this.logger.info("handoff draft created", {
      sessionId: draft.sessionId,
      projectRoot: this.paths.root,
    });
  }

  private async onSessionUpdated(info: Session): Promise<void> {
    const record = await this.getOrCreateDraft(info.id);
    record.title = info.title ?? record.title;
    record.updatedAt = toIsoString(info.time?.updated);
    record.shareUrl = info.share?.url ?? record.shareUrl;
    record.parentSessionIds = info.parentID ? uniq([info.parentID, ...record.parentSessionIds]) : record.parentSessionIds;
    applyFallbackNarrative(record);
    await this.persistDraft(record.sessionId);
  }

  private async onSessionDiff(sessionId: string, files: string[]): Promise<void> {
    const record = await this.getOrCreateDraft(sessionId);
    for (const file of files) {
      incrementFileTouch(record, file);
    }
    await this.persistDraft(sessionId);
  }

  private async onBestEffortFileEdited(file: string): Promise<void> {
    if (this.drafts.size !== 1) {
      return;
    }

    const [record] = this.drafts.values();
    incrementFileTouch(record, file);
    await this.persistDraft(record.sessionId);
  }

  private async onMessageUpdated(info: Message): Promise<void> {
    if (!isAssistantSummaryMessage(info)) {
      return;
    }
    this.summaryMessageIdsBySession.set(info.sessionID, info.id);
  }

  private async onMessagePartUpdated(part: Part): Promise<void> {
    if (part.type !== "text") {
      return;
    }

    const summaryMessageId = this.summaryMessageIdsBySession.get(part.sessionID);
    if (!summaryMessageId || part.messageID !== summaryMessageId) {
      return;
    }

    this.summaryTextByMessage.set(part.messageID, part.text);
  }

  private async onSessionCompacted(sessionId: string): Promise<void> {
    const record = await this.getOrCreateDraft(sessionId);
    const messageId = this.summaryMessageIdsBySession.get(sessionId);
    const summaryText = messageId ? this.summaryTextByMessage.get(messageId) ?? "" : "";
    const structured = summaryText ? extractHandoffPayload(summaryText) : null;
    const summaryOnly = summaryText ? stripHandoffBlock(summaryText) : record.summary;

    if (structured) {
      this.mergeStructuredPayload(record, structured);
      record.status = "finalized";
      await this.logger.info("handoff compaction parsed", {
        sessionId,
        parseStatus: "success",
      });
    } else {
      record.summary = cleanText(summaryOnly) || record.summary;
      record.status = "draft";
      await this.logger.warn("handoff compaction missing structured payload", {
        sessionId,
        parseStatus: "draft",
      });
    }

    applyFallbackNarrative(record);
    sortFileTouches(record);
    await saveSessionRecord(this.paths, record);
    await this.buildAndSaveShortlist(sessionId);
  }

  private mergeStructuredPayload(record: SessionRecord, structured: StructuredHandoffPayload): void {
    record.summary = cleanText(structured.summary) || cleanText(stripHandoffBlock(record.summary)) || record.summary;
    record.goal = cleanText(structured.goal) || record.goal;
    record.changesMade = structured.changesMade?.map((item) => cleanText(item)).filter(Boolean) ?? record.changesMade;
    record.features = normalizeFeatureList(structured.features, record.projectRoot);
    record.decisions = normalizeDecisionList(structured.decisions, record.projectRoot);
    record.blockers = structured.blockers?.map((item) => cleanText(item)).filter(Boolean) ?? [];
    record.openQuestions = structured.openQuestions?.map((item) => cleanText(item)).filter(Boolean) ?? [];
    record.testsRun = structured.testsRun?.map((item) => cleanText(item)).filter(Boolean) ?? [];
    record.resumePrompt = cleanText(structured.resumePrompt) || record.resumePrompt || record.summary;

    for (const file of [
      ...record.features.flatMap((feature) => feature.files),
      ...record.decisions.flatMap((decision) => decision.files),
    ]) {
      incrementFileTouch(record, file, 0);
    }
    applyFallbackNarrative(record);
  }

  private async buildAndSaveShortlist(sessionId: string): Promise<void> {
    const index = await loadIndex(this.paths);
    const records = await loadAllSessionRecords(this.paths);
    const context: CurrentContext = {
      sessionId,
      branch: this.branch,
      dirtyFiles: await readDirtyFiles(this.paths.root),
      fileHints: [],
      query: undefined,
    };
    const shortlist = buildPrefetchShortlist(index, sessionId, context, records);
    await saveShortlist(this.paths, shortlist);
  }

  private async getOrCreateDraft(sessionId: string): Promise<SessionRecord> {
    const draft = this.drafts.get(sessionId);
    if (draft) {
      return draft;
    }

    const stored = await loadSessionRecord(this.paths, sessionId);
    if (stored) {
      this.drafts.set(sessionId, stored);
      return stored;
    }

    const created = createDraft(
      this.paths.root,
      {
        id: sessionId,
        title: `Session ${sessionId}`,
      },
      this.branch
    );
    this.drafts.set(sessionId, created);
    return created;
  }

  private async getDraftOrStoredRecord(sessionId: string): Promise<SessionRecord | null> {
    return this.drafts.get(sessionId) ?? (await loadSessionRecord(this.paths, sessionId));
  }

  private async persistDraft(sessionId: string): Promise<void> {
    const existing = this.persistTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      await this.flushDraft(sessionId);
      this.persistTimers.delete(sessionId);
    }, 50);

    this.persistTimers.set(sessionId, timer);
  }

  private async flushDraft(sessionId: string): Promise<void> {
    const record = this.drafts.get(sessionId);
    if (!record) {
      return;
    }
    record.updatedAt = new Date().toISOString();
    sortFileTouches(record);
    applyFallbackNarrative(record);
    await saveSessionRecord(this.paths, record);
  }

  private async startAutomaticBackfill(): Promise<void> {
    if (!this.autoBackfillEnabled || this.autoBackfillTimer) {
      return;
    }

    await this.runBackfillOnce(this.autoBackfillCount, "startup");
    this.autoBackfillTimer = setInterval(() => {
      void this.runBackfillOnce(this.autoBackfillCount, "interval");
    }, this.autoBackfillIntervalMs);
    this.autoBackfillTimer.unref?.();
  }

  private async runBackfillOnce(
    count: number,
    trigger: "startup" | "interval" | "manual"
  ): Promise<BackfillResult> {
    if (this.backfillInFlight) {
      return this.backfillInFlight;
    }

    this.backfillInFlight = (async () => {
      try {
        const result = await runBackfill({
          paths: this.paths,
          projectRoot: this.paths.root,
          branch: this.branch,
          count,
          runner: this.commandRunner,
        });

        await this.logger.info("handoff backfill complete", {
          projectRoot: this.paths.root,
          importedSessionIds: result.importedSessionIds,
          skippedSessionIds: result.skippedSessionIds,
          trigger,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.logger.error("handoff backfill failed", {
          projectRoot: this.paths.root,
          trigger,
          error: message,
        });
        return {
          importedSessionIds: [],
          skippedSessionIds: [],
          warnings: [message],
        };
      } finally {
        this.backfillInFlight = null;
      }
    })();

    return this.backfillInFlight;
  }

  private async readBranch(): Promise<string | null> {
    const response = await this.commandRunner.run("git", ["branch", "--show-current"], this.paths.root);
    if (response.exitCode !== 0) {
      return null;
    }
    return cleanText(response.stdout) || null;
  }
}
