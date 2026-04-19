# New Session Test Prompts

Use these in a fresh OpenCode session inside this repo.

## 1. Basic retrieval

Ask:

`Call get_context in auto mode and tell me what prior session is relevant.`

Expected:

- selects `example-auto-backfill`
- returns a merged context file under `.handoffs/materialized/`
- mentions `src/handoffs/service.ts` and `tests/handoffs.test.ts`

## 2. Why was this built

Ask:

`Why was the automatic backfill feature added? Use saved handoff context if available.`

Expected:

- explains startup backfill and 10-minute refresh
- mentions keeping `/handoff-backfill`
- cites the saved rationale from the example session

## 3. Continue the same area

Ask:

`I want to continue the automatic backfill work. Get prior context first, then tell me which files I should inspect.`

Expected:

- calls `get_context`
- recommends `src/handoffs/service.ts`, `tests/handoffs.test.ts`, and `src/handoffs/types.ts`

## 4. Merge/conflict style retrieval

Ask:

`Pretend I am about to change the scheduler and manual backfill behavior. Load prior context and summarize any conflict risks or design constraints.`

Expected:

- says manual `/handoff-backfill` must remain available
- notes the service layer owns startup, interval, and manual triggers

## 5. Explicit ID mode

Ask:

`Call get_context with mode=ids using session id example-auto-backfill and summarize it.`

Expected:

- loads the saved example session directly
- reports the same summary and resume prompt

## 6. Resume prompt check

Ask:

`Load saved context and give me the resume prompt from the prior session.`

Expected:

- returns the saved resume prompt about continuing automatic backfill work
