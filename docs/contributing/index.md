# Development Setup

Showtime is an ADHD-friendly macOS day planner built with Electron. Here's how to get it running locally.

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **macOS** — Showtime uses native macOS window APIs (NSPanel, always-on-top). Linux and Windows are not supported yet.
- **Git**

## Quick Start

```bash
git clone https://github.com/vishnujayvel/showtime.git
cd showtime
npm install
npm run dev
```

`npm run dev` launches electron-vite in development mode with hot-reload for the renderer process.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the app in development mode (electron-vite, hot-reload) |
| `npm run build` | Build the production Electron app |
| `npm run test` | Run Vitest unit and component tests |
| `npm run test:e2e` | Run Playwright end-to-end tests (requires a built app) |

::: tip
Playwright E2E tests launch the full Electron app. Run `npm run build` before `npm run test:e2e` if you haven't already.
:::

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 35 + electron-vite |
| Renderer | React 19 + TypeScript |
| State (phase) | XState v5 |
| State (UI) | Zustand |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Components | shadcn/ui + Radix UI |
| Animations | Framer Motion (spring physics) |
| Persistence | SQLite (better-sqlite3) + Drizzle ORM |
| Unit tests | Vitest |
| E2E tests | Playwright |

## Architecture

```
Showtime (Electron App)
├── Main Process (Node.js)
│   ├── claude/           RunManager, ControlPlane, StreamParser
│   ├── window management (NSPanel, always-on-top)
│   └── IPC handlers
├── Preload (contextBridge)
│   └── window.clui API (typed IPC bridge)
└── Renderer (React 19)
    ├── views/        12 views — see View System docs
    ├── panels/       TimerPanel, LineupPanel
    ├── components/   LineupCard, ChatMessage, ActCard,
    │                 BeatCheckModal, MiniRundownStrip, etc.
    ├── machines/     showMachine, showActor, ShowMachineProvider (XState v5)
    ├── stores/       uiStore, sessionStore (Zustand — non-phase state only)
    ├── hooks/        useTimer, useClaudeEvents, etc.
    └── ui/           shadcn/ui components (Button, Dialog, Card)
```

### Main Process

Owns window management and system integration. Creates frameless, transparent `BrowserWindow` instances sized to the current view and handles always-on-top via macOS NSPanel.

### Preload / IPC Bridge

The renderer talks to main **only** through the typed `window.clui` API in `preload/index.ts`. Hard boundary:

- The preload script uses Electron's `contextBridge` to expose a strict, typed interface.
- The renderer never imports Node.js modules directly.
- All IPC calls are typed end-to-end.

```ts
// Renderer code — always go through the bridge
window.clui.someMethod(args)

// Never do this in renderer code
import { ipcRenderer } from 'electron' // WRONG
```

### Renderer

Standard React 19 app. Views map to show phases (Dark Studio, Writer's Room, ON AIR, Intermission, Strike). Phase state is managed by an XState v5 state machine (`showActor`). Non-phase UI state (calendar, chat) uses Zustand stores.

### Persistence

SQLite (better-sqlite3) in the main process. Renderer accesses data through IPC, never directly.

::: warning
`better-sqlite3` is a native Node module. If you see build errors after switching Node versions, run `npx electron-rebuild` to recompile it against Electron's ABI.
:::

## Next Steps

- [Design System](/contributing/design-system) — Colors, typography, animations, and view dimensions
- [Coding Standards](/contributing/coding-standards) — Rules for styling, state management, testing, and more
- [View System](/contributing/view-system) — View tiers, transitions, and routing logic
- [Key Components](/contributing/components) — LineupCard, ChatMessage, TallyLight, and more
- [Chat-First Writer's Room](/contributing/chat-first-writers-room) — How the chat-based planning flow works
- [E2E Testing & Cassettes](/contributing/e2e-testing-cassettes) — Three-tier testing strategy with VCR cassettes
