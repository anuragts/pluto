# Session fe_onboarding_flow_019: Sketch a non-engineer onboarding flow for new session roles

## Goal
Define the first onboarding workflow that uses the React frontend to set role, expectations, and guardrails for future session work.

## Changes Made
- Outlined the onboarding steps a new operator would need
- Mapped where peer role hints and task framing would appear in the shell
- Identified missing data fields for job, tools, and constraints
- Connected the flow to the peer console and shell structure

## Why These Changes Were Made
- Feature: role onboarding concept
  - Why: A management UI only becomes real once someone outside engineering can create and shape work.
  - Status: planned
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx), [dashboard/src/app/page.tsx](../../dashboard/src/app/page.tsx)
- Feature: guided setup steps
  - Why: The onboarding flow needs a simple sequence rather than exposing raw system primitives up front.
  - Status: planned
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx), [dashboard/src/app/globals.css](../../dashboard/src/app/globals.css)
- Feature: role metadata contract
  - Why: Frontend onboarding only works if the backend and session store understand role definitions.
  - Status: partial
  - Files: [dashboard/src/lib/data.ts](../../dashboard/src/lib/data.ts)

## Important Decisions
- Decision: Make onboarding a workflow layer over the existing shell
  - Why: The shell already has the right context; onboarding should guide use of it instead of spawning another experience.
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx)
- Decision: Define role cards in human language, not transport capability jargon
  - Why: The first target user for onboarding is not a systems engineer.
  - Files: [dashboard/src/components/dashboard.tsx](../../dashboard/src/components/dashboard.tsx), [dashboard/src/app/page.tsx](../../dashboard/src/app/page.tsx)

## Files Touched Most
1. dashboard/src/components/dashboard.tsx (5)
2. dashboard/src/app/page.tsx (3)
3. dashboard/src/app/globals.css (2)
4. dashboard/src/lib/data.ts (2)

## Tests Run
- concept review only

## Risks / Blockers
- The repo does not yet persist role definitions, so the onboarding flow is a shell-only concept for now.

## Open Questions
- What is the minimum role schema that lets a non-engineer safely define a new session lane?

## Related Sessions
- fe_peer_console_008
- fe_workspace_shell_001

## Resume Prompt
Continue the onboarding concept by defining the minimum role metadata in dashboard/src/lib/data.ts before expanding the flow in dashboard/src/components/dashboard.tsx.
