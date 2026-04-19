# Session ses_25b7535d1ffe4Is5NNlHq60EMU: Interpret session ID and resume context

## Goal
Interpret `ses_25bb946f4ffeK8FC9Gl0ewM5Kn of this session and lets continue it` as either:

- `auto`
- `auto merge`
- one or more session IDs, optionally followed by `resume`, `merge`, or `debug`

Call the `get_context` tool exactly once with the matching arguments.

Then report:

- selected session IDs
- merged context path
- top files
- conflict risks
- resume prompt

If the arguments are empty, use `mode=auto`, `intent=resume`, and `includeCurrentSession=true`.

## Changes Made
- No explicit change summary recorded

## Why These Changes Were Made
- No feature rationale recorded

## Important Decisions
- No design decisions recorded

## Files Touched Most
1. None

## Tests Run
- None

## Risks / Blockers
- None

## Open Questions
- None

## Related Sessions
- None

## Resume Prompt
Interpret `ses_25bb946f4ffeK8FC9Gl0ewM5Kn of this session and lets continue it` as either:

- `auto`
- `auto merge`
- one or more session IDs, optionally followed by `resume`, `merge`, or `debug`

Call the `get_context` tool exactly once with the matching arguments.

Then report:

- selected session IDs
- merged context path
- top files
- conflict risks
- resume prompt

If the arguments are empty, use `mode=auto`, `intent=resume`, and `includeCurrentSession=true`.
