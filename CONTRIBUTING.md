# Contributing to UnlazyGravity

Thank you for wanting to make this better.

## Philosophy

UnlazyGravity exists to kill one specific failure: work that is technically
responsive but quietly incomplete. Every contribution should serve that goal.
If a change makes it easier for an agent to fake completion, it is wrong.
If it makes proof harder to fake, it is right.

## How to contribute

1. Fork the repository
2. Create a branch: `git checkout -b your-feature-name`
3. Make your changes
4. Write a GATES.md for your own PR (yes, really — dogfood the skill)
5. Submit a pull request

## What we welcome

- Improvements to the evidence grading logic in `scripts/gate-check.mjs`
- New skeptic challenge patterns in `agents/skeptic.md`
- Better drift detection in `hooks/drift-hook.mjs`
- Documentation improvements
- Bug fixes in the Stop hook
- Real-world gate templates for common task types

## What we do not accept

- Changes that lower the evidence bar
- Changes that make Grade D evidence passable
- Changes that disable the adversarial verifier for C-grade gates
- Changes that make it easier to skip the GATES.md requirement

## Code style

- Zero dependencies. Node built-ins only.
- Every script must work on Windows (PowerShell) and Unix (bash).
- Comments explain why, not what.

## Questions

Open an issue. Be specific.
