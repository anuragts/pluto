# React Todo Conflict Demo

This demo uses a small React todo app in a nested git repo:

- `fixtures/react-todo-conflict`

Git branches inside that nested repo:

- `todo/session-filter-tabs`
- `todo/session-inline-edit`
- `todo/session-bulk-actions`
- `todo/session-search-persist`
- `todo/review-toolbar`
- `todo/working-set-editor`
- `todo/conflict-resolution`
- `todo/conflict-repro`

Saved handoff sessions:

- `demo_todo_filters_001`
- `demo_todo_inline_edit_001`
- `demo_todo_bulk_actions_001`
- `demo_todo_search_persist_001`

Conflicting file:

- `fixtures/react-todo-conflict/src/App.jsx`

How the branches now work:

- `todo/review-toolbar` = filter tabs + bulk actions
- `todo/working-set-editor` = inline editing + search/persistence
- `todo/conflict-resolution` = committed resolved merge of both integration branches
- `todo/conflict-repro` = fresh unresolved merge of `todo/working-set-editor` into `todo/review-toolbar`

Verify the real unresolved merge:

- `git -C fixtures/react-todo-conflict status --short --branch`
- `git -C fixtures/react-todo-conflict diff --name-only --diff-filter=U`
- `git -C fixtures/react-todo-conflict diff --merge -- src/App.jsx`

Open the nested repo, not the root repo, if you want to see the conflict in a Git UI:

- `/Users/anurag/kafka/pluto/fixtures/react-todo-conflict`

Suggested multi-session prompt:

`Call get_context with mode=ids using session ids demo_todo_filters_001, demo_todo_inline_edit_001, demo_todo_bulk_actions_001, and demo_todo_search_persist_001. Summarize the conflicting rationale, then resolve the current merge conflict in fixtures/react-todo-conflict/src/App.jsx while preserving filter tabs, inline editing, bulk actions, and search-backed review flow.`
