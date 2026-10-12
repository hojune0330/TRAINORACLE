import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const base = 'http://127.0.0.1:4184'
const output = new URL('../.codex-calendar-visual-qa/canonical-storage-20261012/', import.meta.url)
await mkdir(output, { recursive: true })
const entry = { id: 'synthetic-canonical-browser', kind: 'evening', date: '2026-10-12', savedAt: '2026-10-12T00:00:00Z', syncState: 'local', sleepH: 7, sleepQuality: 4, weightKg: '', restingHr: '', painParts: {}, mood: 3, note: '', fieldProvenance: { painParts: { provenance: 'EXPLICIT' } }, bodyPartMetadata: { schemaVersion: 1, observations: [{ id: 'other_12345678-1234-4234-8234-123456789012', labelSnapshot: '합성 부위', severity: 2, note: 'SYNTHETIC_PRIVATE_ONLY' }] } }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
const page = await context.newPage(), errors = [], evidence = []
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(value => {
  if (!localStorage.getItem('to-local-journal.migration.v1')) localStorage.setItem('trainoracle.journal.v1', JSON.stringify([value]))
}, entry)

try {
  await page.goto(`${base}/?app=1&uitest=1`)
  await page.locator('.home-hub').waitFor()
  const raw = await page.evaluate(() => ({ old: localStorage.getItem('trainoracle.journal.v1'), current: localStorage.getItem('to-local-journal.journal.v2') }))
  assert.equal(raw.current, raw.old)
  assert.ok(raw.current.includes('SYNTHETIC_PRIVATE_ONLY'))
  evidence.push({ name: 'bootstrap-exact-private-body-preservation', passed: true })
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '기록하기', exact: true }).click()
  await page.getByTestId('entry-choice-evening').click()
  await page.getByRole('button', { name: '수면', exact: true }).click()
  const input = page.getByLabel('수면 시간', { exact: true })
  await input.fill('7.5')
  const oldTab = await context.newPage()
  await oldTab.goto(`${base}/?terms=1`)
  const { bodyPartMetadata: _removed, ...stripped } = entry
  for (const [index, value] of [JSON.stringify([stripped]), '[]', null].entries()) {
    await page.bringToFront()
    await input.focus()
    await oldTab.evaluate(raw => {
      if (raw === null) localStorage.removeItem('trainoracle.journal.v1')
      else localStorage.setItem('trainoracle.journal.v1', raw)
    }, value)
    const dialog = page.getByRole('dialog', { name: '이전 앱에서 기록이 바뀌었어요' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    const protectedRead = await page.evaluate(async () => {
      const { writeJournalEntries } = await import('/src/domain/journal-local-storage.ts')
      const { loadEntriesForPlanSafety } = await import('/src/domain/journal-store.ts')
      return { wrote: writeJournalEntries(localStorage, []), status: loadEntriesForPlanSafety().status, raw: localStorage.getItem('to-local-journal.journal.v2') }
    })
    assert.equal(protectedRead.wrote, false)
    assert.equal(protectedRead.status, 'uncertain')
    assert.equal(protectedRead.raw, raw.current)
    if (index === 0) {
      for (const width of [375, 320, 1280]) {
        await page.setViewportSize({ width, height: 812 })
        await page.screenshot({ path: fileURLToPath(new URL(`conflict-${width}.png`, output)), fullPage: true })
        const bounds = await dialog.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, width: innerWidth }))
        assert.ok(bounds.scroll <= bounds.client && bounds.left >= 0 && bounds.right <= bounds.width + 1)
      }
      await page.setViewportSize({ width: 320, height: 812 })
      await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
      const buttons = await dialog.getByRole('button').evaluateAll(nodes => nodes.map(node => ({ w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height })))
      assert.ok(buttons.every(node => node.w >= 44 && node.h >= 44))
      await page.screenshot({ path: fileURLToPath(new URL('conflict-large-text-320.png', output)), fullPage: true })
      evidence.push({ name: '375-320-1280-and-large-text-44px-dialog', passed: true })
    }
    await dialog.getByRole('button', { name: '현재 기록으로 계속' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(input).toHaveValue('7.5')
    await expect(input).toBeFocused()
    assert.equal(await page.evaluate(() => localStorage.getItem('to-local-journal.journal.v2')), raw.current)
    evidence.push({ name: `old-writer-${['strips-metadata', 'empty-array', 'removes-key'][index]}-preserves-new-and-draft`, passed: true })
  }
  await page.reload()
  await page.locator('.home-hub').waitFor()
  const retained = await page.evaluate(async () => {
    const { loadJournalEntriesSnapshot } = await import('/src/domain/journal-store.ts')
    const { canonicalJournalStorageStatus } = await import('/src/domain/canonical-journal-storage.ts')
    return { status: canonicalJournalStorageStatus(localStorage).status, label: loadJournalEntriesSnapshot().entries[0]?.bodyPartMetadata?.observations[0]?.labelSnapshot }
  })
  assert.deepEqual(retained, { status: 'ready', label: '합성 부위' })
  evidence.push({ name: 'reload-retains-canonical-not-empty-legacy', passed: true })
  assert.deepEqual(errors, [])
  await writeFile(new URL('observations.json', output), JSON.stringify({ mode: 'LOCAL_SYNTHETIC_EXTERNAL_REQUESTS_BLOCKED', evidence, errors }, null, 2))
  console.log(JSON.stringify({ checks: evidence.length, errors: errors.length }))
} finally { await context.close(); await browser.close() }
