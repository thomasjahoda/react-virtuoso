import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

async function scrollToBottom(page: Page, prevScrollY = -1): Promise<void> {
  // Virtuoso renders more items as we scroll, so we need to scroll repeatedly
  // until the scroll position stabilizes at the actual bottom.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(200)
  const scrollY = await page.evaluate(() => window.scrollY)
  if (scrollY !== prevScrollY) {
    return scrollToBottom(page, scrollY)
  }
}

test.describe('window scroll at-bottom detection', () => {
  test.beforeEach(async ({ baseURL, page }) => {
    // Use preview mode so the window is the scroll container
    await page.goto(`${baseURL}/?story=window-at-bottom-detection--example&mode=preview`)
    await page.waitForSelector('[data-storyloaded]')
    await page.waitForTimeout(400)
  })

  test('reports atBottom when scrolled to the bottom of the list', async ({ page }) => {
    await expect(page.locator('[data-testid=at-bottom-state]')).toContainText('away from bottom')

    await scrollToBottom(page)

    await expect(page.locator('[data-testid=at-bottom-state]')).toContainText('state: at bottom')
  })

  test('does not report atBottom when scrolled partway', async ({ page }) => {
    // Scroll to a mid-page position — should not trigger at-bottom
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid=at-bottom-state]')).toContainText('away from bottom')
  })
})
