# Merge Conflict Demo

This repo includes a contained merge-conflict demo for testing handoff-aware conflict resolution.

## Git branches

- `demo/session-prod-harden`
- `demo/session-preview-qa`
- `demo/conflict-resolution`

The conflicting file is:

- `fixtures/merge-conflict-demo/deploy-config.json`

## Handoff sessions

- `demo_merge_prod_001`
- `demo_merge_preview_001`

Both sessions touch the same file but for different reasons:

- `demo_merge_prod_001` pushes the file toward production hardening
- `demo_merge_preview_001` pushes the file toward fast preview deployments

That should surface as a conflict risk in `get_context`.

## Suggested test prompt

Ask a fresh OpenCode session:

`Call get_context in auto mode, summarize the conflict risks, then resolve the current merge conflict using the saved handoff rationale.`
