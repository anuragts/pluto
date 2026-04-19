import type { Plugin } from "@opencode-ai/plugin";
import { HandoffService } from "../../src/handoffs/service.js";

export const HandoffsPlugin: Plugin = async ({ client, worktree, directory }) => {
  const autoBackfillEnabled = /^(1|true|yes)$/i.test(process.env.OPENCODE_HANDOFFS_AUTO_BACKFILL ?? "");
  const logger = {
    info: async (message: string, extra?: Record<string, unknown>) => {
      if (typeof client.app?.log === "function") {
        await client.app.log({
          body: {
            service: "handoffs",
            level: "info",
            message,
            extra,
          },
        });
      }
    },
    warn: async (message: string, extra?: Record<string, unknown>) => {
      if (typeof client.app?.log === "function") {
        await client.app.log({
          body: {
            service: "handoffs",
            level: "warn",
            message,
            extra,
          },
        });
      }
    },
    error: async (message: string, extra?: Record<string, unknown>) => {
      if (typeof client.app?.log === "function") {
        await client.app.log({
          body: {
            service: "handoffs",
            level: "error",
            message,
            extra,
          },
        });
      }
    },
  };

  const service = new HandoffService({
    projectRoot: worktree || directory,
    logger,
    autoBackfill: autoBackfillEnabled,
  });
  await service.init();

  return {
    event: async ({ event }) => {
      await service.handleEvent(event);
    },
    "tool.execute.after": async (input) => {
      await service.handleToolExecuteAfter(input);
    },
    "experimental.session.compacting": async (_input, output) => {
      await service.handleSessionCompacting(output);
    },
  };
};

export default HandoffsPlugin;
