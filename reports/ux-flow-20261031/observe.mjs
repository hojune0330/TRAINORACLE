import { chromium } from '../../app/node_modules/playwright-core/index.mjs'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const phase = process.argv[2] ?? 'before'
const directory = fileURLToPath(new URL(`./${phase}/`, import.meta.url))
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 320, height: 812 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const writes = []
page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()) })
await page.goto('http://127.0.0.1:5183/?app=1')
await page.getByRole('button', { name: '내 기록 분석', exact: true }).click()
await page.getByRole('group', { name: '결과 종류' }).waitFor()
const analysisMode = await page.getByRole('group', { name: '결과 종류' }).getByRole('button', { name: '내 기록', exact: true }).getAttribute('aria-pressed')
await page.screenshot({ path: `${directory}analysis-320.png` })
await page.goto('http://127.0.0.1:5183/?app=1')
await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '기록하기', exact: true }).click()
await page.getByTestId('open-import').click()
const input = JSON.stringify([
  { date: '2026-10-16', sport: 'running', name: '합성 운동', distanceKm: '2', durationMin: '10' },
  { date: '2026-10-16', sport: 'running', name: '합성 운동', distanceKm: '3', durationMin: '15' },
])
await page.getByLabel('가져올 운동 파일 선택', { exact: true }).setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(input) })
await page.getByTestId('import-draft-row').nth(1).waitFor()
const measurements = []
for (const width of [320, 375, 430]) {
  await page.setViewportSize({ width, height: 812 })
  const row = page.getByTestId('import-draft-row').first()
  const second = page.getByTestId('import-draft-row').nth(1)
  const before = await row.boundingBox()
  const secondBefore = await second.boundingBox()
  await row.getByRole('checkbox').uncheck()
  const after = await row.boundingBox()
  const secondAfter = await second.boundingBox()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  measurements.push({ width, selectedHeight: before.height, unselectedHeight: after.height,
    followingRowMovement: secondAfter.y - secondBefore.y, overflow })
  await page.screenshot({ path: `${directory}review-${width}.png` })
  await row.getByRole('checkbox').check()
}
const journalBefore = await page.evaluate(() => localStorage.getItem('to-local-journal.journal.v2'))
await writeFile(`${directory}observations.json`, JSON.stringify({ analysisMode, measurements, journalBefore, writes }, null, 2))
console.log(JSON.stringify({ phase, analysisMode, measurements, journalBefore, writes }))
await browser.close()
