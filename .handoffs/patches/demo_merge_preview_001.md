# Session demo_merge_preview_001: Preview environment deployment

## Goal
Make the deployment demo support quick QA preview environments for feature branches.

## Changes Made
- Changed the demo deployment strategy to preview
- Targeted the deployment at qa-preview
- Added branch-scoped review-app naming and lighter verification

## Why These Changes Were Made
- Feature: review app preview rollout
  - Why: Enable QA and stakeholders to validate feature branches without promoting directly to production.
  - Files: [fixtures/merge-conflict-demo/deploy-config.json](../../fixtures/merge-conflict-demo/deploy-config.json)

## Important Decisions
- Decision: Prefer preview-first validation over production hardening
  - Why: For branch previews, speed and easy teardown matter more than blue-green production guarantees.
  - Files: [fixtures/merge-conflict-demo/deploy-config.json](../../fixtures/merge-conflict-demo/deploy-config.json)

## Files Touched Most
1. fixtures/merge-conflict-demo/deploy-config.json (4)
2. MERGE_CONFLICT_DEMO.md (1)

## Tests Run
- manual review of deploy-config structure

## Risks / Blockers
- None

## Open Questions
- Should preview environments auto-expire after merge or stay until manually removed?

## Related Sessions
- demo_merge_prod_001

## Resume Prompt
Continue the preview deployment path. Preserve review-app behavior, qa-preview targeting, and fast validation when resolving conflicts.
