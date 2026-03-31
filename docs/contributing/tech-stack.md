# Tech Stack

Showtime is an **AI-native macOS desktop app** — built with Claude Code as a first-class development partner, not just an assistant. Every feature is spec'd, implemented, tested, and reviewed through an AI-augmented pipeline.

## At a Glance

| Layer | Technology | Version |
|-------|-----------|---------|
| **Language** | TypeScript (strict mode) | ^5.7.0 |
| **Desktop** | Electron | ^35.7.5 |
| **UI** | React | ^19.0.0 |
| **Styling** | Tailwind CSS v4 (CSS-first) | ^4.2.1 |
| **Components** | shadcn/ui + Radix UI | latest |
| **Animation** | Framer Motion (spring physics) | ^12.35.1 |
| **State (phases)** | XState v5 | ^5.0.0 |
| **State (UI)** | Zustand | ^5.0.0 |
| **Database** | SQLite via better-sqlite3 + Drizzle ORM | ^12.8.0 / ^0.45.1 |
| **AI Runtime** | Claude Code subprocess (node-pty) | CLI v2.1+ |
| **Unit Tests** | Vitest + Testing Library | ^4.1.0 |
| **E2E Tests** | Playwright | ^1.58.2 |
| **CI/CD** | GitHub Actions + CodeRabbit | — |
| **Build** | electron-vite + Vite 6 | ^3.0.0 |
| **Docs** | VitePress | ^1.6.3 |

---

## AI-Native Development

Showtime is developed using an AI-native workflow where Claude Code participates in every stage of the software lifecycle.

### Claude Code as Subprocess

The app embeds Claude Code as an interactive subprocess for the Writer's Room feature — users describe their day in natural language, and Claude builds a structured show lineup.

- **node-pty** (^1.1.0) — Spawns Claude Code as a pseudo-terminal for interactive sessions
- **RunManager** — JSON stream transport via stdio (non-interactive mode)
- **PtyRunManager** — PTY transport for interactive permission prompts
- **StreamParser** — Parses Anthropic streaming events (InitEvent, StreamEvent, AssistantEvent, ResultEvent)
- **EventNormalizer** — Converts raw Claude events into typed UI events
- **ControlPlane** — Manages tabs, sessions, error recovery, and lifecycle

### AI-Augmented Development Pipeline

| Stage | Tool | Role |
|-------|------|------|
| **Spec** | OpenSpec CLI | Generates delta specs (ADDED/MODIFIED/REMOVED) for structured change proposals |
| **Implementation** | Loki Mode | Autonomous multi-agent execution with parallel git worktrees |
| **Code Review** | CodeRabbit | AI-powered PR review checking for inline styles, missing tests, IPC safety |
| **Testing** | Playwright + Vitest | AI-generated test suites with cassette replay for deterministic Claude integration tests |
| **Monitoring** | Gardening Agent | Watches Loki execution for stalls, build breaks, and anomalies |

### Cassette Testing

Claude Code integration tests use **cassette replay** — recorded HTTP interactions that make tests deterministic and fast (no real API calls):

```
e2e/cassettes/
├── lineup-chat.cassette.json    # Writer's Room conversation
├── refinement.cassette.json     # Follow-up refinement
└── error-recovery.cassette.json # Error handling paths
```

Set `SHOWTIME_PLAYBACK=1` to replay cassettes instead of hitting the live API.

---

## Desktop Framework

### Electron (^35.7.5)

macOS-only desktop app with NSPanel-like behavior:

```typescript
new BrowserWindow({
  transparent: true,     // Pill rounded corners
  frame: false,          // No native title bar
  hasShadow: true,       // Drop shadow
  alwaysOnTop: true,     // Always visible
})
```

- **Content-tight window sizing** — Window dimensions match content exactly (pill: 320x64, expanded: 560x620)
- **Anchor-based positioning** — Center-bottom anchor preserved across view transitions
- **Multi-display support** — `screen.getDisplayMatching()` for proper placement
- **Dock hidden** — Runs as an accessory app (like Spotlight or Alfred)
- **System tray** — Native menu with timer display, phase-specific items, keyboard accelerators

### Build System

- **electron-vite** (^3.0.0) — Three-bundle build: main (Node.js), preload (isolated), renderer (React)
- **Vite 6** — ESNext bundler with HMR
- **electron-builder** (^26.8.1) — macOS `.app` packaging and distribution
- **@electron/rebuild** (^4.0.3) — Rebuilds native modules (better-sqlite3, node-pty) for Electron's Node ABI

### IPC Architecture

All renderer ↔ main communication goes through a typed `contextBridge` API:

```
Renderer → window.clui.prompt() → ipcRenderer.invoke(IPC.PROMPT) → Main
Main → ipcMain.handle(IPC.PROMPT) → ControlPlane → Claude subprocess
```

- **IPC enum** — All channel names are enum constants (no magic strings)
- **Strict typing** — Every IPC call has typed parameters and return values via `shared/types.ts`
- **Process isolation** — Renderer never imports Node.js modules directly

---

## Frontend

### React 19

Latest React with the new JSX transform. No class components.

### Tailwind CSS v4

CSS-first configuration — no `tailwind.config.js`. All design tokens defined via `@theme` in CSS:

```css
@theme {
  --color-studio-bg: #0d0d0f;
  --color-surface: #1a1a1e;
  --color-accent: #d97757;
  --color-onair: #ef4444;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;
}
```

**Rule: No inline styles.** Every `style={{}}` is technical debt. Use Tailwind utility classes exclusively.

### shadcn/ui + Radix UI

Headless accessible components styled with Tailwind:

- **Button, Dialog, Card, Progress** — From shadcn/ui ("new-york" style)
- **Radix primitives** — Dialog, Progress, Slot for accessibility

### Framer Motion (^12.35.1)

All animations use **spring physics** — never linear durations:

```tsx
<motion.div transition={{ type: "spring", stiffness: 300, damping: 30 }}>
```

Key animations: `tallyPulse` (ON AIR dot), `beatIgnite` (star lock), `spotlightFadeIn` (Dark Studio entrance), `goldenGlow` (DAY WON verdict).

### Typography

| Font | Usage |
|------|-------|
| **JetBrains Mono** | Timers, clapperboard badges, ON AIR text, section labels |
| **Inter** | Body text, headings, buttons, verdicts |

---

## State Management

### Hybrid: XState v5 + Zustand

Show phase management uses an **XState v5 statechart** as the source of truth. UI-only state uses Zustand. See [ADR: XState Migration](../plans/adr-xstate-migration.md) for the full rationale.

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Phase machine** | XState v5 (`showMachine.ts`) | Declarative statechart: 6 phases, nested substates, guards, actions |
| **React bridge** | `@xstate/react` (`ShowMachineProvider.tsx`) | `useShowActor`, `useShowSelector`, `useShowSend` hooks |
| **Singleton actor** | `showActor.ts` | Actor lifecycle, SQLite sync subscription |
| **UI store** | Zustand (`uiStore.ts`) | View tier preferences, transient UI flags |
| **Bridge store** | Zustand (`showStore.ts`) | Backward-compatible API — delegates to XState actor |
| **Session store** | Zustand (`sessionStore.ts`) | Claude Code tab sessions, streaming state, error tracking |

#### Machine Structure

```
show (parallel)
├── phase: no_show → cold_open → writers_room → going_live → live → intermission/director → strike
│   ├── writers_room: energy → plan → conversation → lineup_ready
│   ├── live: act_active → beat_check → celebrating
│   └── intermission: resting / breathing_pause
└── animation: idle / cold_open / going_live
```

#### Migration Path

Components can use either API during the transition:

```tsx
// Legacy (Zustand bridge — still works)
const phase = useShowStore((s) => s.phase)

// New (XState hooks — preferred for new code)
const phase = useShowSelector(showSelectors.phase)
const send = useShowSend()
send({ type: 'ENTER_WRITERS_ROOM' })
```

---

## Data Layer

### SQLite + Drizzle ORM

- **better-sqlite3** (^12.8.0) — Synchronous native SQLite bindings
- **Drizzle ORM** (^0.45.1) — Type-safe SQL query builder
- **drizzle-kit** (^0.31.10) — Migration management

Database: `~/Library/Application Support/Showtime/app.db`

**Schema:**

| Table | Purpose |
|-------|---------|
| `shows` | Show state (phase, energy, verdict, timestamps) |
| `acts` | Acts within a show (name, category, duration, beat status) |
| `timeline` | Event log (phase transitions, act completions, beat locks) |
| `metrics` | Performance timing data |
| `claude_contexts` | Persisted Claude Code conversation context per show |

Migrations are plain SQL files auto-copied to the build output at compile time.

---

## Testing

### Unit Tests — Vitest (^4.1.0)

```bash
npm test          # Run all 514+ unit tests
npm run test:watch # Watch mode
```

- **jsdom** (^29.0.1) — DOM environment for component tests
- **@testing-library/react** (^16.3.2) — Component rendering and queries
- **@testing-library/jest-dom** (^6.9.1) — DOM assertion matchers
- **fast-check** (^4.6.0) — Property-based testing for state machine invariants

Test setup mocks the entire `window.clui` preload API so hooks and stores can be tested in isolation.

### E2E Tests — Playwright (^1.58.2)

```bash
npm run test:e2e  # Run all E2E tests
```

**Test projects** (run in parallel):

| Project | Scope | Timeout |
|---------|-------|---------|
| `smoke` | App launch, onboarding | 60s |
| `core-flow` | Writer's Room, live show, strike, cold open | 60s |
| `data-views` | Data layer, temporal queries, view tiers, history, settings | 60s |
| `visual` | Visual regression, consistency checks | 60s |
| `claude-real` | Real Claude API integration | 180s |
| `claude-cassette` | Cassette replay tests | 30s |

**Custom progress reporter** — Shows `[N/M] (%)` progress, elapsed time, slow test detection (>5s threshold).

### Pre-commit Hooks — Husky

```bash
# .husky/pre-commit
npm test
```

Runs all unit tests before every commit. CI-safe (`prepare: "husky || true"` handles GitHub Actions where husky isn't on PATH during `npm ci`).

### CodeRabbit (AI Code Review)

Every PR is automatically reviewed for:
- Inline styles (must use Tailwind)
- Missing E2E test coverage
- IPC type safety violations
- Animation physics (spring only)
- CLAUDE.md rule violations

---

## CI/CD

### GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | PR / push to main | `npm ci` → `npm test` → `tsc --noEmit` |
| `docs.yml` | Push to main | Build VitePress → deploy to GitHub Pages |
| `docs-lint.yml` | PR with docs changes | Lint markdown files |
| `validate-issue-close.yml` | Issue close | Custom validation |

### Documentation — VitePress (^1.6.3)

Public docs at `docs/` — deployed to GitHub Pages. Covers the framework philosophy, getting started guide, design system, and contributing guidelines.

---

## Native Modules

These require `electron-rebuild` before testing:

| Module | Version | Purpose |
|--------|---------|---------|
| **better-sqlite3** | ^12.8.0 | Synchronous SQLite for show persistence |
| **node-pty** | ^1.1.0 | PTY subprocess for interactive Claude Code sessions |

Both are automatically rebuilt via `postinstall: "electron-builder install-app-deps"`.

---

## Icons & Assets

- **Phosphor Icons** (@phosphor-icons/react ^2.1.10) — UI icon library
- **System tray icons** — Three PNG states: default, live (red), amber (warning) as template images with @2x retina variants
- **App icon** — `resources/icon.icns` (macOS native)
- **Entitlements** — `resources/entitlements.mac.plist` (microphone access for future Whisper integration)

---

## Key Design Constraints

These are enforced by CLAUDE.md, CodeRabbit, and pre-commit hooks:

1. **No inline styles** — 100% Tailwind utility classes
2. **Spring physics only** — No linear CSS transitions or Framer Motion durations
3. **XState for phases, Zustand for UI** — Phase state via `showMachine.ts`, UI state via Zustand stores. `ShowMachineProvider` is the one allowed React Context.
4. **Typed IPC** — All channels via `IPC` enum, all payloads typed in `shared/types.ts`
5. **E2E coverage** — Every feature must have Playwright tests
6. **macOS native feel** — `frame: false`, no vibrancy, CSS backgrounds, content-tight sizing
