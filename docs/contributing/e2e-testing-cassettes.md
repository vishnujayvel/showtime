# E2E Testing with VCR Cassettes

Showtime uses a three-tier testing strategy for its Claude integration. Cassette-based replay tests are the primary tier — fast, deterministic, and safe for CI.

## Testing Tiers

| Tier | Speed | Deterministic | When to use |
|------|-------|---------------|-------------|
| **Cassette replay** | Fast (~seconds) | Yes | All normal feature flows |
| **Real Claude** | Slow (~30s+) | No | Complex multi-turn scenarios, scheduled CI |
| **Unit (Vitest)** | Instant | Yes | Stores, hooks, pure functions |

## How Cassette Playback Works

When the app launches with `SHOWTIME_PLAYBACK=1`, `RunManager` replaces the real `claude -p` subprocess with a mock that reads events from an NDJSON cassette file and replays them through the same `EventEmitter` pipeline. The app can't tell the difference.

`SHOWTIME_PLAYBACK_SPEED` controls time compression — `100` means 100x faster than the original recording.

## Recording a Cassette

```bash
# 1. Launch the app in record mode
SHOWTIME_RECORD=1 npm start

# 2. Use the app normally — go through Writer's Room, submit a plan, etc.
#    Each Claude run writes a cassette to e2e/cassettes/<requestId>.ndjson

# 3. Rename the cassette to a descriptive name
mv e2e/cassettes/<requestId>.ndjson e2e/cassettes/happy-path-lineup.ndjson

# 4. Commit the cassette to git
git add e2e/cassettes/happy-path-lineup.ndjson
```

## Cassette Format (NDJSON)

Each line is a JSON object with a relative timestamp in milliseconds from run start:

```json
{"ts": 0, "event": {"type": "system", "subtype": "init", "session_id": "..."}}
{"ts": 1200, "event": {"type": "assistant", "message": {...}}}
{"ts": 28400, "event": {"type": "result", "result": "...", "subtype": "success"}}
{"ts": 28500, "exit": {"code": 0, "signal": null}}
```

## Writing a Cassette Test

Test files live in `e2e/`. Import from `./fixtures` for shared helpers:

```ts
import { test, expect, screenshot, FIXTURES } from './fixtures'
```

### Key Fixtures

| Export | Purpose |
|--------|---------|
| `test` | Playwright test with Electron app fixture (shared per worker) |
| `expect` | Playwright assertions |
| `screenshot(page, name)` | Takes a timestamped screenshot |
| `FIXTURES` | Preset app states (`STANDARD_ACTS`, `FIVE_ACTS`) |

### Adding a New Cassette Test

```ts
import { test, expect, FIXTURES } from './fixtures'

test('lineup appears from cassette', async ({ mainPage: page }) => {
  // 1. Seed the app state to the correct starting point
  await page.evaluate((fixture) => {
    localStorage.setItem('showtime-show-state', JSON.stringify(fixture))
  }, FIXTURES.WRITERS_ROOM)

  // 2. Reload to apply fixture state
  await page.reload()
  await page.waitForSelector('[data-testid="chat-input"]')

  // 3. Trigger the interaction — the cassette provides deterministic output
  await page.fill('[data-testid="chat-input"]', 'plan my day')
  await page.click('[data-testid="build-lineup-btn"]')

  // 4. Assert on the UI result
  await expect(page.locator('[data-testid="lineup-card"]')).toBeVisible()
})
```

## Environment Variables

| Variable | Values | Purpose |
|----------|--------|---------|
| `SHOWTIME_RECORD` | `1` | Record cassettes during normal app usage |
| `SHOWTIME_PLAYBACK` | `1` | Replay cassettes instead of real Claude subprocess |
| `SHOWTIME_PLAYBACK_SPEED` | Number (e.g. `100`) | Time compression factor for cassette replay |
| `SHOWTIME_USER_DATA` | Path | Isolated user data directory (set automatically in tests) |
| `SHOWTIME_TEST_X` / `SHOWTIME_TEST_Y` | Pixels | Position test window off-screen |

## Running Tests

```bash
# Build the app first (Playwright needs the compiled Electron app)
npm run build

# Run all E2E tests
npm run test:e2e

# Run only cassette tests
npx playwright test e2e/claude-cassette.test.ts

# Run only real Claude tests (requires API access)
npx playwright test e2e/claude-real.test.ts
```

::: warning
Always run `npm run build` before E2E tests. Playwright launches the compiled app from `dist/`, not the dev server.
:::

## When to Use Each Tier

- **Cassette** — Default choice. Use for any flow where Claude's response is predictable (lineup generation, refinement, error handling).
- **Real Claude** — Only for verifying that the actual Claude API integration works end-to-end. Run on schedule or before releases, not on every commit.
- **Vitest** — Use for store logic, timer calculations, lineup parsing, and other pure functions that don't need the full Electron app.
