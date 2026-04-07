# XState Toolbar Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Derive toolbar buttons from XState context instead of hardcoding per view, making the state machine the single source of truth for which buttons appear (fixes #239).

**Architecture:** A pure function `getToolbarConfig(phase, viewTier)` returns a `ToolbarConfig` object describing which buttons are visible. A shared `<Toolbar />` component reads machine state via hooks and renders the correct buttons. Each view replaces its inline button cluster with `<Toolbar />`.

**Tech Stack:** TypeScript, XState v5 (existing showMachine), React 19, Tailwind CSS, Vitest

---

### Task 1: Create `toolbarConfig.ts` — types and pure config function

**Files:**
- Create: `src/renderer/machines/toolbarConfig.ts`

**Step 1: Write the file**

```typescript
import type { ShowPhase, ViewTier } from '../../shared/types'

/** Which toolbar buttons should be visible for a given app state. */
export interface ToolbarConfig {
  showClose: boolean
  showMinimize: boolean
  showViewMenu: boolean
  showMute: boolean
  showDirector: boolean
  showCollapse: boolean
  showBack: boolean
}

const EMPTY: ToolbarConfig = {
  showClose: false,
  showMinimize: false,
  showViewMenu: false,
  showMute: false,
  showDirector: false,
  showCollapse: false,
  showBack: false,
}

/**
 * Derive toolbar button visibility from current show phase and view tier.
 *
 * Mapping (derived from current per-view behavior):
 * - no_show (DarkStudio): no toolbar
 * - writers_room: close + viewMenu + mute (always full-screen, no collapse/director)
 * - strike: close + viewMenu + mute + collapse (full-screen but can collapse to pill)
 * - live/intermission/director + expanded/dashboard: close + viewMenu + mute + director + collapse
 * - live/intermission/director + compact: close + viewMenu + mute + collapse (no director)
 * - live/intermission/director + micro (pill): minimize + viewMenu only
 */
export function getToolbarConfig(phase: ShowPhase, viewTier: ViewTier): ToolbarConfig {
  // Dark Studio — no toolbar buttons
  if (phase === 'no_show') {
    return EMPTY
  }

  // Full-screen phases (ignore viewTier)
  if (phase === 'writers_room') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
    }
  }

  if (phase === 'strike') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
      showCollapse: true,
    }
  }

  // Tier-based views (live, intermission, director)
  if (viewTier === 'micro') {
    return {
      ...EMPTY,
      showMinimize: true,
      showViewMenu: true,
    }
  }

  if (viewTier === 'compact') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
      showCollapse: true,
    }
  }

  // dashboard + expanded
  return {
    ...EMPTY,
    showClose: true,
    showViewMenu: true,
    showMute: true,
    showDirector: true,
    showCollapse: true,
  }
}

/** Toolbar config for overlay views (history, settings, onboarding). Back button only. */
export function getOverlayToolbarConfig(): ToolbarConfig {
  return { ...EMPTY, showBack: true }
}

/** Derive the ViewMenu `view` prop from machine state. */
export type ViewMenuView = 'pill' | 'compact' | 'dashboard' | 'expanded' | 'writers_room' | 'strike'

export function deriveViewMenuView(phase: ShowPhase, viewTier: ViewTier): ViewMenuView {
  if (phase === 'writers_room') return 'writers_room'
  if (phase === 'strike') return 'strike'
  const map: Record<ViewTier, ViewMenuView> = {
    micro: 'pill',
    compact: 'compact',
    dashboard: 'dashboard',
    expanded: 'expanded',
  }
  return map[viewTier]
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/machines/toolbarConfig.ts
git commit -m "feat(toolbar): add toolbarConfig with getToolbarConfig pure function (#239)"
```

---

### Task 2: Add tests for `toolbarConfig`

**Files:**
- Create: `src/__tests__/toolbarConfig.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import {
  getToolbarConfig,
  getOverlayToolbarConfig,
  deriveViewMenuView,
} from '../renderer/machines/toolbarConfig'
import type { ToolbarConfig } from '../renderer/machines/toolbarConfig'
import type { ShowPhase, ViewTier } from '../shared/types'

// Helper: extract truthy keys from config
function activeButtons(config: ToolbarConfig): string[] {
  return Object.entries(config)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
}

describe('getToolbarConfig', () => {
  describe('no_show (Dark Studio)', () => {
    it('returns empty config regardless of viewTier', () => {
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      for (const tier of tiers) {
        expect(activeButtons(getToolbarConfig('no_show', tier))).toEqual([])
      }
    })
  })

  describe('writers_room (full-screen)', () => {
    it('shows close + viewMenu + mute regardless of tier', () => {
      const expected = ['showClose', 'showMute', 'showViewMenu']
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      for (const tier of tiers) {
        expect(activeButtons(getToolbarConfig('writers_room', tier))).toEqual(expected)
      }
    })

    it('does not show director or collapse', () => {
      const config = getToolbarConfig('writers_room', 'expanded')
      expect(config.showDirector).toBe(false)
      expect(config.showCollapse).toBe(false)
    })
  })

  describe('strike (full-screen)', () => {
    it('shows close + viewMenu + mute + collapse', () => {
      const expected = ['showClose', 'showCollapse', 'showMute', 'showViewMenu']
      expect(activeButtons(getToolbarConfig('strike', 'expanded'))).toEqual(expected)
    })

    it('does not show director', () => {
      expect(getToolbarConfig('strike', 'expanded').showDirector).toBe(false)
    })
  })

  describe('live phase — tier-based', () => {
    it('pill (micro): minimize + viewMenu only', () => {
      const config = getToolbarConfig('live', 'micro')
      expect(activeButtons(config)).toEqual(['showMinimize', 'showViewMenu'])
    })

    it('compact: close + viewMenu + mute + collapse (no director)', () => {
      const config = getToolbarConfig('live', 'compact')
      expect(activeButtons(config)).toEqual([
        'showClose', 'showCollapse', 'showMute', 'showViewMenu',
      ])
      expect(config.showDirector).toBe(false)
    })

    it('dashboard: close + viewMenu + mute + director + collapse', () => {
      const config = getToolbarConfig('live', 'dashboard')
      expect(activeButtons(config)).toEqual([
        'showClose', 'showCollapse', 'showDirector', 'showMute', 'showViewMenu',
      ])
    })

    it('expanded: same as dashboard', () => {
      expect(activeButtons(getToolbarConfig('live', 'expanded')))
        .toEqual(activeButtons(getToolbarConfig('live', 'dashboard')))
    })
  })

  describe('intermission — same as live', () => {
    it('micro: minimize + viewMenu', () => {
      expect(activeButtons(getToolbarConfig('intermission', 'micro')))
        .toEqual(activeButtons(getToolbarConfig('live', 'micro')))
    })

    it('expanded: includes director', () => {
      expect(getToolbarConfig('intermission', 'expanded').showDirector).toBe(true)
    })
  })

  describe('director phase — same tier behavior', () => {
    it('expanded: includes director button', () => {
      expect(getToolbarConfig('director', 'expanded').showDirector).toBe(true)
    })
  })

  describe('no config ever has both close and minimize', () => {
    const phases: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
    const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
    for (const phase of phases) {
      for (const tier of tiers) {
        it(`${phase}/${tier}`, () => {
          const config = getToolbarConfig(phase, tier)
          expect(config.showClose && config.showMinimize).toBe(false)
        })
      }
    }
  })
})

describe('getOverlayToolbarConfig', () => {
  it('returns back only', () => {
    expect(activeButtons(getOverlayToolbarConfig())).toEqual(['showBack'])
  })
})

describe('deriveViewMenuView', () => {
  it('returns writers_room for writers_room phase', () => {
    expect(deriveViewMenuView('writers_room', 'expanded')).toBe('writers_room')
  })

  it('returns strike for strike phase', () => {
    expect(deriveViewMenuView('strike', 'expanded')).toBe('strike')
  })

  it('maps viewTier to view for live phases', () => {
    expect(deriveViewMenuView('live', 'micro')).toBe('pill')
    expect(deriveViewMenuView('live', 'compact')).toBe('compact')
    expect(deriveViewMenuView('live', 'dashboard')).toBe('dashboard')
    expect(deriveViewMenuView('live', 'expanded')).toBe('expanded')
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/toolbarConfig.test.ts`
Expected: all tests pass

**Step 3: Commit**

```bash
git add src/__tests__/toolbarConfig.test.ts
git commit -m "test(toolbar): add toolbarConfig unit tests covering all phase/tier combos (#239)"
```

---

### Task 3: Create `Toolbar.tsx` shared component

**Files:**
- Create: `src/renderer/components/Toolbar.tsx`

**Step 1: Write the component**

The Toolbar reads machine state (phase, viewTier, overlay) via hooks and uses `getToolbarConfig` to decide which buttons to render. It accepts an `onBack` prop for overlay views.

```tsx
import { useCallback } from 'react'
import { useShowPhase, useShowContext, useShowSend, useOverlay } from '../machines/ShowMachineProvider'
import { collapseTier } from '../../shared/types'
import {
  getToolbarConfig,
  getOverlayToolbarConfig,
  deriveViewMenuView,
} from '../machines/toolbarConfig'
import { ViewMenu } from './ViewMenu'
import { MuteToggle } from './MuteToggle'

interface ToolbarProps {
  /** Handler for the back button (overlay views). */
  onBack?: () => void
  /** Additional CSS classes for the container. */
  className?: string
}

/** Shared toolbar that derives visible buttons from XState machine state. */
export function Toolbar({ onBack, className }: ToolbarProps) {
  const phase = useShowPhase()
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const overlay = useOverlay()
  const send = useShowSend()

  const config = overlay !== 'none'
    ? getOverlayToolbarConfig()
    : getToolbarConfig(phase, viewTier)

  const collapseViewTier = useCallback(
    () => send({ type: 'SET_VIEW_TIER', tier: collapseTier(viewTier) }),
    [send, viewTier],
  )
  const enterDirector = useCallback(
    () => send({ type: 'ENTER_DIRECTOR' }),
    [send],
  )

  const isPill = config.showMinimize && !config.showClose
  const menuView = deriveViewMenuView(phase, viewTier)

  return (
    <div className={className ?? 'flex items-center gap-1 no-drag'}>
      {config.showBack && onBack && (
        <button
          onClick={onBack}
          className="text-txt-muted hover:text-txt-secondary text-sm no-drag transition-colors"
          data-testid="toolbar-back-btn"
        >
          Back
        </button>
      )}
      {config.showMute && <MuteToggle />}
      {config.showDirector && (
        <button
          onClick={enterDirector}
          className="px-2 py-1 rounded-md bg-surface-hover text-txt-secondary text-sm font-medium hover:text-txt-primary transition-colors no-drag"
          data-testid="toolbar-director-btn"
        >
          Director
        </button>
      )}
      {config.showViewMenu && <ViewMenu view={menuView} />}
      {config.showCollapse && (
        <button
          onClick={collapseViewTier}
          className="px-1 py-0.5 text-txt-muted hover:text-txt-secondary transition-colors no-drag text-xs"
          data-testid="toolbar-collapse-btn"
        >
          ▼
        </button>
      )}
      {config.showMinimize && (
        <button
          className="shrink-0 w-5 h-5 rounded-full border border-white/10 text-txt-muted hover:text-txt-secondary hover:border-white/20 transition-colors flex items-center justify-center text-[10px] font-mono leading-none no-drag"
          aria-label="Minimize to menu bar"
          data-testid="pill-minimize-btn"
          onClick={() => window.showtime.minimizeToTray()}
        >
          −
        </button>
      )}
      {config.showClose && (
        <button
          onClick={() => window.showtime.quit()}
          className="px-1 py-0.5 text-txt-muted hover:text-onair transition-colors text-sm no-drag"
          title="Quit Showtime"
          data-testid="toolbar-quit-btn"
        >
          ✕
        </button>
      )}
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/components/Toolbar.tsx
git commit -m "feat(toolbar): add shared Toolbar component reading config from XState (#239)"
```

---

### Task 4: Update views to use `<Toolbar />`

**Files to modify (7 views):**
- `src/renderer/views/ExpandedView.tsx` — replace button cluster (lines 60-84) with `<Toolbar />`
- `src/renderer/views/DashboardView.tsx` — replace button cluster (lines 77-97) with `<Toolbar />`
- `src/renderer/views/CompactView.tsx` — replace button cluster (lines 93-109) with `<Toolbar />`
- `src/renderer/views/PillView.tsx` — replace minimize + ViewMenu (lines 128-141) with `<Toolbar />`
- `src/renderer/views/StrikeView.tsx` — replace button cluster (lines 63-82) with `<Toolbar />`
- `src/renderer/views/WritersRoomView.tsx` — replace MuteToggle + ViewMenu + close (lines 262-273) with `<Toolbar />`
- `src/renderer/views/HistoryView.tsx` — replace Back button (lines 112-117) with `<Toolbar onBack={onBack} />`
- `src/renderer/views/SettingsView.tsx` — replace Back button (lines 50-55) with `<Toolbar onBack={onBack} />`

For each view:
1. Add import: `import { Toolbar } from '../components/Toolbar'`
2. Remove now-unused imports (MuteToggle, ViewMenu, collapseTier, etc.)
3. Replace the hardcoded button cluster with `<Toolbar />`
4. Keep view-specific non-toolbar elements (TallyLight, EnergyPicker, OnAirIndicator, date labels, SHOWTIME label) — only the toolbar buttons change

**Key patterns:**

**ExpandedView** (title bar right side):
```tsx
// Before (lines 60-84):
<div className="flex items-center gap-1">
  <MuteToggle />
  <button onClick={enterDirector} ...>Director</button>
  <ViewMenu view="expanded" />
  <button onClick={collapseViewTier} ...>▼</button>
  <button onClick={() => window.showtime.quit()} ...>✕</button>
</div>

// After:
<Toolbar />
```

**PillView** (after content area):
```tsx
// Before (lines 128-141):
<button ... onClick={() => window.showtime.minimizeToTray()}>−</button>
<ViewMenu view="pill" />

// After:
<Toolbar />
```

**HistoryView / SettingsView** (title bar right side):
```tsx
// Before:
<button onClick={onBack} ...>Back</button>

// After:
<Toolbar onBack={onBack} />
```

**Step 1: Update all 8 views**

Apply the changes described above to each view file.

**Step 2: Remove unused imports from each view**

After replacing inline buttons with `<Toolbar />`, remove these imports where no longer used:
- `ViewMenu` — if view only used it in the toolbar
- `MuteToggle` — if view only used it in the toolbar
- `collapseTier` / `expandTier` — if only used for toolbar collapse button
- Remove unused `useCallback` wrappers for `collapseViewTier`, `enterDirector`

**Step 3: Verify types and tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass

**Step 4: Commit**

```bash
git add src/renderer/views/ src/renderer/components/Toolbar.tsx
git commit -m "refactor(toolbar): replace per-view hardcoded buttons with shared <Toolbar /> (#239)"
```

---

### Task 5: Final verification

**Step 1: Full type check + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass, zero type errors

**Step 2: Verify no inline style regressions**

Run: `grep -rn 'style={{' src/renderer/components/Toolbar.tsx`
Expected: no matches (Tailwind only)
