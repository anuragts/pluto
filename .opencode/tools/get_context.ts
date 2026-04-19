import { tool } from "@opencode-ai/plugin";
import { HandoffService } from "../../src/handoffs/service.js";
import type { GetContextArgs } from "../../src/handoffs/types.js";
import { resolveProjectRootFromToolContext } from "../../src/handoffs/tool-context.js";

export default tool({
  description: [
    "Retrieve repo-local handoff context from prior OpenCode sessions.",
    "Use this when continuing earlier work, investigating why a feature was made, or when overlapping files might create merge conflicts.",
    "Avoid it for small isolated edits that do not need historical context.",
  ].join(" "),
  args: {
    mode: tool.schema.enum(["auto", "ids"]).describe("Use auto to select relevant sessions or ids to fetch specific session IDs."),
    sessionIds: tool.schema.array(tool.schema.string()).optional().describe("Explicit session IDs when mode=ids."),
    intent: tool.schema.enum(["resume", "merge", "debug"]).optional().default("resume"),
    includeCurrentSession: tool.schema.boolean().optional().default(true),
    maxSessions: tool.schema.number().int().min(1).max(10).optional().default(4),
    fileHints: tool.schema.array(tool.schema.string()).optional().describe("Optional repo-relative file hints to bias auto mode."),
    query: tool.schema.string().optional().describe("Optional free-text hint for titles, features, or decisions."),
  },
  async execute(args: GetContextArgs, context) {
    const projectRoot = resolveProjectRootFromToolContext(context);
    const service = new HandoffService({
      projectRoot,
      autoBackfill: false,
    });
    await service.init();
    const result = await service.getContext(args, context.sessionID);
    await service.dispose();
    return {
      output: JSON.stringify(result, null, 2),
      metadata: result,
    };
  },
});
