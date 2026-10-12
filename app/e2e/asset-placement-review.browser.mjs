import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

// Local-only review: no user data, remote calls, account, plan generation or deployment.
const base = 'http://127.0.0.1:4176'
const output = new URL('../.codex-calendar-visual-qa/emoji-placement-20261012/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], errors = []
const nav = (page, name) => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
const open = async (width, missingImage = false) => {
  const context = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin !== base || missingImage && url.pathname.endsWith('body-check-emoji-v1.webp') ? route.abort() : route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/?app=1&uitest=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.home-hub').waitFor()
  return { context, page }
}
const picture = async (page, file, size) => {
  const image = page.locator(`img[src$="${file}"]`)
  await image.waitFor()
  await image.evaluate(img => img.decode())
  const box = await image.boundingBox()
  assert.equal(box.width, size)
  assert.equal(box.height, size)
  assert.equal(await image.getAttribute('alt'), '')
  assert.equal(await image.locator('xpath=ancestor::button').count(), 0)
  return image
}
const capture = async (page, name) => {
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.app-scroll-region')].some(e => e.scrollWidth > e.clientWidth + 1),
  }))
  assert.equal(metrics.overflow, false, name)
  const targets = await page.locator('.body-pain-selector button').evaluateAll(elements => elements.map(e => ({
    label: e.getAttribute('aria-label'), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height,
    overflow: e.scrollWidth > e.clientWidth + 1,
  })))
  assert.ok(targets.every(e => e.width >= 44 && e.height >= 44 && !e.overflow), `${name}: body touch targets`)
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true })
  results.push({ name, ...metrics, targets })
}
const body = async page => {
  await nav(page, '기록하기').click()
  await page.getByTestId('entry-choice-evening').click()
  await page.getByRole('button', { name: '몸 상태·기분', exact: true }).click()
}
try {
  for (const width of [320, 375, 1280]) {
    const { context, page } = await open(width)
    await body(page)
    await picture(page, 'body-check-emoji-v1.webp', 80)
    await capture(page, `body-${width}`)
    const knee = page.getByRole('button', { name: '오른 무릎', exact: true })
    await knee.click()
    assert.equal(await page.getByRole('button', { name: '오른 무릎 통증 1단계', exact: true }).evaluate(e => e === document.activeElement), true)
    await page.getByRole('button', { name: '오른 무릎 통증 2단계', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true }).count(), 1)
    await capture(page, `body-selected-${width}`)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true }).evaluate(e => e === document.activeElement), true)
    const continueButton = page.getByRole('button', { name: '입력 확인으로', exact: true })
    await continueButton.scrollIntoViewIfNeeded()
    if (width === 375) await capture(page, 'body-bottom-375')
    await continueButton.click()
    await page.getByRole('button', { name: '몸 상태 · 기분 수정', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true }).count(), 1)
    assert.equal(await page.evaluate(() => localStorage.getItem('to-local-journal.journal.v2')), null)
    await context.close()
  }
  const missing = await open(320, true)
  await body(missing.page)
  await missing.page.locator('.body-pain-selector__visual').waitFor({ state: 'detached' })
  await missing.page.getByRole('button', { name: '왼 무릎', exact: true }).click()
  await missing.page.getByRole('button', { name: '왼 무릎 통증 3단계', exact: true }).click()
  await capture(missing.page, 'body-no-image-320')
  await missing.context.close()

  const large = await open(320)
  await body(large.page)
  await large.page.getByRole('button', { name: '오른 무릎', exact: true }).click()
  await large.page.evaluate(() => {
    const sizes = [...document.querySelectorAll('h1,h2,h3,p,button,small,span,summary,label')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)])
    for (const [e, size] of sizes) e.style.fontSize = `${size * 2}px`
  })
  await capture(large.page, 'body-large-text-320')
  await large.context.close()

  for (const width of [320, 375]) {
    const plan = await open(width)
    await nav(plan.page, '훈련').click()
    await picture(plan.page, 'plan-notebook-v2.webp', 64)
    await capture(plan.page, `plan-start-${width}`)
    await plan.context.close()

    const file = await open(width)
    await nav(file.page, '기록하기').click()
    await file.page.getByTestId('open-import').click()
    await picture(file.page, 'watch-file-v2.webp', 80)
    await capture(file.page, `file-start-${width}`)
    await file.context.close()

    const reading = await open(width)
    await reading.page.getByRole('button', { name: '더보기', exact: true }).click()
    await reading.page.getByRole('button', { name: /^최고기록으로 풀이하기/ }).click()
    await picture(reading.page, 'record-stopwatch-v3.webp', 64)
    await capture(reading.page, `record-reading-${width}`)
    await reading.context.close()

    const saved = await open(width)
    await nav(saved.page, '기록하기').click()
    await saved.page.getByTestId('entry-choice-evening').click()
    await saved.page.getByRole('button', { name: '수면', exact: true }).click()
    await saved.page.getByRole('textbox', { name: '수면 시간', exact: true }).fill('8')
    await saved.page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
    await saved.page.getByRole('button', { name: /^저장/ }).click()
    await picture(saved.page, 'journal-saved-v2.webp', 80)
    assert.equal(await saved.page.locator('.journal-save-result').getAttribute('data-storage-state'), 'confirmed')
    await capture(saved.page, `journal-saved-${width}`)
    await saved.context.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(new URL('observations.json', output), JSON.stringify({ baseSource: '01783011', mode: 'LOCAL_SYNTHETIC_ASSET_REVIEW', results, pageErrors: errors }, null, 2))
  console.log(JSON.stringify({ captures: results.length, pageErrors: errors.length }))
} finally { await browser.close() }
