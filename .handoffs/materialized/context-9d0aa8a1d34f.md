# Merged Context

## Selected Sessions
- fe_conflict_drawer_004 - Turn conflict rows into a frontend conflict drawer - directory overlap, recent, finalized, query title match, query summary match, query rationale match
- fe_file_map_007 - Refine the frontend file map for session hotspots - directory overlap, recent, finalized, query title match, query summary match, query rationale match, prefetch shortlist
- fe_handoff_timeline_020 - Design a frontend handoff timeline from the seeded session corpus - directory overlap, recent, query title match, query summary match, query rationale match
- fe_peer_console_008 - Turn peer cards into a frontend peer console - directory overlap, recent, query title match, query summary match, query rationale match
- ses_25ac48418ffefLyRLmYQ0sPASX - Interpreting auto debug session context command - current session

## Current Task Context
- branch: main
- current session id: ses_25ac48418ffefLyRLmYQ0sPASX
- current dirty files: handoffs/index.json, .handoffs/cache/shortlist-ses_25ac48418ffefLyRLmYQ0sPASX.json, .handoffs/materialized/context-68c08c26354e.md, .handoffs/patches/ses_25ac48418ffefLyRLmYQ0sPASX.md, .handoffs/patches/ses_25ad8ba7bffez9KKmonlUypv7D.md, .handoffs/sessions/ses_25ac48418ffefLyRLmYQ0sPASX.json, .handoffs/sessions/ses_25ad8ba7bffez9KKmonlUypv7D.json, dashboard/, fixtures/react-todo-conflict/

## Features and Why
- conflict drawer presentation
  - why: A high-signal review surface helps frontend teams inspect overlapping work before it turns into broken UX.
  - from: fe_conflict_drawer_004
  - files: dashboard/src/components/dashboard.tsx
- rationale-first conflict summaries
  - why: The operator needs to know why two sessions touched the same file, not just that they did.
  - from: fe_conflict_drawer_004
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/data.ts
- shared conflict contract
  - why: Keep API and UI aligned as conflict payloads become richer.
  - from: fe_conflict_drawer_004
  - files: dashboard/src/lib/data.ts, dashboard/src/app/api/data/route.ts
- hotspot-first file map
  - why: Operators need to spot overloaded frontend files quickly when many sessions converge on the same components.
  - from: fe_file_map_007
  - files: dashboard/src/components/dashboard.tsx
- mixed JSX and TSX file labeling
  - why: The demo corpus includes both React todo JSX and Next dashboard TSX work.
  - from: fe_file_map_007
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/utils.ts
- aggregation cleanup
  - why: The file map should stay legible even when twenty or more sessions exist in the repo.
  - from: fe_file_map_007
  - files: dashboard/src/lib/data.ts, dashboard/src/components/dashboard.tsx
- handoff timeline concept
  - why: Operators need a chronological view when the session list gets too large to understand as a flat feed.
  - from: fe_handoff_timeline_020
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/data.ts
- session track grouping
  - why: Grouping dashboard shell work separately from JSX fixture work makes the corpus easier to reason about.
  - from: fe_handoff_timeline_020
  - files: dashboard/src/lib/data.ts
- timeline-driven compare launch
  - why: A timeline is more valuable if it can pivot directly into detailed side-by-side inspection.
  - from: fe_handoff_timeline_020
  - files: dashboard/src/components/dashboard.tsx
- peer console framing
  - why: Operators need to understand who is available and what they can do before handing off frontend work.
  - from: fe_peer_console_008
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/app/page.tsx
- capability grouping
  - why: Raw capability strings are too low-level for a manager-style frontend surface.
  - from: fe_peer_console_008
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/data.ts
- presence-aware summaries
  - why: Assignment decisions depend on whether a peer is active, stale, or offline.
  - from: fe_peer_console_008
  - files: dashboard/src/components/dashboard.tsx

## Decisions
- Treat conflicts as an inspection workflow instead of a warning badge
  - why: Frontend overlap often needs a human-quality judgment rather than a single binary signal.
  - from: fe_conflict_drawer_004
  - files: dashboard/src/components/dashboard.tsx
- Keep the first version read-only
  - why: The team needs reliable visibility before wiring any mutation or assignment actions into the UI.
  - from: fe_conflict_drawer_004
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/app/api/data/route.ts
- Sort hotspots by breadth before raw touch count
  - why: A file touched by many sessions is often riskier than a file hammered by one session.
  - from: fe_file_map_007
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/lib/data.ts
- Keep the file map inside the main dashboard tabs
  - why: Hotspot review is part of regular session triage, not a separate admin mode.
  - from: fe_file_map_007
  - files: dashboard/src/components/dashboard.tsx, dashboard/src/components/ui/tabs.tsx
- Design the timeline against the seeded corpus, not the original small demo
  - why: The larger dataset reveals the real shape of the inspection problem.
  - from: fe_handoff_timeline_020
  - files: dashboard/src/lib/data.ts, dashboard/src/components/dashboard.tsx
- Use branch family and parent relationships as timeline scaffolding
  - why: Those are the most trustworthy signals already stored in the handoff repo.
  - from: fe_handoff_timeline_020
  - files: dashboard/src/lib/data.ts
- Keep peer actions aspirational until live peer data exists
  - why: The UI should not imply controllability before the backend can fulfill it.
  - from: fe_peer_console_008
  - files: dashboard/src/app/page.tsx, dashboard/src/components/dashboard.tsx
- Use role hints as the primary mental model, capabilities as supporting detail
  - why: Non-engineer operators think in responsibilities more than low-level transport features.
  - from: fe_peer_console_008
  - files: dashboard/src/components/dashboard.tsx

## Question Summary
Reworked conflict visibility into a drawer-style inspection flow so overlapping TSX and JSX work can be reviewed with rationale, branches, and suggested tests in one place.

## Relevant Files
1. dashboard/src/components/dashboard.tsx - 30
2. dashboard/src/lib/data.ts - 17
3. dashboard/src/app/api/data/route.ts - 3
4. dashboard/src/lib/utils.ts - 2
5. dashboard/src/components/ui/tabs.tsx - 1
6. dashboard/src/app/page.tsx - 4

## Files Touched Most
1. dashboard/src/components/dashboard.tsx - 30
2. dashboard/src/lib/data.ts - 17
3. dashboard/src/app/page.tsx - 4
4. dashboard/src/app/api/data/route.ts - 3
5. dashboard/src/lib/utils.ts - 2
6. dashboard/src/components/ui/tabs.tsx - 1

## Conflict Risks
- dashboard/src/components/dashboard.tsx
  - sessions: fe_conflict_drawer_004, fe_file_map_007, fe_handoff_timeline_020, fe_peer_console_008
  - differing rationale: conflict drawer presentation | rationale-first conflict summaries | Treat conflicts as an inspection workflow instead of a warning badge | Keep the first version read-only | hotspot-first file map | mixed JSX and TSX file labeling | aggregation cleanup | Sort hotspots by breadth before raw touch count | Keep the file map inside the main dashboard tabs | handoff timeline concept | timeline-driven compare launch | Design the timeline against the seeded corpus, not the original small demo | peer console framing | capability grouping | presence-aware summaries | Keep peer actions aspirational until live peer data exists | Use role hints as the primary mental model, capabilities as supporting detail
- dashboard/src/lib/data.ts
  - sessions: fe_conflict_drawer_004, fe_file_map_007, fe_handoff_timeline_020, fe_peer_console_008
  - differing rationale: rationale-first conflict summaries | shared conflict contract | aggregation cleanup | Sort hotspots by breadth before raw touch count | handoff timeline concept | session track grouping | Design the timeline against the seeded corpus, not the original small demo | Use branch family and parent relationships as timeline scaffolding | capability grouping
- dashboard/src/app/page.tsx
  - sessions: fe_peer_console_008
  - differing rationale: peer console framing | Keep peer actions aspirational until live peer data exists
- dashboard/src/app/api/data/route.ts
  - sessions: fe_conflict_drawer_004
  - differing rationale: shared conflict contract | Keep the first version read-only

## Tests To Re-run
- concept review only
- design review only
- manual conflict list regression pass
- manual hotspot ordering review
- npm run build

## Open Questions
- Do we want the timeline to group drafts separately from finalized sessions?
- Should the eventual peer console sort by availability, skill fit, or recent collaboration history?
- Should the file map collapse same-directory hotspots into groups once the list gets long?
- Should the first action from a conflict drawer be compare context, open file, or assign reviewer?
- Should the timeline be the default first screen once the corpus grows past twenty sessions?

## Resume Prompt
Continue the conflict drawer by reviewing dashboard/src/components/dashboard.tsx and then enrich dashboard/src/lib/data.ts with any missing rationale fields.
