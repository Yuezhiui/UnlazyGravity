#!/usr/bin/env node
// drift-hook.mjs — Antigravity PostInvocation hook for UnlazyGravity.
// Detects when an agent is recapping/summarizing instead of working.
// Injects a warning after consecutive invocations with no file modifications.
// Original work. MIT License. Copyright (c) 2026 Yue
//
// Contract: reads JSON from stdin, writes JSON to stdout.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DRIFT_THRESHOLD = 3;        // invocations with no file change before warning
const DRIFT_STATE_FILE = join(tmpdir(), "unlazygravity-drift.json");
const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".gemini", ".next", "dist", "build", "out",
  ".turbo", ".cache", "coverage", ".idea", ".vscode"
]);

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch (_) {
    process.stdout.write(JSON.stringify({ injectSteps: [] }));
    return;
  }

  const workspacePaths = input.workspacePaths ?? [];

  // Load or init drift state
  let state = { lastMtime: 0, driftCount: 0, conversationId: input.conversationId };
  if (existsSync(DRIFT_STATE_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(DRIFT_STATE_FILE, "utf8"));
      // Only reuse state for same conversation
      if (saved.conversationId === input.conversationId) state = saved;
    } catch (_) {}
  }

  // Recursive mtime scan (up to depth 4 to remain fast & lightweight)
  function scanDirMtime(dir, depth = 0) {
    if (depth > 4) return 0;
    let latest = 0;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".git")) continue;
        const full = join(dir, entry.name);
        try {
          const st = statSync(full);
          if (st.mtimeMs > latest) latest = st.mtimeMs;
          if (entry.isDirectory()) {
            const subLatest = scanDirMtime(full, depth + 1);
            if (subLatest > latest) latest = subLatest;
          }
        } catch (_) {}
      }
    } catch (_) {}
    return latest;
  }

  const currentMtime = Math.max(0, ...workspacePaths.map(p => scanDirMtime(p)));
  const filesChanged = currentMtime > state.lastMtime;

  if (filesChanged) {
    state.driftCount = 0;
    state.lastMtime = currentMtime;
  } else {
    state.driftCount = (state.driftCount ?? 0) + 1;
  }

  // Save state
  try {
    writeFileSync(DRIFT_STATE_FILE, JSON.stringify(state), "utf8");
  } catch (_) {}

  // No drift detected
  if (state.driftCount < DRIFT_THRESHOLD) {
    process.stdout.write(JSON.stringify({ injectSteps: [] }));
    return;
  }

  // Drift detected — inject forceful redirect
  const warning = [
    "━━ UNLAZYGRAVITY DRIFT ALERT ━━",
    `${state.driftCount} consecutive invocations with no workspace file modifications detected.`,
    "You are recapping, summarizing, or planning instead of working.",
    "STOP. Open a file. Make a change. Run a command.",
    "Talking about work is not work. Check your GATES.md and act on the next unmet gate.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");

  process.stdout.write(JSON.stringify({
    injectSteps: [{ ephemeralMessage: warning }]
  }));
});
