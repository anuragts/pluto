# Session example-auto-backfill: Add automatic handoff backfill scheduling

## Goal
Make persisted handoff context appear automatically without requiring users to run backfill manually in every repo.

## Changes Made
- Added automatic startup backfill in the handoff service
- Scheduled recurring backfill every 10 minutes
- Prevented overlapping backfill runs
- Kept manual backfill support unchanged
- Added scheduler and cleanup tests

## Why These Changes Were Made
- Feature: automatic startup backfill
  - Why: Seed `.handoffs` immediately when OpenCode opens so `get_context` can return useful context without manual setup.
  - Files: [src/handoffs/service.ts](../../src/handoffs/service.ts)
- Feature: recurring 10 minute backfill
  - Why: Refresh imported session history during long-lived OpenCode sessions without requiring a manual command.
  - Files: [src/handoffs/service.ts](../../src/handoffs/service.ts), [src/handoffs/types.ts](../../src/handoffs/types.ts)
- Feature: scheduler coverage
  - Why: Verify startup scheduling, 10 minute interval behavior, and manual backfill compatibility.
  - Files: [tests/handoffs.test.ts](../../tests/handoffs.test.ts)

## Important Decisions
- Decision: Keep `/handoff-backfill` as a manual command
  - Why: Users still need an explicit recovery path and a direct way to force imports on demand.
  - Files: [src/handoffs/service.ts](../../src/handoffs/service.ts), [.opencode/commands/handoff-backfill.md](../../.opencode/commands/handoff-backfill.md)
- Decision: Run background backfill inside the service layer
  - Why: The same code path can serve startup, interval, and manual triggers while centralizing overlap protection and logging.
  - Files: [src/handoffs/service.ts](../../src/handoffs/service.ts)

## Files Touched Most
1. src/handoffs/service.ts (5)
2. tests/handoffs.test.ts (4)
3. src/handoffs/types.ts (1)
4. CHAT_SUMMARY.md (1)

## Tests Run
- npm run check
- npm test

## Risks / Blockers
- None

## Open Questions
- Should automatic backfill write a visible toast or stay silent unless it fails?

## Related Sessions
- None

## Resume Prompt
Continue from the automatic backfill work. Inspect `src/handoffs/service.ts` and `tests/handoffs.test.ts` first. Preserve manual `/handoff-backfill` support while extending background context behavior.
