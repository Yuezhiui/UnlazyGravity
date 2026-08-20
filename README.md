# UnlazyGravity

**Anti-laziness enforcement for Antigravity. Built native. No ports. No compromises.**

An AI agent cannot declare a task done. It can only prove it — gate by gate,
with graded evidence, surviving an adversarial verifier. The moment it tries to
stop with unmet gates, Antigravity's Stop hook blocks it and sends it back to work.

Built exclusively for [Antigravity](https://antigravity.google/) using its native
`hooks.json` lifecycle system.

---

## The problem this solves

AI agents have a deeply consistent failure mode: they finish 80% of a task,
then confidently output "✅ Done!" The remaining 20% — the edge cases, the
error paths, the unverified assumptions — gets silently dropped.

Standard anti-laziness tools fight this with instructions. Instructions raise
effort but cannot catch the failures that survive confident self-reporting:
wrong numbers in summaries, gates that "passed" because the agent believed
they did, work that stalled into recap mode.

UnlazyGravity moves enforcement out of goodwill and into files and hooks.
You do not promise you are done. You prove it.

---

## How it works

```
1. Task starts
   └─ Agent writes GATES.md before any work (required, not optional)

2. Agent works...
   └─ drift-hook.mjs fires after each invocation
      └─ 3+ invocations with no file changes? → DRIFT ALERT injected

3. Agent tries to stop
   └─ Antigravity Stop hook fires stop-hook.mjs
      ├─ Unmet gates found? → decision: "continue" — agent is BLOCKED
      ├─ Grade D evidence found? → decision: "continue" — agent is BLOCKED
      └─ All gates met with qualifying evidence? → decision: "allow"

4. Done
   └─ Every gate checked, every evidence graded A or B (or C with skeptic PASS)
```

---

## Evidence Grading

The core innovation. Not all evidence is equal.

| Grade | What it requires | Accepted | Skeptic |
|-------|-----------------|----------|---------|
| **A** | CHECK command run, output captured, EXPECT matched | ✅ | No |
| **B** | Exact file:line cited, content quoted | ✅ | No |
| **C** | Specific measurement or log excerpt | ✅* | **Yes** |
| **D** | Vague claim ("looks good", "verified", "should work") | ❌ | N/A |

*Grade C gates must pass the Adversarial Verifier before closing.

Grade D is structurally rejected. The Stop hook reads evidence lines and blocks
on any `EVIDENCE: pending` or vague content — no matter what the checkbox says.

---

## The Adversarial Verifier

For Grade C gates, a second agent (`agents/skeptic.md`) is invoked. Its only
job: try to disprove the gate claim.

- **Skeptic finds a flaw** → Gate fails. Fix and re-verify.
- **Skeptic cannot disprove** → Gate passes. Verdict is recorded in the evidence line.

This is not self-verification. The agent that did the work cannot also be the
one that certifies it was done correctly — for any gate where the proof is not
mechanically verifiable.

---

## Drift Detection

A PostInvocation hook monitors invocation count vs. file modification time.
After 3 consecutive invocations with no file changes, it injects a system
message directly into the agent's context:

```
━━ UNLAZYGRAVITY DRIFT ALERT ━━
3 consecutive invocations with no file changes detected.
You are recapping, summarizing, or planning instead of working.
STOP. Open a file. Make a change. Run a command.
```

Talking about work is not work.

---

## Installation

### Option 1 — Project-level (recommended)

Copy into your project's `.agents/` directory:

```
your-project/
  .agents/
    SKILL.md              ← copy UnlazyGravity/SKILL.md here
    hooks.json            ← copy UnlazyGravity/hooks.json here
    hooks/
      stop-hook.mjs
      drift-hook.mjs
    agents/
      skeptic.md
    scripts/
      gate-check.mjs
    templates/
      gates-leaf.md
```

### Option 2 — Global (all projects)

Copy into `~/.gemini/config/`:

```
~/.gemini/config/
  skills/
    unlazygravity/        ← this entire repo
  hooks.json              ← merge with existing or copy
  hooks/
    stop-hook.mjs
    drift-hook.mjs
```

> **Note:** If you already have a `hooks.json`, merge the two hook entries
> rather than replacing the file.

---

## Usage

### Starting a task under UnlazyGravity

Before writing any code:

```
1. Copy templates/gates-leaf.md to GATES.md in your working directory
2. Fill in your gates — one per observable outcome
3. Set GRADE targets (aim for A, accept B, justify C, never D)
4. Begin work
```

### Running the gate checker manually

```bash
node scripts/gate-check.mjs             # run checks, grade evidence, update file
node scripts/gate-check.mjs --status    # report only, no file changes
node scripts/gate-check.mjs gates/auth.md  # target a specific file
```

### GATES.md example

```markdown
# Gates: User authentication

Scope: Users can sign in with email/password and receive a JWT.

- [ ] G1: POST /auth/login returns 200 with token for valid credentials
  CHECK: curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"correct\"}"
  EXPECT: 200
  EVIDENCE: pending

- [ ] G2: POST /auth/login returns 401 for wrong password
  CHECK: curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}"
  EXPECT: 401
  EVIDENCE: pending

- [ ] G3: JWT token structure is valid (header.payload.signature)
  CHECK: node -e "const t=require('fs').readFileSync('.test-token','utf8').trim(); console.log(t.split('.').length === 3 ? 'valid' : 'invalid')"
  EXPECT: valid
  EVIDENCE: pending
```

---

## Requirements

- Node.js 16+
- Antigravity (any version supporting `hooks.json` with `Stop` and `PostInvocation` events)
- Zero npm dependencies — built-ins only

---

## License

MIT — Copyright (c) 2026 Yue

See [LICENSE](LICENSE) for full text.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

The short version: make evidence harder to fake, not easier.
