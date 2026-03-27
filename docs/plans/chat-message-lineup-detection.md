# Low-Level Design: Chat Message Lineup Detection

## Problem

When Claude's response contains lineup JSON, the user sees raw JSON in the chat bubble instead of (or in addition to) the LineupCard component.

## Current behavior (broken)

1. `react-markdown` renders the full `message.content` as markdown
2. If Claude uses ` ```showtime-lineup`, the custom `code` renderer intercepts it → renders LineupCard ✓
3. But Claude often outputs ` ```json` or bare JSON → custom renderer doesn't intercept → raw JSON visible ✗
4. Fallback `tryParseLineup()` catches it but renders the card BELOW the raw text → user sees both ✗

## Desired behavior

1. Before rendering, scan `message.content` for any lineup JSON (fenced or bare)
2. If found: extract it, render the card, and show only the non-lineup text as markdown
3. If not found: render everything as normal markdown

## Detection strategy

The `tryParseLineup()` function already handles multiple formats:
- ` ```showtime-lineup { ... } ``` `
- ` ```json { "acts": [...] } ``` `
- Bare `{ "acts": [...] }`

We need a **split** function, not just a **detect** function:

```typescript
function splitLineupFromContent(content: string): {
  textBefore: string
  lineup: ShowLineup | null
  textAfter: string
}
```

## Implementation

In `AssistantBubble`:

```tsx
function AssistantBubble({ message }: { message: Message }) {
  const { textBefore, lineup, textAfter } = splitLineupFromContent(message.content)

  return (
    <div>
      {textBefore && (
        <ReactMarkdown ...>{textBefore}</ReactMarkdown>
      )}
      {lineup && (
        <LineupCard lineup={lineup} onEdit={handleLineupEdit} />
      )}
      {textAfter && (
        <ReactMarkdown ...>{textAfter}</ReactMarkdown>
      )}
    </div>
  )
}
```

## `splitLineupFromContent` logic

```typescript
function splitLineupFromContent(content: string) {
  // Try fenced block first: ```showtime-lineup or ```json with acts
  const fencedRegex = /```(?:showtime-lineup|json)\s*\n([\s\S]*?)```/
  const match = content.match(fencedRegex)

  if (match) {
    try {
      const json = JSON.parse(match[1])
      if (json.acts && Array.isArray(json.acts)) {
        const idx = content.indexOf(match[0])
        return {
          textBefore: content.slice(0, idx).trim(),
          lineup: json,
          textAfter: content.slice(idx + match[0].length).trim(),
        }
      }
    } catch {}
  }

  // Try bare JSON with acts
  const bareRegex = /\{[\s\S]*"acts"\s*:\s*\[[\s\S]*\]\s*[\s\S]*\}/
  const bareMatch = content.match(bareRegex)
  if (bareMatch) {
    try {
      const json = JSON.parse(bareMatch[0])
      if (json.acts && Array.isArray(json.acts)) {
        const idx = content.indexOf(bareMatch[0])
        return {
          textBefore: content.slice(0, idx).trim(),
          lineup: json,
          textAfter: content.slice(idx + bareMatch[0].length).trim(),
        }
      }
    } catch {}
  }

  return { textBefore: content, lineup: null, textAfter: '' }
}
```

## Key: strip before render, not intercept during render

The current approach tries to intercept during markdown rendering (custom `code` component). This fails because:
- Claude doesn't always use the exact language tag
- react-markdown's code component only fires for fenced code blocks
- Bare JSON isn't in a code block at all

The new approach: **pre-process the content, split out the lineup, render text and card separately.**
