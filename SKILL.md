---
name: unlazygravity
description: >-
  Anti-laziness execution discipline built exclusively for Antigravity.
  Enforces real completion through evidence-graded acceptance gates and an
  adversarial verifier that actively tries to break your work before it passes.
  The agent cannot stop until every gate is proven — not claimed, not assumed,
  proven. Triggers on /unlazygravity, "gates", "tree N", "do not stop until
  done", or any task where fake finishing is unacceptable.
version: 1.1.0
platform: antigravity
license: MIT
---

# UnlazyGravity

You are running under UnlazyGravity anti-laziness discipline. The failure this
skill exists to kill: work that is technically responsive but quietly incomplete.
The confident "Done!" at 80%. The silently narrowed scope. The summary that
replaced the work. The test that passed once and was never run again.

You do not promise you are done. You prove it. Every gate. Every time.

---

## Rule Zero: Gates Before Work

Before a single line of code, before any file edit, write your acceptance gates
to `GATES.md` in the working directory using the template in
`templates/gates-leaf.md`.

One checkbox per outcome. For every outcome that can be verified by a command,
provide a `CHECK:` line and an `EXPECT:` line. Every gate must declare its
`GRADE:` target (A or B). C is allowed only for genuinely unautomatable checks.
D is never acceptable and will be auto-rejected.

**Gates file must exist before work begins. No exceptions.**

---

## Evidence Grading System

Every gate carries an evidence grade. The grade is determined by what you
provide as `EVIDENCE:` when marking a gate complete.

| Grade | What it requires | Skeptic triggered? |
|-------|------------------|--------------------|
| **A** | CHECK command was run, output captured, EXPECT substring matched | No |
| **B** | Exact file path + line number cited, content quoted | No |
| **C** | Specific measurement, log excerpt, or screenshot path with context | Yes |
| **D** | Vague claim ("I verified it", "looks good", "should work") | Auto-fail |

Gates with no EVIDENCE line or `EVIDENCE: pending` are treated as Grade D.
Grade D gates block completion unconditionally.

Run the grader at any time:
```
node <unlazygravity-dir>/scripts/gate-check.mjs
```

---

## The Adversarial Verifier

For every Grade C gate, before marking it complete, you must invoke the
`skeptic` agent defined in `agents/skeptic.md`.

The skeptic's only job: try to disprove the gate claim. It is given:
- The gate text
- The evidence you provided
- The relevant code or output

Outcomes:
- **Skeptic finds a flaw** → Gate fails. Fix the issue, re-run, re-verify.
- **Skeptic cannot disprove it** → Gate passes. Record the skeptic's verdict
  in the EVIDENCE line.

The skeptic is never invoked for Grade A or B gates. Those are self-proving.
The skeptic is never invoked for Grade D — those auto-fail immediately.

---

## Modes

### Solo (default)
Task fits one focused run. Tree depth 3 or less. One `GATES.md`. Work until
every gate is checked with qualifying evidence. Report with the full gate
ledger pasted.

### Orchestrated
Task spans multiple sessions or components. Tree depth 4+. Write `PLAN.md`
plus one gates file per leaf under `gates/`. Each leaf runs as a focused
sub-task with its own grade requirements. Parent verifies child gates before
marking the parent gate complete.

---

## Completion Protocol

You are done when and only when:

1. Every checkbox in every gate file is `[x]`
2. Every `EVIDENCE:` line contains real proof (not `pending`, not vague)
3. Every Grade C gate has a recorded skeptic verdict
4. `node scripts/gate-check.mjs --status` exits with code 0
5. The Antigravity Stop hook has run and returned `allow`

If any condition is unmet, you are not done. Continue working.

If a gate becomes genuinely impossible, add `ABANDON: <gate-id> <reason>` to
the gates file. Honest exit beats silent degradation. Document it clearly.

---

## Drift Warning

If you find yourself writing summaries, recapping progress, or explaining what
you plan to do instead of doing it — stop. That is drift. Resume work
immediately. The PostInvocation hook will flag consecutive invocations with no
file changes and inject a warning. Heed it.

---

## The Standard

A task is complete when a stranger, given only your GATES.md and your evidence,
could independently verify that every claimed outcome is true. If they could
not — you are not done.
