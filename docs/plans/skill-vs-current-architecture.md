# Design Audit: Claude Code Skill vs Current Prompt Architecture

**Date:** 2026-03-28
**Status:** Draft
**Author:** Loki Mode (autonomous audit)

---

## 1. Current Architecture — How It Works Today

### The Prompt Flow

Showtime's Claude integration uses a **prompt-in-user-message** pattern. There is no dedicated system prompt channel for Showtime-specific instructions. Instead, every structured interaction bakes role-playing instructions, JSON schemas, and context directly into the user message sent to Claude.

```
User clicks "BUILD MY LINEUP"
       │
       ▼
WritersRoomView.tsx::handleBuildLineup()
  ├── Constructs ~20-line prompt with:
  │   ├── Persona: "You are Showtime, an ADHD-friendly day planner"
  │   ├── Energy level context
  │   ├── Calendar events (if pre-populated, currently disabled)
  │   ├── JSON schema (showtime-lineup format)
  │   ├── Category constraints
  │   └── Last 5 user messages as context
  └── Calls sendMessage(fullPrompt, undefined, "Build my lineup")
       │
       ▼
sessionStore.ts::sendMessage(prompt, projectPath?, displayText?)
  ├── Stores displayText in UI messages array (user sees "Build my lineup")
  ├── Sends raw prompt via window.clui.prompt()
  └── IPC → ControlPlane → RunManager
       │
       ▼
run-manager.ts::startRun()
  ├── Spawns: claude -p --input-format stream-json --output-format stream-json
  ├── Appends: --append-system-prompt CLUI_SYSTEM_HINT
  │   (tells Claude it's in a GUI, use markdown, render images)
  ├── Writes user message to stdin as NDJSON
  └── Pipes stdout through StreamParser → EventNormalizer → Renderer
       │
       ▼
ChatMessage.tsx::splitLineupFromContent()
  ├── Tier 1: Regex for ```showtime-lineup or ```json fenced blocks
  ├── Tier 2: tryParseLineup() with 3 fallback strategies
  ├── Tier 3: Bare JSON with "acts" array detection
  ├── Streaming: Partial lineup detected → "Building your lineup..." placeholder
  └── Renders: textBefore + LineupCard (interactive, editable) + textAfter
```

### System Prompts — What's Injected and Where

There are **two layers** of system prompt injection:

| Layer | What | How | Content |
|-------|------|-----|---------|
| **RunManager** | `CLUI_SYSTEM_HINT` | `--append-system-prompt` flag (additive) | "You are running inside CLUI, a desktop chat app. Use rich markdown, tables, code blocks. Render images via `![alt](url)`. Use WebSearch/WebFetch for real URLs." |
| **WritersRoomView** | Showtime persona + schema | Baked into user message text | "You are Showtime, an ADHD-friendly day planner. Energy level is X. Respond with ```showtime-lineup JSON..." |

The CLUI_SYSTEM_HINT is **always appended** to every Claude session. The Showtime-specific instructions are **only present when the view constructs a structured prompt** (lineup build, refinement). Plain chat messages carry no Showtime context — Claude only knows it's Showtime from conversation history.

### The displayText Split — What the User Sees vs What Claude Receives

The `sendMessage(prompt, projectPath?, displayText?)` function in sessionStore enables a critical split:

```typescript
const visibleText = displayText || prompt
// UI messages array gets visibleText
// window.clui.prompt() gets raw prompt
```

**Concrete examples:**

| Action | User Sees | Claude Receives |
|--------|-----------|-----------------|
| Build lineup | "Build my lineup" | 20-line structured prompt with persona, energy, schema, context |
| Refinement ("swap yoga for a run") | "swap yoga for a run" | Full refinement prompt with current lineup JSON, energy, categories, preservation rules |
| Plain chat | Raw text | Same raw text |

**Problem:** The queued prompts array only stores the raw prompt, not the display text. If a message is queued while Claude is busy, the display text is lost when it eventually sends.

### Lineup JSON Detection and Rendering

`splitLineupFromContent()` in ChatMessage.tsx uses a multi-tier regex strategy:

| Priority | Pattern | Purpose |
|----------|---------|---------|
| 1 | `` ```showtime-lineup\s*\n([\s\S]*?)``` `` | Primary: labeled fenced block |
| 2 | `` ```(?:json)?\s*\n([\s\S]*?)``` `` | Fallback: generic JSON block |
| 3 | `\{[\s\S]*"acts"\s*:\s*\[[\s\S]*\][\s\S]*\}` | Last resort: bare JSON |

Before parsing, tool-call noise is stripped: `` ```tool_use```, ```tool_result```, ```tool_call``` `` blocks are removed.

**Streaming handling:** If the content contains partial lineup indicators (`"acts"` inside an open fence) but parsing fails, a placeholder card with spinner is shown instead of raw JSON.

**Validation:** `isValidLineup()` requires `Array.isArray(obj.acts) && typeof obj.beatThreshold === 'number'`.

The parsed lineup renders as an interactive `LineupCard` component. Crucially, the card uses **live Zustand store data** rather than the frozen parsed version, so user edits persist across re-renders.

### Calendar Integration — Current State

Calendar integration is in a **transitional/broken state**:

1. **Prefetch is disabled** — commented out with: `// Calendar prefetch DISABLED in chat-first mode. Claude fetches calendar directly via MCP tools when the user asks.`
2. **Detection works** — sessionStore checks the MCP tool list at `session_init` for tools matching `gcal`, `google_calendar`, or `calendar`. If found, sets `calendarAvailable: true`.
3. **The injection path exists but is dead** — `handleBuildLineup` has calendar event injection code that only fires if `calendarEnabled && calendarEvents.length > 0`. Since prefetch is disabled, `calendarEvents` is always empty.
4. **User must ask** — The only way calendar data enters the conversation is if the user explicitly asks Claude to check their calendar, at which point Claude uses MCP tools mid-conversation.

**The user's complaint:** "When we start the lineup, there are a lot of issues. I don't see us starting with fetching Google events. When we show the UI, it should immediately start fetching Google calendar events."

### Bugs This Architecture Has Caused

| Bug | Issue | Root Cause | Architectural Lesson |
|-----|-------|------------|---------------------|
| **Refinement dumps raw JSON** | #73 | Refinement prompt was missing lineup context, energy, categories, and MCP prohibition. Claude interpreted user input as calendar queries. | Per-message prompt construction is fragile — every new prompt path must manually include all context. |
| **JSON flicker during streaming** | #85 | `splitLineupFromContent()` regex only matches complete fenced blocks. During streaming, partial JSON like `{"acts": [{"name": "Deep Wor` renders as raw text. | The renderer must parse Claude's output format in real-time, creating a coupling between prompt instructions and parsing logic. |
| **Go Live button invisible** | #74 | The "Finalize Lineup" button scrolled off-screen in the Writer's Room. | UI/UX issue, not architectural. |
| **Go Live button unclickable** | #83 | CSS spotlight overlay (`absolute inset-0`) intercepted clicks above the button. | UI/UX issue, not architectural. |
| **Go Live missing entirely** | #50 | No physical button existed — the transition auto-advanced. | Missing the deliberate "threshold crossing" ceremony important for ADHD users. |
| **Calendar connection flicker** | #49 | Async connection check rendered "Connect" banner for ~1s before switching to connected state. | Async MCP status checks create UI flicker. Fixed by caching in localStorage. |

**Pattern:** Issues #73 and #85 are **directly caused by the prompt-in-user-message architecture**. Every new interaction path must manually reconstruct the full Showtime context, and the renderer must maintain fragile regex parsing to detect structured output embedded in free-text responses.

---

## 2. Skill Architecture — How It Would Work

### What the Existing Skill Contains

`src/skills/showtime/SKILL.md` (209 lines) already defines:

- **Persona:** "Showtime Director" — AI day-planning companion using the SNL framework
- **SNL vocabulary:** Show, Act, Beat, Sketch, Writer's Room, Cold Open, Intermission, Strike the Stage
- **Energy-based scheduling rules:** High/Medium/Low/Recovery with specific act ordering, durations, intermission patterns
- **Lineup format:** `showtime-lineup` fenced JSON block with `acts[]`, `beatThreshold`, `openingNote`
- **Beat Check prompts:** 10 rotating presence-moment questions
- **Director Mode:** Triggered when overwhelmed — 4 compassionate options
- **ADHD guardrails:** Forbidden language list + required reframes
- **Verdict tiers:** DAY WON / SOLID SHOW / GOOD EFFORT / SHOW CALLED EARLY
- **Rest affirmations:** 10 messages for intermission

### What's Missing from the Skill

- **Calendar/MCP instructions** — zero references to Google Calendar, MCP tools, or external data sources
- **Absolute time awareness** — acts are relatively ordered, no start/end times
- **App state protocol** — no instructions for how to communicate with the Electron app about phase transitions
- **JSON enforcement** — the format is defined but there's no instruction like "always respond with JSON when asked for a lineup"

### How the CLI Invocation Would Change

**Current:**
```bash
claude -p --input-format stream-json --output-format stream-json \
  --append-system-prompt "IMPORTANT: You are NOT running in a terminal..." \
  --verbose --permission-mode default
```
System prompt: CLUI_SYSTEM_HINT only. Showtime persona injected per-message.

**With skill:**
```bash
claude -p --input-format stream-json --output-format stream-json \
  --append-system-prompt "IMPORTANT: You are NOT running in a terminal..." \
  --append-system-prompt "$(cat src/skills/showtime/SKILL.md)" \
  --verbose --permission-mode default
```

Or, if Claude Code's `--skill` flag is used:
```bash
claude -p --skill showtime --input-format stream-json ...
```

The skill's SKILL.md would be loaded into the system prompt automatically. Claude would **always know it's Showtime** from the first message, without needing per-message persona injection.

### How Lineup Format Would Be Enforced

| Approach | Current (per-message) | Skill |
|----------|----------------------|-------|
| **Where defined** | Inline in `handleBuildLineup()` and `buildRefinementPrompt()` | Once in SKILL.md |
| **Consistency** | Must be manually duplicated across every prompt path | Single source of truth |
| **Bug surface** | #73 happened because refinement path was missing it | Format is always in context |
| **Categories** | Listed in each prompt, can drift | Listed once, authoritative |

### How Calendar Would Be Handled

A skill has MCP access by default — Claude Code loads the user's configured MCP servers. The skill's SKILL.md could include:

```markdown
## Calendar Integration

When the user asks you to build a lineup, ALWAYS check their Google Calendar first:
1. Use the gcal_list_events tool to fetch today's events
2. Treat calendar events as fixed acts (meetings -> Admin, focus blocks -> Deep Work)
3. Schedule user-requested acts around calendar constraints
4. Mark calendar-sourced acts with "(from calendar)" in the reason field
```

This solves the calendar problem elegantly: Claude always checks calendar on lineup build because the **skill tells it to**, not because the renderer pre-fetches and injects events into the prompt.

### How the displayText Split Problem Goes Away

With the skill architecture, **Claude's natural response IS what the user should see**. The skill instructs Claude to:
1. Respond conversationally ("Here's your lineup for today!")
2. Include the structured `showtime-lineup` block in the response
3. The renderer still parses and renders it as a `LineupCard`

The difference: the renderer no longer needs to **hide** the prompt from the user. There's no 20-line structured prompt being sent as a "user message" that must be disguised with `displayText`. The user's actual message ("Build my lineup") is what Claude receives, because all the context (persona, format, rules) is already in the system prompt via the skill.

```
BEFORE (current):
  User types: "Build my lineup"
  Claude receives: "You are Showtime, an ADHD-friendly day planner. The user has energy level 'high'..."
  User sees: "Build my lineup" (displayText hides the real prompt)

AFTER (skill):
  User types: "Build my lineup"
  Claude receives: "Build my lineup" (skill context already in system prompt)
  User sees: "Build my lineup" (no split needed)
```

### What the Renderer Would Need to Change

**Changes required:**
1. **Remove prompt construction from WritersRoomView** — `handleBuildLineup()` shrinks to `sendMessage("Build my lineup")`. No persona, no schema, no context injection.
2. **Remove `buildRefinementPrompt()`** — refinement becomes `sendMessage("swap yoga for a run")` because Claude already knows the lineup format and rules from the skill.
3. **Remove `displayText` parameter** from `sendMessage()` — or keep it but stop using it for Showtime prompts.
4. **Keep `splitLineupFromContent()`** — the renderer still needs to detect and render lineup JSON. This doesn't change.
5. **Keep `LineupCard`** — the interactive card component stays exactly the same.
6. **Add skill loading to RunManager** — pass `--append-system-prompt` with SKILL.md content, or use `--skill showtime`.

**Changes NOT required:**
- StreamParser, EventNormalizer, ControlPlane — untouched
- IPC bridge — untouched
- Permission server — untouched
- showStore state machine — untouched

---

## 3. Pros and Cons

| Dimension | Current (Prompts in User Messages) | Skill (System Prompt via SKILL.md) |
|-----------|-----------------------------------|-----------------------------------|
| **Prompt reliability** | Fragile — every new prompt path must manually include persona, format, constraints. Bug #73 was caused by a missing path. | Robust — persona and format are always in context via system prompt. New features only need the user's intent, not re-injected context. |
| **Calendar integration** | Broken — prefetch disabled, injection code dead, user must ask manually. | Natural — skill instructs Claude to check calendar on lineup build. MCP tools available by default. |
| **JSON format compliance** | Defined per-message, can drift between handleBuildLineup and buildRefinementPrompt. Category list duplicated in two places. | Single source of truth in SKILL.md. Claude always knows the format. |
| **User experience (visible prompts)** | Requires displayText hack — user sees "Build my lineup" while Claude receives 20-line prompt. Queued messages lose display text. | Clean — user's message IS what Claude receives. No split needed. |
| **Testing** | Prompt construction logic in view layer requires unit tests (refinementPrompt.test.ts). Regex parsing in ChatMessage needs E2E coverage for streaming. | Prompt logic moves to SKILL.md (static text, no code to test). Parsing tests remain the same. |
| **Deployment complexity** | Self-contained in the Electron app. No external skill file dependency. | Requires SKILL.md to be accessible to Claude CLI — either bundled with the app, in the project directory, or in user's skill config. |
| **Customizability** | Full programmatic control — can inject dynamic context (energy, calendar events, conversation history) into every prompt. | Less dynamic — skill is static text. Dynamic context (energy level, current acts) would need to be communicated via the user message or a companion tool. |
| **Startup speed** | No additional overhead — prompts constructed on demand. | Marginal overhead — SKILL.md loaded into system prompt at session start. ~209 lines of text. |
| **Conversation memory** | Claude forgets Showtime context in plain chat — only knows it's Showtime from conversation history. | Claude always knows it's Showtime — even in plain chat messages. |
| **Maintenance burden** | Prompt engineering spread across 3 files (WritersRoomView, refinement-prompt, run-manager). Changes require code changes + rebuild. | Prompt engineering centralized in SKILL.md. Changes only require editing a markdown file. |
| **Bug surface area** | High — 7 regex patterns for lineup detection, prompt construction in multiple paths, displayText synchronization. | Lower — same regex patterns, but prompt construction eliminated from renderer code. |

---

## 4. The Calendar Problem

### Current State

The calendar integration went through three phases:

1. **Phase 1 (prefetch):** App fetched calendar events before lineup build, injected them into the prompt. **Problem:** Calendar data polluted the chat — Claude's MCP tool calls (gcal_list_events) appeared as visible messages.

2. **Phase 2 (disabled):** Prefetch removed. Calendar events only appear when the user explicitly asks. **Problem:** The user's core complaint — "When we start the lineup, I don't see us starting with fetching Google events."

3. **Phase 3 (current):** The injection path exists in `handleBuildLineup()` but is dead code — `calendarEvents` is always empty because prefetch is disabled.

### Analysis: Current Architecture

In the current architecture, fixing calendar requires one of:

- **Re-enable prefetch with hidden messages:** Fetch calendar events before lineup build, but suppress the MCP tool call messages from the UI. This means extending the displayText pattern to hide entire messages, not just rewrite them. Adds complexity.

- **Prefetch via direct API:** Call Google Calendar API directly from the main process (bypassing Claude's MCP), inject events into the prompt. This duplicates MCP functionality and requires separate OAuth handling.

- **Accept the delay:** Let Claude fetch calendar during the lineup build conversation. The user sees tool calls in the chat. Takes 3-5 seconds extra.

### Analysis: Skill Architecture

The skill approach solves this more naturally:

```markdown
## Calendar Protocol (in SKILL.md)

When the user asks to build a lineup:
1. FIRST, use gcal_list_events to check today's calendar
2. Treat confirmed events as fixed acts
3. Schedule user tasks around calendar constraints
4. If calendar check fails, proceed without it and note the limitation
```

**Why this works better:**
- Claude checks calendar **as part of its reasoning**, not as a pre-flight step
- The MCP tool call happens inside Claude's turn — the user sees the lineup result, not the tool call details (depending on UI configuration)
- No prefetch code needed in the renderer
- No displayText hack needed to hide calendar fetching
- If the user's Google Calendar MCP server is configured, it just works. If not, Claude gracefully degrades.

**Remaining issue:** The user wants calendar data "immediately when we show the UI." Even with a skill, Claude still needs to make the MCP call during its response, which takes 2-3 seconds. Truly instant calendar display requires a renderer-side prefetch, which is orthogonal to the skill vs prompt architecture decision.

---

## 5. JSON Response Mode

### The Question

> "Can't we just let Claude Code always be instructed to return back the response in JSON?"

### Analysis

**Can `--append-system-prompt` or SKILL.md force JSON-only responses?**

Yes, technically. The skill could include:
```markdown
Always respond with valid JSON. No prose, no markdown, just JSON.
```

**Is this desirable?** No. The user wants to:
1. Chat naturally with Claude ("What should I do today?", "I'm feeling low energy")
2. Get structured JSON only when a lineup is requested
3. See conversational encouragement, not raw data structures

**Hybrid mode — the right approach:**

The skill can define a **conditional format**:

```markdown
## Response Format

When the user asks for a lineup or lineup modification:
- Include your conversational response (encouragement, explanation)
- THEN include the structured lineup in a ```showtime-lineup JSON block
- The app will detect and render the JSON block as an interactive card

When the user is just chatting:
- Respond naturally, no JSON needed
```

This is **exactly what the current architecture already does** — Claude responds with text + a fenced JSON block. The renderer parses and renders the JSON as a LineupCard. The skill just makes this instruction persistent rather than per-message.

**Could we use Claude's native JSON mode?**

Claude's API supports `response_format: { type: "json_object" }`, but:
- Claude Code CLI doesn't expose this flag
- It forces ALL output to be JSON, breaking natural chat
- The current fenced-block approach works well and is more flexible

**Verdict:** The hybrid approach (chat + fenced JSON when needed) is correct. The skill makes it more reliable by defining the format once in the system prompt.

---

## 6. Recommendation

### Build the Skill Now

The analysis strongly favors migrating to a skill-based architecture. The current prompt-in-user-message pattern has caused real bugs (#73, #85), creates maintenance burden across 3+ files, and makes calendar integration awkward.

### Migration Path

**Phase 1: Enhance SKILL.md (low risk, high value)**
1. Add calendar protocol instructions to SKILL.md
2. Add explicit JSON format instructions (the hybrid mode)
3. Add app state awareness (current phase, energy level, act context)
4. Keep the existing SKILL.md content (persona, ADHD guardrails, beat checks, etc.)

**Phase 2: Load Skill in RunManager (medium risk)**
1. Read SKILL.md content at app startup
2. Pass via `--append-system-prompt` alongside CLUI_SYSTEM_HINT
3. Verify Claude receives both system prompts
4. Test: plain chat still works, lineup build works, refinement works

**Phase 3: Simplify Renderer (medium risk)**
1. Remove prompt construction from `handleBuildLineup()` — send user's intent directly
2. Remove `buildRefinementPrompt()` — send user's refinement text directly
3. Remove `displayText` usage for Showtime prompts
4. Keep `splitLineupFromContent()` and LineupCard (these still needed)
5. Keep streaming partial detection (still needed)

**Phase 4: Fix Calendar (depends on Phase 2)**
1. Skill instructs Claude to check calendar on lineup build
2. Remove dead calendar prefetch code from WritersRoomView
3. Remove calendar event injection from handleBuildLineup
4. Test: Claude calls gcal_list_events during lineup build

### What Stays in the Renderer

Even with the skill, the renderer retains:
- `splitLineupFromContent()` — Claude's response still contains fenced JSON that needs parsing
- `LineupCard` — interactive editing of the parsed lineup
- Streaming partial detection — the "Building your lineup..." placeholder
- showStore state machine — phase transitions, timer, beats
- IPC bridge and ControlPlane — unchanged

### What Moves to the Skill

- Persona and tone ("You are Showtime...")
- Lineup JSON format specification
- Category constraints
- Energy-based scheduling rules
- Calendar protocol
- ADHD guardrails and forbidden language
- Beat check prompts
- Director mode instructions
- Rest affirmations
- Verdict messages

### Open Question: Dynamic Context

The skill is static text. Some context is dynamic:
- **Energy level** — selected by the user each session
- **Current acts** — the lineup as it exists
- **Beat progress** — how many beats are locked
- **Time of day** — affects scheduling

Options for dynamic context:
1. **User message contains it** — "Build my lineup. Energy: high." The skill knows to look for this.
2. **App-provided context prefix** — The renderer prepends a small context block to user messages: `[Energy: high, Acts: 3, Beats: 2/3]`. The skill says to read this.
3. **MCP resource** — A Showtime MCP server exposes app state as a resource. Claude reads it.

Option 2 is simplest and sufficient for v1. The renderer still sends a small context prefix, but the **prompt engineering** (persona, format, rules) lives in the skill.

---

## Appendix: File Reference

| File | Role | Changes Needed |
|------|------|---------------|
| `src/skills/showtime/SKILL.md` | Skill definition | Add calendar, JSON format, app state protocol |
| `src/renderer/views/WritersRoomView.tsx` | View layer | Remove prompt construction, simplify to direct messages |
| `src/renderer/lib/refinement-prompt.ts` | Refinement prompt builder | Delete entirely |
| `src/renderer/stores/sessionStore.ts` | Message dispatch | Remove displayText usage for Showtime prompts |
| `src/renderer/components/ChatMessage.tsx` | Response parsing | No changes — still needs lineup detection |
| `src/main/claude/run-manager.ts` | CLI subprocess | Add SKILL.md loading via --append-system-prompt |
| `src/renderer/lib/lineup-parser.ts` | JSON parsing | No changes |
| `src/renderer/components/LineupCard.tsx` | Lineup rendering | No changes |

## Appendix: Bug Cross-Reference

| Bug | Would Skill Prevent? | Why |
|-----|---------------------|-----|
| #73 (refinement raw JSON) | **Yes** | Format and persona always in system prompt — no path can miss it |
| #85 (JSON flicker) | **No** | Streaming is a renderer problem, not a prompt problem |
| #50/#74/#83 (Go Live) | **No** | UI/interaction bugs, not prompt-related |
| #49 (calendar flicker) | **Partially** | Skill-driven calendar eliminates prefetch, but MCP status detection still needs caching |
