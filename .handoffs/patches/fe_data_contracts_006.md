# Session fe_data_contracts_006: Stabilize TSX data contracts for the dashboard API

## Goal
Reduce frontend glue code by giving the route and the React shell a cleaner contract for session-driven dashboards.

## Changes Made
- Normalized session and conflict payload shapes
- Added explicit stats for counts the shell reads repeatedly
- Consolidated file conflict derivation inside the loader layer
- Removed assumptions from the TSX shell about missing branch and status fields

## Why These Changes Were Made
- Feature: dashboard data normalization
  - Why: TSX components should spend time rendering, not guessing at missing backend fields.
  - Status: done
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts)
- Feature: frontend stats payload
  - Why: The shell header and future summary widgets need counts without recomputing everything client-side.
  - Status: done
  - Files: [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts), [dashboard/src/app/page.tsx](../../dashboard/src/app/page.tsx)
- Feature: conflict payload alignment
  - Why: The conflict drawer depends on a stable set of session titles and paths.
  - Status: done
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)

## Important Decisions
- Decision: Keep file-based reading inside lib/data.ts for now
  - Why: The dashboard is still repo-local, and the route should not open files directly in multiple places.
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)
- Decision: Return stats from the route instead of deriving them in the shell
  - Why: The same counts are used in multiple places and should stay consistent.
  - Files: [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts)

## Files Touched Most
1. dashboard/src/lib/data.ts (13)
2. dashboard/src/app/api/data/route.ts (8)
3. dashboard/src/app/page.tsx (4)
4. dashboard/src/components/dashboard.tsx (3)

## Tests Run
- npm run build
- manual /api/data inspection

## Risks / Blockers
- None

## Open Questions
- Do we want one combined payload for the full shell or smaller route slices once the UI becomes interactive?

## Related Sessions
- fe_workspace_shell_001
- fe_activity_rail_002

## Resume Prompt
Continue data contract cleanup in dashboard/src/lib/data.ts, then keep dashboard/src/app/api/data/route.ts as the single place that assembles shell payloads.
