# Session fe_session_compare_018: Prototype session-to-session compare views in TSX

## Goal
Move the dashboard closer to L4 observability by making side-by-side session comparison a real TSX workflow.

## Changes Made
- Mapped the compare use cases coming from hotspot and conflict review
- Outlined a split-pane TSX layout for paired session context
- Identified the data slices needed for files, rationale, and test histories
- Reviewed how compare actions could originate from conflicts and session cards

## Why These Changes Were Made
- Feature: paired session compare view
  - Why: Operators need a direct way to inspect overlap and divergence between two frontend sessions.
  - Status: planned
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)
- Feature: compare data shaping
  - Why: A compare view depends on consistent session payloads and highlighted deltas.
  - Status: partial
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts)
- Feature: conflict-origin compare entry points
  - Why: Conflict review is the most obvious place to launch side-by-side inspection.
  - Status: partial
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)

## Important Decisions
- Decision: Start with same-repo session compare instead of cross-repo compare
  - Why: The existing handoff data model is repo-local, so this keeps scope aligned with what the system already knows.
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)
- Decision: Compare rationale and files before raw patch text
  - Why: Intent and touched surfaces are faster to scan than long markdown patches.
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)

## Files Touched Most
1. dashboard/src/components/dashboard.tsx (5)
2. dashboard/src/lib/data.ts (4)
3. dashboard/src/app/api/data/route.ts (3)

## Tests Run
- design review only

## Risks / Blockers
- Need a compare state model and likely URL params before the split-pane view can be navigated reliably.

## Open Questions
- Should compare mode live inside the current shell or open a dedicated route?

## Related Sessions
- fe_conflict_drawer_004
- fe_session_details_003
- fe_file_map_007

## Resume Prompt
Continue the compare prototype by settling the paired-session data shape in dashboard/src/lib/data.ts before touching the TSX layout.
