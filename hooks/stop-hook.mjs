#!/usr/bin/env node
// stop-hook.mjs — Antigravity Stop hook for UnlazyGravity.
// Fires when the agent tries to terminate. Blocks if any gate is unmet or lacks proof.
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
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch (_) {
    write({ decision: "allow" });
    return;
  }

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
      try {
        for (const f of readdirSync(gdir)) {
          if (f.endsWith(".md")) found.push(join(gdir, f));
        }
      } catch (_) {}
    }
    return found;
  }

  // Returns { unmet: string[], dGrades: string[], pendingSkeptic: string[] }
  function auditFile(filePath) {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const unmet = [];
    const dGrades = [];
    const pendingSkeptic = [];
    const abandoned = new Set();

    // Check for abandoned gates
    for (const line of lines) {
      const am = line.match(/^ABANDON:\s*(\S+)/);
      if (am) abandoned.add(am[1]);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match gate line: - [ ] or - [x]
      const gateMatch = line.match(/^- \[( |x|X)\] (.+)$/);
      if (!gateMatch) continue;

      const isChecked = gateMatch[1].toLowerCase() === "x";
      const gateTitle = gateMatch[2].trim();
      const gateId = gateTitle.match(/^(\S+?):/)?.[1] ?? `L${i + 1}`;

      // If marked abandoned, skip check
      if (abandoned.has(gateId)) continue;

      // 1. Unchecked gate
      if (!isChecked) {
        unmet.push(`  ☐ Unchecked: "${gateTitle}"`);
        continue;
      }

      // 2. Checked gate — inspect the evidence block
      const followingLines = lines.slice(i + 1, i + 8);
      const evidenceLine = followingLines.find(l => /^\s{2,}EVIDENCE:/.test(l));
      const skepticLine = followingLines.find(l => /^\s{2,}SKEPTIC:/.test(l));

      if (!evidenceLine) {
        unmet.push(`  ❌ Missing EVIDENCE line: "${gateTitle}"`);
        continue;
      }

      const ev = evidenceLine.replace(/^\s+EVIDENCE:\s*/, "").trim();

      if (!ev || ev === "pending") {
        unmet.push(`  ❌ EVIDENCE is pending: "${gateTitle}"`);
        continue;
      }

      // Grade D Detection (vague claims, conversational reassurance, or missing structure)
      const isVague = /(looks good|verified|should work|I think|checked it|tested manually|working fine|verified manually)/i.test(ev);
      const isTooShort = ev.length < 20 && !ev.startsWith("[A]") && !ev.startsWith("[B]");
      const isExplicitGradeD = ev.startsWith("[D]");

      if (isExplicitGradeD || isVague || isTooShort) {
        dGrades.push(`  ⚠️  Grade-D Evidence (Unacceptable): "${gateTitle}"\n     Given: "${ev}"`);
        continue;
      }

      // Grade C Detection: If it's Grade C or assertion, verify Skeptic PASS
      const isGradeC = ev.startsWith("[C]") || (!ev.startsWith("[A]") && !ev.startsWith("[B]") && !/\w+[\\/]\w+.*:\d+/.test(ev));
      if (isGradeC) {
        const skepticPass = skepticLine && /SKEPTIC:\s*PASS/i.test(skepticLine);
        if (!skepticPass) {
          pendingSkeptic.push(`  🔍 Grade-C requires Adversarial Skeptic: "${gateTitle}"\n     Must invoke 'skeptic' subagent and record "SKEPTIC: PASS — <reason>"`);
        }
      }
    }

    return { unmet, dGrades, pendingSkeptic };
  }

  const allProblems = [];

  for (const wsPath of workspacePaths) {
    for (const gf of findGateFiles(wsPath)) {
      try {
        const { unmet, dGrades, pendingSkeptic } = auditFile(gf);
        if (unmet.length > 0) allProblems.push(...unmet.map(u => `[${gf}]\n${u}`));
        if (dGrades.length > 0) allProblems.push(...dGrades.map(d => `[${gf}]\n${d}`));
        if (pendingSkeptic.length > 0) allProblems.push(...pendingSkeptic.map(s => `[${gf}]\n${s}`));
      } catch (_) {
        // Unreadable gate file — skip, don't block
      }
    }
  }

  if (allProblems.length === 0) {
    write({ decision: "allow" });
    return;
  }

  const reason = [
    "━━ UNLAZYGRAVITY GATE BLOCK ━━",
    `${allProblems.length} unresolved gate item(s) prevent task completion:`,
    ...allProblems.slice(0, 8),
    allProblems.length > 8 ? `  ... and ${allProblems.length - 8} more.` : "",
    "",
    "ACTIONS REQUIRED:",
    "1. Complete unmet gates and provide Grade A (command) or Grade B (file:line) evidence.",
    "2. For Grade C gates, invoke the 'skeptic' subagent and record 'SKEPTIC: PASS'.",
    "3. Grade D evidence (vague assertions) is auto-rejected.",
    "4. [ESCAPE HATCH]: If a gate is genuinely impossible or blocked by external infra,",
    "   add 'ABANDON: <gate-id> <reason>' to GATES.md rather than guessing.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].filter(Boolean).join("\n");

  write({ decision: "continue", reason });
});

function write(obj) {
  process.stdout.write(JSON.stringify(obj));
}
