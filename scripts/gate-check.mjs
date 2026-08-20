#!/usr/bin/env node
// gate-check.mjs — UnlazyGravity evidence grader and gate verifier.
// Original work. MIT License. Copyright (c) 2026 Yue
//
// Usage:
//   node gate-check.mjs              run checks, grade evidence, update files
//   node gate-check.mjs --status     report only, no file changes
//   node gate-check.mjs --timeout 30 per-check timeout in seconds (default 30)
//   node gate-check.mjs [file ...]   target specific gate files
//
// Files default to GATES.md and gates/*.md in the current directory.
// Exit codes: 0 = all gates met, 1 = unmet gates remain, 2 = usage error

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const timeoutIdx = args.indexOf("--timeout");
const timeoutSec = timeoutIdx !== -1 ? (Number(args[timeoutIdx + 1]) || 30) : 30;
const fileArgs = args.filter((a, i) =>
  !a.startsWith("--") && i !== timeoutIdx + 1
);

// ── Evidence grade definitions ────────────────────────────────────────────────
const GRADES = {
  A: "Command run, output captured, EXPECT matched",
  B: "File path + line number cited, content quoted",
  C: "Specific measurement or log excerpt (skeptic required)",
  D: "Vague claim — auto-rejected",
};

function gradeEvidence(evidence, hasCheck) {
  if (!evidence || evidence.trim() === "" || evidence.trim() === "pending") {
    return "D";
  }
  // Grade A: captured command output (contains newlines or looks like terminal output)
  if (hasCheck && /\n/.test(evidence)) return "A";
  // Grade A: explicit grade marker
  if (evidence.startsWith("[A]")) return "A";
  // Grade B: file:line citation pattern
  if (/\w+[\\/]\w+.*:\d+/.test(evidence) || evidence.startsWith("[B]")) return "B";
  // Grade C: specific but not command-proven
  if (evidence.length > 40 && !/(looks good|verified|should work|I think|checked it)/i.test(evidence)) return "C";
  // Grade D: vague
  return "D";
}

// ── Gate file discovery ───────────────────────────────────────────────────────
function discoverGateFiles(dir) {
  const found = [];
  const top = join(dir, "GATES.md");
  if (existsSync(top)) found.push(resolve(top));
  const gatesDir = join(dir, "gates");
  if (existsSync(gatesDir)) {
    for (const f of readdirSync(gatesDir)) {
      if (f.endsWith(".md")) found.push(resolve(join(gatesDir, f)));
    }
  }
  return found;
}

const targetFiles = fileArgs.length
  ? fileArgs.map(f => resolve(f))
  : discoverGateFiles(process.cwd());

if (targetFiles.length === 0) {
  console.error("gate-check: no gate files found (GATES.md or gates/*.md)");
  process.exit(2);
}

// ── Parse a gate file ─────────────────────────────────────────────────────────
const GATE_LINE  = /^- \[( |x|X)\] (.+)$/;
const CHECK_LINE = /^\s{2,}CHECK:\s*(.+)$/;
const EXPECT_LINE= /^\s{2,}EXPECT:\s*(.+)$/;
const EVID_LINE  = /^\s{2,}EVIDENCE:\s*(.*)$/;
const ABANDON_LINE = /^ABANDON:\s*(\S+)\s*(.*)$/;

function parseFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const gates = [];
  const abandoned = new Map();
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const gm = line.match(GATE_LINE);
    if (gm) {
      cur = {
        lineIdx: i,
        checked: gm[1].toLowerCase() === "x",
        title: gm[2].trim(),
        check: null, expect: null,
        evidence: null, evidenceLineIdx: -1,
      };
      gates.push(cur);
      continue;
    }
    if (cur) {
      const cm = line.match(CHECK_LINE);
      if (cm) { cur.check = cm[1].trim(); continue; }
      const em = line.match(EXPECT_LINE);
      if (em) { cur.expect = em[1].trim(); continue; }
      const evm = line.match(EVID_LINE);
      if (evm) { cur.evidence = evm[1].trim(); cur.evidenceLineIdx = i; continue; }
    }
    const am = line.match(ABANDON_LINE);
    if (am) abandoned.set(am[1], am[2]);
  }

  return { lines, gates, abandoned };
}

// ── Run a CHECK command ───────────────────────────────────────────────────────
function runCheck(command) {
  const isWin = process.platform === "win32";
  const result = spawnSync(
    isWin ? "cmd" : "sh",
    isWin ? ["/c", command] : ["-c", command],
    { timeout: timeoutSec * 1000, encoding: "utf8" }
  );
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    code: result.status ?? 1,
  };
}

function expectMatches(output, expect) {
  if (expect.startsWith("/") && expect.endsWith("/")) {
    const pattern = expect.slice(1, -1);
    return new RegExp(pattern, "i").test(output);
  }
  return output.includes(expect);
}

// ── Process each file ─────────────────────────────────────────────────────────
let totalUnmet = 0;
let totalGates = 0;

for (const filePath of targetFiles) {
  const { lines, gates, abandoned } = parseFile(filePath);
  const updatedLines = [...lines];
  let fileChanged = false;

  console.log(`\n📋 ${filePath}`);
  console.log("─".repeat(60));

  for (const gate of gates) {
    totalGates++;
    const gateId = gate.title.match(/^(\S+?):/)?.[1] ?? `L${gate.lineIdx + 1}`;

    if (abandoned.has(gateId)) {
      console.log(`  ⏭  [ABANDONED] ${gate.title}`);
      console.log(`       Reason: ${abandoned.get(gateId)}`);
      continue;
    }

    const grade = gradeEvidence(gate.evidence, !!gate.check);

    if (gate.checked && grade !== "D" && grade !== "C") {
      console.log(`  ✅ [${grade}] ${gate.title}`);
      continue;
    }

    // Grade D — auto-reject
    if (grade === "D") {
      totalUnmet++;
      console.log(`  ❌ [D] ${gate.title}`);
      console.log(`       REJECTED: Evidence is vague or missing.`);
      console.log(`       Provide a command output (Grade A) or file:line citation (Grade B).`);
      continue;
    }

    // Has a CHECK command and gate is unchecked — run it
    if (gate.check && !gate.checked) {
      console.log(`  🔍 [CHECKING] ${gate.title}`);
      console.log(`       $ ${gate.check}`);
      const result = runCheck(gate.check);

      if (gate.expect && !expectMatches(result.stdout + result.stderr, gate.expect)) {
        totalUnmet++;
        console.log(`  ❌ [RUN-FAIL] Expected: "${gate.expect}"`);
        console.log(`       Got: ${(result.stdout || result.stderr).slice(0, 200)}`);
        continue;
      }

      if (result.code !== 0 && !gate.expect) {
        totalUnmet++;
        console.log(`  ❌ [RUN-FAIL] Exit code ${result.code}`);
        console.log(`       ${result.stderr.slice(0, 200)}`);
        continue;
      }

      // Check passed — update file
      const capturedOutput = (result.stdout || result.stderr).slice(0, 500);
      const gradeA_evidence = `[A] $ ${gate.check}\n    OUTPUT: ${capturedOutput.replace(/\n/g, "\n    ")}`;

      if (!statusOnly) {
        updatedLines[gate.lineIdx] = updatedLines[gate.lineIdx].replace("- [ ]", "- [x]");
        if (gate.evidenceLineIdx !== -1) {
          updatedLines[gate.evidenceLineIdx] = `  EVIDENCE: ${gradeA_evidence}`;
        }
        fileChanged = true;
      }

      const newGrade = gradeEvidence(gradeA_evidence, true);
      console.log(`  ✅ [${newGrade}] ${gate.title}`);
      continue;
    }

    // Grade C — flag for skeptic
    if (grade === "C") {
      totalUnmet++;
      console.log(`  ⚠️  [C-SKEPTIC] ${gate.title}`);
      console.log(`       Grade C evidence requires Adversarial Verifier.`);
      console.log(`       Invoke the skeptic agent (agents/skeptic.md) before closing this gate.`);
      continue;
    }

    // Unchecked, no check command, no evidence
    totalUnmet++;
    console.log(`  ☐  [OPEN] ${gate.title}`);
  }

  if (fileChanged) {
    writeFileSync(filePath, updatedLines.join("\n"), "utf8");
    console.log(`\n  💾 Updated: ${filePath}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(60));
const met = totalGates - totalUnmet;
console.log(`Gates: ${met}/${totalGates} met`);

if (totalUnmet === 0) {
  console.log("✅ ALL GATES MET — proof complete.");
  process.exit(0);
} else {
  console.log(`❌ ${totalUnmet} gate(s) unmet — agent cannot stop.`);
  process.exit(1);
}
