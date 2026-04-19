import { expect, test } from '@playwright/test'

test.describe('mobile preview smoke', () => {
  test('loads the app shell in a mobile viewport', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/UDOT Cameras/)

    await page.waitForSelector('.header-chrome, #imageGallery, .app-empty-state', {
      timeout: 15_000,
    })

    await page.waitForFunction(() => {
      const splash = document.getElementById('splashScreen')
      if (!splash) {
        return true
      }

      const style = window.getComputedStyle(splash)
      return style.display === 'none' || style.opacity === '0'
    })

    await expect(page.locator('.header-chrome')).toBeVisible()
  })
})