# Design Audit: Claude Code Skill vs Current Prompt Architecture

## Work Type: Architecture (design doc output only)

## Goal

Produce a design document at `docs/plans/skill-vs-current-architecture.md` that honestly evaluates two approaches for Showtime's Claude integration:

**Approach A (Current):** Prompts constructed in renderer (WritersRoomView.tsx), sent via sessionStore → ControlPlane → Claude CLI. System context injected per-message. Calendar fetched via MCP during conversation.

**Approach B (Skill):** A Claude Code skill (`/showtime` or via `--skill`) that defines the lineup contract in SKILL.md. Showtime Electron app invokes Claude CLI with the skill loaded. Claude knows it's Showtime from the skill context.

## What to Analyze

### 1. Current Architecture — How It Works Today

Read these files and document the prompt flow:
- `src/renderer/views/WritersRoomView.tsx` — handleBuildLineup, handleSend, handleRefinement
- `src/renderer/lib/refinement-prompt.ts` — buildRefinementPrompt
- `src/renderer/stores/sessionStore.ts` — sendMessage, displayText separation
- `src/renderer/components/ChatMessage.tsx` — splitLineupFromContent, LineupCard rendering
- `src/main/claude/run-manager.ts` — CLUI_SYSTEM_HINT

Document:
- What system prompts are injected and where
- What the user sees vs what Claude receives (displayText split)
- How lineup JSON is detected and rendered (the splitLineupFromContent approach)
- How calendar events are fetched (MCP during conversation vs prefetch)
- What bugs this architecture has caused (#73, #85, Go Live, JSON flicker)

### 2. Skill Architecture — How It Would Work

Read the existing skill at `src/skills/showtime/SKILL.md` and document:
- What instructions would go in the skill SKILL.md
- How the CLI invocation changes (`claude --skill showtime` or `--append-system-prompt`)
- How lineup format would be enforced (skill instruction vs per-message prompt)
- How calendar would be handled (skill has MCP access by default)
- How the displayText split problem goes away (Claude's response IS what the user sees)
- What the renderer would need to change (or not change)

### 3. Pros and Cons Table

| Dimension | Current (Prompts) | Skill |
|-----------|-------------------|-------|
| Prompt reliability | ? | ? |
| Calendar integration | ? | ? |
| JSON format compliance | ? | ? |
| User experience (visible prompts) | ? | ? |
| Testing | ? | ? |
| Deployment complexity | ? | ? |
| Customizability | ? | ? |
| Startup speed | ? | ? |

### 4. The Calendar Problem

The user specifically noted: "When we start the lineup, there are a lot of issues. I don't see us starting with fetching Google events. When we show the UI, it should immediately start fetching Google calendar events."

Analyze both approaches for calendar:
- **Current:** Calendar prefetch was removed because it polluted the chat. Now calendar only appears when the user asks.
- **Skill:** Could the skill's SKILL.md instruct Claude to always check calendar on first message? Would this be automatic?

### 5. JSON Response Mode

The user asked: "Can't we just let Claude Code always be instructed to return back the response in JSON?"

Analyze:
- Can `--append-system-prompt` or SKILL.md force JSON-only responses?
- Is this desirable? (user wants to chat naturally, JSON is for lineup extraction only)
- Could the skill define a hybrid mode: chat naturally, but when lineup is requested, output as JSON?

### 6. Recommendation

Based on the analysis, recommend:
- Build the skill now? Or later?
- What to put in the skill vs what stays in the renderer?
- Migration path from current to skill architecture

## Output

Write to `docs/plans/skill-vs-current-architecture.md`. Commit the document.
