---
description: Retrieve handoff context from prior OpenCode sessions
---

Interpret `$ARGUMENTS` as either:

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
