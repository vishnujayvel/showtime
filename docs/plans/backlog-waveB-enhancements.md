# Wave B: Enhancements — Issues #115, #116, #117

## IMPORTANT: Issue Closure Protocol
When closing issues, you MUST:
1. Add labels FIRST: `gh issue edit <N> --add-label "root-cause" --add-label "has-test-evidence"`
2. Then close with structured comment containing all three sections:
   - `Root cause:` — why this was needed
   - `Fix:` — what was changed
   - `Test evidence:` — proof it works
A GitHub Action will REOPEN issues that are missing the required labels.

## Issue #115: feat: add Personal/Wellness category — therapy is not "Social"
- Current categories: Deep Work, Exercise, Admin, Creative, Social (5 total)
- Add a 6th category: **Personal** for therapy, doctor appointments, meditation, journaling, self-care
- Color: teal (#14b8a6) or similar -- must be visually distinct from existing 5 colors
- Files to update:
  - `src/renderer/lib/category-colors.ts` — add Personal to SketchCategory type, CATEGORY_MAP, and SKETCH_CATEGORIES array
  - `src/renderer/views/WritersRoomView.tsx` — update system prompt categories list (around line 172)
  - `src/skills/showtime/SKILL.md` — update valid sketch categories
  - `src/renderer/styles/index.css` — add --color-cat-personal theme token
- Do NOT remove or rename existing categories

## Issue #116: feat: allow editing lineup acts after generation
- The LineupCard component shows acts but they are read-only after generation
- Make each act editable:
  - Click act name to rename (inline edit)
  - Click duration to adjust (increment/decrement or inline edit)
  - Click category badge to cycle through categories
  - Click X or swipe to remove an act
  - The "+ Add an Act" button at the bottom should work (may already be wired)
- Files to check:
  - `src/renderer/panels/LineupPanel.tsx` or `src/renderer/components/LineupCard.tsx`
  - `src/renderer/stores/showStore.ts` — ensure acts can be mutated before finalization
- Use existing shadcn/ui components for edit controls
- No drag-and-drop required in this pass -- just inline editing

## Issue #117: feat: add help button and navigation guide to pill view
- The pill view has no way to discover features or get help
- Add a small info/help icon (e.g., "?" circle) in the pill view that opens a contextual popup
- The popup should show:
  - Current phase name and description
  - Available actions (expand, settings, history)
  - Keyboard shortcuts if any
- Use a Radix Popover or Tooltip from shadcn/ui
- Keep it minimal -- one small icon, one popup panel
- File: `src/renderer/views/PillView.tsx`

## Testing Strategy
- Run `npm test` — all tests must pass
- For #115: verify new category renders with correct color in a lineup
- For #116: verify acts can be renamed, duration changed, and removed
- For #117: verify help icon appears in pill view and popup shows content
- Close each issue with proper labels + structured comment

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only, shadcn/ui for interactive components
- Spring physics for any animations
- Do not break existing category handling
