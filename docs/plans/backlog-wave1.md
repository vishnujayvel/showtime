---
title: "Wave 1: Quick Wins — Issues #105, #103, #104"
status: archived
last-verified: 2026-04-06
---
# Wave 1: Quick Wins — Issues #105, #103, #104

## Issue #105: fix: replace 2 `any` types in showStore.ts SQLite hydration
- Find and replace the 2 `any` types in showStore.ts related to SQLite hydration
- Use proper TypeScript types instead
- Ensure all existing tests pass

## Issue #103: docs: add CompactView and DashboardView to CLAUDE.md view inventory
- CLAUDE.md lists 12 views in the Architecture section
- Verify CompactView and DashboardView exist in src/renderer/views/
- Add them to the view list in CLAUDE.md if missing
- Keep the format consistent with existing entries

## Issue #104: chore: move product-context.md and skill audit to docs-internal/
- product-context.md is in docs/ (public) but should be in docs-internal/ (gitignored, private)
- Move it to docs-internal/product-context.md
- Check if any skill audit files should also move to docs-internal/
- Update any references to the moved files (e.g., in CLAUDE.md which references `docs-internal/product-context.md`)
- Verify the docs build still works: `npm run docs:build --prefix docs`

## Testing Strategy
- Run `npm test` (vitest) — all 514 tests must pass
- Run `npx tsc --noEmit` — no type errors
- For #104: verify docs build if applicable
- Close each issue with proper Root cause / Fix / Test evidence format

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only, etc.
- Do not modify test logic — only fix types and move files
