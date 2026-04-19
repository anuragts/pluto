# Session fe_api_filters_017: Add richer API-side filters for session inspection

## Goal
Prepare the dashboard and future command palette for larger handoff corpora by moving more filtering work into the route layer.

## Changes Made
- Mapped filter inputs needed by sessions_context and the dashboard shell
- Outlined branch, status, and text filter behavior
- Reviewed where data.ts can own filtering without multiplying route logic
- Identified places where the frontend still assumes a full corpus load

## Why These Changes Were Made
- Feature: route-side session filtering
  - Why: Larger frontend corpora will eventually need narrower payloads for speed and clarity.
  - Status: partial
  - Files: [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts), [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)
- Feature: command palette filter feed
  - Why: The palette should be able to search the same filtered dataset the shell is showing.
  - Status: planned
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)
- Feature: branch family awareness
  - Why: Grouping frontend sessions by branch family helps when several related efforts are active at once.
  - Status: partial
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)

## Important Decisions
- Decision: Keep filtering primitives in lib/data.ts even if the route exposes them
  - Why: One shared implementation reduces drift between API and direct file-based reads.
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts), [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts)
- Decision: Support status and query first, branch groupings second
  - Why: Those two filters unlock the biggest inspection gains with the smallest surface area.
  - Files: [dashboard/src/app/api/data/route.ts](../../dashboard/src/app/api/data/route.ts)

## Files Touched Most
1. dashboard/src/app/api/data/route.ts (7)
2. dashboard/src/lib/data.ts (7)
3. dashboard/src/components/dashboard.tsx (2)

## Tests Run
- design review only

## Risks / Blockers
- The shell still expects the whole session list, so route filtering needs a small frontend contract pass too.

## Open Questions
- Should filter state live in the URL before we add server-side filtering?

## Related Sessions
- fe_data_contracts_006
- fe_command_palette_005

## Resume Prompt
Continue API filtering in dashboard/src/lib/data.ts, then update dashboard/src/app/api/data/route.ts once the filter contract is settled.
