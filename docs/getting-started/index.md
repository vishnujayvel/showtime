# Install & First Show

You found this page, which probably means you're tired of productivity tools that make you feel bad. Good news: Showtime doesn't do that. Your day is a live TV show. You're the star. Let's get you on stage.

## Installation

Showtime is a macOS-only Electron app. You'll need Node.js 18+ and Git.

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

## Your First Show

Here's what happens the first time you run Showtime.

### 1. Dark Studio

The app opens to an empty stage. A warm spotlight. Quiet anticipation. There's nothing overdue here, no backlog of shame. The stage is empty because tonight's show hasn't been written yet.

Click **Enter the Writer's Room** when you're ready. No rush.

### 2. Writer's Room

This is where you plan your day — through a conversation with Claude. The whole thing takes about three minutes.

**Set your energy.** A chip in the title bar shows your energy level. Tap it to pick one: High, Medium, Low, or Recovery. Be honest. Recovery days are valid days. See [Energy Levels](./energy-levels) for what each level means.

**Tell Claude about your day.** Type into the chat what's on your plate. Don't organize it, don't prioritize it. "finish the API thing, need to email alex, maybe gym if I feel like it, groceries." That's plenty. Hit **BUILD MY LINEUP** and Claude structures your brain dump into a lineup of Acts (timed blocks of work).

**Review and refine.** The lineup appears as an interactive card right in the chat. Each Act shows its category, name, and duration — all editable inline. Click a name to rename it. Click a duration to change it. Click the category badge to switch sketches. Add or remove Acts with the buttons. Or just type a follow-up message: "make the exercise block longer" or "swap acts 2 and 3" and Claude will regenerate the lineup.

### 3. "We're Live!"

Once the lineup looks right, hit **WE'RE LIVE!** and the ON AIR light ignites. "Live from your desk, it's [today's date]!" This isn't decoration. It's a threshold. Before this moment, you were a person sitting at a desk. Now you're a Performer on stage.

The show has started.

### 4. Act Timer

Your first Act begins with a countdown timer, a studio clock in big monospaced numbers. The pill view floats on your screen showing the Act name, timer, and Beat count so you can see where you are while you work.

Acts are typically 45-90 minutes. When the timer runs out, the Act is over. You don't have to finish the task perfectly. The Act is done because the time is done.

### 5. Beat Check

After each Act, a spotlight narrows and the app asks: **"Did you have a moment of presence?"**

A Beat isn't about productivity. It's about noticing. Were you there? Did you feel alive inside the work, even for a second? "That solution clicked." "I was actually enjoying this." "I noticed I was focused."

If yes, lock the Beat. A golden star ignites. That moment was real.

If no, that's fine too. The Act still counted. You still showed up.

### 6. Intermission

Between Acts, the ON AIR light goes dark. A vintage card appears: **"WE'LL BE RIGHT BACK."** There's no timer. There's no guilt. Rest costs zero capacity. Always has.

Get a coffee. Stretch. Stare at the wall. The show isn't going anywhere.

Tap **Back to the show** when you're ready for the next Act.

### 7. Director Mode

If things go sideways -- you're overwhelmed, you've skipped a couple of Acts, the day isn't going as planned -- the Director steps in. Four options, all of them valid:

- Skip to the next Act
- Take a longer break
- Breathe for five minutes
- Call the show early

None of these is failure. They're production decisions.

### 8. Strike the Stage

When the show is over -- either because you finished the lineup or because you called it -- it's time to Strike. You'll see your stats: Acts completed, Beats locked, and a verdict.

| Verdict | What it means |
|---------|---------------|
| **DAY WON** | You hit the Beat threshold. Standing ovation. |
| **SOLID SHOW** | One Beat short of the threshold. Strong performance. |
| **GOOD EFFORT** | You got on stage. That counts. |
| **SHOW CALLED EARLY** | A short show is still a show. |

There is no "bad show" verdict. There is no failure state. Close the laptop. The show is over. It was your show.

---

Tomorrow the stage is empty again. No streaks to protect, no backlog to dread. Just a warm spotlight and a Writer's Room waiting to hear what's on tonight's show.
