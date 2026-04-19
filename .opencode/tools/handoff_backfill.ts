import { tool } from "@opencode-ai/plugin";
import { HandoffService } from "../../src/handoffs/service.js";
import { resolveProjectRootFromToolContext } from "../../src/handoffs/tool-context.js";

export default tool({
  description: "Import recent local OpenCode sessions into .handoffs so get_context has historical data to use.",
  args: {
    count: tool.schema.number().int().min(1).max(100).optional().default(20),
  },
  async execute(args, context) {
    const projectRoot = resolveProjectRootFromToolContext(context);
    const service = new HandoffService({
      projectRoot,
      autoBackfill: false,
    });
    await service.init();
    const result = await service.backfill(args.count);
    await service.dispose();
    return {
      output: JSON.stringify(result, null, 2),
      metadata: result,
    };
  },
});
