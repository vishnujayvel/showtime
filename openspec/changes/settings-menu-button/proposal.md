# Feature: Settings/Menu Button in All Views (#201)

**Issue:** #201
**Type:** Enhancement
**Priority:** P1

## Problem

There's no consistent way to access Edit Lineup, Director Mode, or Settings from the different views. Key actions are buried in Director Mode or the tray menu.

## Solution

Add a kebab menu (⋮) or gear (⚙) button in the top area of every view that opens a dropdown with contextual actions.

### Pill View (320x48px)
- Small ⋮ button on the right edge (replaces or sits next to expand icon)
- Dropdown: Edit Lineup, Director Mode, Expand View, Settings, Quit

### Compact View (340x200px)
- ⚙ button in the top bar next to window controls
- Dropdown: Edit Lineup, Director Mode, Take a Break, Show History, Settings

### Expanded View (560x400px)
- ⚙ button in the top bar next to window controls
- Dropdown: Edit Lineup, Director Mode, View History, Settings
- Note: some actions are also in the action buttons row at bottom

### Implementation

**New component:** `src/renderer/components/ViewMenu.tsx`
- Uses shadcn/ui `DropdownMenu` (Radix UI based)
- Accepts `view: 'pill' | 'compact' | 'expanded'` prop to show contextual items
- Menu items dispatch XState events via `useShowSend()`
- Edit Lineup: `send({ type: 'EDIT_LINEUP' })`
- Director Mode: `send({ type: 'ENTER_DIRECTOR' })`
- Take a Break: `send({ type: 'ENTER_INTERMISSION' })`
- Show History / Settings: navigate via view state

**Files to modify:**
- `src/renderer/views/PillView.tsx` — add ⋮ trigger
- `src/renderer/views/CompactView.tsx` — add ⚙ trigger in top bar (if exists)
- `src/renderer/views/ExpandedView.tsx` — add ⚙ trigger in top bar
- `src/renderer/components/ViewMenu.tsx` — NEW shared dropdown component

**Design:**
- Trigger icon: 16px, `text-txt-secondary`, hover `text-txt-primary`
- Dropdown: `bg-surface`, `border border-white/[0.06]`, `rounded-xl`, `shadow-lg`
- Menu items: 32px height, `text-sm`, icon + label, hover `bg-surface-hover`
- Dividers between action groups
- Spring physics for dropdown open/close (Framer Motion)

## Acceptance Criteria

- [ ] ⋮ button visible in pill view
- [ ] ⚙ button visible in compact and expanded views
- [ ] Dropdown opens with correct contextual menu items
- [ ] Edit Lineup dispatches EDIT_LINEUP event
- [ ] Director Mode dispatches ENTER_DIRECTOR event
- [ ] All existing tests pass
- [ ] No inline styles (Tailwind + shadcn/ui only)
