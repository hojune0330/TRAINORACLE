import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

// Isolated local browser only. No real athlete/account data or external traffic.
const base = 'http://127.0.0.1:4184'
const output = new URL('../.codex-calendar-visual-qa/body-history-20261012/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const evidence = [], errors = []
const nav = (page, name) => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
async function open(width, failImage = false) {
  const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin !== base || failImage && /body-check.*\.webp$/.test(url.pathname) ? route.abort() : route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${base}/?app=1&uitest=1`)
  await page.locator('.home-hub').waitFor()
  return { page, context }
}
async function condition(page) {
  await nav(page, '기록하기').click()
  await page.getByTestId('entry-choice-evening').click()
  await page.getByRole('button', { name: '몸 상태·기분', exact: true }).click()
}
async function capture(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true })
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    dialogOverflow: [...document.querySelectorAll('dialog[open]')].some(e => e.scrollWidth > e.clientWidth),
    dialogOutside: [...document.querySelectorAll('dialog[open]')].some(e => e.getBoundingClientRect().left < 0 || e.getBoundingClientRect().right > innerWidth + 1),
  }))
  assert.equal(layout.overflow, false, name)
  assert.equal(layout.dialogOverflow, false, name)
  assert.equal(layout.dialogOutside, false, name)
  evidence.push({ name, ...layout })
}
try {
  for (const width of [320, 375, 1280]) {
    const { page, context } = await open(width)
    await condition(page)
    await page.getByRole('button', { name: '오른 무릎', exact: true }).click()
    const focus = page.getByRole('dialog', { name: '오른 무릎 통증 정도', exact: true })
    await expect(focus).toBeVisible()
    await focus.locator('img').evaluate(img => img.decode())
    await capture(page, `knee-focus-${width}`)
    const targets = await focus.getByRole('button').evaluateAll(nodes => nodes.map(e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })))
    assert.ok(targets.every(v => v.w >= 44 && v.h >= 44), '44px minimum')
    await focus.getByRole('button', { name: '오른 무릎 통증 2단계' }).click()
    await expect(focus).toHaveCount(0)
    await expect(page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true })).toBeFocused()
    await page.getByRole('button', { name: '오른 종아리', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').locator('img').evaluate(img => img.decode())
    await capture(page, `calf-focus-${width}`)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '오른 종아리', exact: true })).toBeFocused()
    if (width === 320) {
      await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
      await page.getByRole('button', { name: '기타 부위 추가', exact: true }).click()
      await page.getByRole('textbox', { name: '부위 이름', exact: true }).fill('테스트 긴 부위 이름')
      await capture(page, 'large-text-custom-320')
    }
    await context.close()
  }
  const { page, context } = await open(375)
  await condition(page)
  await page.getByRole('button', { name: '기타 부위 추가', exact: true }).click()
  await page.getByRole('textbox', { name: '부위 이름', exact: true }).fill('테스트 발목 안쪽')
  await page.locator('.body-part-focus-dialog__memo-details summary').click()
  await page.getByRole('dialog').getByRole('textbox', { name: '메모', exact: true }).fill('SYNTHETIC_PRIVATE_BODY_NOTE')
  await capture(page, 'custom-input-375')
  await page.getByRole('button', { name: '테스트 발목 안쪽 통증 4단계', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
  await page.getByRole('button', { name: /^저장/ }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('to-local-journal.journal.v2') ?? '[]').some(e => e.bodyPartMetadata?.observations.length))
  const saved = await page.evaluate(async () => {
    const { loadEntries } = await import('/src/domain/journal-store.ts')
    const { toExportJournalEntry, toAnalysisJournalEntry } = await import('/src/domain/safe-export.ts')
    const entry = loadEntries()[0]
    return { entry, safe: JSON.stringify(toExportJournalEntry(entry)), analysis: JSON.stringify(toAnalysisJournalEntry(entry)) }
  })
  assert.equal(saved.entry.bodyPartMetadata.observations[0].severity, 4)
  assert.deepEqual(saved.entry.painParts, {})
  for (const projection of [saved.safe, saved.analysis]) {
    assert.equal(projection.includes('테스트 발목 안쪽'), false)
    assert.equal(projection.includes('SYNTHETIC_PRIVATE_BODY_NOTE'), false)
    assert.equal(projection.includes(saved.entry.bodyPartMetadata.observations[0].id), false)
  }
  evidence.push({ name: 'custom-only-save-and-private-projection', passed: true })
  await page.locator('.journal-save-result__secondary').click()
  await nav(page, '일지').click()
  const grid = page.getByRole('grid')
  await page.getByRole('button', { name: '이전 달', exact: true }).click()
  const month = await grid.getAttribute('aria-label')
  await page.getByRole('button', { name: '몸 기록', exact: true }).click()
  await page.getByRole('button', { name: /^테스트 발목 안쪽, 마지막 기록/ }).click()
  await capture(page, 'history-detail-375')
  await page.getByRole('button', { name: '원본 일지 보기', exact: true }).click()
  await expect(page.getByText('SYNTHETIC_PRIVATE_BODY_NOTE', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.body-history__records')).toBeVisible()
  await page.getByRole('group', { name: '일지와 몸 기록' }).getByRole('button', { name: '일지', exact: true }).click()
  await expect(grid).toHaveAttribute('aria-label', month)
  await page.getByRole('button', { name: '몸 기록', exact: true }).click()
  await expect(page.locator('.body-history__records')).toBeVisible()
  await page.getByRole('button', { name: '오늘 상태 남기기', exact: true }).click()
  const reuse = page.getByRole('dialog', { name: '테스트 발목 안쪽 통증 정도', exact: true })
  await expect(reuse).toBeVisible()
  await expect(reuse.getByRole('textbox', { name: '부위 이름', exact: true })).toHaveValue('테스트 발목 안쪽')
  assert.equal(await reuse.locator('.body-part-focus-dialog__level[aria-pressed="true"]').count(), 0)
  assert.equal(await reuse.locator('textarea').inputValue(), '')
  await capture(page, 'name-reused-not-severity-375')
  await page.keyboard.press('Escape')
  await expect(reuse).toHaveCount(0)
  await page.getByRole('button', { name: '오른 무릎', exact: true }).click()
  await page.getByRole('button', { name: '오른 무릎 통증 2단계', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '몸 부위 기록 이력 보기', exact: true }).click()
  const historyDialog = page.getByRole('dialog', { name: '몸 기록', exact: true })
  await expect(historyDialog).toBeVisible()
  await historyDialog.getByRole('button', { name: /^테스트 발목 안쪽, 마지막 기록/ }).click()
  await historyDialog.getByRole('button', { name: '원본 일지 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '몸 기록의 원본 일지', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: '몸 기록의 원본 일지', exact: true })).toHaveCount(0)
  await expect(historyDialog.locator('.body-history__records')).toBeVisible()
  await historyDialog.getByRole('button', { name: '오늘 상태 남기기', exact: true }).click()
  await expect(reuse).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true })).toBeVisible()
  evidence.push({ name: 'history-layer-to-input-preserves-draft', passed: true, preservedCalendarMonth: month })
  await context.close()

  const missing = await open(320, true)
  await condition(missing.page)
  await missing.page.getByRole('button', { name: '오른 무릎', exact: true }).click()
  await missing.page.getByRole('button', { name: '오른 무릎 통증 2단계', exact: true }).click()
  await expect(missing.page.getByRole('dialog')).toHaveCount(0)
  await expect(missing.page.getByRole('button', { name: '오른 무릎, 통증 2/5', exact: true })).toBeVisible()
  await capture(missing.page, 'image-failure-320')
  await missing.context.close()
  assert.deepEqual(errors, [])
  await writeFile(new URL('observations.json', output), JSON.stringify({ mode: 'LOCAL_SYNTHETIC', evidence, errors }, null, 2))
  console.log(JSON.stringify({ checks: evidence.length, errors: errors.length }))
} finally { await browser.close() }
