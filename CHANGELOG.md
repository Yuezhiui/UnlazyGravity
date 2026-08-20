# Changelog

## [1.0.0] — 2026-08-20

### Initial release

- `SKILL.md` — Core anti-laziness skill, Antigravity-native
- `scripts/gate-check.mjs` — Evidence grader (A/B/C/D) and gate runner
- `hooks/stop-hook.mjs` — Antigravity Stop hook, blocks completion on unmet gates
- `hooks/drift-hook.mjs` — Antigravity PostInvocation hook, detects recap drift
- `agents/skeptic.md` — Adversarial verifier persona for Grade C gates
- `templates/gates-leaf.md` — Gate file template with grade guidance
- `references/evidence-grades.md` — Full grading system documentation
- `hooks.json` — Ready-to-use Antigravity hooks configuration

### What makes this different from other anti-laziness skills

1. **Antigravity-native**: Built exclusively for Antigravity's `hooks.json`
   lifecycle system. Not a port. Not an adaptation. Native.

2. **Evidence Grading**: Four-tier evidence system (A/B/C/D). Vague claims
   are structurally rejected — not just discouraged.

3. **Adversarial Verifier**: Grade C gates must survive an independent skeptic
   agent that actively tries to disprove the claim before it passes.

4. **Drift Detection**: PostInvocation hook catches agents that are recapping
   or summarizing instead of working — and forces them back to the task.
