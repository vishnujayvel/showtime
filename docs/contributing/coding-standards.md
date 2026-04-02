# Coding Standards

These are the rules for writing code in the Showtime codebase. They exist to keep the app consistent, accessible, and maintainable.

## No Inline Styles

This is the single most important rule. **Never use React `style` prop objects.** All styling must use Tailwind CSS utility classes.

```tsx
// WRONG — never do this
<div style={{ display: 'flex', padding: '16px', background: '#1a1a1e' }}>

// RIGHT — use Tailwind classes
<div className="flex p-4 bg-surface">
```

There are no exceptions. If you need a value that doesn't exist as a Tailwind utility, add it as a theme token in CSS via `@theme`.

## Tailwind CSS v4 — CSS-First Configuration

Showtime uses Tailwind CSS v4 with the `@tailwindcss/vite` plugin. There is **no `tailwind.config.js` file**. All custom design tokens are defined via `@theme` blocks directly in CSS:

```css
@import "tailwindcss";

@theme {
  --color-studio-bg: #0d0d0f;
  --color-surface: #1a1a1e;
  --color-accent: #d97757;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;
}
```

To add a new color, spacing value, or font, add it to the `@theme` block and use the resulting Tailwind utility class (e.g., `bg-studio-bg`, `font-mono`).

## Use shadcn/ui for Interactive Components

Buttons, modals, dialogs, selects, popovers, tooltips, and other interactive elements must use **shadcn/ui** components (built on Radix UI primitives), styled with Tailwind.

Do not hand-roll accessible interactive components. shadcn/ui handles keyboard navigation, focus management, and ARIA attributes correctly.

```bash
# Add new components via the CLI
npx shadcn@latest add button dialog card
```

```tsx
// Use shadcn/ui components
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/ui/dialog'

<Dialog>
  <DialogTrigger asChild>
    <Button variant="default">Open</Button>
  </DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

## Framer Motion — Spring Physics Only

All animations must use spring physics. Never use linear or tween-based transitions.

```tsx
// RIGHT — spring physics
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>

// WRONG — duration-based (linear/tween)
<motion.div transition={{ duration: 0.3 }} />
```

Springs feel physical and alive. They match the live TV production energy of the app. Duration-based animations feel mechanical and flat.

## macOS Native Window Rules

Showtime is a macOS-native Electron app. These window configuration rules are mandatory:

- **`frame: false`** — No native window chrome. All UI is custom.
- **No `vibrancy`** — Electron's vibrancy option creates visible gray borders. Paint all backgrounds in CSS instead.
- **No `titleBarStyle: 'hiddenInset'`** — Conflicts with `frame: false` and creates ghost native traffic lights.
- **Transparent backgrounds** — HTML, body, and the React root must have `background-color: transparent`. Views paint their own backgrounds.
- **CSS drag regions** — Use the `.drag-region` and `.no-drag` CSS classes defined in `index.css`. Never use inline style props for `-webkit-app-region`.
- **Content-tight sizing** — The window is resized to match the active view exactly. Do not use `setIgnoreMouseEvents`. Views must use `w-full h-full` to fill the window edge-to-edge.

```tsx
// RIGHT — fill the window, use CSS classes
<div className="w-full h-full bg-studio-bg drag-region">
  <button className="no-drag">Click me</button>
</div>

// WRONG — hardcoded dimensions, inline drag style
<div style={{ width: 560, WebkitAppRegion: 'drag' }}>
```

## State Management — Zustand Only

All global state uses **Zustand**. Do not use React Context for state management.

- `showStore` — The primary store. Manages show phase, acts, beats, energy level, and timer state.

```tsx
import { useShowStore } from '@/stores/showStore'

function MyComponent() {
  const phase = useShowStore((s) => s.phase)
  const acts = useShowStore((s) => s.acts)
  // ...
}
```

## IPC Bridge — Strict Typing

The renderer process communicates with the main process **only** through the typed `window.showtime` API, defined in `preload/index.ts` via Electron's `contextBridge`.

- Never import `electron`, `ipcRenderer`, or any Node.js module in renderer code.
- All IPC methods are typed end-to-end.
- Data persistence (SQLite) lives in the main process. The renderer reads and writes through IPC.

```tsx
// RIGHT — use the typed bridge
const data = await window.showtime.getData()

// WRONG — direct Node.js imports in renderer
import { ipcRenderer } from 'electron'
import fs from 'fs'
```

## Testing

Every feature must have test coverage. No exceptions.

### Playwright E2E Tests

Located in `e2e/`. These launch the full Electron app and test real user flows.

E2E tests must cover:
- App launches successfully
- Dark Studio to Writer's Room transition
- Energy selection through to "We're live!"
- Act timer counts down
- Beat Check modal appears and Beat can be locked
- Intermission flow
- Strike the Stage with verdict
- Pill to Expanded view transitions

```bash
# Build the app first, then run E2E tests
npm run build
npm run test:e2e
```

### Vitest Unit Tests

Located in `src/__tests__/`. Use Vitest for stores, hooks, and pure functions.

```bash
npm run test
```

::: warning
Vitest runs under system Node.js, not Electron's Node.js. Test configuration uses the `node` environment. If you're testing code that depends on native modules like `better-sqlite3`, it needs `electron-rebuild` for ABI compatibility.
:::

## Git Workflow

- **Commit at each working milestone** — small, frequent commits.
- **Test before commit** — run `npm run test && npm run test:e2e` and ensure all tests pass.
- **Never commit with failing tests.**
- **Branch:** `main` for now (no feature branches during MLP phase).
