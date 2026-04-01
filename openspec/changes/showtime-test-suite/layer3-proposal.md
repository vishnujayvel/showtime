# Layer 3: Playwright E2E State-Seeded Tests (Bug Discovery)

## Why

Layers 1+2 test the Zustand store but CANNOT catch UI copy bugs. Bug #29 ("tonight's lineup" when planning for tomorrow) proves this — no store test can verify what the rendered DOM shows. Only Playwright launching the real Electron app and reading `page.getByText()` can catch these.

## CRITICAL INSTRUCTION FOR LOKI

**Every test in this proposal MUST use Playwright to launch the Electron app.** Do NOT write Vitest tests. Do NOT write tests that import React components directly. Every test file must:

```typescript
import { test, expect, _electron as electron } from '@playwright/test'

test('description', async () => {
  const app = await electron.launch({ args: ['dist/main/index.js'] })
  const page = await app.firstWindow()
  // ... seed state via page.evaluate() ...
  // ... assert via page.getByText(), page.locator(), page.screenshot() ...
  await app.close()
})
```

**If a test does not call `electron.launch()`, it is WRONG. Delete it and rewrite it.**

## What to Build

### 1. State Seeding Fixtures (`e2e/fixtures.ts`)

Create canonical state snapshots that can be injected via `localStorage`:

```typescript
export const FIXTURES = {
  // Phase x Temporal combinations
  darkStudio_morning: { phase: 'no_show', viewTier: 'expanded', mockHour: 9 },
  darkStudio_evening: { phase: 'no_show', viewTier: 'expanded', mockHour: 20 },
  writersRoom_morning: { phase: 'writers_room', viewTier: 'expanded', mockHour: 10 },
  writersRoom_evening: { phase: 'writers_room', viewTier: 'expanded', mockHour: 21 },
  live_with3acts: { phase: 'live', viewTier: 'expanded', acts: [/*3 acts*/], currentActId: '1' },
  live_pill_micro: { phase: 'live', viewTier: 'micro', acts: [/*3 acts*/] },
  live_pill_compact: { phase: 'live', viewTier: 'compact', acts: [/*3 acts*/] },
  live_pill_dashboard: { phase: 'live', viewTier: 'dashboard', acts: [/*3 acts*/] },
  intermission: { phase: 'intermission', viewTier: 'expanded' },
  strike_dayWon: { phase: 'strike', viewTier: 'expanded', verdict: 'DAY_WON' },
  strike_solidShow: { phase: 'strike', viewTier: 'expanded', verdict: 'SOLID_SHOW' },
}
```

Each fixture is seeded into the app via:
```typescript
await page.evaluate((fixture) => {
  localStorage.setItem('showtime-show-state', JSON.stringify(fixture))
  localStorage.setItem('showtime-onboarding-complete', 'true')
}, FIXTURES.writersRoom_evening)
await page.reload()
```

### 2. Temporal Copy Tests (`e2e/temporal-copy.test.ts`)

**USE PLAYWRIGHT. Launch the Electron app for every test.**

```typescript
test('morning: DarkStudio says "Today\'s show"', async () => {
  // Seed: mockHour = 9
  // Launch app
  // Assert: page.getByText("Today's show") is visible
  // Assert: page.getByText("Tonight's show") is NOT visible
})

test('evening: DarkStudio says "Tomorrow\'s show"', async () => {
  // Seed: mockHour = 20
  // Launch app
  // Assert: page.getByText("Tomorrow's show") is visible
})

test('evening: WritersRoom says "tomorrow\'s lineup"', async () => {
  // Seed: mockHour = 20, phase = writers_room
  // Launch app
  // Assert: textarea placeholder contains "tomorrow"
  // Assert: textarea placeholder does NOT contain "tonight"
})

test('morning: WritersRoom says "today\'s lineup"', async () => {
  // Seed: mockHour = 9, phase = writers_room
  // Assert: textarea placeholder contains "today"
})
```

### 3. View Tier Verification (`e2e/view-tiers.test.ts`)

**USE PLAYWRIGHT.** For each view tier, verify:
- Window dimensions match VIEW_DIMENSIONS
- Expected UI elements are visible
- Unexpected elements are NOT visible

```typescript
test('micro pill shows act name + timer', async () => {
  // Seed: live show, viewTier = micro
  // Assert: window width = 320, height = 56
  // Assert: act name visible via page.getByText()
  // Assert: timer visible
})

test('compact shows RundownBar', async () => {
  // Seed: live show, viewTier = compact
  // Assert: window width = 340, height = 140
  // Assert: RundownBar element visible
  // Assert: drift badge visible
})

test('dashboard shows upcoming acts', async () => {
  // Seed: live show with 5 acts, viewTier = dashboard
  // Assert: window width = 400, height = 320
  // Assert: "Coming Up" section visible
  // Assert: next 2 act names visible
})
```

### 4. Visual Regression Screenshots (`e2e/visual-regression.test.ts`)

**USE PLAYWRIGHT.** Take screenshots of key states for visual comparison:

```typescript
test('DarkStudio visual', async () => {
  // Seed: no_show, morning
  await expect(page).toHaveScreenshot('dark-studio-morning.png')
})

test('ExpandedView live visual', async () => {
  // Seed: live, 3 acts, act 2 active
  await expect(page).toHaveScreenshot('expanded-live.png')
})

test('Strike DAY_WON visual', async () => {
  // Seed: strike, DAY_WON verdict
  await expect(page).toHaveScreenshot('strike-day-won.png')
})
```

### 5. Cross-Component Consistency (`e2e/consistency.test.ts`)

**USE PLAYWRIGHT.** Verify the same data shows consistently across views:

```typescript
test('act name matches across pill and expanded', async () => {
  // Seed: live show
  // In expanded: read act name from title bar
  // Toggle to micro pill: read act name
  // Assert: they match
})

test('date label matches across ExpandedView and WritersRoom', async () => {
  // Both should show the same formatted date
})
```

## Bug Discovery Phase

After building all tests, **run them and file bugs:**

```bash
npx playwright test e2e/temporal-copy.test.ts e2e/view-tiers.test.ts e2e/consistency.test.ts e2e/visual-regression.test.ts
```

For EVERY failure:
```bash
gh issue create --title "[auto-detected] <test name> failed: <expected vs actual>" --label "bug" --label "auto-detected"
```

**Commit the tests even if some fail.** The failures ARE the bugs we're looking for.

## Testing
```bash
npm run build
npx playwright test   # ALL E2E tests
```

## Loop Configuration
autonomous: true
max_iterations: 2
issue_labels: ["bug", "auto-detected"]
cooldown_minutes: 2
