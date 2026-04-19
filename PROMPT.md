# Demo Prompts

Use these inside OpenCode to demo the seeded handoff corpus and the repo-local inspection tools.

## Corpus inspection

1. `/sessions-context`
2. `/sessions-context finalized`
3. `/sessions-context draft 8`
4. `/sessions-context 20 dashboard tsx`
5. `/sessions-context 10 react jsx App.jsx`
6. `/sessions-context 5 onboarding role manager`

## Auto-retrieval demos

7. `/get-context auto what is the current direction of the dashboard workspace shell`
8. `/get-context auto what sessions matter most for session inspection and conflict visibility`
9. `/get-context auto what changed around dashboard/src/components/dashboard.tsx`
10. `/get-context auto what is the story behind fixtures/react-todo-conflict/src/App.jsx`
11. `/get-context auto merge summarize the strongest overlap risks in the React JSX workflow`
12. `/get-context auto debug what unfinished frontend management-ui work is still in draft`

## Explicit linked-session demos

13. `/get-context fe_workspace_shell_001 fe_activity_rail_002 fe_session_details_003 resume summarize how the TSX dashboard evolved`
14. `/get-context fe_workspace_shell_001 fe_activity_rail_002 fe_session_details_003 fe_conflict_drawer_004 fe_command_palette_005 resume explain the linked five-session story`
15. `/get-context fe_data_contracts_006 fe_file_map_007 fe_api_filters_017 debug explain the data-layer roadmap for the dashboard`
16. `/get-context fe_peer_console_008 fe_onboarding_flow_019 fe_handoff_timeline_020 resume explain the management UI direction and what is still missing`

## React JSX overlap demos

17. `/get-context fe_triage_tabs_009 fe_inline_edit_010 fe_bulk_actions_011 fe_search_persist_012 merge explain how the JSX todo app evolved`
18. `/get-context fe_inline_edit_010 fe_bulk_actions_011 fe_search_persist_012 fe_working_set_merge_013 merge summarize the state-model collisions in App.jsx`
19. `/get-context fe_review_toolbar_014 fe_conflict_repro_015 debug explain why App.jsx became a hotspot and what that teaches about frontend handoffs`
20. `/get-context fe_triage_tabs_009 fe_inline_edit_010 fe_bulk_actions_011 fe_search_persist_012 fe_working_set_merge_013 fe_review_toolbar_014 fe_conflict_repro_015 merge give me the full JSX backstory from first feature to overlap repro`

## Question-style demos

21. `Use /sessions-context and tell me which 5 sessions are best to demo the TSX dashboard story.`
22. `Use /sessions-context and tell me which sessions form the best JSX overlap narrative.`
23. `Call get_context for the most relevant dashboard sessions and explain the product story in plain English.`
24. `Call get_context for the React JSX sessions and list the major pain points besides merge conflict.`
25. `Use the handoff corpus to explain what parts of this project feel L4 already and what still feels L2-L3.`
