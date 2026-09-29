import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(dir, '../../../app/package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' })
await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4194' ? route.continue() : route.abort())
const page = await context.newPage()
const result = { scope: 'Synthetic isolated browser; review only', observations: [] }
try {
  await page.goto('http://127.0.0.1:4194/?app=1&uitest=1')
  result.observations.push(await page.evaluate(async () => {
    const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
    const { createPlannedSessionLogDraft } = await import('/src/domain/planned-session-link.ts')
    const { derivePlanExecutionRelation } = await import('/src/domain/plan-execution-relation.ts')
    const { readJournalOriginalPlan } = await import('/src/domain/journal-original-plan.ts')
    const { reviewPlanExecution } = await import('/src/domain/plan-execution-review.ts')
    const state = stateFixture()
    const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0], '2026-07-24T01:00:00Z')
    const entry = { id: 'synthetic-followup', kind: 'post-session', date: draft.date, savedAt: '2026-07-24T02:00:00Z', syncState: 'local',
      activityOutcome: 'COMPLETED', activitySlot: 'AM', planExecutionRelation: 'AS_PLANNED', plannedSessionLink: draft.link,
      system: '', title: '', distanceKm: '3.2', durationMin: '18', avgPace: '', rpe: 7, memo: '',
      fieldProvenance: { rpe: { provenance: 'EXPLICIT' }, distanceKm: { provenance: 'EXPLICIT' }, durationMin: { provenance: 'EXPLICIT' } } }
    localStorage.setItem('trainoracle.plan-beta.v1', JSON.stringify(state))
    localStorage.setItem('trainoracle.journal.v1', JSON.stringify([entry]))
    const original = readJournalOriginalPlan(entry)
    const pm = { ...entry, activitySlot: 'PM', planExecutionRelation: 'MODIFIED' }
    const pmOriginal = readJournalOriginalPlan(pm)
    const review = reviewPlanExecution(pm, pmOriginal)
    return { id: 'AM_PLAN_PM_ACTUAL', originalAM: original.kind, originalPM: pmOriginal.kind,
      derivedRelation: derivePlanExecutionRelation('COMPLETED', 'PM', draft.link),
      reviewStatus: review.status, metrics: review.metrics, summary: review.summary }
  }))
  await page.reload()
  await page.locator('.home-coaching__item .home-hub__summary-row').first().click()
  const dialog = page.locator('dialog.execution-review-reader')
  await dialog.getByRole('tab', { name: '이유', exact: true }).click()
  const details = dialog.locator('details').filter({ has: page.locator('summary', { hasText: '사용한 기록' }) })
  await details.locator('summary').click()
  const before = await details.evaluate(el => el.open)
  await dialog.getByRole('tab', { name: '요약', exact: true }).click()
  await dialog.getByRole('tab', { name: '이유', exact: true }).click()
  const after = await details.evaluate(el => el.open)
  result.observations.push({ id: 'REASON_DISCLOSURE_RETURN', expandedBefore: before, expandedAfter: after })
  result.observations.push({ id: 'TAB_PANEL_REFERENCES', refs: await dialog.getByRole('tab').evaluateAll(tabs => tabs.map(tab => ({ name: tab.textContent, targetExists: !!document.getElementById(tab.getAttribute('aria-controls')) }))) })
  await page.screenshot({ path: path.join(dir, 'reason-disclosure-return.png') })
  await page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem('trainoracle.journal.v1'))
    entries[0].objectiveDataState = 'WAITING'
    localStorage.setItem('trainoracle.journal.v1', JSON.stringify(entries))
  })
  await page.reload()
  await page.locator('.home-coaching__item .home-hub__summary-row').first().click()
  const waitingVisibleOnSummary = (await dialog.innerText()).includes('자료를 기다리는')
  await dialog.getByRole('tab', { name: '이유', exact: true }).click()
  await dialog.getByText('아직 판단하지 않은 내용', { exact: true }).click()
  result.observations.push({ id: 'WAITING_VISIBILITY', waitingVisibleOnSummary, visibleAfterTwoActions: (await dialog.innerText()).includes('자료를 기다리는') })
  const second = await context.newPage()
  await second.goto('http://127.0.0.1:4194/?app=1&uitest=1')
  await second.evaluate(() => localStorage.setItem('trainoracle.journal.v1', '[]'))
  await dialog.waitFor({ state: 'detached' })
  result.observations.push({ id: 'DELETED_OPENER_FOCUS', focus: await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement === document.body ? '' : document.activeElement.textContent?.slice(0, 60) })) })
  await second.close()
} catch (error) { result.error = String(error); process.exitCode = 1 }
finally { await writeFile(path.join(dir, 'followup-probes-results.json'), JSON.stringify(result, null, 2)); await browser.close() }
console.log(JSON.stringify(result, null, 2))
