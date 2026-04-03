# Settings

Showtime keeps configuration minimal -- the app should feel like it works out of the box. But there are a few things you can adjust. Open Settings anytime with **Cmd + ,**.

## Timer Display Modes

During the live show, the timer can appear in two forms:

### Pill View

A small floating capsule (320px wide) that sits on top of your other windows. Shows the Act name, countdown timer, Beat count, and a thin colored timeline of your lineup. This is the default during focus work -- it stays visible without taking up space.

Use Pill view when you want the timer present but unobtrusive. One click expands it to the full view. Press **Escape** to collapse back.

### Expanded View

The full-stage experience with a 64px hero timer, full lineup sidebar, ON AIR bar, and Beat stars. For when you want to lean into the production metaphor and see everything at once.

Switch between views anytime using keyboard shortcuts:

| Shortcut | View |
|----------|------|
| **Cmd + 1** | Pill view |
| **Cmd + 2** | Compact view |
| **Cmd + 3** | Dashboard view |
| **Cmd + 4** | Expanded view |
| **Escape** | Collapse to Pill |

For the full breakdown of all view sizes, see [View Tiers](/concepts/view-tiers).

## Keyboard Shortcuts

Showtime is fully keyboard-navigable. The essential shortcuts:

| Shortcut | Action |
|----------|--------|
| **Space** | Pause / resume the current Act timer |
| **Cmd + D** | Open Director Mode |
| **Cmd + Enter** | Lock a Beat during Beat Check |
| **Cmd + I** | Start Intermission |
| **Cmd + Shift + S** | Strike the Stage (end the show) |
| **Cmd + ,** | Open Settings |

For the complete reference, see [Keyboard Shortcuts](/getting-started/keyboard-shortcuts).

## Data Storage

Showtime stores your show history in a local SQLite database inside the app's data directory. Your data stays on your machine -- nothing is sent to external servers (except the Claude conversation during the Writer's Room, which uses the Claude CLI).

Your shows, Acts, Beats, verdicts, and energy levels are all persisted locally. This means you can look back at past shows to see patterns in your energy, Beat counts, and verdicts over time.

## Resetting Data

If you want a completely fresh start -- no history, no past shows -- you can reset the database from Settings. This clears all stored shows, Acts, and Beats.

::: warning This is permanent
Resetting your data cannot be undone. All past show history will be deleted. The app will return to its first-run state, starting with the Dark Studio as if it's your first day.
:::

## Getting Help

If you run into issues or have questions:

- **GitHub Issues** -- Report bugs or request features at [github.com/vishnujayvel/showtime/issues](https://github.com/vishnujayvel/showtime/issues)
- **Documentation** -- You're reading it. Browse the sidebar for concepts, framework details, and contributing guides.
- **Framework questions** -- Start with [The Showtime Framework](./framework) for an overview of how everything fits together, or dive into the [Concepts](/concepts/show-phases) section for detailed explanations of each piece.
