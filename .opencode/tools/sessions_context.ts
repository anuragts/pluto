import { tool } from "@opencode-ai/plugin";
import { HandoffService } from "../../src/handoffs/service.js";
import type { SessionsContextArgs } from "../../src/handoffs/types.js";
import { resolveProjectRootFromToolContext } from "../../src/handoffs/tool-context.js";

export default tool({
  description: [
    "List repo-local handoff sessions with their full stored context and artifact paths.",
    "Use this to inspect what is in .handoffs/sessions before choosing sessions to resume, debug, or compare.",
  ].join(" "),
  args: {
    status: tool.schema.enum(["all", "draft", "finalized"]).optional().default("all"),
    query: tool.schema.string().optional().describe("Optional text filter across titles, summaries, rationale, files, and resume prompts."),
    limit: tool.schema.number().int().min(1).max(200).optional().describe("Optional maximum number of sessions to return."),
  },
  async execute(args: SessionsContextArgs, context) {
    const projectRoot = resolveProjectRootFromToolContext(context);
    const service = new HandoffService({
      projectRoot,
      autoBackfill: false,
    });
    await service.init();
    const result = await service.getSessionsContext(args);
    await service.dispose();
    return {
      output: JSON.stringify(result, null, 2),
      metadata: result,
    };
  },
});
