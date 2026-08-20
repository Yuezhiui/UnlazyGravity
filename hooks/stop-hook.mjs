#!/usr/bin/env node
// stop-hook.mjs — Antigravity Stop hook for UnlazyGravity.
// Fires when the agent tries to terminate. Blocks if any gate is unmet.
// Original work. MIT License. Copyright (c) 2026 Yue
//
// Contract: reads JSON from stdin, writes JSON to stdout.
// decision: "continue" => agent is blocked from stopping, re-enters loop.
// decision: "allow"    => agent is permitted to stop.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  const input = JSON.parse(raw || "{}");
  const workspacePaths = input.workspacePaths ?? [];

  // Only enforce on clean model-initiated stops.
  // Never block on max_steps or error — those need human attention.
  if (input.terminationReason !== "model_stop") {
    write({ decision: "allow" });
    return;
  }

  function findGateFiles(dir) {
    const found = [];
    const top = join(dir, "GATES.md");
    if (existsSync(top)) found.push(top);
    const gdir = join(dir, "gates");
    if (existsSync(gdir)) {
      for (const f of readdirSync(gdir)) {
        if (f.endsWith(".md")) found.push(join(gdir, f));
      }
    }
    return found;
  }

  // Returns { unmet: string[], dGrades: string[] } for a gate file
  function auditFile(filePath) {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const unmet = [];
    const dGrades = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Unchecked gate
      if (/^- \[ \]/.test(line)) {
        unmet.push(`  Unchecked: "${line.replace(/^- \[ \]\s*/, "").trim()}"`);
        continue;
      }

      // EVIDENCE pending or empty on a checked gate
      if (/^- \[x\]/i.test(line)) {
        const evidenceLine = lines.slice(i + 1, i + 6)
          .find(l => /^\s{2,}EVIDENCE:/.test(l));
        if (evidenceLine) {
          const ev = evidenceLine.replace(/^\s+EVIDENCE:\s*/, "").trim();
          if (!ev || ev === "pending") {
            unmet.push(`  Missing evidence: "${line.replace(/^- \[x\]\s*/i, "").trim()}"`);
          }
          // Grade D detection
          const isVague = /(looks good|verified|should work|I think|checked it)/i.test(ev);
          const isTooShort = ev.length < 20 && ev !== "pending" && ev !== "";
          if (isVague || isTooShort) {
            dGrades.push(`  Grade-D evidence: "${line.replace(/^- \[x\]\s*/i, "").trim()}"`);
          }
        }
      }
    }

    return { unmet, dGrades };
  }

  const allUnmet = [];
  const allDGrades = [];

  for (const wsPath of workspacePaths) {
    for (const gf of findGateFiles(wsPath)) {
      try {
        const { unmet, dGrades } = auditFile(gf);
        if (unmet.length > 0) allUnmet.push(...unmet.map(u => `[${gf}]\n${u}`));
        if (dGrades.length > 0) allDGrades.push(...dGrades.map(d => `[${gf}]\n${d}`));
      } catch (_) {
        // Unreadable gate file — skip, don't block
      }
    }
  }

  if (allUnmet.length === 0 && allDGrades.length === 0) {
    write({ decision: "allow" });
    return;
  }

  const problems = [...allUnmet, ...allDGrades];
  const reason = [
    "━━ UNLAZYGRAVITY GATE BLOCK ━━",
    `${problems.length} problem(s) prevent completion:`,
    ...problems.slice(0, 8),
    problems.length > 8 ? `  ... and ${problems.length - 8} more.` : "",
    "",
    "Run: node <unlazygravity>/scripts/gate-check.mjs",
    "Fix all gates. Replace every EVIDENCE: pending with real proof.",
    "Grade D evidence (vague claims) is not accepted.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].filter(Boolean).join("\n");

  write({ decision: "continue", reason });
});

function write(obj) {
  process.stdout.write(JSON.stringify(obj));
}
