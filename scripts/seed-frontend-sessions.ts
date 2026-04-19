import fs from "node:fs/promises";
import path from "node:path";
import {
  createHandoffPaths,
  ensureHandoffLayout,
  saveMaterializedContext,
  saveSessionRecord,
  saveShortlist,
} from "../src/handoffs/index.js";
import type { PrefetchShortlist, SessionRecord } from "../src/handoffs/index.js";

const projectRoot = process.cwd();
const paths = createHandoffPaths(projectRoot);

type SessionSeedInput = Omit<SessionRecord, "schemaVersion" | "projectRoot" | "source">;

const baseTools = [
  { name: "read_file", count: 6 },
  { name: "apply_patch", count: 3 },
  { name: "exec_command", count: 4 },
];

function isoAt(minutesOffset: number): string {
  return new Date(Date.UTC(2026, 3, 19, 8, minutesOffset, 0)).toISOString();
}

function makeRecord(input: SessionSeedInput): SessionRecord {
  return {
    schemaVersion: 1,
    projectRoot,
    source: "opencode-local",
    ...input,
  };
}

const sessions: SessionRecord[] = [
  makeRecord({
    sessionId: "fe_workspace_shell_001",
    branch: "fe/dashboard-workspace-shell",
    title: "Shape the React workspace shell for session operations",
    createdAt: isoAt(0),
    updatedAt: isoAt(18),
    status: "finalized",
    parentSessionIds: [],
    shareUrl: null,
    summary:
      "Turned the dashboard into a task-first workspace shell so session inspection, queue state, and conflict visibility live in one React surface.",
    goal:
      "Establish the main TSX layout for a frontend control plane where session operations can grow without the page collapsing into one long feed.",
    changesMade: [
      "Split the page into workspace bands for sessions, peers, conflicts, and files",
      "Moved the page framing into dashboard/src/components/dashboard.tsx so the route stays thin",
      "Normalized the top-level data contract that page.tsx passes into the shell",
      "Reserved room in globals.css for denser frontend task surfaces and status chips",
    ],
    features: [
      {
        name: "workspace shell frame",
        why: "Give React frontend operators one stable home for session work instead of a stack of disconnected cards.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/page.tsx",
          "dashboard/src/app/globals.css",
        ],
      },
      {
        name: "session-first navigation bands",
        why: "Let the shell expand into a manager surface without reworking the app layout every time a new pane is added.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/tabs.tsx",
        ],
      },
      {
        name: "frontend dataset handoff contract",
        why: "Keep the route loader lightweight while the TSX shell handles most presentation detail.",
        status: "done",
        files: [
          "dashboard/src/app/page.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
    ],
    decisions: [
      {
        decision: "Keep the route as a thin loader and push layout logic into TSX components",
        why: "The frontend will iterate faster if page.tsx mostly handles data fetching and leaves composition to React components.",
        files: [
          "dashboard/src/app/page.tsx",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Use bands and tabs instead of a single scrolling report",
        why: "Operators need to switch between live concerns quickly without losing where they were in the interface.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/tabs.tsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the workspace shell pin the current session selection in the URL for sharable review links?",
      "Do we want a compact density mode for heavy session corpora?",
    ],
    testsRun: ["npm run build", "manual browser smoke for dashboard shell"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 1 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 12 },
      { path: "dashboard/src/app/page.tsx", count: 5 },
      { path: "dashboard/src/lib/data.ts", count: 4 },
      { path: "dashboard/src/app/globals.css", count: 3 },
      { path: "dashboard/src/components/ui/tabs.tsx", count: 2 },
    ],
    resumePrompt:
      "Continue the workspace shell by checking dashboard/src/components/dashboard.tsx first, then extend page.tsx only if the data contract needs to grow.",
  }),
  makeRecord({
    sessionId: "fe_activity_rail_002",
    branch: "fe/dashboard-activity-rail",
    title: "Add a frontend activity rail for live session movement",
    createdAt: isoAt(22),
    updatedAt: isoAt(40),
    status: "finalized",
    parentSessionIds: ["fe_workspace_shell_001"],
    shareUrl: null,
    summary:
      "Layered a session activity rail into the dashboard shell so recent updates, idle peers, and queue shifts read like a live frontend tool instead of a static report.",
    goal:
      "Use the existing dashboard shell as the frame for a React activity rail that makes session recency and operator focus visible at a glance.",
    changesMade: [
      "Introduced a recent activity column inside the dashboard shell",
      "Promoted updated timestamps and status badges as first-class UI cues",
      "Extended data.ts helpers to sort and shape recent frontend activity",
      "Adjusted badge usage so online/offline and draft/finalized states read consistently",
    ],
    features: [
      {
        name: "session activity rail",
        why: "Show operators which frontend sessions changed most recently before they expand the full context.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "status badge normalization",
        why: "Prevent the UI from using different visual language for peers and sessions that represent the same operational state.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/badge.tsx",
        ],
      },
      {
        name: "recency-aware sorting",
        why: "Frontends with many sessions need a default view that surfaces the hot path first.",
        status: "done",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    decisions: [
      {
        decision: "Surface activity inside the main shell instead of a separate page",
        why: "Context switching between pages would slow triage when the operator only wants to inspect what moved recently.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Derive activity from session metadata instead of introducing a second event log",
        why: "The repo already has enough signal in updatedAt, status, and touched files to bootstrap the rail without a new backend.",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the activity rail cluster changes by branch family once we have more than fifty sessions?",
    ],
    testsRun: ["npm run build", "manual session sorting smoke test"],
    toolsUsed: [...baseTools, { name: "get_context", count: 2 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 10 },
      { path: "dashboard/src/lib/data.ts", count: 7 },
      { path: "dashboard/src/app/api/data/route.ts", count: 3 },
      { path: "dashboard/src/components/ui/badge.tsx", count: 2 },
    ],
    resumePrompt:
      "Continue the activity rail by refining the data shaping in dashboard/src/lib/data.ts and then verify the rail layout in dashboard/src/components/dashboard.tsx.",
  }),
  makeRecord({
    sessionId: "fe_session_details_003",
    branch: "fe/dashboard-session-details",
    title: "Expand session detail cards into full inspection panes",
    createdAt: isoAt(44),
    updatedAt: isoAt(67),
    status: "finalized",
    parentSessionIds: ["fe_workspace_shell_001", "fe_activity_rail_002"],
    shareUrl: null,
    summary:
      "Extended the session cards into denser detail panes so goals, changes, rationale, files, and tool usage can be inspected without leaving the frontend dashboard.",
    goal:
      "Make the session list a real inspection tool where a reviewer can understand why a frontend session happened, not just when it updated.",
    changesMade: [
      "Added expandable detail sections for goal, changes, features, decisions, blockers, and tools",
      "Tightened card spacing so large sessions remain scan-friendly in TSX",
      "Improved file and tool badges for high-volume frontend sessions",
      "Aligned session detail density with the activity rail and shell patterns",
    ],
    features: [
      {
        name: "full session inspection pane",
        why: "Operators need the stored context in the UI, not only the raw JSON files in .handoffs.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/card.tsx",
        ],
      },
      {
        name: "dense badge rows for files and tools",
        why: "Large frontend sessions touch many TSX and JSX files, so the card needs compact metadata presentation.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/badge.tsx",
        ],
      },
      {
        name: "inspection-friendly section order",
        why: "Reviewers usually look for summary, goal, rationale, and touched files in that order.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Use inline expansion rather than modal drill-down for session details",
        why: "Inspecting many sessions in sequence is faster if the operator can stay in one scroll context.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Lead with recorded rationale before low-level file counts",
        why: "The whole point of the handoff repo is preserving intent; the UI should reinforce that priority.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Do we want keyboard navigation between expanded session cards once the list is long?",
    ],
    testsRun: ["npm run build", "manual session expansion pass"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 2 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 15 },
      { path: "dashboard/src/components/ui/card.tsx", count: 2 },
      { path: "dashboard/src/components/ui/badge.tsx", count: 2 },
    ],
    resumePrompt:
      "Continue the session inspection pane by tightening long-form content layout in dashboard/src/components/dashboard.tsx.",
  }),
  makeRecord({
    sessionId: "fe_conflict_drawer_004",
    branch: "fe/dashboard-conflict-drawer",
    title: "Turn conflict rows into a frontend conflict drawer",
    createdAt: isoAt(70),
    updatedAt: isoAt(95),
    status: "finalized",
    parentSessionIds: ["fe_workspace_shell_001", "fe_session_details_003"],
    shareUrl: null,
    summary:
      "Reworked conflict visibility into a drawer-style inspection flow so overlapping TSX and JSX work can be reviewed with rationale, branches, and suggested tests in one place.",
    goal:
      "Move conflict handling from a passive list to a dedicated frontend surface that explains why sessions overlap and what the operator should inspect next.",
    changesMade: [
      "Deepened the conflict panel to show session titles and branch context together",
      "Aligned conflict UI with the inspection card language from the session pane",
      "Shaped conflict data so file overlaps and rationale labels stay grouped",
      "Prepared the shell for future action buttons like compare and assign review",
    ],
    features: [
      {
        name: "conflict drawer presentation",
        why: "A high-signal review surface helps frontend teams inspect overlapping work before it turns into broken UX.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        name: "rationale-first conflict summaries",
        why: "The operator needs to know why two sessions touched the same file, not just that they did.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "shared conflict contract",
        why: "Keep API and UI aligned as conflict payloads become richer.",
        status: "done",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    decisions: [
      {
        decision: "Treat conflicts as an inspection workflow instead of a warning badge",
        why: "Frontend overlap often needs a human-quality judgment rather than a single binary signal.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Keep the first version read-only",
        why: "The team needs reliable visibility before wiring any mutation or assignment actions into the UI.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the first action from a conflict drawer be compare context, open file, or assign reviewer?",
    ],
    testsRun: ["npm run build", "manual conflict list regression pass"],
    toolsUsed: [...baseTools, { name: "get_context", count: 3 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 11 },
      { path: "dashboard/src/lib/data.ts", count: 6 },
      { path: "dashboard/src/app/api/data/route.ts", count: 3 },
    ],
    resumePrompt:
      "Continue the conflict drawer by reviewing dashboard/src/components/dashboard.tsx and then enrich dashboard/src/lib/data.ts with any missing rationale fields.",
  }),
  makeRecord({
    sessionId: "fe_command_palette_005",
    branch: "fe/dashboard-command-palette",
    title: "Design the React command palette for session actions",
    createdAt: isoAt(98),
    updatedAt: isoAt(123),
    status: "draft",
    parentSessionIds: [
      "fe_workspace_shell_001",
      "fe_activity_rail_002",
      "fe_session_details_003",
      "fe_conflict_drawer_004",
    ],
    shareUrl: null,
    summary:
      "Started a command palette concept that would let operators open sessions, jump to conflicts, and filter frontend work without hunting through tabs.",
    goal:
      "Prototype the next interaction layer on top of the workspace shell so large React session corpora remain operable from the keyboard.",
    changesMade: [
      "Mapped the key session actions that deserve palette commands",
      "Outlined a shared action model for open, compare, filter, and inspect",
      "Identified the UI seams in dashboard.tsx where the palette can anchor",
      "Sketched how sessions_context output can seed searchable command items",
    ],
    features: [
      {
        name: "session action palette",
        why: "Keyboardable actions become necessary once the frontend tool has dozens of sessions and several panes.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "command item dataset shaping",
        why: "Palette search needs a compact feed of titles, statuses, branches, and touched files.",
        status: "planned",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
      {
        name: "shell-level interaction hooks",
        why: "The palette should feel native to the workspace shell rather than bolted onto one tab.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/globals.css",
        ],
      },
    ],
    decisions: [
      {
        decision: "Search across session metadata first, raw patch content later",
        why: "Palette interactions should stay fast and relevant before widening into full-text search.",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        decision: "Let the palette launch existing views instead of creating a new page type",
        why: "The shell already has the right panes; the palette should be navigation and command glue.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    blockers: [
      "Need a shared action state model before palette execution can open or focus a pane reliably.",
    ],
    openQuestions: [
      "Should palette commands expose raw session JSON and patch paths directly for power users?",
      "Do we want one global palette or separate palettes scoped to sessions and conflicts?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 3 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 7 },
      { path: "dashboard/src/lib/data.ts", count: 6 },
      { path: "dashboard/src/app/api/data/route.ts", count: 2 },
      { path: "dashboard/src/app/globals.css", count: 2 },
    ],
    resumePrompt:
      "Continue the command palette by stabilizing the action model in dashboard/src/lib/data.ts and then threading palette entry points through dashboard/src/components/dashboard.tsx.",
  }),
  makeRecord({
    sessionId: "fe_data_contracts_006",
    branch: "fe/dashboard-data-contracts",
    title: "Stabilize TSX data contracts for the dashboard API",
    createdAt: isoAt(126),
    updatedAt: isoAt(150),
    status: "finalized",
    parentSessionIds: ["fe_workspace_shell_001", "fe_activity_rail_002"],
    shareUrl: null,
    summary:
      "Refined the frontend data contract so the API route and TSX shell agree on sessions, conflicts, stats, and peer metadata without repeated reshaping in components.",
    goal:
      "Reduce frontend glue code by giving the route and the React shell a cleaner contract for session-driven dashboards.",
    changesMade: [
      "Normalized session and conflict payload shapes",
      "Added explicit stats for counts the shell reads repeatedly",
      "Consolidated file conflict derivation inside the loader layer",
      "Removed assumptions from the TSX shell about missing branch and status fields",
    ],
    features: [
      {
        name: "dashboard data normalization",
        why: "TSX components should spend time rendering, not guessing at missing backend fields.",
        status: "done",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
      {
        name: "frontend stats payload",
        why: "The shell header and future summary widgets need counts without recomputing everything client-side.",
        status: "done",
        files: [
          "dashboard/src/app/api/data/route.ts",
          "dashboard/src/app/page.tsx",
        ],
      },
      {
        name: "conflict payload alignment",
        why: "The conflict drawer depends on a stable set of session titles and paths.",
        status: "done",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Keep file-based reading inside lib/data.ts for now",
        why: "The dashboard is still repo-local, and the route should not open files directly in multiple places.",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        decision: "Return stats from the route instead of deriving them in the shell",
        why: "The same counts are used in multiple places and should stay consistent.",
        files: [
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Do we want one combined payload for the full shell or smaller route slices once the UI becomes interactive?",
    ],
    testsRun: ["npm run build", "manual /api/data inspection"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "dashboard/src/lib/data.ts", count: 13 },
      { path: "dashboard/src/app/api/data/route.ts", count: 8 },
      { path: "dashboard/src/app/page.tsx", count: 4 },
      { path: "dashboard/src/components/dashboard.tsx", count: 3 },
    ],
    resumePrompt:
      "Continue data contract cleanup in dashboard/src/lib/data.ts, then keep dashboard/src/app/api/data/route.ts as the single place that assembles shell payloads.",
  }),
  makeRecord({
    sessionId: "fe_file_map_007",
    branch: "fe/dashboard-file-map",
    title: "Refine the frontend file map for session hotspots",
    createdAt: isoAt(152),
    updatedAt: isoAt(177),
    status: "finalized",
    parentSessionIds: ["fe_data_contracts_006"],
    shareUrl: null,
    summary:
      "Sharpened the file map into a hotspot view that highlights repeated TSX and JSX touch points across sessions and makes repeated frontend pressure visible.",
    goal:
      "Use file-level aggregation to show where the frontend work is clustering so teams can spot fragile areas before collisions happen.",
    changesMade: [
      "Reworked file map ordering around session count and touch density",
      "Tagged repeated hotspots with stronger visual emphasis",
      "Kept per-session contribution badges compact enough for dense maps",
      "Made file path presentation friendlier for mixed JSX and TSX areas",
    ],
    features: [
      {
        name: "hotspot-first file map",
        why: "Operators need to spot overloaded frontend files quickly when many sessions converge on the same components.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        name: "mixed JSX and TSX file labeling",
        why: "The demo corpus includes both React todo JSX and Next dashboard TSX work.",
        status: "done",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/utils.ts",
        ],
      },
      {
        name: "aggregation cleanup",
        why: "The file map should stay legible even when twenty or more sessions exist in the repo.",
        status: "done",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Sort hotspots by breadth before raw touch count",
        why: "A file touched by many sessions is often riskier than a file hammered by one session.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        decision: "Keep the file map inside the main dashboard tabs",
        why: "Hotspot review is part of regular session triage, not a separate admin mode.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/components/ui/tabs.tsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the file map collapse same-directory hotspots into groups once the list gets long?",
    ],
    testsRun: ["npm run build", "manual hotspot ordering review"],
    toolsUsed: [...baseTools, { name: "get_context", count: 1 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 9 },
      { path: "dashboard/src/lib/data.ts", count: 5 },
      { path: "dashboard/src/lib/utils.ts", count: 2 },
      { path: "dashboard/src/components/ui/tabs.tsx", count: 1 },
    ],
    resumePrompt:
      "Continue the hotspot map by stress-testing dashboard/src/components/dashboard.tsx against wider session data and then trim any noisy labeling in dashboard/src/lib/data.ts.",
  }),
  makeRecord({
    sessionId: "fe_peer_console_008",
    branch: "fe/dashboard-peer-console",
    title: "Turn peer cards into a frontend peer console",
    createdAt: isoAt(180),
    updatedAt: isoAt(205),
    status: "draft",
    parentSessionIds: ["fe_workspace_shell_001", "fe_activity_rail_002"],
    shareUrl: null,
    summary:
      "Started reshaping the peer list into a console that explains role hints, capabilities, and recent presence in a way a frontend operator can actually use.",
    goal:
      "Lift the peer panel above a static card grid so it becomes the starting point for assignment and collaboration flows.",
    changesMade: [
      "Outlined richer peer summaries and capability clusters",
      "Mapped where peer actions could sit without crowding the session list",
      "Reviewed the hardcoded peer snapshot and the future MCP path",
      "Identified missing fields needed for real assignment workflows",
    ],
    features: [
      {
        name: "peer console framing",
        why: "Operators need to understand who is available and what they can do before handing off frontend work.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/page.tsx",
        ],
      },
      {
        name: "capability grouping",
        why: "Raw capability strings are too low-level for a manager-style frontend surface.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "presence-aware summaries",
        why: "Assignment decisions depend on whether a peer is active, stale, or offline.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Keep peer actions aspirational until live peer data exists",
        why: "The UI should not imply controllability before the backend can fulfill it.",
        files: [
          "dashboard/src/app/page.tsx",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Use role hints as the primary mental model, capabilities as supporting detail",
        why: "Non-engineer operators think in responsibilities more than low-level transport features.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    blockers: [
      "Peer data is still a snapshot, so assignment actions would be misleading right now.",
    ],
    openQuestions: [
      "Should the eventual peer console sort by availability, skill fit, or recent collaboration history?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 6 },
      { path: "dashboard/src/app/page.tsx", count: 4 },
      { path: "dashboard/src/lib/data.ts", count: 2 },
    ],
    resumePrompt:
      "Continue the peer console by deciding how dashboard/src/app/page.tsx should evolve once live peer data replaces the snapshot.",
  }),
  makeRecord({
    sessionId: "fe_triage_tabs_009",
    branch: "fe/react-todo-triage-tabs",
    title: "Add JSX triage tabs to the React todo fixture",
    createdAt: isoAt(208),
    updatedAt: isoAt(230),
    status: "finalized",
    parentSessionIds: [],
    shareUrl: null,
    summary:
      "Introduced triage tabs in the React todo JSX fixture to split review work into inbox, active, and done states without leaving one screen.",
    goal:
      "Seed the frontend handoff corpus with realistic JSX feature work that shares files and rationale across multiple sessions.",
    changesMade: [
      "Added stateful tabs for inbox, active, and done groupings",
      "Restructured App.jsx rendering to support filtered task lists",
      "Kept interactions lightweight so later sessions can layer more controls",
      "Documented the tab behavior in the demo narrative",
    ],
    features: [
      {
        name: "triage tabs in JSX",
        why: "This fixture needs believable frontend sessions that touch the same React surface for later handoff and conflict inspection.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
      {
        name: "list filtering state",
        why: "Later sessions will build on the same JSX state model for search, edit, and bulk actions.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "fixture story alignment",
        why: "The demo markdown should explain how the frontend sessions relate when inspected from the handoff repo.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Use the todo fixture as the JSX side of the demo corpus",
        why: "The repo already contains a React JSX app that is small enough to reason about and rich enough to create overlapping sessions.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
      {
        decision: "Keep tabs simple so later sessions can layer actions without rewriting the foundation",
        why: "The point is to create believable session history, not one overdesigned fixture step.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the tab state live in the URL once the fixture starts simulating deeper review flows?",
    ],
    testsRun: ["npm run test -- react todo fixture mental model", "manual JSX flow review"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 12 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 4 },
    ],
    resumePrompt:
      "Continue the JSX triage flow in fixtures/react-todo-conflict/src/App.jsx and then sync the updated behavior back into REACT_TODO_CONFLICT_DEMO.md.",
  }),
  makeRecord({
    sessionId: "fe_inline_edit_010",
    branch: "fe/react-todo-inline-edit",
    title: "Layer inline editing on top of the JSX triage flow",
    createdAt: isoAt(232),
    updatedAt: isoAt(257),
    status: "finalized",
    parentSessionIds: ["fe_triage_tabs_009"],
    shareUrl: null,
    summary:
      "Built inline editing into the same JSX todo surface so reviewers can correct items without losing their place in the triage tabs.",
    goal:
      "Create a second realistic JSX session that shares state and files with the tab work, giving the handoff repo a meaningful relationship to inspect.",
    changesMade: [
      "Added editable rows and save/cancel controls",
      "Preserved the active triage context while an item is being edited",
      "Kept the edit affordance lightweight enough for later bulk actions",
      "Updated the fixture story to capture the new editing flow",
    ],
    features: [
      {
        name: "inline row editing",
        why: "Review flows often need small textual corrections without navigating away from the current queue.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "tab-aware edit persistence",
        why: "The user should not lose the current triage context while editing a row.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "fixture rationale update",
        why: "The handoff story needs to explain why this session now overlaps with triage tabs in the same JSX file.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Keep edits inline instead of a separate form",
        why: "The fixture is modeling reviewer throughput, so maintaining context is more important than verbose editing chrome.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        decision: "Reuse the existing list rendering path",
        why: "Subsequent sessions need the same JSX surface to remain a believable overlap hotspot.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should edit state survive refresh once search and persistence arrive?",
    ],
    testsRun: ["manual JSX edit flow review"],
    toolsUsed: [...baseTools, { name: "get_context", count: 1 }],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 14 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 3 },
    ],
    resumePrompt:
      "Continue the inline edit work in fixtures/react-todo-conflict/src/App.jsx and watch for state collisions with any triage tab updates.",
  }),
  makeRecord({
    sessionId: "fe_bulk_actions_011",
    branch: "fe/react-todo-bulk-actions",
    title: "Add bulk review actions to the shared JSX todo surface",
    createdAt: isoAt(260),
    updatedAt: isoAt(284),
    status: "finalized",
    parentSessionIds: ["fe_triage_tabs_009"],
    shareUrl: null,
    summary:
      "Added bulk selection and toolbar actions to the same JSX todo surface so the corpus includes realistic overlapping frontend sessions with different rationale.",
    goal:
      "Create a parallel frontend session that touches the same JSX file as triage tabs and inline edit work but solves a different review problem.",
    changesMade: [
      "Added per-row selection state and a bulk toolbar",
      "Created bulk complete and bulk archive flows",
      "Made toolbar visibility depend on selection count",
      "Captured the new overlap in the fixture narrative",
    ],
    features: [
      {
        name: "bulk selection toolbar",
        why: "Reviewers need to process repeated low-value items quickly when a queue builds up.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "selection-aware row rendering",
        why: "The same JSX list now needs to support actions on one item or many.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "fixture overlap story update",
        why: "The handoff repo should explain why multiple frontend sessions share App.jsx with distinct intent.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Use a transient toolbar instead of permanent row action clutter",
        why: "The JSX fixture should stay readable even as more review behaviors land.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        decision: "Treat selection state as peer to filter state",
        why: "Future sessions will need both to coexist without one silently resetting the other.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should bulk actions remain visible when a search filter hides some selected rows?",
    ],
    testsRun: ["manual bulk review pass"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 13 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 2 },
    ],
    resumePrompt:
      "Continue the bulk review flow in fixtures/react-todo-conflict/src/App.jsx and validate how selection should interact with any future search state.",
  }),
  makeRecord({
    sessionId: "fe_search_persist_012",
    branch: "fe/react-todo-search-persist",
    title: "Add search and local persistence to the JSX triage board",
    createdAt: isoAt(286),
    updatedAt: isoAt(312),
    status: "finalized",
    parentSessionIds: ["fe_triage_tabs_009"],
    shareUrl: null,
    summary:
      "Introduced search and local persistence in the same JSX file, creating another overlapping session with a distinct rationale centered on continuity and retrieval.",
    goal:
      "Expand the fixture into a more realistic React frontend by letting review state survive reload and by making large queues searchable.",
    changesMade: [
      "Added a text search field that filters the rendered task set",
      "Persisted todos and filter state locally",
      "Shaped the state to coexist with the earlier tab-based triage flow",
      "Documented the persistence rationale for later overlap analysis",
    ],
    features: [
      {
        name: "search-backed triage board",
        why: "Large review queues stop being usable unless the frontend can narrow the visible set quickly.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "local persistence",
        why: "Reviewers should not lose work when they reload the page or reopen the fixture.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "fixture story continuity",
        why: "The session narrative should make it obvious why this work overlaps with tabs, edits, and bulk actions.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Persist only review state, not transient draft edits",
        why: "Saving half-finished inline edits would create a rough demo experience and blur intent.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        decision: "Search inside the current triage context before widening to all items",
        why: "Users think about narrowing the queue they are already in before jumping to another status bucket.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should persistence include active tab, search query, and selection together or keep some of them ephemeral?",
    ],
    testsRun: ["manual persistence pass", "manual search filtering review"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 16 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 3 },
    ],
    resumePrompt:
      "Continue the search and persistence flow in fixtures/react-todo-conflict/src/App.jsx and reconcile it carefully with selection and inline edit state.",
  }),
  makeRecord({
    sessionId: "fe_working_set_merge_013",
    branch: "fe/react-todo-working-set-merge",
    title: "Integrate the strongest JSX review features into one working set",
    createdAt: isoAt(314),
    updatedAt: isoAt(340),
    status: "draft",
    parentSessionIds: ["fe_inline_edit_010", "fe_bulk_actions_011", "fe_search_persist_012"],
    shareUrl: null,
    summary:
      "Started integrating tabs, inline edits, search, and bulk actions into one coherent JSX working set, exposing where the frontend state model still fights itself.",
    goal:
      "Use the overlapping React sessions as raw material for one combined review surface and capture the seams that need cleanup.",
    changesMade: [
      "Compared the overlapping JSX state models from the three prior sessions",
      "Mapped the most dangerous interaction points between search, selection, and edits",
      "Outlined a combined working set reducer-style approach",
      "Updated the fixture story toward integration instead of isolated features",
    ],
    features: [
      {
        name: "working set integration",
        why: "The handoff corpus should include a believable phase where separate frontend feature branches are brought together.",
        status: "partial",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
      {
        name: "state interaction audit",
        why: "The integrated JSX flow only works if selection, editing, and search stop trampling each other.",
        status: "partial",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "integration narrative",
        why: "The session history should explain how isolated frontend sessions become one merged review experience.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Integrate working-set behavior before adding more JSX features",
        why: "The fixture is already complex enough that extra features would hide the real coordination problem.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        decision: "Document state collisions explicitly in the handoff narrative",
        why: "This session should teach the repo how a frontend merge effort differs from a simple feature branch.",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    blockers: [
      "Selection and inline edit state still need a shared source of truth before the combined JSX flow is reliable.",
    ],
    openQuestions: [
      "Do we want reducer-style state, or is the fixture still simple enough for grouped useState hooks?",
      "Should hidden selected rows stay selected when the search query changes?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools, { name: "get_context", count: 4 }],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 18 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 5 },
    ],
    resumePrompt:
      "Continue the working-set merge by untangling shared state inside fixtures/react-todo-conflict/src/App.jsx before adding any new JSX affordances.",
  }),
  makeRecord({
    sessionId: "fe_review_toolbar_014",
    branch: "fe/react-todo-review-toolbar",
    title: "Build a JSX review toolbar on top of the integrated working set",
    createdAt: isoAt(342),
    updatedAt: isoAt(366),
    status: "finalized",
    parentSessionIds: ["fe_working_set_merge_013"],
    shareUrl: null,
    summary:
      "Introduced a review toolbar that turns the integrated JSX working set into a real triage surface, with session-driven actions clustered at the top of the board.",
    goal:
      "Use the integrated working set as the base for a denser React review toolbar that mirrors how frontend teams handle queues in practice.",
    changesMade: [
      "Added a top-level review toolbar above the task list",
      "Grouped shared actions so the board feels more like a review console",
      "Aligned toolbar behavior with selection and filter state",
      "Updated the fixture narrative to connect the toolbar with prior JSX sessions",
    ],
    features: [
      {
        name: "review toolbar",
        why: "Once the JSX board has multiple actions, those actions need a coherent home that reflects review intent.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "integrated action grouping",
        why: "Bulk, filter, and review flows should feel like one system instead of separate patches to the same file.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        name: "story continuity update",
        why: "The handoff story should now show a path from isolated JSX features to a cohesive review experience.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Place the review toolbar above the filtered list",
        why: "Shared actions should reflect the visible working set, not sit far away from the content they affect.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
      {
        decision: "Keep the toolbar declarative and local to App.jsx",
        why: "The fixture stays easier to reason about if the whole JSX interaction remains in one file.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the toolbar preview how many hidden selected rows exist when search is active?",
    ],
    testsRun: ["manual integrated review pass"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 17 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 4 },
    ],
    resumePrompt:
      "Continue the review toolbar in fixtures/react-todo-conflict/src/App.jsx and keep the toolbar synchronized with both filter and selection state.",
  }),
  makeRecord({
    sessionId: "fe_conflict_repro_015",
    branch: "fe/react-todo-conflict-repro",
    title: "Capture a realistic JSX overlap repro for handoff inspection",
    createdAt: isoAt(368),
    updatedAt: isoAt(394),
    status: "finalized",
    parentSessionIds: ["fe_inline_edit_010", "fe_bulk_actions_011", "fe_search_persist_012", "fe_review_toolbar_014"],
    shareUrl: null,
    summary:
      "Recorded a deliberate JSX overlap repro so the handoff repo has a realistic frontend case where several sessions touch App.jsx for different reasons.",
    goal:
      "Make the .handoffs corpus demonstrate more than one-off features by showing how a frontend file becomes a hotspot with multiple overlapping narratives.",
    changesMade: [
      "Captured the dominant overlapping JSX sessions as one reproducible story",
      "Made the fixture demo explain the branch relationships more directly",
      "Emphasized how rationale differs across the sessions even when the file is the same",
      "Positioned the overlap as an inspection and resume scenario, not only a merge problem",
    ],
    features: [
      {
        name: "realistic overlap repro",
        why: "The handoff repo should teach session inspection, history reconstruction, and frontend hotspot review from one concrete example.",
        status: "done",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
      {
        name: "branch relationship narrative",
        why: "Operators need to see how distinct frontend goals converged on the same JSX surface.",
        status: "done",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
      {
        name: "inspection-first framing",
        why: "The session should support debug and audit workflows, not just conflict resolution.",
        status: "done",
        files: [
          "README.md",
          "REACT_TODO_CONFLICT_DEMO.md",
        ],
      },
    ],
    decisions: [
      {
        decision: "Frame the overlap as a handoff dataset asset, not just fixture drama",
        why: "The demo should prove why repo-local memory matters for React frontends with parallel work.",
        files: [
          "REACT_TODO_CONFLICT_DEMO.md",
          "README.md",
        ],
      },
      {
        decision: "Keep App.jsx as the hotspot file",
        why: "Using one shared JSX surface makes the inspection story crisp and the overlap obvious.",
        files: [
          "fixtures/react-todo-conflict/src/App.jsx",
        ],
      },
    ],
    blockers: [],
    openQuestions: [
      "Should the demo narrative include example /sessions-context usage now that the corpus is much larger?",
    ],
    testsRun: ["manual narrative review"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 2 }],
    filesTouched: [
      { path: "fixtures/react-todo-conflict/src/App.jsx", count: 8 },
      { path: "REACT_TODO_CONFLICT_DEMO.md", count: 9 },
      { path: "README.md", count: 2 },
    ],
    resumePrompt:
      "Continue the overlap repro by checking REACT_TODO_CONFLICT_DEMO.md first, then inspect the shared JSX hotspot in fixtures/react-todo-conflict/src/App.jsx.",
  }),
  makeRecord({
    sessionId: "fe_ui_polish_016",
    branch: "fe/dashboard-ui-polish",
    title: "Polish the dashboard TSX styling for dense session corpora",
    createdAt: isoAt(396),
    updatedAt: isoAt(420),
    status: "draft",
    parentSessionIds: ["fe_workspace_shell_001", "fe_session_details_003", "fe_file_map_007"],
    shareUrl: null,
    summary:
      "Started tightening spacing, type rhythm, and density controls so the dashboard remains readable with a large session dataset instead of the small original demo.",
    goal:
      "Adapt the React dashboard to the new twenty-session corpus without turning the UI into a wall of repeated card chrome.",
    changesMade: [
      "Reviewed long-session rendering under denser data",
      "Outlined spacing and hierarchy adjustments for the shell and cards",
      "Identified where repeated borders and padding feel too heavy",
      "Mapped the CSS areas that need a more operational frontend tone",
    ],
    features: [
      {
        name: "dense corpus polish",
        why: "A frontend inspection tool should remain readable when the dataset grows well past the original handful of sessions.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/globals.css",
        ],
      },
      {
        name: "long-content containment",
        why: "Big session summaries, decisions, and file lists need stronger layout discipline in TSX.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        name: "operational visual tone",
        why: "The dashboard should read like a control plane, not a generic component showcase.",
        status: "planned",
        files: [
          "dashboard/src/app/globals.css",
        ],
      },
    ],
    decisions: [
      {
        decision: "Polish density after the larger dataset exists",
        why: "The real pressure points only show up once the frontend is exercised with many sessions.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/globals.css",
        ],
      },
      {
        decision: "Keep layout changes close to the existing shell",
        why: "This pass should refine the tool, not replace the structure that earlier sessions established.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    blockers: [
      "Need screenshots or live review to validate density decisions instead of tuning purely from code.",
    ],
    openQuestions: [
      "Should sessions default to collapsed or expanded when the corpus is this large?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 8 },
      { path: "dashboard/src/app/globals.css", count: 6 },
    ],
    resumePrompt:
      "Continue the density polish in dashboard/src/app/globals.css, then tune any overlong session sections in dashboard/src/components/dashboard.tsx.",
  }),
  makeRecord({
    sessionId: "fe_api_filters_017",
    branch: "fe/dashboard-api-filters",
    title: "Add richer API-side filters for session inspection",
    createdAt: isoAt(422),
    updatedAt: isoAt(448),
    status: "draft",
    parentSessionIds: ["fe_data_contracts_006", "fe_command_palette_005"],
    shareUrl: null,
    summary:
      "Started shaping richer server-side filters so the frontend can query session status, branch families, and text search without downloading everything first.",
    goal:
      "Prepare the dashboard and future command palette for larger handoff corpora by moving more filtering work into the route layer.",
    changesMade: [
      "Mapped filter inputs needed by sessions_context and the dashboard shell",
      "Outlined branch, status, and text filter behavior",
      "Reviewed where data.ts can own filtering without multiplying route logic",
      "Identified places where the frontend still assumes a full corpus load",
    ],
    features: [
      {
        name: "route-side session filtering",
        why: "Larger frontend corpora will eventually need narrower payloads for speed and clarity.",
        status: "partial",
        files: [
          "dashboard/src/app/api/data/route.ts",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "command palette filter feed",
        why: "The palette should be able to search the same filtered dataset the shell is showing.",
        status: "planned",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        name: "branch family awareness",
        why: "Grouping frontend sessions by branch family helps when several related efforts are active at once.",
        status: "partial",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
    ],
    decisions: [
      {
        decision: "Keep filtering primitives in lib/data.ts even if the route exposes them",
        why: "One shared implementation reduces drift between API and direct file-based reads.",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
      {
        decision: "Support status and query first, branch groupings second",
        why: "Those two filters unlock the biggest inspection gains with the smallest surface area.",
        files: [
          "dashboard/src/app/api/data/route.ts",
        ],
      },
    ],
    blockers: [
      "The shell still expects the whole session list, so route filtering needs a small frontend contract pass too.",
    ],
    openQuestions: [
      "Should filter state live in the URL before we add server-side filtering?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 1 }],
    filesTouched: [
      { path: "dashboard/src/app/api/data/route.ts", count: 7 },
      { path: "dashboard/src/lib/data.ts", count: 7 },
      { path: "dashboard/src/components/dashboard.tsx", count: 2 },
    ],
    resumePrompt:
      "Continue API filtering in dashboard/src/lib/data.ts, then update dashboard/src/app/api/data/route.ts once the filter contract is settled.",
  }),
  makeRecord({
    sessionId: "fe_session_compare_018",
    branch: "fe/dashboard-session-compare",
    title: "Prototype session-to-session compare views in TSX",
    createdAt: isoAt(450),
    updatedAt: isoAt(474),
    status: "draft",
    parentSessionIds: ["fe_conflict_drawer_004", "fe_session_details_003", "fe_file_map_007"],
    shareUrl: null,
    summary:
      "Began a compare-view concept so operators can inspect two frontend sessions side by side and understand overlap without manually hopping between expanded cards.",
    goal:
      "Move the dashboard closer to L4 observability by making side-by-side session comparison a real TSX workflow.",
    changesMade: [
      "Mapped the compare use cases coming from hotspot and conflict review",
      "Outlined a split-pane TSX layout for paired session context",
      "Identified the data slices needed for files, rationale, and test histories",
      "Reviewed how compare actions could originate from conflicts and session cards",
    ],
    features: [
      {
        name: "paired session compare view",
        why: "Operators need a direct way to inspect overlap and divergence between two frontend sessions.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        name: "compare data shaping",
        why: "A compare view depends on consistent session payloads and highlighted deltas.",
        status: "partial",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/app/api/data/route.ts",
        ],
      },
      {
        name: "conflict-origin compare entry points",
        why: "Conflict review is the most obvious place to launch side-by-side inspection.",
        status: "partial",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Start with same-repo session compare instead of cross-repo compare",
        why: "The existing handoff data model is repo-local, so this keeps scope aligned with what the system already knows.",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        decision: "Compare rationale and files before raw patch text",
        why: "Intent and touched surfaces are faster to scan than long markdown patches.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    blockers: [
      "Need a compare state model and likely URL params before the split-pane view can be navigated reliably.",
    ],
    openQuestions: [
      "Should compare mode live inside the current shell or open a dedicated route?",
    ],
    testsRun: ["design review only"],
    toolsUsed: [...baseTools, { name: "get_context", count: 2 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 5 },
      { path: "dashboard/src/lib/data.ts", count: 4 },
      { path: "dashboard/src/app/api/data/route.ts", count: 3 },
    ],
    resumePrompt:
      "Continue the compare prototype by settling the paired-session data shape in dashboard/src/lib/data.ts before touching the TSX layout.",
  }),
  makeRecord({
    sessionId: "fe_onboarding_flow_019",
    branch: "fe/dashboard-onboarding-flow",
    title: "Sketch a non-engineer onboarding flow for new session roles",
    createdAt: isoAt(476),
    updatedAt: isoAt(502),
    status: "draft",
    parentSessionIds: ["fe_peer_console_008", "fe_workspace_shell_001"],
    shareUrl: null,
    summary:
      "Sketched how a non-engineer could onboard a new session role from the frontend, moving the dashboard toward a manager surface instead of a read-only viewer.",
    goal:
      "Define the first onboarding workflow that uses the React frontend to set role, expectations, and guardrails for future session work.",
    changesMade: [
      "Outlined the onboarding steps a new operator would need",
      "Mapped where peer role hints and task framing would appear in the shell",
      "Identified missing data fields for job, tools, and constraints",
      "Connected the flow to the peer console and shell structure",
    ],
    features: [
      {
        name: "role onboarding concept",
        why: "A management UI only becomes real once someone outside engineering can create and shape work.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/page.tsx",
        ],
      },
      {
        name: "guided setup steps",
        why: "The onboarding flow needs a simple sequence rather than exposing raw system primitives up front.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/globals.css",
        ],
      },
      {
        name: "role metadata contract",
        why: "Frontend onboarding only works if the backend and session store understand role definitions.",
        status: "partial",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
    ],
    decisions: [
      {
        decision: "Make onboarding a workflow layer over the existing shell",
        why: "The shell already has the right context; onboarding should guide use of it instead of spawning another experience.",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Define role cards in human language, not transport capability jargon",
        why: "The first target user for onboarding is not a systems engineer.",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/app/page.tsx",
        ],
      },
    ],
    blockers: [
      "The repo does not yet persist role definitions, so the onboarding flow is a shell-only concept for now.",
    ],
    openQuestions: [
      "What is the minimum role schema that lets a non-engineer safely define a new session lane?",
    ],
    testsRun: ["concept review only"],
    toolsUsed: [...baseTools],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 5 },
      { path: "dashboard/src/app/page.tsx", count: 3 },
      { path: "dashboard/src/app/globals.css", count: 2 },
      { path: "dashboard/src/lib/data.ts", count: 2 },
    ],
    resumePrompt:
      "Continue the onboarding concept by defining the minimum role metadata in dashboard/src/lib/data.ts before expanding the flow in dashboard/src/components/dashboard.tsx.",
  }),
  makeRecord({
    sessionId: "fe_handoff_timeline_020",
    branch: "fe/dashboard-handoff-timeline",
    title: "Design a frontend handoff timeline from the seeded session corpus",
    createdAt: isoAt(504),
    updatedAt: isoAt(530),
    status: "draft",
    parentSessionIds: [
      "fe_workspace_shell_001",
      "fe_activity_rail_002",
      "fe_session_details_003",
      "fe_session_compare_018",
    ],
    shareUrl: null,
    summary:
      "Started a timeline view that would string the seeded frontend sessions into one narrative of layout, data, overlap, and review work.",
    goal:
      "Use the new twenty-session corpus to prototype a frontend timeline that makes long-running work legible across many handoffs.",
    changesMade: [
      "Mapped how sessions could be grouped into dashboard shell, data, JSX fixture, and management tracks",
      "Identified the timeline metadata already present in the handoff repo",
      "Outlined a timeline band that could sit above or beside the session list",
      "Connected the compare concept with the timeline as two sides of inspection",
    ],
    features: [
      {
        name: "handoff timeline concept",
        why: "Operators need a chronological view when the session list gets too large to understand as a flat feed.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "session track grouping",
        why: "Grouping dashboard shell work separately from JSX fixture work makes the corpus easier to reason about.",
        status: "partial",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
      {
        name: "timeline-driven compare launch",
        why: "A timeline is more valuable if it can pivot directly into detailed side-by-side inspection.",
        status: "planned",
        files: [
          "dashboard/src/components/dashboard.tsx",
        ],
      },
    ],
    decisions: [
      {
        decision: "Design the timeline against the seeded corpus, not the original small demo",
        why: "The larger dataset reveals the real shape of the inspection problem.",
        files: [
          "dashboard/src/lib/data.ts",
          "dashboard/src/components/dashboard.tsx",
        ],
      },
      {
        decision: "Use branch family and parent relationships as timeline scaffolding",
        why: "Those are the most trustworthy signals already stored in the handoff repo.",
        files: [
          "dashboard/src/lib/data.ts",
        ],
      },
    ],
    blockers: [
      "Need a clear visual model for timeline density before implementing it in the existing shell.",
    ],
    openQuestions: [
      "Should the timeline be the default first screen once the corpus grows past twenty sessions?",
      "Do we want the timeline to group drafts separately from finalized sessions?",
    ],
    testsRun: ["concept review only"],
    toolsUsed: [...baseTools, { name: "sessions_context", count: 2 }],
    filesTouched: [
      { path: "dashboard/src/components/dashboard.tsx", count: 4 },
      { path: "dashboard/src/lib/data.ts", count: 4 },
    ],
    resumePrompt:
      "Continue the handoff timeline by grouping the seeded frontend sessions in dashboard/src/lib/data.ts before experimenting with a new TSX panel in dashboard/src/components/dashboard.tsx.",
  }),
];

const materializedContexts = [
  {
    name: "context-dashboard-shell-and-conflicts.md",
    markdown: [
      "# Dashboard Shell Context",
      "",
      "- Related sessions: fe_workspace_shell_001, fe_activity_rail_002, fe_session_details_003, fe_conflict_drawer_004, fe_command_palette_005",
      "- Primary files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/data.ts, dashboard/src/app/page.tsx",
      "- Why it matters: these sessions establish the TSX control plane that future manager workflows will build on.",
      "- Watchouts: card density, command palette action model, and richer conflict navigation remain unfinished.",
      "",
    ].join("\n"),
  },
  {
    name: "context-react-jsx-working-set.md",
    markdown: [
      "# React JSX Working Set",
      "",
      "- Related sessions: fe_triage_tabs_009, fe_inline_edit_010, fe_bulk_actions_011, fe_search_persist_012, fe_working_set_merge_013, fe_review_toolbar_014, fe_conflict_repro_015",
      "- Primary file: fixtures/react-todo-conflict/src/App.jsx",
      "- Why it matters: this is the seeded overlap story for JSX review work with multiple valid but competing frontend goals.",
      "- Watchouts: shared state between search, edit, and selection remains the main integration risk.",
      "",
    ].join("\n"),
  },
  {
    name: "context-management-ui-next-steps.md",
    markdown: [
      "# Management UI Next Steps",
      "",
      "- Related sessions: fe_peer_console_008, fe_onboarding_flow_019, fe_session_compare_018, fe_handoff_timeline_020",
      "- Primary files: dashboard/src/components/dashboard.tsx, dashboard/src/app/page.tsx, dashboard/src/lib/data.ts",
      "- Why it matters: these drafts point from a read-only dashboard toward a true manager surface with role onboarding and session comparison.",
      "- Watchouts: live peer data and role persistence do not exist yet, so the UI concepts are ahead of backend reality.",
      "",
    ].join("\n"),
  },
];

const shortlists: PrefetchShortlist[] = [
  {
    schemaVersion: 1,
    sessionId: "fe_command_palette_005",
    createdAt: isoAt(123),
    candidates: [
      { sessionId: "fe_conflict_drawer_004", title: "Turn conflict rows into a frontend conflict drawer", score: 15, reasonSelected: ["file overlap", "branch match"] },
      { sessionId: "fe_session_details_003", title: "Expand session detail cards into full inspection panes", score: 14, reasonSelected: ["file overlap", "recent"] },
      { sessionId: "fe_activity_rail_002", title: "Add a frontend activity rail for live session movement", score: 10, reasonSelected: ["directory overlap"] },
    ],
  },
  {
    schemaVersion: 1,
    sessionId: "fe_working_set_merge_013",
    createdAt: isoAt(340),
    candidates: [
      { sessionId: "fe_inline_edit_010", title: "Layer inline editing on top of the JSX triage flow", score: 16, reasonSelected: ["file overlap", "query rationale match"] },
      { sessionId: "fe_bulk_actions_011", title: "Add bulk review actions to the shared JSX todo surface", score: 15, reasonSelected: ["file overlap", "prefetch shortlist"] },
      { sessionId: "fe_search_persist_012", title: "Add search and local persistence to the JSX triage board", score: 15, reasonSelected: ["file overlap", "recent"] },
    ],
  },
  {
    schemaVersion: 1,
    sessionId: "fe_session_compare_018",
    createdAt: isoAt(474),
    candidates: [
      { sessionId: "fe_conflict_drawer_004", title: "Turn conflict rows into a frontend conflict drawer", score: 13, reasonSelected: ["query summary match", "file overlap"] },
      { sessionId: "fe_session_details_003", title: "Expand session detail cards into full inspection panes", score: 12, reasonSelected: ["query title match", "directory overlap"] },
      { sessionId: "fe_handoff_timeline_020", title: "Design a frontend handoff timeline from the seeded session corpus", score: 9, reasonSelected: ["query rationale match"] },
    ],
  },
];

async function seed(): Promise<void> {
  await fs.rm(paths.handoffsDir, { recursive: true, force: true });
  await ensureHandoffLayout(paths);

  for (const session of sessions) {
    await saveSessionRecord(paths, session);
  }

  for (const context of materializedContexts) {
    await saveMaterializedContext(paths, context.name, context.markdown);
  }

  for (const shortlist of shortlists) {
    await saveShortlist(paths, shortlist);
  }

  const summary = {
    sessions: sessions.length,
    finalized: sessions.filter((session) => session.status === "finalized").length,
    drafts: sessions.filter((session) => session.status === "draft").length,
    interlinkedFive: sessions
      .filter((session) =>
        [
          "fe_workspace_shell_001",
          "fe_activity_rail_002",
          "fe_session_details_003",
          "fe_conflict_drawer_004",
          "fe_command_palette_005",
        ].includes(session.sessionId)
      )
      .map((session) => ({
        sessionId: session.sessionId,
        parents: session.parentSessionIds,
        primaryFiles: session.filesTouched.slice(0, 3).map((file) => file.path),
      })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

await seed();
