import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:4176'
const output = new URL('../.codex-calendar-visual-qa/body-asset-ux-20261012/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const observations = [], errors = []
const nav = (page, name) => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
const openContext = async (width, imageFailure = false) => {
  const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin !== base || imageFailure && url.pathname.endsWith('body-check-guide-v1.webp') ? route.abort() : route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/?app=1&uitest=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.home-hub').waitFor()
  return { page, context }
}
const capture = async (page, name) => {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true })
  const evidence = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    mainOverflow: document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(e => e.checkVisibility()).map(e => e.textContent),
  }))
  assert.equal(evidence.horizontalOverflow, false, name)
  assert.equal(evidence.mainOverflow, false, name)
  observations.push({ name, ...evidence })
}
const condition = async page => {
  await nav(page, '기록하기').click()
  await page.getByTestId('entry-choice-evening').click()
  await page.getByRole('button', { name: '몸 상태·기분', exact: true }).click()
}
const contentPosition = locator => locator.evaluate(element => {
  let scroll = 0
  for (let parent = element.parentElement; parent; parent = parent.parentElement) scroll += parent.scrollTop
  const box = element.getBoundingClientRect()
  return { x: box.x, y: box.y + scroll }
})

try {
  for (const width of [320, 375, 1280]) {
    const { page, context } = await openContext(width)
    await page.getByRole('button', { name: '훈련량·변화 보기', exact: true }).click()
    await page.getByRole('heading', { name: '누적 거리와 변화', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '훈련량', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByRole('group', { name: '주간 비교 기간', exact: true }).count(), 0)
    await capture(page, `empty-distance-${width}`)
    await page.getByRole('button', { name: '훈련 요약', exact: true }).click()
    const lens = page.locator('img[src$="analysis-lens-v2.webp"]')
    await lens.waitFor()
    await lens.evaluate(img => img.decode())
    await capture(page, `oracle-start-${width}`)
    await condition(page)
    const guide = page.locator('img[src$="body-check-guide-v1.webp"]')
    await guide.waitFor()
    await guide.evaluate(img => img.decode())
    await capture(page, `body-start-${width}`)
    const knee = page.getByRole('button', { name: '오른 무릎', exact: true })
    await knee.scrollIntoViewIfNeeded()
    const before = await contentPosition(knee)
    await knee.click()
    const after = await contentPosition(knee)
    assert.ok(Math.abs(after.y - before.y) <= 1 && Math.abs(after.x - before.x) <= 1, `body button moved at ${width}`)
    const levels = page.getByRole('group', { name: '오른 무릎 통증 정도' })
    const targets = await levels.getByRole('button').evaluateAll(buttons => buttons.map(button => ({ name: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })))
    assert.ok(targets.every(target => target.width >= 44 && target.height >= 44), `pain target too small at ${width}: ${JSON.stringify(targets)}`)
    await page.getByRole('button', { name: '오른 무릎 통증 4단계', exact: true }).click()
    await capture(page, `body-selected-${width}`)
    observations.push({ name: `body-controls-${width}`, before, after, targets, guide: await guide.evaluate(img => ({ width: img.clientWidth, height: img.clientHeight, naturalWidth: img.naturalWidth })) })
    await context.close()
  }


  const large = await openContext(320)
  await condition(large.page)
  await large.page.getByRole('button', { name: '오른 무릎', exact: true }).click()
  await large.page.evaluate(() => {
    const sizes = [...document.querySelectorAll('h1,h2,h3,p,button,small,span,summary,label')]
      .map(element => [element, parseFloat(getComputedStyle(element).fontSize)])
    for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
  })
  const largeTargets = await large.page.locator('.body-pain-selector__level-picker button, [aria-label="오늘 감정"] button').evaluateAll(buttons =>
    buttons.map(button => ({ name: button.textContent, width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height, wraps: getComputedStyle(button).whiteSpace !== 'nowrap',
      overflow: button.scrollWidth > button.clientWidth })))
  assert.ok(largeTargets.every(button => button.width >= 44 && button.height >= 44 && !button.wraps && !button.overflow))
  await large.page.getByRole('button', { name: '오른 무릎 통증 해제', exact: true }).scrollIntoViewIfNeeded()
  await capture(large.page, 'body-large-text-320')
  observations.push({ name: 'large-text-controls', targets: largeTargets })
  await large.context.close()

  const { page, context } = await openContext(375)
  await nav(page, '기록하기').click()
  await page.getByTestId('entry-choice-evening').click()
  await page.getByRole('button', { name: '수면', exact: true }).click()
  const hours = page.getByRole('textbox', { name: '수면 시간', exact: true })
  assert.equal(await hours.inputValue(), '')
  await hours.fill('25')
  await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
  assert.equal(await hours.getAttribute('aria-invalid'), 'true')
  await hours.fill('2.5')
  await capture(page, 'sleep-input-375')
  await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
  await page.getByRole('button', { name: /^저장/ }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('trainoracle.journal.v1') ?? '[]').some(entry => entry.kind === 'evening'))
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.journal.v1')))
  assert.equal(saved[0].sleepH, 2.5)
  observations.push({ name: 'sleep-synthetic-save', sleepH: saved[0].sleepH, provenance: saved[0].fieldProvenance.sleepH.provenance })
  await context.close()

  const missing = await openContext(320, true)
  await condition(missing.page)
  await missing.page.getByRole('button', { name: '오른 무릎', exact: true }).click()
  await missing.page.getByRole('button', { name: '오른 무릎 통증 2단계', exact: true }).click()
  assert.equal(await missing.page.getByRole('button', { name: '오른 무릎 통증 2단계', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await missing.page.locator('img[src$="body-check-guide-v1.webp"]').isVisible(), false)
  await capture(missing.page, 'body-image-unavailable-320')
  await missing.context.close()

  const calendar = await openContext(375)
  await nav(calendar.page, '일지').click()
  const previous = calendar.page.getByRole('button', { name: '이전 달', exact: true })
  await previous.waitFor()
  const grid = calendar.page.getByRole('grid')
  const original = await grid.getAttribute('aria-label')
  const target = await previous.boundingBox()
  assert.ok(target.width >= 44 && target.height >= 44)
  await previous.click()
  assert.notEqual(await grid.getAttribute('aria-label'), original)
  await calendar.page.getByRole('button', { name: '다음 달', exact: true }).click()
  assert.equal(await grid.getAttribute('aria-label'), original)
  await capture(calendar.page, 'calendar-arrows-375')
  await calendar.context.close()

  const plan = await openContext(375)
  await plan.page.evaluate(async () => {
    const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
    const { savePlanBetaState } = await import('/src/domain/plan-beta-store.ts')
    const state = stateFixture()
    state.intake.startDate = '2026-10-01'
    state.progress = [{ sessionDay: 1, sessionSlot: 'AM', state: 'COMPLETED' }]
    if (!savePlanBetaState(state).ok) throw new Error('Synthetic plan fixture failed')
  })
  await plan.page.reload()
  await nav(plan.page, '오라클').click()
  await plan.page.getByRole('button', { name: '훈련표 보기', exact: true }).waitFor()
  assert.equal(await plan.page.locator('.trends-hub__result-layout').count(), 0)
  await capture(plan.page, 'oracle-plan-only-375')
  await plan.context.close()
  assert.deepEqual(errors, [])
  await writeFile(new URL('observations.json', output), JSON.stringify({ baseSource: '6d347d16', mode: 'LOCAL_SYNTHETIC_IMPLEMENTATION_CHECK', observations, pageErrors: errors }, null, 2))
  console.log(JSON.stringify({ captures: observations.filter(item => item.horizontalOverflow !== undefined).length, observations: observations.length, pageErrors: errors.length }))
} finally { await browser.close() }
