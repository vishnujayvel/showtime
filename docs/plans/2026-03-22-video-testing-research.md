# Video-Based UI Testing Research for Showtime (Electron)

**Date:** 2026-03-22
**Goal:** Evaluate approaches for recording the app in action and using AI/ML to analyze whether the UI behaves correctly — like a QA engineer watching a screen recording.

---

## Table of Contents

1. [Playwright Video Recording](#1-playwright-video-recording)
2. [Visual AI Testing Services](#2-visual-ai-testing-services)
3. [AI-Powered Video Analysis for Testing](#3-ai-powered-video-analysis-for-testing)
4. [Open Source Visual Testing](#4-open-source-visual-testing)
5. [The DIY Claude Vision Approach](#5-the-diy-claude-vision-approach)
6. [Electron-Specific APIs](#6-electron-specific-apis)
7. [Comparison Table](#7-comparison-table)
8. [Recommended Approach for Showtime](#8-recommended-approach-for-showtime)

---

## 1. Playwright Video Recording

Playwright has built-in video recording that works with Electron apps. This is the foundation everything else builds on.

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    video: 'on',              // Record every test
    // video: 'retain-on-failure', // Only keep videos from failed tests
    // video: 'on-first-retry',    // Record only on retries
  },
});
```

For Electron specifically, pass `recordVideo` to `_electron.launch()`:

```typescript
const app = await _electron.launch({
  args: ['main.js'],
  recordVideo: {
    dir: 'test-videos',
    size: { width: 1200, height: 800 }
  }
});
```

### Key Details

- **Format:** `.webm` (playable in Chrome, convertible to mp4 via ffmpeg)
- **Default size:** Viewport scaled to fit 800x800px
- **Custom size:** Specify `size: { width, height }` in config
- **Storage:** Videos saved to `test-results/` directory by default
- **Access path:** `page.video().path()` after page/context closure
- **Important:** Must `await browserContext.close()` for videos to be saved

### Verdict for Showtime

Playwright video recording works with Electron out of the box. We already have Playwright E2E tests. Enabling `video: 'retain-on-failure'` is a zero-effort win for debugging. The real question is what we do *with* the recordings.

---

## 2. Visual AI Testing Services

### Comparison of Paid Services

| Service | Approach | Free Tier | Paid Pricing | Electron Support | AI Diffing |
|---------|----------|-----------|-------------|-----------------|------------|
| **Applitools Eyes** | Visual AI engine; compares screenshots against baselines using computer vision, not pixel diff | 1 user, 100 checkpoints/mo | Custom/enterprise (est. $500+/mo) | Yes, via screenshot upload | Yes — AI understands layout, ignores irrelevant changes |
| **Percy (BrowserStack)** | Screenshot capture + pixel diff + AI Visual Review Agent | 5,000 screenshots/mo, unlimited users | $149/mo (annual) for 25K screenshots | Yes, via SDK screenshot upload | Yes — AI Review Agent filters ~40% false positives |
| **Chromatic** | Storybook-native; captures component states, perceptual diff | 5,000 snapshots/mo (commercial); unlimited for OSS | $149/mo (35K), $349/mo (85K), $649/mo (165K) | Storybook components only, not full app | Perceptual diff (not full AI) |
| **Happo** | Real browser rendering across Chrome/FF/Safari/Edge | Free trial only | Paid plans (pricing on request) | Via Playwright integration | No |
| **VisWiz.io** | API-first; multi-platform (web, mobile, desktop) | Free trial only | Per-image pricing | Yes, via API | No |

### Analysis

**Applitools Eyes** is the gold standard for visual AI testing. Its "Visual AI" engine understands layout semantics — it knows that a button moving 2px is irrelevant but a button disappearing is a bug. However, enterprise pricing makes it expensive for a solo/small project. The free tier (100 checkpoints/mo) is extremely limited.

**Percy** is the most practical paid option. 5,000 free screenshots per month is generous. Their new AI Visual Review Agent (late 2025) reduces false positives by ~40%. Works with any test framework via screenshot SDK.

**Chromatic** is excellent if you use Storybook, but it only tests isolated components, not the full app flow. Not useful for end-to-end "is the UI correct" analysis.

### Free/Open Source Alternatives

| Tool | Type | What It Does |
|------|------|-------------|
| **Playwright `toHaveScreenshot()`** | Built-in | Pixel-level screenshot comparison with configurable thresholds. Uses pixelmatch under the hood |
| **BackstopJS** | Open source | Screenshot comparison with HTML diff reports. Mature (since 2014), JSON config |
| **Argos** | Open source + cloud | Collaborative visual testing with GitHub PR integration |
| **reg-suit / reg-cli** | Open source | Framework-agnostic screenshot comparison; cloud storage for baselines (S3/GCS) |
| **jest-image-snapshot** | Open source | Jest matcher for screenshot comparison |
| **AyeSpy** | Open source | Fast visual regression testing |

---

## 3. AI-Powered Video Analysis for Testing

### Can Claude Vision Analyze UI Screenshots?

**Yes, absolutely.** Claude's vision API is well-suited for UI analysis:

- **Supported formats:** JPEG, PNG, GIF, WebP
- **Max image size:** 5MB per image (API), 8000x8000px max
- **Optimal size:** 1568px max on longest edge; ~1,600 tokens per image
- **Images per request:** Up to 600 (API), up to 20 (claude.ai)
- **Cost:** ~$0.004 per 1000x1000px image (Claude Sonnet 4.6 at $3/M input tokens)
- **Capabilities:** OCR, layout understanding, element identification, color recognition, text verification

**What Claude vision CAN do for UI testing:**
- Read all text in a screenshot and verify copy
- Check that UI elements exist and are in roughly correct positions
- Verify color themes (dark mode, accent colors)
- Detect obvious layout issues (overlapping elements, missing sections)
- Compare a screenshot against a description of expected state
- Identify which "phase" the app is in (Dark Studio, Writer's Room, ON AIR, etc.)

**Limitations:**
- Spatial reasoning is approximate (won't catch 2px alignment issues)
- Cannot give pixel-precise coordinates reliably
- May hallucinate details in low-quality or very small images
- Not a replacement for pixel-diff regression testing

### AI Testing Platforms with Video/Visual Analysis

| Platform | Video Analysis | Pricing | How It Works |
|----------|---------------|---------|-------------|
| **Bug0 Studio** | Yes — video upload, screen recording | $250/mo self-serve; $2,500/mo managed | Upload video/screen recording; AI generates Playwright tests from visual flow. Vision models watch frame-by-frame |
| **Momentic** | Visual comparison (not video) | Custom pricing | AI compares visual appearance between builds using visual cues + accessibility data. Not pixel-to-pixel — structural understanding |
| **Testim (Tricentis)** | Video recording of test runs | $30K-100K/yr enterprise | ML-based smart locators; video recordings of test runs for debugging; AI failure analysis |
| **QA Wolf** | Video recording + managed QA | ~$5K/mo | Fully managed: they build and maintain your E2E tests. Video evidence included |
| **Rainforest QA** | Video recordings + AI failure explanations | Free tier (5 hrs/mo); $200/mo PAYG | Auto-healing tests; AI-generated explanations of test failures alongside video recordings |
| **ZeroStep** | No video; AI assertions in Playwright | Free (500 calls/mo); $20/mo (2K calls) | `ai()` function inside Playwright tests — asks AI to perform actions or make assertions using page state |
| **Reflect** | Automatic change detection | Pricing on request | Functional + visual testing; lighter alternative to Applitools |

### ZeroStep — Worth Highlighting

ZeroStep integrates directly into Playwright tests and adds an `ai()` function:

```typescript
import { ai } from '@zerostep/playwright';

test('verify ON AIR state', async ({ page }) => {
  // ... navigate to ON AIR state
  const isOnAir = await ai('Is there a red ON AIR indicator visible?', { page });
  expect(isOnAir).toBeTruthy();

  const timerVisible = await ai('Is there a countdown timer displayed prominently?', { page });
  expect(timerVisible).toBeTruthy();
});
```

500 free AI calls per month. This is essentially the "DIY Claude approach" but packaged as a product using GPT under the hood.

---

## 4. Open Source Visual Testing

### Playwright Built-in Visual Comparison

Already available, zero setup:

```typescript
test('Dark Studio view', async ({ page }) => {
  await expect(page).toHaveScreenshot('dark-studio.png', {
    maxDiffPixelRatio: 0.01,  // Allow 1% pixel difference
  });
});
```

- Uses **pixelmatch** under the hood
- Generates baseline screenshots on first run
- Fails when diff exceeds threshold
- Generates diff images for debugging
- Works with Electron via `page.screenshot()`

### OpenCV Template Matching

For verifying specific UI elements exist in a screenshot:

```python
import cv2
# Load screenshot and template (e.g., ON AIR badge)
result = cv2.matchTemplate(screenshot, template, cv2.TM_CCOEFF_NORMED)
# If max correlation > 0.8, element is present
```

**Pros:** Fast, deterministic, works offline
**Cons:** Brittle to any visual changes; requires maintaining template images; not semantic

### Image Diff Libraries

| Library | Language | Approach |
|---------|----------|----------|
| **pixelmatch** | JS | Pixel-level diff, fast, used by Playwright |
| **resemble.js** | JS | Pixel diff with anti-aliasing detection |
| **looks-same** | JS | Perceptual diff with tolerance settings |
| **reg-cli** | JS | CLI for comparing screenshot directories |
| **BackstopJS** | JS | Full framework with HTML reports |

---

## 5. The DIY Claude Vision Approach

This is the most interesting option for Showtime. Here is a concrete architecture.

### Architecture

```
Playwright E2E Test Run
    │
    ├── video: 'on' (webm recording)
    ├── page.screenshot() at key state transitions
    │
    ▼
Key Frame Extraction
    │
    ├── Option A: Screenshots taken during test (preferred)
    ├── Option B: ffmpeg frame extraction from video
    │
    ▼
Claude Vision API Analysis
    │
    ├── Send screenshot + expected state description
    ├── Claude returns structured pass/fail + reasoning
    │
    ▼
Test Report
    ├── Pixel diff results (pixelmatch — catches regressions)
    └── AI analysis results (Claude — catches semantic issues)
```

### Implementation Plan

**Step 1: Capture screenshots at state transitions**

```typescript
// e2e/helpers/visual-qa.ts
import { Page } from '@playwright/test';
import * as fs from 'fs';

interface StateCapture {
  name: string;
  screenshot: Buffer;
  expectedDescription: string;
}

const captures: StateCapture[] = [];

export async function captureState(
  page: Page,
  name: string,
  expectedDescription: string
) {
  const screenshot = await page.screenshot({ fullPage: true });
  fs.writeFileSync(`test-results/captures/${name}.png`, screenshot);
  captures.push({ name, screenshot, expectedDescription });
}
```

**Step 2: Analyze with Claude Vision API after test run**

```typescript
// scripts/analyze-screenshots.ts
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic();

interface AnalysisResult {
  state: string;
  pass: boolean;
  issues: string[];
  confidence: number;
}

async function analyzeScreenshot(
  imagePath: string,
  expectedDescription: string
): Promise<AnalysisResult> {
  const imageData = fs.readFileSync(imagePath).toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: imageData }
        },
        {
          type: 'text',
          text: `You are a QA engineer reviewing a screenshot of an Electron desktop app called "Showtime" — an ADHD-friendly day planner with an SNL/live TV theme.

Expected state: ${expectedDescription}

Analyze this screenshot and return JSON:
{
  "pass": true/false,
  "issues": ["list of any visual issues found"],
  "confidence": 0.0-1.0,
  "observations": "brief description of what you see"
}

Check for:
1. Does the UI match the expected state description?
2. Is text readable and correctly spelled?
3. Are colors appropriate (dark theme, correct accent colors)?
4. Are interactive elements visible and properly positioned?
5. Any overlapping elements, clipped text, or layout issues?`
        }
      ]
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

**Step 3: Define expected states for Showtime**

```typescript
const SHOWTIME_STATES = {
  'dark-studio': 'Empty dark stage with a warm spotlight in the center. Should show the Showtime logo or "DARK STUDIO" text. Background should be very dark (#0d0d0f). No acts, no timer.',

  'writers-room-energy': 'Writer\'s Room view asking the user to select their energy level. Should show energy options (Low/Medium/High). Title should reference "Writer\'s Room" or planning.',

  'writers-room-lineup': 'Lineup preview showing planned acts for the day. Each act should have a title, duration, and category color. Should show a "WE\'RE LIVE!" or "GO LIVE" button.',

  'on-air-expanded': 'Expanded view during an active act. Should show: a large countdown timer (JetBrains Mono font), an ON AIR indicator (red), the current act name, and a lineup sidebar.',

  'beat-check': 'Beat Check modal overlaying the main view. Should show a card asking "Are you present?" with options to lock or skip the beat. Gold star iconography.',

  'intermission': 'Intermission screen showing "WE\'LL BE RIGHT BACK" or similar. Calm, restful appearance. Should feel like a TV intermission card.',

  'strike': 'Strike the Stage / end-of-day view. Should show completion stats, a verdict (DAY WON or similar), and a recap of completed acts. Gold stars for beats.',
};
```

### Cost Estimate

| Scenario | Screenshots/day | Cost/screenshot | Daily Cost | Monthly Cost |
|----------|----------------|-----------------|------------|-------------|
| Dev testing (manual) | 10 | ~$0.004 | $0.04 | ~$1.20 |
| CI per commit | 7 states x 1 | ~$0.004 | $0.03/commit | ~$2/mo (60 commits) |
| Full E2E suite | 20 screenshots | ~$0.004 | $0.08/run | ~$5/mo |
| Heavy usage | 50 screenshots | ~$0.004 | $0.20/run | ~$12/mo |

**Claude Sonnet 4.5 at $3/M input tokens:** A 1000x1000px screenshot is ~1,334 tokens = ~$0.004. This is extremely cheap.

### Comparison: DIY vs. Paid Services

| Factor | DIY Claude Vision | Applitools Eyes | Percy |
|--------|------------------|----------------|-------|
| Monthly cost | $2-12 | $500+ | Free (5K screenshots) |
| Setup effort | Medium (write scripts) | Low (SDK integration) | Low (SDK integration) |
| AI understanding | Excellent (semantic) | Excellent (visual AI) | Good (AI Review Agent) |
| Pixel precision | No (use pixelmatch for that) | Yes | Yes |
| Baseline management | Manual | Automatic | Automatic |
| Dashboard/UI | None (generate markdown reports) | Full dashboard | Full dashboard |
| Customizability | Complete | Limited to their API | Limited to their API |
| Showtime-specific prompts | Yes — can check SNL theme, copy, mood | No — generic visual diff | No — generic visual diff |

### Key Advantages of DIY for Showtime

1. **Domain-specific prompts:** Claude can be told about the SNL framework. "Is this screenshot showing a proper 'ON AIR' state with tally light pulsing?" — no paid service understands your app's *meaning*.

2. **Copy verification:** Claude can read every string on screen and verify it matches expected copy. "Does this say 'WE'RE LIVE!' and not 'We are live'?"

3. **Mood/aesthetic checking:** "Does this look like a dark, cinematic production studio? Is the spotlight warm?"

4. **Combine with pixelmatch:** Use Playwright's built-in `toHaveScreenshot()` for pixel-level regression, PLUS Claude for semantic analysis. Best of both worlds.

5. **Cost:** Pennies per analysis. Orders of magnitude cheaper than paid services.

---

## 6. Electron-Specific APIs

### `webContents.capturePage()`

Programmatic screenshot of the BrowserWindow content:

```typescript
// In main process
const image = await win.webContents.capturePage();
const png = image.toPNG();
fs.writeFileSync('screenshot.png', png);

// With specific rectangle
const image = await win.webContents.capturePage({
  x: 0, y: 0, width: 560, height: 620
});
```

**Pros:** No external dependencies, captures exactly what the renderer shows
**Cons:** Only captures web content (no native chrome); requires IPC from test

### `desktopCapturer`

Full desktop/window capture using media streams:

```typescript
const { desktopCapturer } = require('electron');

const sources = await desktopCapturer.getSources({
  types: ['window'],
  thumbnailSize: { width: 1920, height: 1080 }
});

// Find our window
const showtimeWindow = sources.find(s => s.name === 'Showtime');
const thumbnail = showtimeWindow.thumbnail.toPNG();
```

**Pros:** Captures the full window including native frame, vibrancy effects
**Cons:** Requires macOS screen recording permission (Catalina+); captures as-rendered (includes system effects)

### Screen Recording via MediaRecorder

```typescript
// In renderer process
const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId,
    }
  }
});

const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
recorder.start();
// ... later
recorder.stop(); // Saves webm file
```

**Pros:** Real video recording with timestamps
**Cons:** Complex setup, requires permissions, heavy files

### Recommendation for Showtime

Use **Playwright's built-in screenshot/video** for testing. Do not use Electron's own APIs for test capture — Playwright already handles this through CDP (Chrome DevTools Protocol) and it integrates cleanly with the test lifecycle.

Use `webContents.capturePage()` only if you want to add an in-app "screenshot for bug report" feature later.

---

## 7. Comparison Table — All Approaches

| Approach | Type | Cost | Setup Effort | Semantic Understanding | Pixel Precision | Electron Support | Best For |
|----------|------|------|-------------|----------------------|----------------|-----------------|----------|
| **Playwright `toHaveScreenshot()`** | Built-in | Free | Minimal | None | Excellent | Yes (CDP) | Regression catching |
| **Playwright video + ffmpeg + Claude** | DIY | ~$2-12/mo | Medium | Excellent | None (add pixelmatch) | Yes | Semantic UI verification |
| **ZeroStep `ai()`** | Plugin | Free (500/mo) | Low | Good (GPT-based) | None | Yes (Playwright) | Quick AI assertions |
| **Percy** | SaaS | Free (5K/mo) | Low | Good (AI agent) | Yes | Via SDK | Team visual review |
| **Applitools Eyes** | SaaS | $$$ enterprise | Low | Excellent | Yes | Via SDK | Enterprise cross-browser |
| **Chromatic** | SaaS | Free (5K/mo) | Low | Partial | Yes | Storybook only | Component visual testing |
| **BackstopJS** | Open source | Free | Medium | None | Yes | Via Puppeteer | Framework-agnostic regression |
| **Bug0 Studio** | SaaS | $250/mo | Low | Excellent (video) | No | Via Playwright | Video-to-test generation |
| **Momentic** | SaaS | Custom | Low | Good | No | Via browser | AI-powered E2E |
| **Rainforest QA** | Managed | $200/mo+ | Low | Good | No | Via browser | Managed QA with video |
| **OpenCV template matching** | DIY | Free | High | None | Good (template) | Any screenshot | Element presence detection |

---

## 8. Recommended Approach for Showtime

### Tier 1: Implement Now (Zero Cost)

**Enable Playwright visual regression testing.**

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    video: 'retain-on-failure',
    screenshot: 'on',
  },
});
```

Add `toHaveScreenshot()` assertions to existing E2E tests:

```typescript
test('Dark Studio renders correctly', async ({ electronApp }) => {
  const page = await electronApp.firstWindow();
  await expect(page).toHaveScreenshot('dark-studio.png', {
    maxDiffPixelRatio: 0.02
  });
});
```

**Cost:** Free
**Effort:** 1-2 hours to add to existing tests
**Value:** Catches every pixel-level regression automatically

### Tier 2: Implement Soon (Pennies/Month)

**Add Claude Vision semantic analysis as a post-test step.**

1. Take screenshots at each state transition in E2E tests (already doing this for `toHaveScreenshot`)
2. After test run, run `scripts/analyze-screenshots.ts` that sends each screenshot to Claude with Showtime-specific prompts
3. Generate a markdown report with pass/fail and AI observations
4. Optionally fail CI if Claude detects issues

```bash
# In CI pipeline
npm run test:e2e                    # Playwright E2E with screenshots
node scripts/analyze-screenshots.ts  # Claude vision analysis
```

**Cost:** ~$2-5/month
**Effort:** Half a day to build the script
**Value:** Catches semantic issues pixel-diff misses (wrong text, broken theme, missing elements, layout intent violations)

### Tier 3: Consider Later

**Add ZeroStep for inline AI assertions** if the DIY approach feels too manual. 500 free calls/month is enough for a solo project. Or adopt **Percy** if you start collaborating with designers who want a visual review dashboard.

### Why NOT the Paid Services

For a solo developer building a macOS Electron app:

- **Applitools ($500+/mo):** Overkill. Designed for teams testing across 10 browsers.
- **Bug0 ($250/mo):** Cool tech, but you already have Playwright tests. You're paying for test generation you don't need.
- **QA Wolf ($5K/mo):** Managed QA service. Not relevant for a solo project.
- **Testim ($30K+/yr):** Enterprise procurement product.

### The Verdict

**The DIY Claude Vision approach is not only viable — it is the best option for Showtime.**

Reasons:
1. **Cost:** ~$2-5/month vs. $150-500+/month for paid services
2. **Domain specificity:** Only Claude can be prompted with "Is this showing a proper SNL-themed Dark Studio?" Paid services do generic visual diff.
3. **Flexibility:** You control the prompts, the analysis pipeline, and the reporting format
4. **Already integrated:** Showtime is an Anthropic-ecosystem project using Claude Code. Adding Claude API calls for visual QA is natural
5. **Combines with pixelmatch:** Use Playwright's `toHaveScreenshot()` for pixel regression AND Claude for semantic analysis. This is strictly better than either approach alone
6. **Copy/text verification:** Claude can read and verify every string on screen. No visual diff tool does this well.

The combination of **Playwright screenshots + pixelmatch regression + Claude Vision semantic analysis** gives you testing capabilities that rival or exceed Applitools Eyes at 1/100th the cost.

---

## Appendix: Useful Commands

```bash
# Extract frames from Playwright video recording
ffmpeg -i test-results/video.webm -r 2 -q:v 2 frames/frame_%04d.png

# Extract frames at 1fps (fewer frames)
ffmpeg -i test-results/video.webm -vf fps=1 frames/frame_%04d.png

# Convert webm to mp4 for easier viewing
ffmpeg -i test-results/video.webm -c:v libx264 output.mp4

# Extract keyframes only (scene changes)
ffmpeg -i test-results/video.webm -vf "select=gt(scene\,0.3)" -vsync vfr frames/scene_%04d.png
```

## Appendix: Sources

- [Playwright Videos Documentation](https://playwright.dev/docs/videos)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Claude Vision API Documentation](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Electron desktopCapturer API](https://www.electronjs.org/docs/api/desktop-capturer)
- [Applitools Eyes Platform](https://applitools.com/platform/eyes/)
- [Percy Visual Testing](https://www.browserstack.com/percy)
- [Chromatic Pricing](https://www.chromatic.com/pricing)
- [ZeroStep AI for Playwright](https://zerostep.com/)
- [Bug0 Studio](https://bug0.com/studio)
- [Momentic AI Testing](https://momentic.ai/)
- [Rainforest QA](https://www.g2.com/products/rainforest-rainforest-qa/reviews)
- [ffmpeg-analyse-video-skill (Claude Code Skill)](https://github.com/fabriqaai/ffmpeg-analyse-video-skill)
- [AI Experiment: Video to Test Cases](https://www.testmanagement.com/blog/2025/10/ai-experiment-1-recording-videos-and-converting-them-to-test-cases/)
- [Visual Regression Testing Tools 2026](https://bug0.com/knowledge-base/visual-regression-testing-tools)
- [Best Generative AI Testing Tools 2026](https://hashnode.com/blog/best-generative-ai-testing-tools-2026)
- [Playwright AI Ecosystem 2026](https://testdino.com/blog/playwright-ai-ecosystem/)
- [Testing Electron Apps with Playwright](https://playwright.dev/docs/api/class-electron)
- [BackstopJS](https://github.com/garris/BackstopJS)
- [OpenCV Template Matching for UI Testing](https://medium.com/@lindaliuAus/visual-ui-verification-using-opencv-and-skimage-ai-3a8d8c97e04c)
