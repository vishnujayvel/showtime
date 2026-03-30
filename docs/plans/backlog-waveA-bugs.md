# Wave A: Critical Bug Fixes — Issues #112, #113, #114, #118

## IMPORTANT: Issue Closure Protocol
When closing issues, you MUST:
1. Add labels FIRST: `gh issue edit <N> --add-label "root-cause" --add-label "has-test-evidence"`
2. Then close with structured comment containing all three sections:
   - `Root cause:` — why the bug exists
   - `Fix:` — what was changed
   - `Test evidence:` — proof it works (test output, screenshots)
A GitHub Action will REOPEN issues that are missing the required labels.

## Issue #112: bug: system prompt leaked to user in Writer's Room chat
- The system prompt text ("You are Showtime, an ADHD-friendly day planner...") appears as a visible chat bubble in the Writer's Room
- Check `WritersRoomView.tsx` where the system prompt is constructed (around line 170)
- The system prompt should be passed via `--system-prompt` or `--append-system-prompt` to the Claude subprocess and NEVER rendered in the chat UI
- Check `ChatPanel.tsx` to see how messages are rendered — filter out system messages from the display
- The NDJSON stream from `claude -p` includes system messages — they must be filtered in the event normalizer or chat panel

## Issue #113: bug: no loading state when Claude subprocess is starting up
- When user clicks "Build my lineup" or sends a chat message, there is no visual feedback for several seconds while the Claude subprocess boots
- Add a loading/thinking indicator in `ChatPanel` between send and first assistant response
- Use a thematic message like "The writers are getting ready..." or a subtle typing animation
- Check the event flow: ChatPanel sends message -> RunManager spawns subprocess -> first NDJSON event arrives
- The gap between send and first event is the window that needs a loading state

## Issue #114: bug: default lineup shown without user input
- Claude generates a default lineup immediately based on energy level alone, without waiting for user input
- Then asks "What's on your plate today?" AFTER already showing the lineup (backwards flow)
- When calendar data arrives, the lineup gets replaced (correct behavior, but the initial default is confusing)
- Fix the system prompt to instruct Claude to ASK first before generating a lineup
- OR wait for calendar data before triggering lineup generation

## Issue #118: bug: pill view missing SHOWTIME label
- PillView.tsx line 54 renders only TallyLight dot with no text label
- DashboardView.tsx line 64-67 and CompactView.tsx have TallyLight + "SHOWTIME" text
- Add "SHOWTIME" label in the same monospace uppercase style next to the tally dot in PillView
- Keep it compact — pill view is intentionally minimal but should still identify the app

## Testing Strategy
- Run `npm test` — all 521+ tests must pass
- Run E2E tests for Writer's Room flow: `npx playwright test --project core-flow`
- For #112: verify system prompt is NOT visible in chat
- For #113: verify loading state appears when sending a message
- For #114: verify Claude asks before generating lineup, OR waits for calendar
- For #118: verify "SHOWTIME" label appears in pill view
- Take Playwright screenshots as evidence

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only, spring physics animations
- Do not modify the actual system prompt content — only fix where/how it's displayed
- Loading state should use the Showtime design language (dark theme, warm accents)
