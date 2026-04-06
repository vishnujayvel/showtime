## Summary

<!-- Brief description of what this PR does and why -->

## Checklist

- [ ] If this PR changes user flow in a view, I verified the XState machine accepts all events the view sends from the state the user will actually be in
- [ ] If this PR modifies `showMachine.ts`, I ran the state coverage report (`bun run scripts/state-coverage-report.ts`) and checked for orphaned transitions
- [ ] If this PR adds a new full-screen view, it is a state in the XState machine (not `useState` routing)
- [ ] No inline `style={{}}` objects — all styling uses Tailwind utility classes
- [ ] E2E test coverage added or updated for changed user flows
- [ ] Animations use spring physics only (no linear transitions)

## Test Evidence

<!-- Paste Playwright screenshots or test output here -->
