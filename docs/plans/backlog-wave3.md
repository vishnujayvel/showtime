# Wave 3: Enhancements — Issues #100, #87, #88

## Issue #100: chore: add husky pre-commit hooks for test + lint
- Husky is already installed (package.json has `"prepare": "husky || true"`)
- Add pre-commit hook that runs `npm test` (vitest) before each commit
- Add a lint check if ESLint is configured, otherwise skip
- Ensure the hook doesn't block when run in CI (check for CI env var)
- Test by making a commit and verifying the hook runs

## Issue #87: feat: enforce structured issue closure (anti-gaming)
- There's already a hook at `~/.claude/hooks/validate-issue-close.sh` that requires Root cause, Fix, and Test evidence in gh issue close comments
- This issue is about documenting and enforcing this pattern
- Add a CONTRIBUTING.md section or update existing docs about the structured closure format
- Verify the hook works by attempting to close an issue without the required format

## Issue #88: feat: tray menu shows current act + timer (menu bar view tier)
- The tray menu already exists (commit 9a037bc "feat: dynamic tray menu bar with live show status")
- Check if the current implementation shows act name + timer
- If not, enhance the tray menu to display: current act name, remaining time, act category
- Update the tray menu on timer tick via IPC

## Testing Strategy
- Run `npm test` — all 521 tests must pass
- For #100: test the husky hook by making a test commit
- For #88: run the app and verify tray menu shows act info
- Close each issue with proper Root cause / Fix / Test evidence format

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only
- Do not break existing functionality
