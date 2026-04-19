import type { StructuredHandoffPayload } from "./types.js";
import { cleanText, safeJsonParse } from "./utils.js";

export const HANDOFF_BLOCK_PATTERN = /```handoff-json\s*([\s\S]*?)```/im;

export const COMPACTION_CONTEXT = `
## Handoff Artifact

Return a machine-readable JSON object between fenced markers:

\`\`\`handoff-json
{
  "summary": "short factual summary",
  "goal": "the session goal",
  "changesMade": ["specific change"],
  "features": [
    {
      "name": "feature name",
      "why": "why it was made",
      "status": "done",
      "files": ["relative/path.ts"]
    }
  ],
  "decisions": [
    {
      "decision": "important design choice",
      "why": "why this decision was made",
      "files": ["relative/path.ts"]
    }
  ],
  "blockers": ["remaining blocker"],
  "openQuestions": ["question still unresolved"],
  "testsRun": ["test command"],
  "resumePrompt": "prompt for the next agent"
}
\`\`\`

Requirements:
- Only use repo-relative file paths.
- Keep every "why" concrete and factual.
- Include empty arrays instead of omitting list fields when nothing applies.
- After the fenced JSON block, you may continue with normal summary text if needed.
`.trim();

export function extractHandoffPayload(text: string): StructuredHandoffPayload | null {
  const match = text.match(HANDOFF_BLOCK_PATTERN);
  if (!match) {
    return null;
  }

  const parsed = safeJsonParse<StructuredHandoffPayload>(match[1]);
  if (!parsed) {
    return null;
  }

  return parsed;
}

export function stripHandoffBlock(text: string): string {
  return cleanText(text.replace(HANDOFF_BLOCK_PATTERN, ""));
}
