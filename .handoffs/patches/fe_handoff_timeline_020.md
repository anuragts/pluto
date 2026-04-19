# Session fe_handoff_timeline_020: Design a frontend handoff timeline from the seeded session corpus

## Goal
Use the new twenty-session corpus to prototype a frontend timeline that makes long-running work legible across many handoffs.

## Changes Made
- Mapped how sessions could be grouped into dashboard shell, data, JSX fixture, and management tracks
- Identified the timeline metadata already present in the handoff repo
- Outlined a timeline band that could sit above or beside the session list
- Connected the compare concept with the timeline as two sides of inspection

## Why These Changes Were Made
- Feature: handoff timeline concept
  - Why: Operators need a chronological view when the session list gets too large to understand as a flat feed.
  - Status: planned
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx), [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)
- Feature: session track grouping
  - Why: Grouping dashboard shell work separately from JSX fixture work makes the corpus easier to reason about.
  - Status: partial
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)
- Feature: timeline-driven compare launch
  - Why: A timeline is more valuable if it can pivot directly into detailed side-by-side inspection.
  - Status: planned
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)

## Important Decisions
- Decision: Design the timeline against the seeded corpus, not the original small demo
  - Why: The larger dataset reveals the real shape of the inspection problem.
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)
- Decision: Use branch family and parent relationships as timeline scaffolding
  - Why: Those are the most trustworthy signals already stored in the handoff repo.
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)

## Files Touched Most
1. dashboard/src/components/dashboard.tsx (4)
2. dashboard/src/lib/data.ts (4)

## Tests Run
- concept review only

## Risks / Blockers
- Need a clear visual model for timeline density before implementing it in the existing shell.

## Open Questions
- Should the timeline be the default first screen once the corpus grows past twenty sessions?
- Do we want the timeline to group drafts separately from finalized sessions?

## Related Sessions
- fe_workspace_shell_001
- fe_activity_rail_002
- fe_session_details_003
- fe_session_compare_018

## Resume Prompt
Continue the handoff timeline by grouping the seeded frontend sessions in dashboard/src/lib/data.ts before experimenting with a new TSX panel in dashboard/src/components/dashboard.tsx.
