# Development Setup

Showtime is an ADHD-friendly macOS day planner built as an Electron desktop app. This guide covers everything you need to get a development environment running.

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
| State | Zustand |
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
│   ├── window management (NSPanel, always-on-top)
│   └── IPC handlers
├── Preload (contextBridge)
│   └── window.clui API (typed IPC bridge)
└── Renderer (React 19)
    ├── views/        PillView, WritersRoomView, ExpandedView,
    │                 StrikeView, DarkStudioView
    ├── panels/       TimerPanel, LineupPanel, ChatPanel
    ├── components/   ActCard, BeatCheckModal, BeatCounter, etc.
    ├── stores/       showStore (Zustand)
    └── ui/           shadcn/ui components (Button, Dialog, Card)
```

### Main Process

The main process owns window management and system integration. It creates frameless, transparent `BrowserWindow` instances sized to match the current view (Pill, Expanded, Writer's Room, etc.) and manages always-on-top behavior via native macOS NSPanel APIs.

### Preload / IPC Bridge

The renderer communicates with the main process **only** through the typed `window.clui` API defined in `preload/index.ts`. This is a hard boundary:

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

The renderer is a standard React 19 app. Views correspond to Showtime's production phases (Dark Studio, Writer's Room, ON AIR via Expanded/Pill, Intermission, Strike). Global state lives in Zustand stores, primarily `showStore`.

### Persistence

SQLite via better-sqlite3 runs in the main process. Drizzle ORM provides the query layer. The renderer accesses data through IPC, never directly.

::: warning
`better-sqlite3` is a native Node module. If you see build errors after switching Node versions, run `npx electron-rebuild` to recompile it against Electron's ABI.
:::

## Next Steps

- [Design System](/contributing/design-system) — Colors, typography, animations, and view dimensions
- [Coding Standards](/contributing/coding-standards) — Rules for styling, state management, testing, and more
