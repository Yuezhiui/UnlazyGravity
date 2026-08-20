# Evidence Grades Reference

UnlazyGravity grades every piece of evidence before accepting a gate as complete.
The grade determines trust level and whether the Adversarial Verifier is triggered.

---

## Grade A — Command-Proven ✅

The strongest grade. A CHECK command was run, its output was captured, and the
EXPECT substring was matched. No human judgment required.

**Format:**
```
EVIDENCE: [A] $ <command>
  OUTPUT: <captured output>
```

**Example:**
```
- [x] G1: All tests pass
  CHECK: npm test
  EXPECT: passing
  EVIDENCE: [A] $ npm test
    OUTPUT: 42 passing (3s)
             0 failing
```

**Skeptic triggered:** No.

---

## Grade B — File-Cited ✅

A specific file path and line number is cited, with the relevant content quoted.
Verifiable by anyone with access to the repository.

**Format:**
```
EVIDENCE: [B] path/to/file.ext:42 — "exact quoted content from that line"
```

**Example:**
```
- [x] G2: Error handler returns 404 for missing resources
  EVIDENCE: [B] src/api/handlers.ts:87 — "return res.status(404).json({ error: 'not found' })"
```

**Skeptic triggered:** No.

---

## Grade C — Assertion-With-Proof ⚠️

A specific measurement, log excerpt, screenshot path, or manual verification
with enough detail that a stranger could evaluate it. Requires the Adversarial
Verifier before the gate closes.

**Format:**
```
EVIDENCE: [C] <specific detail — measurement, excerpt, path>
SKEPTIC: PASS — <skeptic verdict summary>
```

**Example:**
```
- [x] G3: Page loads under 2 seconds on 3G
  EVIDENCE: [C] Lighthouse report: FCP 1.4s, LCP 1.9s (screenshot: docs/perf-report.png)
  SKEPTIC: PASS — Verified FCP/LCP values in screenshot. No hidden reflows detected.
```

**Skeptic triggered:** Yes — must be invoked before closing.

---

## Grade D — Rejected ❌

Vague claims. Not accepted. Gate auto-fails. Agent is blocked.

**Examples of Grade D (all rejected):**
```
EVIDENCE: I checked it
EVIDENCE: looks good
EVIDENCE: should work
EVIDENCE: verified manually
EVIDENCE: tested
EVIDENCE: pending
EVIDENCE: (empty)
```

**How to fix:** Upgrade to Grade A by adding a CHECK command, or Grade B by
citing a specific file and line.

---

## Quick Reference

| Grade | Accepted | Skeptic | Example |
|-------|----------|---------|---------|
| A | ✅ | No | Command output captured |
| B | ✅ | No | file.ts:42 — "quoted code" |
| C | ✅* | Yes | Measurement + screenshot |
| D | ❌ | N/A | "looks good", "verified" |

*Grade C gates require a SKEPTIC: PASS line from agents/skeptic.md.
