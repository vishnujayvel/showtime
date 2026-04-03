# Getting Started

Welcome to Showtime. If you're here, you're probably tired of to-do apps that keep score against you. Showtime doesn't do that. Your day is a live TV show. You're the star. Let's get you on stage.

## Prerequisites

Showtime is a macOS-only Electron app. You'll need:

- **macOS** (any recent version)
- **Node.js 18+** ([download](https://nodejs.org))
- **Git** (pre-installed on macOS, or via `xcode-select --install`)
- **Claude CLI** (for the Writer's Room chat experience)

## Installation

```bash
# Clone the repo
git clone https://github.com/vishnujayvel/showtime.git
cd showtime

# Install dependencies
npm install

# Launch the app
npm run dev
```

That's it. The app opens and you're looking at a dark stage.

## What You'll See: Dark Studio

When Showtime launches for the first time, you land in the **Dark Studio**. An empty stage. A warm spotlight. Quiet anticipation.

There's nothing overdue here. No backlog of unfinished tasks from yesterday. No 47 notifications demanding your attention. The stage is empty because tonight's show hasn't been written yet.

This is intentional. Every day in Showtime starts from zero.

When you're ready, click **Enter the Writer's Room**. No rush. The spotlight will wait.

## Your First Show

Here's the full flow from opening the app to closing the laptop.

### 1. Enter the Writer's Room

Click the button on the Dark Studio screen. You're now the **Head Writer**, drafting tonight's lineup.

### 2. Set Your Energy

A chip in the title bar shows your energy level. Tap it to choose one:

- **High** -- Full tank. Deep focus day.
- **Medium** -- Solid working day. Mix of tasks.
- **Low** -- Lighter day. Gentle tasks.
- **Recovery** -- Near empty. One Beat wins the day.

Be honest. Recovery days are valid days. Your energy level shapes how many Acts get scheduled, what kind of work goes on stage, and how many Beats count as a win. For the full breakdown, see [Energy Levels](/getting-started/energy-levels).

### 3. Chat with Claude

Type what's on your plate into the chat. Don't organize it, don't prioritize it.

> "Finish the API thing, email Alex, maybe gym if I feel like it, groceries."

That's plenty. Hit **BUILD MY LINEUP** and Claude structures your brain dump into a lineup of Acts -- timed blocks of work with categories and durations.

### 4. Review the Lineup

The lineup appears as an interactive card. Each Act shows its name, category, and duration. You can edit them inline, reorder, add, or remove Acts. Or type a follow-up: "make the exercise block longer" and Claude regenerates.

### 5. Go Live

Once the lineup looks right, hit **WE'RE LIVE!** and the ON AIR light ignites.

*"Live from your desk, it's [today's date]!"*

You're no longer a person sitting at a desk. You're a Performer on stage. The show has started.

### 6. Perform Your Acts

Your first Act begins with a countdown timer in big monospaced numbers. Work through your lineup, one Act at a time. After each Act, a Beat Check asks if you had a moment of presence. Between Acts, an Intermission gives you guilt-free rest.

For the full details on what happens during the live show, head to the [Live Show guide](./live-show).

### 7. Strike the Stage

When the show is over, you'll see your stats: Acts completed, Beats locked, and a verdict. There is no "bad show" verdict. Close the laptop. The show is over. It was your show.

::: tip Tomorrow starts fresh
There are no streaks to protect. No backlog to dread. Tomorrow the stage is empty again -- just a warm spotlight and a Writer's Room waiting to hear what's on tonight's show.
:::
