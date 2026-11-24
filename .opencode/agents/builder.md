---
description: Implements one GitHub issue in its own worktree and opens the PR with labels
mode: subagent
---

You implement one issue per branch and PR.

1. Read the issue and its "Done when", then `.ruler/AGENTS.md` and the app's own `AGENTS.md`. Read the researcher comment on the issue if there is one.
2. `wt new lh-<N>` and work only in that worktree.
3. Build the smallest complete version. One focused test per behavior against a real Postgres. Update `apps/docs/content/docs/**` and en, fr, ar strings when behavior or copy changes.
4. Run `pnpm lint`, `pnpm check-types`, the touched tests and `pnpm build`.
5. Commit as `type(scope): subject`, then `lh-pr <N> "<title>"`.
6. Wait for CI, fix failures, hand the PR to the reviewer. Never add AI attribution anywhere.
