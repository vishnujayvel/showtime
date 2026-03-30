# Contributing to Showtime

Thanks for your interest in contributing! Showtime is an ADHD-friendly macOS day planner built on the SNL Day Framework.

## Getting started

1. Fork and clone:
   ```bash
   git clone https://github.com/<your-username>/showtime.git
   cd showtime
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start dev mode:
   ```bash
   npm run dev
   ```

Requires **macOS** and **Node.js 20+**.

## Development tips

- **Main process** changes (`src/main/`) require a full restart.
- **Renderer** changes (`src/renderer/`) hot-reload automatically.
- Toggle the window with `Opt+Space` (fallback: `Cmd+Shift+K`).
- Dev reset: `Cmd+Shift+R` clears all state and reloads.

## Pull request workflow

All changes go through PRs. No direct pushes to `main`.

1. Create a branch: `git checkout -b feat/my-change`
2. Make your changes
3. Run tests: `npm run test && npm run build && npm run test:e2e`
4. Push and open a PR against `main`
5. **CodeRabbit** will auto-review your PR — address its feedback
6. Get a human review
7. Squash-merge when approved

### Branch naming

- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation
- `chore/` — build, CI, tooling
- `refactor/` — restructuring without behavior change

## Code style

These are non-negotiable (CodeRabbit enforces them):

- **No inline styles.** Use Tailwind CSS utility classes, never `style={{}}`.
- **shadcn/ui for interactive components.** Buttons, modals, dialogs — use the primitives.
- **Spring physics only.** Framer Motion with `type: "spring"`. No linear transitions.
- **Zustand for state.** No React Context for state management.
- **Typed IPC.** All channels go through the `IPC` enum and `window.clui` bridge.
- **E2E tests required.** Every feature needs Playwright coverage.

See [CLAUDE.md](CLAUDE.md) for the full rule set.

## Closing issues

Every issue must be closed with a structured comment containing three required sections. A Claude Code pre-tool-use hook enforces this automatically — `gh issue close` will be blocked if the comment is missing any section.

**Required format:**

```
Root cause: <why the issue existed>
Fix: <what was changed to resolve it>
Test evidence: <proof the fix works — test output, screenshots, or Playwright evidence>
```

**Example:**

```bash
gh issue close 42 --comment "Root cause: Tray menu was not subscribing to timer-tick IPC events.
Fix: Added ipcMain.on('timer-tick') handler in tray.ts that rebuilds the context menu with updated time.
Test evidence: npm test 521/521 pass. Playwright screenshot confirms tray shows '12:34 remaining'."
```

This prevents drive-by closures and ensures every fix is traceable. The hook lives at `~/.claude/hooks/validate-issue-close.sh` and is configured globally in Claude Code settings.

## Reporting bugs

Open an issue with:
- macOS version
- Node.js version (`node --version`)
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if it's a visual bug

## Documentation

`docs/` is the public VitePress site. Internal notes go in `docs-internal/` (gitignored). See CLAUDE.md "Documentation Rules" for details.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
