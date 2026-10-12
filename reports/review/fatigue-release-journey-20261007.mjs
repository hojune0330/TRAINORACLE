import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'app/package.json'))
const { chromium, expect } = require('@playwright/test')
const base = process.argv[2] ?? 'http://127.0.0.1:4467/'
const output = path.join(root, 'reports/review/evidence/fatigue-release-20261007', base.includes('github.io') ? 'public' : 'local')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const width of [375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    const button = name => page.getByRole('button', { name, exact: typeof name === 'string' })
    const tab = name => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
    const capture = async name => {
      await page.evaluate(async () => { await document.fonts.ready })
      const dimensions = await page.evaluate(() => {
        const main = document.querySelector('.app-scroll-region')
        return { width: innerWidth, contentWidth: document.documentElement.scrollWidth, height: main?.scrollHeight, viewport: main?.clientHeight }
      })
      expect(dimensions.contentWidth).toBeLessThanOrEqual(width)
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`) })
      results.push({ name, ...dimensions })
    }
    try {
      await page.goto(`${base}?app=1&uitest=1`, { waitUntil: 'domcontentloaded' })
      await tab('홈').click()
      await capture('home')
      await tab('훈련').click()
      await button('800m').click()
      await button('내 기록').click()
      await page.getByLabel('분', { exact: true }).fill('2')
      await page.getByLabel('초', { exact: true }).fill('8.3')
      await page.getByText('기록 관리·훈련표 읽기', { exact: true }).click()
      await button('훈련표 표기 읽기').click()
      await capture('notation-help')
      await button('계획 시작으로 돌아가기').click()
      await expect(page.getByLabel('초', { exact: true })).toHaveValue('8.3')
      await button('내 경기 기록').click()
      await capture('record-manager')
      await button('계획으로').click()
      await expect(page.getByLabel('초', { exact: true })).toHaveValue('8.3')
      await button('기준 다시 선택').click()
      await button('기록 없이').click()
      await button(/훈련 계획에 맞춰 달려 본 경험/u).click()
      await capture('plan-question')
      await button(/^3일/u).click()
      await button(/통증은 없고 몸 상태는 평소와 같아요/u).click()
      await capture('candidate')
      await button('이 일정으로 시작').click()
      await capture('active')
      await page.locator('button[data-date]').filter({ hasText: '오전' }).first().click()
      await capture('day')
      await button('이 훈련 일지 쓰기').click()
      await button('계획대로 마쳤어요').click()
      await button('오전').click()
      await button(/^힘든 정도 6\/10/u).click()
      await button('없어요').click()
      await page.getByRole('checkbox', { name: '계획에도 완료 표시 남기기' }).check()
      await capture('journal-confirm')
      await button('저장하고 계획에 완료 표시').click()
      await expect(page.getByText('일지의 결과를 계획에도 반영했어요.')).toBeVisible()
      await capture('saved')
      await button('완료').click()
      await button('달력으로 돌아가기').click()
      await tab('오라클').click()
      await expect(page.getByText('최근 8주 훈련 일지 1건을 남겼어요.')).toBeVisible()
      const effort = await page.getByRole('heading', { name: '힘든 정도 6/10' }).boundingBox()
      expect(effort.width).toBeGreaterThan(200)
      expect(effort.height).toBeLessThan(80)
      await capture('oracle-after-log')
      await tab('홈').click()
      await button('더보기').click()
      await capture('more')
      await button('백업·복원·휴지통').click()
      await button('내려받은 백업 되돌리기').click()
      await button('뒤로').click()
      await expect(page.getByRole('heading', { name: '백업·복원·휴지통' })).toBeVisible()
      await page.goBack()
      await expect(button('백업·복원·휴지통')).toBeVisible()
      expect(errors).toEqual([])
    } catch (error) {
      await capture('failure')
      throw error
    } finally { await context.close() }
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ scope: 'isolated synthetic guest journeys, no account data', results }, null, 2))
  console.log(JSON.stringify({ passed: true, states: results.length, output }))
} finally { await browser.close() }
