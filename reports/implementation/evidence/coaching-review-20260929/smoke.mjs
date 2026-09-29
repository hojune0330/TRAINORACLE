import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(dir, '../../../../app/package.json'))
const { chromium } = require('playwright')
const origin = 'http://127.0.0.1:4194'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' })
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const result = { scope: 'Focused synthetic local smoke; not full regression or production account test', checks: [], errors }
try {
  await page.goto(`${origin}/?app=1&uitest=1`)
  const resolved = await page.evaluate(async () => {
    const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
    const { createPlannedSessionLogDraft } = await import('/src/domain/planned-session-link.ts')
    const { readJournalOriginalPlan } = await import('/src/domain/journal-original-plan.ts')
    const state = stateFixture()
    const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0], '2026-07-24T01:00:00Z')
    const entry = { id: 'synthetic-a', kind: 'post-session', date: draft.date, savedAt: '2026-07-24T02:00:00Z', syncState: 'local',
      activityOutcome: 'COMPLETED', activitySlot: 'PM', planExecutionRelation: 'MODIFIED', plannedSessionLink: draft.link,
      objectiveDataState: 'WAITING', system: '', title: '', distanceKm: '3.2', durationMin: '18', avgPace: '', rpe: 7, memo: '',
      fieldProvenance: { rpe: { provenance: 'EXPLICIT' }, distanceKm: { provenance: 'EXPLICIT' }, durationMin: { provenance: 'EXPLICIT' } } }
    localStorage.setItem('trainoracle.plan-beta.v1', JSON.stringify(state))
    localStorage.setItem('trainoracle.journal.v1', JSON.stringify([entry]))
    return readJournalOriginalPlan(entry).kind
  })
  assert.equal(resolved, 'matched')
  result.checks.push('AM plan / PM actual resolves original')
  await page.reload()
  const opener = page.locator('.home-coaching__item .home-hub__summary-row').first()
  await opener.click()
  const dialog = page.locator('dialog.execution-review-reader')
  assert(await dialog.getByText('워치 기록을 기다리고 있어요.', { exact: true }).isVisible())
  assert(await dialog.getByText(/계획은 오전, 실제 운동은 오후/).isVisible())
  assert(await dialog.getByRole('tab').evaluateAll(tabs => tabs.every(tab => document.getElementById(tab.getAttribute('aria-controls')))))
  await dialog.getByRole('tab', { name: '이유', exact: true }).click()
  const facts = dialog.getByText('사용한 기록', { exact: true })
  await facts.click()
  await dialog.getByRole('tab', { name: '요약', exact: true }).click()
  await dialog.getByRole('tab', { name: '이유', exact: true }).click()
  assert(await facts.evaluate(el => el.closest('details').open))
  result.checks.push('Waiting visible, tab targets valid, disclosures retained')
  await page.goBack()
  await dialog.waitFor({ state: 'detached' })
  await page.evaluate(() => {
    const [entry] = JSON.parse(localStorage.getItem('trainoracle.journal.v1'))
    localStorage.setItem('trainoracle.journal.v1', JSON.stringify([entry, { ...entry, id: 'synthetic-b', durationMin: '22' }]))
  })
  await page.reload()
  await page.getByRole('button', { name: '겹친 기록 2/2 일지 열기', exact: true }).click()
  const target = page.locator('.journal-entry-section[data-open="true"]')
  await target.waitFor()
  assert.equal(await target.count(), 1)
  assert((await target.innerText()).includes('22'))
  await page.screenshot({ path: path.join(dir, 'targeted-journal.png') })
  result.checks.push('Duplicate record 2 opens its exact journal section')
  await page.goto(`${origin}/?app=1&uitest=1`)
  await opener.click()
  const other = await context.newPage()
  await other.goto(`${origin}/?app=1&uitest=1`)
  await other.evaluate(() => localStorage.setItem('trainoracle.journal.v1', '[]'))
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'home-coaching-title')
  await other.close()
  result.checks.push('Deleted opener returns focus to coaching heading')
  await page.setViewportSize({ width: 320, height: 568 })
  result.compact = []
  for (const outcome of ['COMPLETED', 'PARTIAL', 'PAIN']) {
    await page.evaluate(async outcome => {
      const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
      const { createPlannedSessionLogDraft } = await import('/src/domain/planned-session-link.ts')
      const state = stateFixture(), draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0], '2026-07-24T01:00:00Z')
      const entry = { id: 'synthetic-compact', kind: 'post-session', date: draft.date, savedAt: '2026-07-24T02:00:00Z', syncState: 'local',
        activityOutcome: outcome === 'PAIN' ? 'PARTIAL' : outcome, activitySlot: 'AM', planExecutionRelation: 'MODIFIED', plannedSessionLink: draft.link,
        system: '', title: '', distanceKm: '3.2', durationMin: '18', avgPace: '', rpe: 7, memo: '',
        painCheckStatus: outcome === 'PAIN' ? 'SIGNAL_REPORTED' : 'NO_SIGNAL_REPORTED',
        fieldProvenance: { rpe: { provenance: 'EXPLICIT' }, distanceKm: { provenance: 'EXPLICIT' }, durationMin: { provenance: 'EXPLICIT' } } }
      localStorage.setItem('trainoracle.journal.v1', JSON.stringify([entry]))
    }, outcome)
    await page.reload()
    await opener.click()
    await dialog.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
    const scroll = await dialog.locator('.plan-day-reader__body').evaluate(el => ({ y: el.scrollHeight - el.clientHeight, x: el.scrollWidth - el.clientWidth }))
    result.compact.push({ outcome, ...scroll })
    assert(scroll.x <= 1)
    assert(scroll.y <= 1)
    await page.screenshot({ path: path.join(dir, `compact-${outcome}.png`) })
  }
  result.checks.push('320x568 completed/partial/pain summaries fit without clipping')
  assert.deepEqual(errors, [])
  result.status = 'PASS'
} catch (error) { result.status = 'FAIL'; result.error = String(error); process.exitCode = 1 }
finally { await writeFile(path.join(dir, 'smoke-results.json'), JSON.stringify(result, null, 2)); await browser.close() }
console.log(JSON.stringify(result, null, 2))
