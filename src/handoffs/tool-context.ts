import path from "node:path";

export interface ToolProjectContext {
  worktree?: string;
  directory?: string;
}

function normalizeCandidate(candidate: string | undefined): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}

export function resolveProjectRootFromToolContext(context: ToolProjectContext): string {
  const cwdCandidate = normalizeCandidate(process.cwd());
  const candidates = [
    normalizeCandidate(context.worktree),
    normalizeCandidate(context.directory),
    cwdCandidate,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate !== path.parse(candidate).root) {
      return candidate;
    }
  }

  if (cwdCandidate) {
    return cwdCandidate;
  }

  throw new Error("Could not resolve a writable project root from tool context.");
}
