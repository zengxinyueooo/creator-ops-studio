#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function normalizeCount(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;

  const text = String(value).trim().replaceAll(",", "").replaceAll("+", "");
  if (!text) return null;

  const match = text.match(/(-?\d+(?:\.\d+)?)\s*([万千wk]?)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "万" || unit === "w" ? 10000 : unit === "千" || unit === "k" ? 1000 : 1;
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : null;
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["items", "results", "data", "notes"]) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === "object") {
      const nested = extractItems(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function firstValue(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") return item[key];
  }
  return null;
}

function noteIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/\/(?:explore|search_result)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

function normalizedKey(item) {
  const noteId = firstValue(item, ["note_id", "noteId", "id"]) ?? noteIdFromUrl(item.url);
  if (noteId) return `id:${noteId}`;

  const title = String(firstValue(item, ["title", "name"]) ?? "").trim().toLowerCase();
  const authorValue = firstValue(item, ["author", "nickname", "user"]);
  const author = typeof authorValue === "object"
    ? String(firstValue(authorValue, ["name", "nickname", "username"]) ?? "")
    : String(authorValue ?? "");
  return `fallback:${title}|${author.trim().toLowerCase()}`;
}

function normalizeItem(item) {
  const likesRaw = firstValue(item, ["likes_raw", "likes", "liked_count", "like_count", "likedCount"]);
  return {
    ...item,
    likes_raw: likesRaw,
    likes_count: normalizeCount(likesRaw),
    note_id: firstValue(item, ["note_id", "noteId", "id"]) ?? noteIdFromUrl(item.url),
  };
}

async function readInput() {
  const file = process.argv[2];
  if (file) return readFile(file, "utf8");

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

try {
  const raw = await readInput();
  if (!raw.trim()) throw new Error("Expected a JSON file path or JSON on stdin.");

  const items = extractItems(JSON.parse(raw));
  const unique = new Map();

  for (const sourceItem of items) {
    if (!sourceItem || typeof sourceItem !== "object") continue;
    const item = normalizeItem(sourceItem);
    const key = normalizedKey(item);
    const previous = unique.get(key);
    if (!previous || (item.likes_count ?? -1) > (previous.likes_count ?? -1)) unique.set(key, item);
  }

  const output = [...unique.values()].sort((a, b) => (b.likes_count ?? -1) - (a.likes_count ?? -1));
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`normalize_results: ${error.message}\n`);
  process.exitCode = 1;
}
