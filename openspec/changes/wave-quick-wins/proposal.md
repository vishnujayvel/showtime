# Wave: Quick Wins (#111, #173, #174)

## Problem

Three small, independent issues that can be resolved in parallel with minimal risk.

## Goals

1. **#111 — `--bare` flag for Claude subprocess**: Add `'--bare'` to the args array in `src/main/claude/run-manager.ts` for ~10x faster subprocess startup. One-line change in two methods.
2. **#173 — Manual smoke test checklist**: Create `scripts/manual-smoke.md` with the 5 critical user flows for post-merge verification.
3. **#174 — PR template checklist**: Add XState transition audit checklist to `.github/PULL_REQUEST_TEMPLATE.md`.

## Scope

### In scope
- Add `--bare` to `startRun()` and `preWarm()` args in `run-manager.ts`
- Create `scripts/manual-smoke.md` with 5 critical flows
- Create or update `.github/PULL_REQUEST_TEMPLATE.md` with XState checklist

### Out of scope
- Changing pty-run-manager.ts (interactive sessions need full context)
- Automated enforcement of checklist items

## Testing Strategy

- Run existing E2E tests to verify `--bare` doesn't break subprocess communication
- Verify the smoke test checklist covers the flows listed in issue #173
- Verify PR template renders correctly on GitHub

## Acceptance Criteria

- [ ] `--bare` flag added to `run-manager.ts` `startRun()` args
- [ ] `--bare` flag added to `run-manager.ts` `preWarm()` args
- [ ] `scripts/manual-smoke.md` exists with 5 critical flows
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists with XState transition audit checklist
- [ ] Existing tests pass with `--bare` flag

## Context (auto-generated)

### Relevant file paths
- `src/main/claude/run-manager.ts:327-334` — `startRun()` args array, add `'--bare'` after `-p`
- `src/main/claude/run-manager.ts:185-192` — `preWarm()` args array, add `'--bare'` after `-p`
- `src/main/claude/pty-run-manager.ts` — DO NOT modify (interactive sessions)
- `.github/PULL_REQUEST_TEMPLATE.md` — create if not exists

### CLAUDE.md rules that apply
- Rule #6: Testing — Playwright E2E is mandatory
- Rule #8: XState v5 — every full-screen view must be a state in the machine
- Git workflow: all changes through PRs, never push to main

### Build/run/test commands
```bash
npm run build        # Build the Electron app
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

### Recent git history for relevant files
```
3e45068 fix: move History/Settings/Onboarding to XState overlay region (#205)
80bc07e feat: mid-show lineup editing via Director Mode (#190) (#191)
```

### Tech stack
- Electron + React 19 + TypeScript
- XState v5 for state management
- Playwright for E2E testing
- Vitest for unit tests
