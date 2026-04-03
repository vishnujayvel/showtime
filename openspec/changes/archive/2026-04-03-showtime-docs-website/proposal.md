# Showtime Documentation Website + Internal Docs Housekeeping

GitHub Issues: #45, #47 (partial)

## Why

Showtime has no public-facing documentation. The `?` help button goes nowhere (#44). The `docs/` directory is a mixed bag of internal session notes, design docs, and mockups — some shareable, some not. There's no guardrail preventing future mixing.

We need:
1. A public documentation website explaining the app and the Showtime framework
2. A clean separation between public docs and internal working notes
3. Guardrails so the mixed bag doesn't happen again

## What Changes

### Phase 1: Housekeeping — Separate Public from Internal

**Move internal docs out of `docs/`:**

```
docs-internal/              ← NEW, gitignored
  session/                  ← date-stamped session notes (moved from docs/plans/)
    2026-03-20-showtime-design.md
    2026-03-20-showtime-retrospective.md
    2026-03-21-refactor-plan.md
    2026-03-21-pill-sizes-design.md
    2026-03-21-test-framework-research.md
    2026-03-22-video-testing-research.md
    2026-03-24-claude-warmup.md
    2026-03-24-test-optimization.md
  pipeline-journal.md
  oss-readiness-report.md
```

**Add to `.gitignore`:**
```
# Internal working docs — not for public consumption
docs-internal/
```

**Keep in `docs/` temporarily** (becomes source material for the website):
- `docs/plans/product-context.md` → becomes website content
- `docs/plans/design-system.md` → becomes website content
- `docs/plans/snl-framework-reference.md` → becomes website content
- `docs/plans/electron-best-practices-research.md` → stays as contributor reference
- `docs/plans/pill-window-fix-design.md` → stays as feature design doc
- `docs/plans/test-isolation-design.md` → stays as feature design doc
- `docs/mockups/` → reference for contributors

### Phase 2: Documentation Website — VitePress

**Why VitePress:**
- Vue-powered static site generator (fast, lightweight)
- Built-in search, dark mode, sidebar navigation
- Markdown-first — write docs as `.md`, get a polished site
- GitHub Pages deployment is a single workflow file
- Used by Vue, Vite, Pinia — proven at scale

**Directory structure:**
```
docs/                           ← VitePress site root
  .vitepress/
    config.ts                   ← site config, nav, sidebar
    theme/                      ← custom Showtime theme (optional)
  index.md                      ← landing page
  getting-started/
    index.md                    ← Install + first show
    energy-levels.md            ← High/Medium/Low explained
    keyboard-shortcuts.md       ← All shortcuts
  framework/
    index.md                    ← What is the Showtime Framework?
    science.md                  ← Research foundations
    snl-metaphor.md             ← Why live TV production works
    adhd-design.md              ← ADHD-specific design decisions
    no-guilt.md                 ← The no-guilt philosophy
  concepts/
    show-phases.md              ← Dark Studio → Writer's Room → Live → Intermission → Strike
    acts-and-beats.md           ← What acts and beats are
    verdicts.md                 ← DAY WON, SOLID SHOW, etc.
    director-mode.md            ← Compassionate options when stuck
    view-tiers.md               ← Pill, Compact, Dashboard, Expanded
  contributing/
    index.md                    ← Dev setup, architecture overview
    design-system.md            ← Migrated from docs/plans/
    coding-standards.md         ← Extracted from CLAUDE.md
  public/
    favicon.ico
    og-image.png                ← Social sharing image
  plans/                        ← Surviving design docs (feature designs)
    pill-window-fix-design.md
    test-isolation-design.md
    electron-best-practices-research.md
  mockups/                      ← Kept as contributor reference
    direction-4-the-show.html
```

### Phase 3: Framework Content — The Science

The Showtime framework draws from real research. The docs should explain **why** each design decision exists:

| Concept | Science Behind It | Page |
|---------|-------------------|------|
| Time-boxed acts | Parkinson's Law + ultradian rhythms (90-120 min performance cycles) | `science.md` |
| Beat checks | Mindfulness anchors — brief meta-awareness moments improve task engagement | `science.md` |
| Energy-based planning | Chronotype research — match task difficulty to energy, not clock time | `energy-levels.md` |
| No-guilt language | Self-compassion research (Kristin Neff) — shame spirals destroy motivation | `no-guilt.md` |
| Show metaphor | Narrative identity theory — people perform better when cast as protagonists | `snl-metaphor.md` |
| Daily variation | Novelty-seeking in ADHD — same routine every day triggers habituation | `adhd-design.md` |
| Rest is free | ADHD rejection sensitivity — "rest costs zero" removes permission anxiety | `no-guilt.md` |
| Verdicts not grades | Growth mindset framing (Dweck) — "SOLID SHOW" ≠ "B-" | `verdicts.md` |
| Director Mode | Self-determination theory — autonomy in choosing to pause, skip, or restructure | `director-mode.md` |

### Phase 4: GitHub Pages Deployment

```yaml
# .github/workflows/docs.yml
name: Deploy docs
on:
  push:
    branches: [main]
    paths: ['docs/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci --prefix docs && npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist
      - uses: actions/deploy-pages@v4
```

### Phase 5: Guardrails — Prevent Future Mixing

1. **CLAUDE.md rule** — Add a "Documentation" section:
   ```
   ## Documentation Rules
   - `docs/` is the PUBLIC documentation website. Every file here is deployed to GitHub Pages.
   - Internal session notes, retrospectives, and working docs go in `docs-internal/` (gitignored).
   - Design docs for features go in `docs/plans/` (public, useful for contributors).
   - Never put date-stamped session logs in `docs/`.
   ```

2. **CI check** — Lint that `docs/` doesn't contain files matching `202*-*` pattern (date-stamped notes).

3. **`.gitignore` enforcement** — `docs-internal/` stays ignored.

## Non-Goals

- Video tutorials (later)
- Blog / changelog (later)
- API documentation (later)
- i18n / translations (later)
- Custom domain (later — use `vishnujayvel.github.io/showtime` first)

## Testing Strategy

- `npm run docs:dev` — local preview works
- `npm run docs:build` — builds without errors
- All internal links resolve (VitePress validates this)
- GitHub Pages deployment succeeds on push to main
- `docs-internal/` not present in built output

## Key Files

| File | Purpose |
|------|---------|
| `docs/.vitepress/config.ts` | Site config, navigation, sidebar |
| `docs/index.md` | Landing page |
| `docs/framework/*.md` | Showtime framework guide |
| `docs/concepts/*.md` | App concepts explained |
| `.github/workflows/docs.yml` | GitHub Pages deployment |
| `.gitignore` | `docs-internal/` added |
| `CLAUDE.md` | Documentation rules added |
