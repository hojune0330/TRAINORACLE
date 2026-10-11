import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const base = process.env.GOAL_PROGRAM_LOCAL_URL ?? 'http://127.0.0.1:4176'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local synthetic checks only')
const output = new URL('../.codex-calendar-visual-qa/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(30_000)
  await page.goto(`${base}/?app=1&uitest=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByRole('button', { name: '훈련 계획 만들기', exact: true }).click()
  await page.getByRole('button', { name: '10km 한 달 훈련표', exact: true }).click()
  await page.getByRole('button', { name: '45분 목표', exact: true }).click()
  await page.getByRole('button', { name: '훈련표 보기', exact: true }).click()
  await page.getByRole('button', { name: '훈련 계획에 맞춰 달려 본 경험이 있어요', exact: true }).click()
  await page.getByRole('button', { name: /목표 속도로 연습/ }).click()
  await page.getByRole('heading', { name: '10km 45분 목표', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('trainoracle.goal-training-program.v1')), null)
  assert.equal(await page.getByRole('list', { name: '날짜별 계획 미리보기', exact: true }).locator(':scope > li').count(), 29)
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: '목록', exact: true }).click()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `List overflow at ${width}`)
    await page.screenshot({ path: fileURLToPath(new URL(`program-list-${width}.png`, output)), fullPage: true })
    await page.getByRole('button', { name: '달력', exact: true }).click()
    await page.getByRole('region', { name: '한 달 훈련표 · 9.5일 × 3', exact: true }).scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Calendar overflow at ${width}`)
    await page.screenshot({ path: fileURLToPath(new URL(`program-calendar-${width}.png`, output)), fullPage: true })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  const durationCheck = page.getByRole('checkbox', { name: /^최대 .* 훈련시간을 확인했어요$/ })
  if (await durationCheck.count()) {
    assert.equal(await page.getByRole('button', { name: '이 계획 시작', exact: true }).isDisabled(), true)
    await durationCheck.check()
  }
  await page.getByRole('button', { name: '이 계획 시작', exact: true }).click()
  await page.getByRole('button', { name: '통증 없고 평소와 같아요 · 시작', exact: true }).click()
  await page.getByRole('button', { name: '이번 9.5일 보기·수정', exact: true }).waitFor()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.goal-training-program.v1')))
  assert.equal(saved.program.days.length, 29)
  assert.equal(saved.program.frames.length, 3)
  assert.equal(saved.application.currentCycleIndex, 1)
  assert.equal(saved.program.inputs.goalPaceConfirmed, true)
  await page.screenshot({ path: fileURLToPath(new URL('program-saved-375.png', output)), fullPage: true })
  await page.getByRole('button', { name: '이번 9.5일 보기·수정', exact: true }).click()
  await page.getByRole('button', { name: '10km 한 달 훈련표', exact: true }).click()
  await page.getByRole('button', { name: '이번 9.5일 보기·수정', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '2차 훈련 시작', exact: true }).count(), 0)
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.goal-training-program.v1')))
  assert.equal(reloaded.program.programId, saved.program.programId)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.getByRole('button', { name: '목록', exact: true }).click()
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('.goal-program *')].map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }))
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`
  })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large-text overflow at 320')
  const activeAction = page.getByRole('button', { name: '이번 9.5일 보기·수정', exact: true })
  await activeAction.scrollIntoViewIfNeeded()
  assert.ok((await activeAction.boundingBox()).height >= 44)
  await page.screenshot({ path: fileURLToPath(new URL('program-large-text-320.png', output)), fullPage: true })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ result: 'passed', widths: [320, 375, 1280], days: 29, cycles: 3,
    checks: ['no preview writes', 'local save/apply', 'existing active view round trip', 'next-cycle lock', 'no horizontal overflow', '200% synthetic text at 320', 'no page errors'] }))
  await context.close()
} finally { await browser.close() }
