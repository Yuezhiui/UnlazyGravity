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

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  const input = JSON.parse(raw || "{}");
  const workspacePaths = input.workspacePaths ?? [];
  const invocationNum = input.invocationNum ?? 0;

  // Load or init drift state
  let state = { lastMtime: 0, driftCount: 0, conversationId: input.conversationId };
  if (existsSync(DRIFT_STATE_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(DRIFT_STATE_FILE, "utf8"));
      // Only reuse state for same conversation
      if (saved.conversationId === input.conversationId) state = saved;
    } catch (_) {}
  }

  // Get the most recent mtime across all workspace files (shallow scan)
  function latestMtime(dir) {
    let latest = 0;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        try {
          const mt = statSync(full).mtimeMs;
          if (mt > latest) latest = mt;
        } catch (_) {}
      }
    } catch (_) {}
    return latest;
  }

  const currentMtime = Math.max(...workspacePaths.map(latestMtime));
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
    `${state.driftCount} consecutive invocations with no file changes detected.`,
    "You are recapping, summarizing, or planning instead of working.",
    "STOP. Open a file. Make a change. Run a command.",
    "Talking about work is not work. Check your GATES.md and act on the next unmet gate.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");

  process.stdout.write(JSON.stringify({
    injectSteps: [{ ephemeralMessage: warning }]
  }));
});
