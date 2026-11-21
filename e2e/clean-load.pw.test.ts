import { expect, test } from '@playwright/test'

// The site is served on hub, market and skills.hanzo.bot, none of which is Vercel: a
// page that asks for /_vercel/… gets the app's HTML back for a script (a 404 and a
// refused MIME type in the console on every visit). A page load asks for nothing
// the host does not have and logs no error.
//
//   PLAYWRIGHT_BASE_URL=https://market.hanzo.bot bunx playwright test e2e/clean-load.pw.test.ts

for (const route of ['/', '/skills', '/personas']) {
  for (const width of [390, 1440]) {
    test(`${route} at ${width}px loads with no failed request and no console error`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const failed: string[] = []
      const errors: string[] = []
      page.on('response', (r) => {
        if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url()}`)
      })
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      page.on('pageerror', (e) => errors.push(e.message))

      await page.goto(route, { waitUntil: 'load' })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)

      expect(failed.filter((f) => f.includes('/_vercel/')), failed.join('\n')).toEqual([])
      expect(errors, errors.join('\n')).toEqual([])
    })
  }
}
