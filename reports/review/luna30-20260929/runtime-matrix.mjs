import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(dir, '../../../app/package.json'))
const { chromium } = require('playwright')
const origin = 'http://127.0.0.1:4194'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const output = path.join(dir, 'runtime-matrix')
await mkdir(output, { recursive: true })
const report = { seed: 20260929, scope: 'synthetic isolated Chrome; not live accounts or real iPhone', cases: [], checks: [], errors: [] }
let seed = report.seed
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
const check = (condition, message) => { if (!condition) throw new Error(message) }
async function contextAt(viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', hasTouch: true })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === origin ? route.continue() : route.abort()
  })
  return context
}
try {
  const setup = await contextAt({ width: 375, height: 667 })
  const source = await setup.newPage()
  await source.goto(`${origin}/?app=1&uitest=1`)
  const fixture = await source.evaluate(async () => {
    const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
    const { createPlannedSessionLogDraft } = await import('/src/domain/planned-session-link.ts')
    const state = stateFixture()
    return { state, draft: createPlannedSessionLogDraft(state, state.activePlan.sessions[0], '2026-07-24T01:00:00Z') }
  })
  await setup.close()
  const outcomes = ['COMPLETED', 'PARTIAL', 'RESTED', 'SKIPPED', 'PAIN', 'DUPLICATE']
  const sizes = [[320, 568], [375, 667], [390, 844], [768, 700], [1280, 800]]
  for (const [width, height] of sizes) for (const outcome of outcomes) {
    const context = await contextAt({ width, height })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const result = { id: `${width}-${outcome}`, width, height, outcome, actions: 0, status: 'NOT_RUN', errors }
    report.cases.push(result)
    try {
      await page.addInitScript(({ state, draft, outcome }) => {
        const entry = { id: 'synthetic-matrix', kind: 'post-session', date: draft.date, savedAt: '2026-07-24T02:00:00Z', syncState: 'local',
          activityOutcome: ['PAIN', 'DUPLICATE'].includes(outcome) ? 'PARTIAL' : outcome, activitySlot: 'AM',
          planExecutionRelation: outcome === 'COMPLETED' ? 'AS_PLANNED' : 'MODIFIED', plannedSessionLink: draft.link,
          system: '', title: '', distanceKm: '3.2', durationMin: '18', avgPace: '', rpe: 7,
          fieldProvenance: { rpe: { provenance: 'EXPLICIT' }, distanceKm: { provenance: 'EXPLICIT' }, durationMin: { provenance: 'EXPLICIT' } },
          memo: '', painCheckStatus: outcome === 'PAIN' ? 'SIGNAL_REPORTED' : 'NO_SIGNAL_REPORTED' }
        localStorage.setItem('trainoracle.plan-beta.v1', JSON.stringify(state))
        localStorage.setItem('trainoracle.journal.v1', JSON.stringify(outcome === 'DUPLICATE' ? [entry, { ...entry, id: 'synthetic-second' }] : [entry]))
      }, { ...fixture, outcome })
      await page.goto(`${origin}/?app=1&uitest=1`)
      const opener = page.locator('.home-coaching__item .home-hub__summary-row').first()
      await opener.waitFor()
      const before = await page.evaluate(() => [localStorage.getItem('trainoracle.plan-beta.v1'), localStorage.getItem('trainoracle.journal.v1')])
      await opener.click()
      const dialog = page.locator('dialog.execution-review-reader')
      await dialog.waitFor()
      await dialog.evaluate(async el => {
        const transitions = el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        await Promise.all(transitions.map(animation => animation.finished.catch(() => {})))
      })
      const body = dialog.locator('.plan-day-reader__body')
      result.summaryScrollPx = await body.evaluate(el => el.scrollHeight - el.clientHeight)
      result.summaryHorizontalPx = await body.evaluate(el => el.scrollWidth - el.clientWidth)
      result.title = await dialog.locator('h2').innerText()
      const footerBox = await dialog.locator('.execution-review__actions').boundingBox()
      check(footerBox && footerBox.y + footerBox.height <= height + 1, 'Footer is outside viewport')
      check(result.summaryHorizontalPx <= 1, 'Summary horizontal overflow')
      if (outcome === 'PAIN') check(result.title.includes('몸 상태'), 'Pain absent from title')
      if (outcome === 'DUPLICATE') check(result.title.includes('겹친'), 'Conflict absent from title')
      await page.screenshot({ path: path.join(output, `${result.id}.png`) })
      for (let action = 0; action < 20; action++) {
        const choice = random(5)
        if (choice < 3) await dialog.getByRole('tab', { name: ['요약', '계획·기록', '이유'][choice], exact: true }).click()
        else if (choice === 3) {
          const next = dialog.getByRole('button', { name: '다음 내용', exact: true })
          if (await next.isEnabled()) await next.click()
          else await dialog.getByRole('tab', { name: '요약', exact: true }).click()
        } else {
          const previous = dialog.getByRole('button', { name: '이전 내용', exact: true })
          if (await previous.isEnabled()) await previous.click()
          else await dialog.getByRole('tab', { name: '이유', exact: true }).click()
        }
        check(await dialog.getByRole('tab', { selected: true }).count() === 1, 'Invalid tab selection')
        check(await dialog.getByRole('tabpanel').count() === 1, 'Invalid panel count')
        check(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Content horizontal overflow')
        check(await dialog.locator('h2').innerText() === result.title, 'Status title lost')
        result.actions++
      }
      await page.goBack()
      await dialog.waitFor({ state: 'detached' })
      check(await opener.evaluate(el => document.activeElement === el), 'Opener focus not restored')
      const after = await page.evaluate(() => [localStorage.getItem('trainoracle.plan-beta.v1'), localStorage.getItem('trainoracle.journal.v1')])
      check(JSON.stringify(before) === JSON.stringify(after), 'Plan or journal mutated by reading')
      check(errors.length === 0, 'Page errors')
      result.status = 'PASS'
    } catch (error) { result.status = 'FAIL'; result.failure = String(error); await page.screenshot({ path: path.join(output, `${result.id}-failure.png`) }).catch(() => {}) }
    finally { await context.close() }
    process.stdout.write(`${result.id}: ${result.status}; actions=${result.actions}; scroll=${result.summaryScrollPx}; ${result.failure ?? ''}\n`)
  }
} catch (error) { report.errors.push(String(error)) }
finally {
  report.pass = report.cases.filter(x => x.status === 'PASS').length
  report.fail = report.cases.filter(x => x.status === 'FAIL').length
  report.actions = report.cases.reduce((sum, x) => sum + x.actions, 0)
  await writeFile(path.join(dir, 'runtime-matrix-results.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
if (report.errors.length || report.fail || report.cases.length !== 30) process.exitCode = 1
