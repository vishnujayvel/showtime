/**
 * Evidence capture — drives the app through real UI interactions and screenshots each state.
 * Run: node e2e/capture-evidence.mjs
 */
import { _electron as electron } from 'playwright'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const ssDir = path.join(rootDir, 'e2e', 'screenshots')

async function main() {
  console.log('Launching Showtime...')
  const userDataDir = path.join(os.tmpdir(), 'showtime-evidence-' + Date.now())

  const app = await electron.launch({
    args: [path.join(rootDir, 'dist', 'main', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test', SHOWTIME_USER_DATA: userDataDir },
    timeout: 30000,
  })

  const page = await app.firstWindow()
  await page.waitForSelector('#root > *', { timeout: 15000 }).catch(() => {})
  await page.evaluate(() => localStorage.setItem('showtime-onboarding-complete', 'true'))
  await page.reload()
  await page.waitForTimeout(2000)

  // Resize window for consistent screenshots
  const bw = await app.browserWindow(page)
  await bw.evaluate(win => win.setSize(560, 680))
  await page.waitForTimeout(500)

  // 1. Dark Studio
  console.log('1. Dark Studio...')
  await page.screenshot({ path: `${ssDir}/evidence-dark-studio.png` })

  // 2. Enter Writer's Room
  console.log('2. Writer\'s Room...')
  const enterBtn = page.getByText("Enter the Writer's Room")
  if (await enterBtn.isVisible()) {
    await enterBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${ssDir}/evidence-writers-room.png` })
  }

  // 3. Select energy
  console.log('3. Energy selection...')
  const energyBadge = page.locator('[data-testid="energy-badge"], button:has-text("Medium"), button:has-text("High")')
  if (await energyBadge.first().isVisible().catch(() => false)) {
    await energyBadge.first().click()
    await page.waitForTimeout(500)
    // Click "Medium" in dropdown
    const medium = page.getByText('Medium', { exact: true })
    if (await medium.isVisible().catch(() => false)) {
      await medium.click()
      await page.waitForTimeout(1000)
    }
  }
  await page.screenshot({ path: `${ssDir}/evidence-energy-selected.png` })

  // 4. Type a plan and build lineup
  console.log('4. Building lineup...')
  const input = page.locator('input[placeholder*="accomplish"], textarea[placeholder*="accomplish"]')
  if (await input.isVisible().catch(() => false)) {
    await input.fill('Deep work on XState, walk with Steven, tea time with Aseem')
    await page.screenshot({ path: `${ssDir}/evidence-plan-input.png` })
    // Click BUILD MY LINEUP
    const buildBtn = page.getByText('BUILD MY LINEUP')
    if (await buildBtn.isVisible().catch(() => false)) {
      await buildBtn.click()
      await page.waitForTimeout(5000) // Wait for Claude to generate lineup
      await page.screenshot({ path: `${ssDir}/evidence-lineup-built.png` })
    }
  }

  // 5. Check for lineup with reorder controls (#132)
  console.log('5. Checking lineup reorder controls...')
  const upBtn = page.locator('[data-testid="reorder-up"], button:has-text("↑"), [aria-label*="move up"]')
  if (await upBtn.first().isVisible().catch(() => false)) {
    await page.screenshot({ path: `${ssDir}/evidence-132-reorder-controls.png` })
    console.log('   Reorder controls visible!')
  } else {
    console.log('   No reorder controls found (lineup may not have loaded)')
  }

  // 6. Minimize to pill view to test #131 fallback
  console.log('6. Testing pill view...')
  await bw.evaluate(win => win.setSize(320, 64))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${ssDir}/evidence-131-pill-writers-room.png` })

  // 7. Back to expanded
  await bw.evaluate(win => win.setSize(560, 680))
  await page.waitForTimeout(1000)

  console.log('\nAll evidence screenshots captured!')
  console.log(`Screenshots saved to: ${ssDir}/`)
  await app.close().catch(() => {})
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
