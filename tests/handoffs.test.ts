import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPrefetchShortlist,
  createHandoffPaths,
  detectConflicts,
  ensureHandoffLayout,
  extractHandoffPayload,
  HandoffService,
  loadIndex,
  loadSessionRecord,
  renderPatchMarkdown,
  resolveContext,
  saveSessionRecord,
  updateIndex,
  resolveProjectRootFromToolContext,
  type CommandRunner,
  type GetContextResult,
  type SessionRecord,
} from "../src/handoffs/index.js";

const tempDirs: string[] = [];
const services: HandoffService[] = [];

async function createTempProject(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "handoffs-"));
  tempDirs.push(directory);
  await fs.mkdir(path.join(directory, ".git"));
  return directory;
}

function record(input: Partial<SessionRecord> & Pick<SessionRecord, "sessionId" | "projectRoot">): SessionRecord {
  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    projectRoot: input.projectRoot,
    branch: input.branch ?? "feature/test",
    title: input.title ?? input.sessionId,
    createdAt: input.createdAt ?? new Date("2026-04-19T10:00:00.000Z").toISOString(),
    updatedAt: input.updatedAt ?? new Date("2026-04-19T10:10:00.000Z").toISOString(),
    source: "opencode-local",
    status: input.status ?? "finalized",
    parentSessionIds: input.parentSessionIds ?? [],
    shareUrl: input.shareUrl ?? null,
    summary: input.summary ?? "summary",
    goal: input.goal,
    changesMade: input.changesMade ?? [],
    features: input.features ?? [],
    decisions: input.decisions ?? [],
    blockers: input.blockers ?? [],
    openQuestions: input.openQuestions ?? [],
    testsRun: input.testsRun ?? [],
    toolsUsed: input.toolsUsed ?? [],
    filesTouched: input.filesTouched ?? [],
    resumePrompt: input.resumePrompt ?? "resume",
  };
}

afterEach(async () => {
  while (services.length > 0) {
    await services.pop()?.dispose();
  }
  vi.useRealTimers();
  await Promise.all(tempDirs.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function createService(
  projectRoot: string,
  runnerOverrides?: Partial<CommandRunner>
): Promise<HandoffService> {
  const runner: CommandRunner = {
    run: async (command, args) => {
      if (command === "git" && args[0] === "branch") {
        return { stdout: "feature/test\n", stderr: "", exitCode: 0 };
      }
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    ...runnerOverrides,
  };

  const service = new HandoffService({
    projectRoot,
    commandRunner: runner,
    autoBackfill: false,
  });
  await service.init();
  services.push(service);
  return service;
}

async function createSession(service: HandoffService, projectRoot: string, sessionId: string, title = "Session"): Promise<void> {
  await service.handleEvent({
    type: "session.created",
    properties: {
      info: {
        id: sessionId,
        title,
        directory: projectRoot,
        projectID: "project-1",
        version: "1",
        time: {
          created: Date.parse("2026-04-19T10:00:00.000Z"),
          updated: Date.parse("2026-04-19T10:00:00.000Z"),
        },
      },
    },
  } as never);
}

describe("handoff core", () => {
  it("parses handoff payload blocks", () => {
    const payload = extractHandoffPayload(
      [
        "before",
        "```handoff-json",
        '{"summary":"done","features":[{"name":"auth","why":"keep clients stable","status":"done","files":["src/auth.ts"]}],"decisions":[],"blockers":[],"openQuestions":[],"testsRun":[],"resumePrompt":"resume"}',
        "```",
        "after",
      ].join("\n")
    );

    expect(payload?.summary).toBe("done");
    expect(payload?.features?.[0]?.files).toEqual(["src/auth.ts"]);
  });

  it("resolves tool project root without using filesystem root", () => {
    const resolved = resolveProjectRootFromToolContext({
      worktree: "/",
      directory: "/Users/anurag/kafka/pluto",
    });

    expect(resolved).toBe("/Users/anurag/kafka/pluto");
  });

  it("falls back to process cwd when tool context paths are empty", () => {
    const resolved = resolveProjectRootFromToolContext({
      worktree: "",
      directory: "   ",
    });

    expect(resolved).toBe(path.resolve(process.cwd()));
  });

  it("updates the index with files and keywords", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    const session = record({
      sessionId: "abc",
      projectRoot,
      title: "Refactor auth flow",
      summary: "Improve auth token handling",
      features: [
        {
          name: "refresh token rotation",
          why: "prevent replay",
          status: "done",
          files: ["src/auth/service.ts"],
        },
      ],
      filesTouched: [{ path: "src/auth/service.ts", count: 3 }],
    });

    await updateIndex(paths, session);
    const index = await loadIndex(paths);
    expect(index.files["src/auth/service.ts"]).toEqual(["abc"]);
    expect(index.sessions.abc.keywords).toContain("auth");
  });

  it("scores auto mode by exact file overlap over recency", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    const overlap = record({
      sessionId: "overlap",
      projectRoot,
      updatedAt: new Date().toISOString(),
      filesTouched: [{ path: "src/auth/service.ts", count: 1 }],
    });
    const recent = record({
      sessionId: "recent",
      projectRoot,
      updatedAt: new Date().toISOString(),
      filesTouched: [{ path: "src/other.ts", count: 1 }],
    });

    await saveSessionRecord(paths, overlap);
    await saveSessionRecord(paths, recent);
    const index = await loadIndex(paths);
    const shortlist = buildPrefetchShortlist(
      index,
      "current",
      {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: ["src/auth/service.ts"],
        fileHints: [],
      },
      [overlap, recent]
    );

    const result = await resolveContext({
      paths,
      records: [overlap, recent],
      shortlist,
      args: {
        mode: "auto",
        maxSessions: 1,
      },
      currentContext: {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: ["src/auth/service.ts"],
        fileHints: [],
      },
    });

    expect(result.selectedSessions[0]?.sessionId).toBe("overlap");
  });

  it("prefers semantic query matches over unrelated file-overlap sessions in auto mode", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    const nameSession = record({
      sessionId: "name-session",
      projectRoot,
      title: "Name introduction from Anurag",
      summary: "my name is anurag",
      filesTouched: [{ path: "notes/profile.md", count: 1 }],
    });
    const overlapSession = record({
      sessionId: "overlap-session",
      projectRoot,
      title: "React todo conflict work",
      summary: "resolved app state overlap",
      filesTouched: [{ path: "fixtures/react-todo-conflict/src/App.jsx", count: 4 }],
    });

    await saveSessionRecord(paths, nameSession);
    await saveSessionRecord(paths, overlapSession);
    const index = await loadIndex(paths);
    const shortlist = buildPrefetchShortlist(
      index,
      "current",
      {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: ["fixtures/react-todo-conflict/src/App.jsx"],
        fileHints: [],
        query: "what's my name ? check sessions",
      },
      [nameSession, overlapSession]
    );

    const result = await resolveContext({
      paths,
      records: [nameSession, overlapSession],
      shortlist,
      args: {
        mode: "auto",
        maxSessions: 1,
        query: "what's my name ? check sessions",
      },
      currentContext: {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: ["fixtures/react-todo-conflict/src/App.jsx"],
        fileHints: [],
        query: "what's my name ? check sessions",
      },
    });

    expect(result.selectedSessions[0]?.sessionId).toBe("name-session");
    expect(result.selectedSessions[0]?.reasonSelected).toContain("query title match");
  });

  it("builds answer-oriented relevant files and question summary for explicit session queries", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    const session = record({
      sessionId: "intro-session",
      projectRoot,
      title: "Name introduction from Anurag",
      summary: "my name is anurag",
      features: [
        {
          name: "profile note",
          why: "capture a quick intro",
          status: "done",
          files: ["notes/profile.md"],
        },
      ],
      filesTouched: [
        { path: ".handoffs/index.json", count: 4 },
        { path: "notes/profile.md", count: 1 },
      ],
    });

    await saveSessionRecord(paths, session);

    const result = await resolveContext({
      paths,
      records: [session],
      shortlist: null,
      args: {
        mode: "ids",
        sessionIds: ["intro-session"],
        query: "what files were touched in this session",
        includeCurrentSession: false,
      },
      currentContext: {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: [],
        fileHints: [],
        query: "what files were touched in this session",
      },
    });

    expect(result.relevantFiles.map((file) => file.path)).toEqual(["notes/profile.md"]);
    expect(result.questionSummary).toContain("notes/profile.md");
  });

  it("lists stored session context with artifact paths", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot);
    await createSession(service, projectRoot, "session-a", "Review auth history");
    await service.handleEvent({
      type: "session.updated",
      properties: {
        info: {
          id: "session-a",
          title: "Review auth history",
          directory: projectRoot,
          projectID: "project-1",
          version: "1",
          time: {
            created: Date.parse("2026-04-19T10:00:00.000Z"),
            updated: Date.parse("2026-04-19T10:05:00.000Z"),
          },
        },
      },
    } as never);

    const result = await service.getSessionsContext();

    expect(result.totalSessions).toBe(1);
    expect(result.returnedSessions).toBe(1);
    expect(result.sessions[0]?.sessionId).toBe("session-a");
    expect(result.sessions[0]?.sessionPath).toContain(".handoffs/sessions/session-a.json");
    expect(result.sessions[0]?.patchPath).toContain(".handoffs/patches/session-a.md");
    expect(result.sessions[0]?.record.title).toBe("Review auth history");
  });

  it("filters session context by status, query, and limit", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    await saveSessionRecord(
      paths,
      record({
        sessionId: "draft-auth",
        projectRoot,
        status: "draft",
        title: "Draft auth task",
        summary: "investigate auth retries",
      })
    );
    await saveSessionRecord(
      paths,
      record({
        sessionId: "finalized-auth",
        projectRoot,
        status: "finalized",
        title: "Finalize auth task",
        summary: "ship auth retries",
      })
    );

    const service = await createService(projectRoot);
    const result = await service.getSessionsContext({
      status: "finalized",
      query: "ship auth",
      limit: 1,
    });

    expect(result.totalSessions).toBe(2);
    expect(result.returnedSessions).toBe(1);
    expect(result.filters.status).toBe("finalized");
    expect(result.filters.query).toBe("ship auth");
    expect(result.filters.limit).toBe(1);
    expect(result.sessions.map((session) => session.sessionId)).toEqual(["finalized-auth"]);
  });

  it("detects conflict entries for different rationale on the same file", () => {
    const projectRoot = "/tmp/project";
    const conflicts = detectConflicts([
      record({
        sessionId: "a",
        projectRoot,
        features: [
          {
            name: "Feature A",
            why: "first reason",
            status: "done",
            files: ["src/auth.ts"],
          },
        ],
        filesTouched: [{ path: "src/auth.ts", count: 1 }],
      }),
      record({
        sessionId: "b",
        projectRoot,
        features: [
          {
            name: "Feature B",
            why: "second reason",
            status: "done",
            files: ["src/auth.ts"],
          },
        ],
        filesTouched: [{ path: "src/auth.ts", count: 1 }],
      }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.path).toBe("src/auth.ts");
  });

  it("renders the patch markdown sections", async () => {
    const projectRoot = await createTempProject();
    const patchPath = path.join(projectRoot, ".handoffs", "patches", "abc.md");
    await fs.mkdir(path.dirname(patchPath), { recursive: true });

    const markdown = renderPatchMarkdown(
      record({
        sessionId: "abc",
        projectRoot,
        goal: "Keep API stable",
        features: [
          {
            name: "refresh rotation",
            why: "reduce replay risk",
            status: "done",
            files: ["src/auth.ts"],
          },
        ],
        decisions: [
          {
            decision: "Keep API unchanged",
            why: "avoid breaking clients",
            files: ["src/api.ts"],
          },
        ],
        filesTouched: [{ path: "src/auth.ts", count: 2 }],
        testsRun: ["bun test"],
      }),
      patchPath
    );

    expect(markdown).toContain("## Goal");
    expect(markdown).toContain("## Why These Changes Were Made");
    expect(markdown).toContain("## Resume Prompt");
  });

  it("runs the session lifecycle and persists a finalized handoff", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot, {
      run: async (command, args, cwd) => {
        if (command === "git" && args[0] === "status") {
          return { stdout: " M src/auth.ts\n", stderr: "", exitCode: 0 };
        }
        return {
          stdout: command === "git" && args[0] === "branch" ? "feature/test\n" : "",
          stderr: "",
          exitCode: 0,
        };
      },
    });
    await createSession(service, projectRoot, "session-1", "Auth work");
    await service.handleToolExecuteAfter({
      tool: "edit",
      sessionID: "session-1",
      args: { filePath: "src/auth.ts" },
    });
    await service.handleEvent({
      type: "message.updated",
      properties: {
        info: {
          id: "msg-1",
          sessionID: "session-1",
          role: "assistant",
          parentID: "user-1",
          modelID: "model",
          providerID: "provider",
          mode: "chat",
          path: {
            cwd: projectRoot,
            root: projectRoot,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          summary: true,
          time: {
            created: Date.now(),
          },
        },
      },
    } as never);
    await service.handleEvent({
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "session-1",
          messageID: "msg-1",
          type: "text",
          text: `Summary\n\n\`\`\`handoff-json\n{"summary":"Auth done","goal":"Finish auth work","changesMade":["Updated auth flow"],"features":[{"name":"refresh rotation","why":"reduce replay risk","status":"done","files":["src/auth.ts"]}],"decisions":[{"decision":"Keep API stable","why":"avoid breaking clients","files":["src/api.ts"]}],"blockers":[],"openQuestions":[],"testsRun":["bun test"],"resumePrompt":"continue auth"}\n\`\`\``,
        },
      },
    } as never);
    await service.handleEvent({
      type: "session.compacted",
      properties: {
        sessionID: "session-1",
      },
    } as never);

    const saved = await loadSessionRecord(createHandoffPaths(projectRoot), "session-1");
    expect(saved?.status).toBe("finalized");
    expect(saved?.features[0]?.why).toBe("reduce replay risk");
  });

  it("resolves explicit ids, keeps warnings for unknown ids, and includes the current draft", async () => {
    const projectRoot = await createTempProject();
    const paths = createHandoffPaths(projectRoot);
    await ensureHandoffLayout(paths);

    const prior = record({
      sessionId: "known",
      projectRoot,
      title: "Known session",
      features: [
        {
          name: "auth",
          why: "existing rationale",
          status: "done",
          files: ["src/auth.ts"],
        },
      ],
      filesTouched: [{ path: "src/auth.ts", count: 2 }],
      resumePrompt: "resume known",
    });
    const currentDraft = record({
      sessionId: "current",
      projectRoot,
      status: "draft",
      title: "Current draft",
      features: [
        {
          name: "local edits",
          why: "current work",
          status: "partial",
          files: ["src/current.ts"],
        },
      ],
      filesTouched: [{ path: "src/current.ts", count: 1 }],
      resumePrompt: "resume current",
    });

    await saveSessionRecord(paths, prior);
    const result = await resolveContext({
      paths,
      records: [prior],
      shortlist: null,
      args: {
        mode: "ids",
        sessionIds: ["known", "missing"],
        includeCurrentSession: true,
      },
      currentContext: {
        sessionId: "current",
        branch: "feature/test",
        dirtyFiles: [],
        fileHints: [],
      },
      currentDraft,
    });

    expect(result.selectedSessions.map((session) => session.sessionId)).toEqual(["known", "current"]);
    expect(result.warnings).toContain("Unknown session ID: missing");
    expect(result.resumePrompt).toBe("resume known");
    expect(result.mergedContextPath).toMatch(/^\.handoffs\/materialized\/context-/);
  });

  it("keeps a compacted session in draft status when the summary lacks structured handoff json", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot);

    await createSession(service, projectRoot, "session-draft", "Draft summary");
    await service.handleEvent({
      type: "message.updated",
      properties: {
        info: {
          id: "msg-draft",
          sessionID: "session-draft",
          role: "assistant",
          parentID: "user-1",
          modelID: "model",
          providerID: "provider",
          mode: "chat",
          path: {
            cwd: projectRoot,
            root: projectRoot,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          summary: true,
          time: {
            created: Date.now(),
          },
        },
      },
    } as never);
    await service.handleEvent({
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-draft",
          sessionID: "session-draft",
          messageID: "msg-draft",
          type: "text",
          text: "Plain summary without a machine-readable block.",
        },
      },
    } as never);
    await service.handleEvent({
      type: "session.compacted",
      properties: {
        sessionID: "session-draft",
      },
    } as never);

    const saved = await loadSessionRecord(createHandoffPaths(projectRoot), "session-draft");
    expect(saved?.status).toBe("draft");
    expect(saved?.summary).toBe("Plain summary without a machine-readable block.");
    expect(saved?.features).toEqual([]);
  });

  it("returns useful context from the current draft when no prior sessions match", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot, {
      run: async (command, args) => {
        if (command === "git" && args[0] === "branch") {
          return { stdout: "feature/test\n", stderr: "", exitCode: 0 };
        }
        if (command === "git" && args[0] === "status") {
          return { stdout: " M src/draft.ts\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await createSession(service, projectRoot, "current-only", "Current only");
    await service.handleToolExecuteAfter({
      tool: "edit",
      sessionID: "current-only",
      args: { filePath: "src/draft.ts" },
    });

    const result = await service.getContext({
      mode: "auto",
      includeCurrentSession: true,
      maxSessions: 4,
    }, "current-only");

    expect(result.selectedSessions.map((session) => session.sessionId)).toEqual(["current-only"]);
    expect(result.warnings).toEqual([]);
    expect(result.topFiles[0]?.path).toBe("src/draft.ts");
  });

  it("backfills local OpenCode exports into finalized and draft handoffs", async () => {
    const projectRoot = await createTempProject();
    const structuredSummary = [
      "summary",
      "```handoff-json",
      JSON.stringify({
        summary: "Imported auth summary",
        goal: "Import prior auth work",
        changesMade: ["Updated auth flow"],
        features: [
          {
            name: "refresh rotation",
            why: "reduce replay risk",
            status: "done",
            files: ["src/auth.ts"],
          },
        ],
        decisions: [
          {
            decision: "Keep API stable",
            why: "avoid client breakage",
            files: ["src/api.ts"],
          },
        ],
        blockers: [],
        openQuestions: ["Need follow-up"],
        testsRun: ["bun test auth"],
        resumePrompt: "continue auth import",
      }),
      "```",
    ].join("\n");

    const runner: CommandRunner = {
      run: async (command, args) => {
        if (command === "git" && args[0] === "branch") {
          return { stdout: "feature/test\n", stderr: "", exitCode: 0 };
        }
        if (command === "opencode" && args[0] === "session") {
          return {
            stdout: JSON.stringify([
              { id: "import-1", directory: projectRoot },
              { id: "import-2", directory: projectRoot },
              { id: "other-project", directory: "/tmp/other" },
            ]),
            stderr: "",
            exitCode: 0,
          };
        }
        if (command === "opencode" && args[0] === "export" && args[1] === "import-1") {
          return {
            stdout: JSON.stringify({
              session: {
                id: "import-1",
                title: "Imported finalized session",
                parentID: "parent-1",
                share: { url: "https://example.com/s/import-1" },
                time: { created: Date.parse("2026-04-19T09:00:00.000Z"), updated: Date.parse("2026-04-19T09:30:00.000Z") },
              },
              messages: [
                {
                  parts: [
                    { type: "text", text: structuredSummary },
                  ],
                },
              ],
              diffs: [
                { file: "src/auth.ts", additions: 4, deletions: 1 },
              ],
            }),
            stderr: "",
            exitCode: 0,
          };
        }
        if (command === "opencode" && args[0] === "export" && args[1] === "import-2") {
          return {
            stdout: JSON.stringify({
              session: {
                id: "import-2",
                title: "Imported draft session",
                time: { created: Date.parse("2026-04-18T09:00:00.000Z"), updated: Date.parse("2026-04-18T09:10:00.000Z") },
              },
              messages: [
                {
                  parts: [
                    { type: "text", text: "Older summary without a structured block" },
                  ],
                },
              ],
              diffs: [
                { path: "src/legacy.ts", additions: 1, deletions: 0 },
              ],
            }),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    };

    const service = new HandoffService({
      projectRoot,
      commandRunner: runner,
      autoBackfill: false,
    });
    await service.init();
    services.push(service);

    const result = await service.backfill(10);
    const finalized = await loadSessionRecord(createHandoffPaths(projectRoot), "import-1");
    const draft = await loadSessionRecord(createHandoffPaths(projectRoot), "import-2");

    expect(result.importedSessionIds).toEqual(["import-1", "import-2"]);
    expect(finalized?.status).toBe("finalized");
    expect(finalized?.features[0]?.name).toBe("refresh rotation");
    expect(finalized?.shareUrl).toBe("https://example.com/s/import-1");
    expect(draft?.status).toBe("draft");
    expect(draft?.filesTouched[0]?.path).toBe("src/legacy.ts");
  });

  it("runs backfill on startup and every 10 minutes without removing manual backfill", async () => {
    vi.useFakeTimers();
    const projectRoot = await createTempProject();
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = {
      run: async (command, args) => {
        calls.push({ command, args });
        if (command === "git" && args[0] === "branch") {
          return { stdout: "feature/test\n", stderr: "", exitCode: 0 };
        }
        if (command === "opencode" && args[0] === "session") {
          return {
            stdout: JSON.stringify([]),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    };

    const service = new HandoffService({
      projectRoot,
      commandRunner: runner,
      autoBackfill: {
        enabled: true,
        intervalMs: 10 * 60 * 1000,
        count: 10,
      },
    });
    services.push(service);
    await service.init();

    expect(calls.filter((call) => call.command === "opencode" && call.args[0] === "session")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(calls.filter((call) => call.command === "opencode" && call.args[0] === "session")).toHaveLength(2);

    await service.backfill(5);
    expect(calls.filter((call) => call.command === "opencode" && call.args[0] === "session")).toHaveLength(3);
  });

  it("gives even small draft sessions a usable fallback summary and resume prompt", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot);

    await createSession(service, projectRoot, "tiny-session", "Tiny session");
    await service.dispose();

    const saved = await loadSessionRecord(createHandoffPaths(projectRoot), "tiny-session");
    expect(saved?.summary).toBe("Tiny session");
    expect(saved?.resumePrompt).toBe("Continue Tiny session. Review the session context and decide the next change.");
  });

  it("replaces low-signal summaries like clear with a derived summary", async () => {
    const projectRoot = await createTempProject();
    const service = await createService(projectRoot, {
      run: async (command, args) => {
        if (command === "git" && args[0] === "branch") {
          return { stdout: "feature/test\n", stderr: "", exitCode: 0 };
        }
        if (command === "git" && args[0] === "status") {
          return { stdout: " M src/handoffs/service.ts\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await createSession(service, projectRoot, "low-signal", "Backfill cleanup");
    await service.handleToolExecuteAfter({
      tool: "edit",
      sessionID: "low-signal",
      args: { filePath: "src/handoffs/service.ts" },
    });
    await service.handleEvent({
      type: "message.updated",
      properties: {
        info: {
          id: "msg-low",
          sessionID: "low-signal",
          role: "assistant",
          parentID: "user-1",
          modelID: "model",
          providerID: "provider",
          mode: "chat",
          path: {
            cwd: projectRoot,
            root: projectRoot,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          summary: true,
          time: {
            created: Date.now(),
          },
        },
      },
    } as never);
    await service.handleEvent({
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-low",
          sessionID: "low-signal",
          messageID: "msg-low",
          type: "text",
          text: "clear",
        },
      },
    } as never);
    await service.handleEvent({
      type: "session.compacted",
      properties: {
        sessionID: "low-signal",
      },
    } as never);

    const saved = await loadSessionRecord(createHandoffPaths(projectRoot), "low-signal");
    expect(saved?.status).toBe("draft");
    expect(saved?.summary).toContain("Backfill cleanup");
    expect(saved?.summary).toContain("src/handoffs/service.ts");
    expect(saved?.summary?.toLowerCase()).not.toBe("clear");
    expect(saved?.resumePrompt).toContain("src/handoffs/service.ts");
  });
});
