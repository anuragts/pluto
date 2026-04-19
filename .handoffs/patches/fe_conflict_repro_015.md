# Session fe_conflict_repro_015: Capture a realistic JSX overlap repro for handoff inspection

## Goal
Make the .handoffs corpus demonstrate more than one-off features by showing how a frontend file becomes a hotspot with multiple overlapping narratives.

## Changes Made
- Captured the dominant overlapping JSX sessions as one reproducible story
- Made the fixture demo explain the branch relationships more directly
- Emphasized how rationale differs across the sessions even when the file is the same
- Positioned the overlap as an inspection and resume scenario, not only a merge problem

## Why These Changes Were Made
- Feature: realistic overlap repro
  - Why: The handoff repo should teach session inspection, history reconstruction, and frontend hotspot review from one concrete example.
  - Status: done
  - Files: [fixtures/react-todo-conflict/src/App.jsx](../../fixtures/react-todo-conflict/src/App.jsx), [REACT_TODO_CONFLICT_DEMO.md](../../REACT_TODO_CONFLICT_DEMO.md)
- Feature: branch relationship narrative
  - Why: Operators need to see how distinct frontend goals converged on the same JSX surface.
  - Status: done
  - Files: [REACT_TODO_CONFLICT_DEMO.md](../../REACT_TODO_CONFLICT_DEMO.md)
- Feature: inspection-first framing
  - Why: The session should support debug and audit workflows, not just conflict resolution.
  - Status: done
  - Files: [README.md](../../README.md), [REACT_TODO_CONFLICT_DEMO.md](../../REACT_TODO_CONFLICT_DEMO.md)

## Important Decisions
- Decision: Frame the overlap as a handoff dataset asset, not just fixture drama
  - Why: The demo should prove why repo-local memory matters for React frontends with parallel work.
  - Files: [REACT_TODO_CONFLICT_DEMO.md](../../REACT_TODO_CONFLICT_DEMO.md), [README.md](../../README.md)
- Decision: Keep App.jsx as the hotspot file
  - Why: Using one shared JSX surface makes the inspection story crisp and the overlap obvious.
  - Files: [fixtures/react-todo-conflict/src/App.jsx](../../fixtures/react-todo-conflict/src/App.jsx)

## Files Touched Most
1. fixtures/react-todo-conflict/src/App.jsx (8)
2. REACT_TODO_CONFLICT_DEMO.md (9)
3. README.md (2)

## Tests Run
- manual narrative review

## Risks / Blockers
- None

## Open Questions
- Should the demo narrative include example /sessions-context usage now that the corpus is much larger?

## Related Sessions
- fe_inline_edit_010
- fe_bulk_actions_011
- fe_search_persist_012
- fe_review_toolbar_014

## Resume Prompt
Continue the overlap repro by checking REACT_TODO_CONFLICT_DEMO.md first, then inspect the shared JSX hotspot in fixtures/react-todo-conflict/src/App.jsx.
