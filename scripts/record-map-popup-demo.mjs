/**
 * Records a short WebM of map zoom + pan + auto-popups.
 * Requires: `npm run dev` (or preview) on DEMO_BASE_URL. Sets `localStorage.ucamDebugMap=1` so `window.__ucamMap` is exposed.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const baseURL = process.env.DEMO_BASE_URL || 'http://127.0.0.1:4173'
const outDir = process.env.DEMO_VIDEO_DIR || '/opt/cursor/artifacts'

fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: process.env.PLAYWRIGHT_HEADED !== '1',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
})

const page = await context.newPage()

await page.addInitScript(() => {
  window.localStorage.setItem('ucamDebugMap', '1')
})

const url = new URL('/', baseURL)
url.searchParams.set('view', 'map')

await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 })

await page.waitForFunction(
  () => {
    const splash = document.getElementById('splashScreen')
    if (!splash) {
      return true
    }
    const style = window.getComputedStyle(splash)
    return style.display === 'none' || style.opacity === '0'
  },
  { timeout: 90_000 },
)

await page.waitForFunction(() => typeof window.__ucamMap !== 'undefined', { timeout: 90_000 })

await page.waitForTimeout(2000)

await page.evaluate(() => {
  const map = window.__ucamMap
  if (!map) {
    throw new Error('__ucamMap missing')
  }
  map.easeTo({
    center: [-111.9, 40.35],
    zoom: 11.2,
    duration: 4500,
  })
})

await page.waitForTimeout(4800)

await page.locator('[class*="popupThumb"]').first().waitFor({ state: 'visible', timeout: 60_000 })
await page.waitForTimeout(2000)

for (let i = 0; i < 4; i++) {
  const dx = (i % 2 === 0 ? 1 : -1) * 220
  const dy = (i < 2 ? 1 : -1) * 140
  await page.evaluate(({ dx, dy }) => window.__ucamMap?.panBy([dx, dy], { animate: true }), { dx, dy })
  await page.waitForTimeout(1600)
}

await page.waitForTimeout(2000)
await context.close()
await browser.close()

const files = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => ({ f, t: fs.statSync(path.join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)

const latest = files[0]?.f
if (latest) {
  const dest = path.join(outDir, 'map-popup-demo.webm')
  fs.renameSync(path.join(outDir, latest), dest)
  console.log(dest)
} else {
  console.error('No webm found in', outDir)
  process.exit(1)
}
