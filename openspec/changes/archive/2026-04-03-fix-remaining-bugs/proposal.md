# Proposal: Fix Remaining Bugs + Harden Tests

## Issues to fix

### Bug #72: Claude subprocess exits code=1 on warmup session resume (ALREADY FIXED)

The fix exists on branch `fix/claude-warmup-and-queue` (commit 53aeb41):
- `initSession` changed from `process.cwd()` to `homedir()` for projectPath
- Queue-during-connecting prevents lost prompts
- Default model set to `claude-sonnet-4-6`

**Action:** Cherry-pick or rebase these changes onto main. The fix is proven — just needs to land.

Key files already modified on that branch:
- `src/renderer/App.tsx` — warmup at launch
- `src/renderer/stores/sessionStore.ts` — queue during connecting, Sonnet default
- `src/main/claude/control-plane.ts` — warmup uses Sonnet, homedir() fix
- `src/renderer/components/LineupChatInput.tsx` — remove duplicate conversation

### Bug #71: Writer's Room skips to conversation step on app restart

**Root cause:** `writersRoomStep` persists in localStorage across restarts. User lands in conversation step without lineup context.

**Fix (Option C from the issue):** Check if acts exist — if not, route through `handleBuildLineup` instead of `handleRefinement`. Also reset `writersRoomStep` to `'energy'` on app start if no acts are present.

Files to modify:
- `src/renderer/views/WritersRoomView.tsx` — add guard at mount: if `writersRoomStep === 'conversation'` but `acts.length === 0`, reset to `'energy'`
- `src/renderer/stores/showStore.ts` — add `resetWritersRoomIfStale()` action

### Bug #70: System theme (dark/light) doesn't sync correctly

**Root cause:** `nativeTheme.on('updated')` listener not broadcasting to renderer, or renderer not responding.

Files to investigate/modify:
- `src/main/window.ts` — ensure `nativeTheme.on('updated')` sends IPC to renderer
- `src/renderer/App.tsx` — ensure theme IPC listener applies dark/light class to document
- `src/renderer/index.css` — ensure dark mode CSS variables exist

### Enhancement #69: Harden Claude E2E test assertions (CodeRabbit review)

10 assertion improvements across 3 files:

**claude-real.test.ts:**
1. Don't treat normal lineup or blank 120s timeout as "error" pass
2. Scope Claude log assertions to current test (not cumulative)
3. Require real lineup change on refinement (`> initialCount`, not `>= initialCount`)
4. Assert the live phase, not just that app stayed mounted
5. Use `firstActName` to prove turn-to-turn context survived

**claude-cassette.test.ts:**
6. Launch fresh Electron process per cassette test
7. Don't let replay layer skip itself away
8. Multi-turn replay needs actual second turn
9. Assert recovery UI, not just delayed screenshot

**fixtures.ts:**
10. Don't treat timed-out spinner wait as "complete"

## Testing Strategy

- Run full E2E suite after all fixes
- Run claude-real tests with live Claude to verify #72 warmup fix
- Verify theme sync with system dark/light toggle
- Verify app restart doesn't skip to stale conversation step

## Priority Order

1. #72 (cherry-pick existing fix — lowest risk)
2. #71 (localStorage guard — small change)
3. #70 (theme sync — investigate first)
4. #69 (test hardening — improves everything going forward)
