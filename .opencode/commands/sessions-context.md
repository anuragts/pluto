---
description: Inspect stored handoff session context in this repo
---

Interpret `$ARGUMENTS` as optional filters:

- `all`, `draft`, or `finalized`
- an optional number limit
- any remaining natural-language text as a query filter

Call the `sessions_context` tool exactly once.

Then report:

- total sessions found
- returned sessions
- sessions directory
- for each returned session:
  - session ID
  - title
  - status
  - branch
  - updated time
  - summary
  - session JSON path
  - patch markdown path

If the arguments are empty, use `status=all` with no query or limit.
