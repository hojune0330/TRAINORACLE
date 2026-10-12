import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto('http://127.0.0.1:4477/e2e/fixtures/scroll-alignment.html')
  await page.getByRole('button', { name: '5000m', exact: true }).waitFor()
  // Freeze timer progress so browser input latency cannot hide a delayed reset.
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.locator('#next').click()
  await page.clock.runFor(20)
  const region = page.locator('.app-scroll-region')
  await region.evaluate(element => {
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 50 }))
    element.scrollTop = 150
  })
  await page.clock.runFor(300)
  assert.equal(await region.evaluate(element => element.scrollTop), 150)
  await page.getByRole('textbox', { name: 'Memo', exact: true }).fill('Keep this position')
  const beforeTyping = await region.evaluate(element => element.scrollTop)
  await page.clock.runFor(300)
  assert.equal(await region.evaluate(element => element.scrollTop), beforeTyping)
  await page.clock.resume()
  await page.getByRole('button', { name: '5000m', exact: true }).click()
  await page.getByRole('textbox', { name: '최고기록', exact: true }).fill('20:30')
  await page.getByRole('button', { name: '나의 러닝 풀이 보기', exact: true }).click()
  for (const width of [320, 375, 1024]) {
    await page.setViewportSize({ width, height: 812 })
    await page.getByRole('button', { name: '기록 요약', exact: true }).click()
    // Programmatic click isolates application scrolling from Playwright's own scroll-to-click.
    await page.evaluate(() => window.scrollTo(0, 60))
    const outer = await page.evaluate(() => window.scrollY)
    await page.getByRole('button', { name: '400m 평균', exact: true }).evaluate(button => button.click())
    await page.waitForFunction(() => {
      const region = document.querySelector('.app-scroll-region').getBoundingClientRect()
      const body = document.querySelector('.record-reading__body').getBoundingClientRect()
      return Math.abs(body.top - region.top) < 2
    })
    assert.equal(await page.evaluate(() => window.scrollY), outer)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  }
  await mkdir('test-results/scroll-alignment', { recursive: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({ path: 'test-results/scroll-alignment/oracle-375.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS: gesture cancels settle, typing stays still, chapters align only inside app at 320/375/1024.')
} finally {
  await browser.close()
}
