# OpenCode Repo Handoffs

Repo-local OpenCode handoff plugin with:

- `.handoffs/` session artifacts
- `get_context` custom tool
- `sessions_context` custom tool
- `/get-context` slash command
- `/handoff-backfill` slash command
- `/sessions-context` slash command

## Startup behavior

Automatic backfill is manual by default so `opencode .` opens quickly.

Use:

```bash
/handoff-backfill 20
```

inside OpenCode when you want to import prior sessions.

To temporarily enable startup/interval backfill again:

```bash
OPENCODE_HANDOFFS_AUTO_BACKFILL=1 opencode .
```

## Files

- [.opencode/plugins/handoffs.ts](./.opencode/plugins/handoffs.ts)
- [.opencode/tools/get_context.ts](./.opencode/tools/get_context.ts)
- [.opencode/tools/handoff_backfill.ts](./.opencode/tools/handoff_backfill.ts)
- [.opencode/tools/sessions_context.ts](./.opencode/tools/sessions_context.ts)
- [.opencode/commands/get-context.md](./.opencode/commands/get-context.md)
- [.opencode/commands/handoff-backfill.md](./.opencode/commands/handoff-backfill.md)
- [.opencode/commands/sessions-context.md](./.opencode/commands/sessions-context.md)
- [src/handoffs](./src/handoffs)

## Development

```bash
bun install
bun run check
bun test
```

## OpenCode Testing

1. Install dependencies and verify the local test suite:

```bash
bun install
bun run check
bun test
```

2. Start OpenCode in this repo and run `/handoff-backfill 10` to import recent local sessions.
3. Run `/get-context` to test default auto resume retrieval.
4. Run `/get-context auto merge` to test merged context materialization.
5. Verify the response includes selected session IDs, merged context path, top files, conflict risks, and a resume prompt.
6. Verify `.handoffs/` contains session records, patches, index data, materialized context, and shortlist cache files.
