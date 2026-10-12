import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await mkdir('test-results/date-slider', { recursive: true })
try {
  await page.goto('http://127.0.0.1:4477/e2e/fixtures/plan-date-slider.html')
  const list = page.getByRole('list', { name: '날짜별 계획 미리보기' })
  await page.getByRole('button', { name: '9월 28일 월요일 선택', exact: true }).click()
  assert.equal(await page.locator('.plan-date-rail [aria-pressed="true"] strong').evaluate(element => getComputedStyle(element).animationName), 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  assert.equal(await page.locator('.plan-date-rail [aria-pressed="true"] strong').evaluate(element => getComputedStyle(element).animationName), 'plan-date-pop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const centered = () => page.waitForFunction(() => {
    const rail = document.querySelector('.plan-date-rail').getBoundingClientRect()
    const selected = document.querySelector('.plan-date-rail [aria-pressed="true"]').getBoundingClientRect()
    return Math.abs(selected.left + selected.width / 2 - rail.left - rail.width / 2) < 2
  })
  await centered()
  await page.getByRole('button', { name: '10월 7일 수요일 선택', exact: true }).click()
  await centered()
  await page.getByRole('button', { name: '9월 28일 월요일 선택', exact: true }).click()
  await centered()
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.plan-date-rail [aria-pressed="true"]')?.textContent?.includes('29'))
  await page.waitForFunction(() => {
    const list = document.querySelector('.plan-schedule-preview')
    return list && Math.abs(list.scrollLeft - (list.children[1].offsetLeft - list.children[0].offsetLeft)) < 2
  })
  await page.getByRole('group', { name: '9월 29일 화요일 오전 세션', exact: true }).getByRole('button', { name: '이 훈련 일지 쓰기', exact: true }).click()
  assert.match(await page.locator('#result').textContent(), /2일차 AM/)
  await page.getByRole('button', { name: '9월 29일 화요일 전체 처방 보기', exact: true }).click()
  await page.getByRole('button', { name: '달력으로 돌아가기', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '9월 29일 화요일 선택', exact: true }).getAttribute('aria-pressed'), 'true')
  await list.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('.plan-date-rail [aria-pressed="true"]')?.textContent?.includes('30'))
  // The same native scrolling used by touch must update the selected date.
  await list.dispatchEvent('pointerdown', { pointerType: 'touch' })
  await list.evaluate(element => { element.scrollLeft = element.children[3].offsetLeft - element.children[0].offsetLeft })
  await page.waitForFunction(() => document.querySelector('.plan-date-rail [aria-pressed="true"]')?.getAttribute('aria-label')?.includes('10월 1일'))
  for (const width of [320, 375, 1024]) {
    await page.setViewportSize({ width, height: 812 })
    await centered()
    await page.waitForFunction(() => {
      const list = document.querySelector('.plan-schedule-preview')
      const card = list.querySelector('[data-active-card="true"]')
      return Math.abs(card.getBoundingClientRect().left - list.getBoundingClientRect().left) < 2
    })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `test-results/date-slider/${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 320, height: 812 })
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: 'test-results/date-slider/320-large-text.png', fullPage: true })
  await page.addStyleTag({ content: 'body { min-height: 200vh; } html { font-size: 100% !important; }' })
  await page.evaluate(() => window.scrollTo(0, 60))
  const scrollY = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click()
  await centered()
  assert.equal(await page.evaluate(() => window.scrollY), scrollY)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: '9월 29일 화요일 선택', exact: true }).click()
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click()
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.plan-date-rail [aria-pressed="true"]')?.getAttribute('aria-label')?.includes('10월 1일'))
  await centered()
  assert.deepEqual(errors, [])
  console.log('PASS: date selection, arrows, keyboard, native slide, AM journal action, reader return, 320/375/1024 and enlarged text. No page errors.')
} finally {
  await browser.close()
}
