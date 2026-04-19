# Session demo_merge_prod_001: Production deployment hardening

## Goal
Harden the deployment demo so production releases are explicit, safe, and health-check driven.

## Changes Made
- Changed the demo deployment strategy to blue-green
- Targeted the deployment at production
- Added strict health-check and rollback defaults

## Why These Changes Were Made
- Feature: production blue-green rollout
  - Why: Use zero-downtime production deployment semantics and ensure failed rollouts can revert quickly.
  - Files: [fixtures/merge-conflict-demo/deploy-config.json](../../fixtures/merge-conflict-demo/deploy-config.json)

## Important Decisions
- Decision: Prefer health-check enforced production rollout
  - Why: A production release should fail fast if the new version does not pass the readiness check.
  - Files: [fixtures/merge-conflict-demo/deploy-config.json](../../fixtures/merge-conflict-demo/deploy-config.json)

## Files Touched Most
1. fixtures/merge-conflict-demo/deploy-config.json (4)
2. MERGE_CONFLICT_DEMO.md (1)

## Tests Run
- manual review of deploy-config structure

## Risks / Blockers
- None

## Open Questions
- Should production rollout also require post-deploy smoke tests before traffic cutover?

## Related Sessions
- demo_merge_preview_001

## Resume Prompt
Continue the production hardening path. Preserve blue-green rollout semantics, production target, and strict health-check behavior when resolving conflicts.
