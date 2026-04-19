import crypto from "node:crypto";
import path from "node:path";

export function toIsoString(input?: number | string | Date | null): string {
  if (!input) {
    return new Date().toISOString();
  }
  if (typeof input === "number") {
    return new Date(input).toISOString();
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  return new Date(input).toISOString();
}

export function normalizeRepoPath(projectRoot: string, candidate: string): string {
  const absolute = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(projectRoot, candidate);
  const relative = path.relative(projectRoot, absolute);
  return normalizeSlashes(relative === "" ? "." : relative);
}

export function normalizeSlashes(input: string): string {
  return input.split(path.sep).join("/");
}

export function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function cleanText(input: string | undefined | null): string {
  return (input ?? "").replace(/\r\n/g, "\n").trim();
}

export function topLevelDirectory(filePath: string): string {
  const normalized = normalizeSlashes(filePath);
  return normalized.includes("/") ? normalized.split("/")[0] : normalized;
}

export function tokenize(input: string): string[] {
  return cleanText(input)
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function shortHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

export function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export function sortByCountDescending<T extends { count: number }>(values: T[]): T[] {
  return [...values].sort((left, right) => right.count - left.count || 0);
}
