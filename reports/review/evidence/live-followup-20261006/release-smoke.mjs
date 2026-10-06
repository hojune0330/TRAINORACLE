import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
const require = createRequire(resolve(process.cwd(), 'package.json'))
const { chromium, expect } = require('@playwright/test')
const base = process.env.LIVE_BASE || 'https://hojune0330.github.io/TRAINORACLE/'
const out = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 320, height: 740 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort())
const page = await context.newPage()
const report = { source: null, checks: [], errors: [] }
page.on('pageerror', error => report.errors.push(error.message))
page.setDefaultTimeout(10000)
try {
  await page.goto(base + '?app=1')
  if (base.startsWith('https:')) {
    const manifest = await (await context.request.get(base + 'trainoracle-build-manifest.json')).json()
    const receipt = await (await context.request.get(base + 'trainoracle-deploy-receipt.json')).json()
    expect(manifest.sourceSha).toBe(receipt.sourceSha)
    expect(manifest.accountHeld).toBe(true)
    expect(manifest.previewOnly).toBe(false)
    report.source = manifest.sourceSha
    report.checks.push('live manifest and receipt agree; account hold retained')
  }
  const example = page.getByRole('button', { name: /오라클 결과 예시 보기/ })
  await expect(example).toHaveAttribute('aria-expanded', 'false')
  await example.focus()
  await page.keyboard.press('Enter')
  await expect(example).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Space')
  await expect(example).toHaveAttribute('aria-expanded', 'false')
  report.checks.push('home optional feature is discoverable by button role; Enter and Space work')
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '오라클', exact: true }).click()
  await page.getByRole('button', { name: /페이스 계산/ }).click()
  await page.getByRole('button', { name: '1500m', exact: true }).click()
  await page.getByRole('textbox', { name: '분', exact: true }).fill('5')
  await page.getByRole('textbox', { name: '초', exact: true }).fill('10')
  await page.getByRole('button', { name: '페이스 보기' }).click()
  await page.getByRole('button', { name: '계산 근거', exact: true }).click()
  await expect(page.getByText('1:22.7', { exact: true })).toBeVisible()
  const precise = page.getByText('310초 × 400m ÷ 1500m = 82.66666666666667초', { exact: true })
  await expect(precise).not.toBeVisible()
  await page.screenshot({ path: resolve(out, 'release-pace-easy.png') })
  await page.getByText('계산식·정밀한 값', { exact: true }).click()
  await expect(precise).toBeVisible()
  await page.getByRole('button', { name: '이전 화면' }).click()
  await expect(page.getByRole('heading', { name: '내 기록으로 페이스 계산' })).toBeVisible()
  report.checks.push('pace reason shows representative time; exact value retained; Back returns to result')
  await page.goto(base + '?app=1')
  await page.getByRole('button', { name: /더보기/, exact: false }).click()
  await page.getByRole('button', { name: /최고기록으로 풀이하기/ }).click()
  await page.getByRole('button', { name: '1500m', exact: true }).click()
  await page.getByRole('textbox', { name: '최고기록' }).fill('5:10')
  await page.getByRole('button', { name: '나의 러닝 풀이 보기' }).click()
  await page.getByRole('button', { name: '친구와 러닝 궁합 보기' }).click()
  await page.getByRole('button', { name: '1500m', exact: true }).click()
  await page.getByRole('textbox', { name: '최고기록' }).fill('6:00')
  const compare = page.getByRole('button', { name: '친구 기록과 비교하기' })
  await expect(compare).toBeDisabled()
  await expect(page.getByText('동의를 확인하면 풀이를 볼 수 있어요.')).toBeVisible()
  await page.getByRole('checkbox', { name: '친구가 이 기록의 풀이와 비교에 동의했어요.' }).check()
  await expect(compare).toBeEnabled()
  await compare.click()
  await expect(page.getByRole('heading', { name: '같은 거리, 서로 다른 리듬' })).toBeVisible()
  await expect(page.getByText(/차이는 50초예요/)).toBeVisible()
  await page.screenshot({ path: resolve(out, 'release-friend-comparison.png') })
  await page.getByRole('button', { name: '풀이 닫기' }).click()
  await page.getByRole('button', { name: /최고기록으로 풀이하기/ }).click()
  await expect(page.getByRole('heading', { name: '어떤 기록을 풀어볼까요?' })).toBeVisible()
  await page.getByRole('button', { name: '1500m', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '최고기록' })).toHaveValue('')
  report.checks.push('synthetic consent enables comparison; closes to origin; reopened input is empty')
  await page.evaluate(() => localStorage.setItem('trainoracle.journal.v1', JSON.stringify([{
    id: 'synthetic-two-exercises', kind: 'post-session', date: '2026-09-20',
    savedAt: '2026-09-20T09:00:00.000Z', syncState: 'local', system: '', title: 'Two exercises',
    distanceKm: '', durationMin: '', avgPace: '', rpe: 0, memo: '',
    exerciseLog: { version: 1, source: 'SELF_REPORTED', components: [
      { id: 'run', kind: 'RUNNING', name: '달리기', rows: [{ id: 'run-row', distanceM: 1000, durationSeconds: 360 }] },
      { id: 'squat', kind: 'STRENGTH', name: '스쿼트', rows: [{ id: 'squat-row', repetitions: 8, sets: 2 }] },
    ] },
  }])))
  await page.goto(base + '?app=1')
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '일지', exact: true }).click()
  const calendar = page.getByRole('button', { name: '내 달력', exact: true })
  if (await calendar.count()) await calendar.click()
  await page.locator('button[data-date="2026-09-20"]').click()
  await page.getByRole('button', { name: '일지·메모 원문 열기' }).click()
  const journalCard = page.locator('.journal-entry-card--session')
  await expect(journalCard).toContainText('1000m · 360초')
  await expect(journalCard).toContainText('8회 × 2세트')
  await expect(journalCard.locator('.journal-entry-metrics')).toHaveCount(0)
  await page.screenshot({ path: resolve(out, 'release-journal-compact.png') })
  report.checks.push('seeded synthetic exercise rows read in original journal without empty aggregate cells; no aggregate pace invented')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(report.errors).toEqual([])
  report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'
  report.failure = error.message
  await page.screenshot({ path: resolve(out, 'release-smoke-failure.png') }).catch(() => {})
} finally {
  await context.close()
  await browser.close()
  writeFileSync(resolve(out, 'release-smoke.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
}
if (report.status !== 'PASS') process.exitCode = 1
