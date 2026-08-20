# Gates: <task or leaf name>

Scope: <one sentence — what this unit of work delivers>

<!--
Grade targets:
  A = CHECK command run, output captured, EXPECT matched       (preferred)
  B = Exact file:line cited, content quoted                    (acceptable)
  C = Specific measurement or log excerpt (skeptic required)   (use sparingly)
  D = Vague claim                                              (REJECTED — auto-fail)
-->

- [ ] G1: <observable outcome a stranger could judge>
  CHECK: <shell command that proves it>
  EXPECT: <substring or /regex/ the output must contain>
  EVIDENCE: pending

- [ ] G2: <another runnable outcome>
  CHECK: <command>
  EXPECT: <substring or /regex/>
  EVIDENCE: pending

- [ ] G3: <outcome provable by file citation>
  EVIDENCE: pending
  <!-- Grade B: replace with: path/to/file.ext:42 — "exact quoted content" -->

- [ ] G4: <manual gate — only when no command can prove it>
  EVIDENCE: pending
  <!-- Grade C: replace with specific measurement, log excerpt, or screenshot path -->
  <!-- Then invoke agents/skeptic.md before closing this gate -->

<!--
To abandon a gate that becomes impossible:
ABANDON: G4 <reason why this gate cannot be met>

Done means:
  1. Every checkbox is [x]
  2. Every EVIDENCE: line has real proof (not "pending")
  3. Every Grade C gate has a skeptic verdict recorded
  4. node scripts/gate-check.mjs --status exits 0
  5. The Antigravity Stop hook returns allow
-->
