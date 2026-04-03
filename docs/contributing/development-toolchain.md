# Development Toolchain

Showtime uses **Bun** as its development toolchain for package management, script execution, and build orchestration. The application itself runs on **Electron** (Node.js/V8) at runtime.

## Architecture

```text
Development (your machine)          Shipped Application
┌──────────────────────────┐        ┌──────────────────────────┐
│  Bun                     │        │  Electron                │
│  ├─ bun install          │  ──►   │  ├─ Main (Node.js/V8)    │
│  ├─ bun run dev          │  build │  ├─ Preload (contextBridge)│
│  ├─ bun run build        │  ──►   │  └─ Renderer (React 19)  │
│  └─ bun run test         │        │                          │
│                          │        │  Native Modules           │
│  Lockfile: bun.lock      │        │  ├─ better-sqlite3       │
│  Config: package.json    │        │  └─ node-pty             │
└──────────────────────────┘        └──────────────────────────┘
```

Bun replaces npm as the outer shell. It installs packages, runs scripts, and manages the lockfile. The Electron app, its V8 runtime, and all native modules remain unchanged.

## Prerequisites

- **Bun** >= 1.3.0: `brew install oven-sh/bun/bun` or `curl -fsSL https://bun.sh/install | bash`
- **Node.js** >= 22: Required by Electron's build toolchain

Verify installation:

```bash
bun --version   # Should print 1.3.x
node --version  # Should print v22.x or higher
```

## Getting Started

```bash
git clone https://github.com/vishnujayvel/showtime.git
cd showtime
bun install
bun run dev
```

## Common Commands

| Command | What it does |
|---------|--------------|
| `bun install` | Install all dependencies + rebuild native modules |
| `bun run dev` | Start Electron in development mode (HMR enabled) |
| `bun run build` | Production build (main + preload + renderer) |
| `bun run test` | Run Vitest unit/component tests (684 tests) |
| `bun run test:e2e` | Run Playwright E2E tests |
| `bun run dist` | Build + package as macOS .app |

## Why Bun?

### Performance

Benchmarked on this project (745 packages, 2 native modules):

| Operation | npm | Bun | Speedup |
|-----------|-----|-----|---------|
| Clean install (no lockfile) | 10.2s | 23.7s | npm faster* |
| Install with lockfile | 10.2s | 5.3s | **1.9x faster** |
| Lockfile size | 12,326 lines | 1,792 lines | **6.9x smaller** |

\* First-run includes lockfile migration from package-lock.json + native module rebuild overhead. Subsequent installs are faster.

### Supply-Chain Security

Bun blocks postinstall scripts by default. Unknown packages cannot run arbitrary code during install. Showtime's `postinstall` (electron-builder native module rebuild) is trusted automatically because it's declared in the project's own `package.json`.

### Compatibility

Bun handles all of Showtime's requirements:
- Native modules (`better-sqlite3`, `node-pty`) via `electron-builder install-app-deps`
- Electron rebuild for ABI compatibility
- Vitest (runs unchanged under Bun's script runner)
- Playwright E2E tests
- Husky git hooks

## Lockfile

The project uses `bun.lock` (Bun's binary lockfile format). This replaces `package-lock.json`.

If you need to use npm for any reason, the `package.json` is standard and npm will generate its own lockfile. Both tools read the same `package.json`.

## Native Modules

Showtime depends on two native C++ addons:

- **better-sqlite3** — SQLite database driver for persisting show data
- **node-pty** — Terminal emulator for Claude subprocess management

These are automatically rebuilt for Electron's ABI during `bun install` via the `postinstall` script:

```json
"postinstall": "electron-builder install-app-deps && bash scripts/patch-dev-icon.sh"
```

If you encounter native module errors after switching Node or Electron versions:

```bash
bun run postinstall
```

## Troubleshooting

### "Cannot find module better-sqlite3"

Native modules need rebuilding. Run:

```bash
bun run postinstall
```

### Switching between npm and Bun

Both tools can coexist. Each generates its own lockfile (`package-lock.json` for npm, `bun.lock` for Bun). The project commits `bun.lock` as the canonical lockfile.

### Bun version mismatch

If you see unexpected behavior, ensure you're on Bun >= 1.3.0:

```bash
bun upgrade
```
