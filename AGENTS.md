<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

Never commit directly to `main`. For every task that changes files:

1. **Branch first**, before making any edits, off an up-to-date `main`:
   ```
   git checkout main && git pull
   git checkout -b <type>/<short-kebab-description>
   ```
   Branch `<type>` is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
   Examples: `feat/skill-companies`, `fix/skill-companies-mixed`.

2. **Commit** in logical units with a short imperative subject line, no trailing period, no `type:` prefix — match the existing history style (`Redesign Skills page and add Skills link to mobile menu`). Wrap the body at ~72 chars and explain *why*, not *what*, when the change isn't self-evident.

3. **Push** the branch and set upstream:
   ```
   git push -u origin <branch>
   ```
   Then report the compare URL so a PR can be opened:
   `https://github.com/sadiqanwerkhan/apply-tracker/compare/<branch>?expand=1`

## Rules

- Only commit and push when explicitly asked. Never do either as a side effect of another task.
- Before committing, run `git status` and `git diff --staged` and confirm every staged file is intended. Stage files by name; do not use `git add -A` or `git add .`.
- Never commit secrets, `.env*` files, build output, or `node_modules`.
- Verify the change builds before committing: `npm run build` (and `npm run lint` if touching source).
- Never use `--no-verify`, `--force`, or `--force-with-lease` on a shared branch without being asked.
- If already on a non-`main` feature branch relevant to the task, keep using it instead of branching again.
- `gh` (GitHub CLI) is not installed on this machine — do not attempt to open PRs with it. Push the branch and hand over the compare URL instead.
