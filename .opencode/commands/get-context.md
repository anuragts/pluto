---
description: Retrieve handoff context from prior OpenCode sessions
---

Interpret `$ARGUMENTS` as:

- `auto`
- `auto merge`
- one or more session IDs, optionally followed by `resume`, `merge`, or `debug`
- any remaining natural-language text is a follow-up question to answer from the retrieved context

Call the `get_context` tool exactly once with the matching arguments.

Rules:

- If explicit session IDs are present, default `includeCurrentSession=false` unless the user explicitly asks to compare with the current session.
- Pass any trailing natural-language text as `query`.
- If the user asked a question, answer that question directly using the returned context.
- Prefer `questionSummary` and `relevantFiles` over raw `topFiles` when answering.
- Only include selected session IDs, merged context path, conflict risks, or resume prompt as short supporting context when they help the answer.
- If there is no follow-up question, report:
  - selected session IDs
  - merged context path
  - relevant files
  - conflict risks
  - resume prompt

If the arguments are empty, use `mode=auto`, `intent=resume`, and `includeCurrentSession=true`.
