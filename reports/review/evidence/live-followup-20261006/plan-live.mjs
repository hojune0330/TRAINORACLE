import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const require = createRequire(resolve(process.cwd(), 'package.json'))
const { chromium, expect } = require('@playwright/test')
const out = dirname(fileURLToPath(import.meta.url))
mkdirSync(out, { recursive: true })
const base = process.env.LIVE_BASE || 'https://hojune0330.github.io/TRAINORACLE/'
const tag = base.startsWith('http://127.0.0.1') ? 'local-' : 'live-'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
for (const persona of [{ id: 'novice-800', width: 320, event: '800m' }, { id: 'record-1500', width: 375, event: '1500m', minutes: '5', seconds: '10' }].filter(persona => !process.env.PERSONA || persona.id === process.env.PERSONA)) {
  const context = await browser.newContext({ viewport: { width: persona.width, height: 740 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const result = { persona, actions: [], checkpoints: [], errors: [], source: null }
  page.on('pageerror', error => result.errors.push(error.message))
  async function snapshot(name) {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
    const state = await page.evaluate(() => {
      const scope = document.querySelector('dialog[open]') || document.querySelector('[role="dialog"]') || document.querySelector('main') || document.body
      const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && !node.closest('[inert]') && ![...scope.querySelectorAll('details:not([open])')].some(detail => detail.contains(node) && !detail.querySelector('summary')?.contains(node))
      const interactive = [...scope.querySelectorAll('button,input,select,summary,textarea')].filter(visible)
      const inViewport = interactive.filter(node => { const r = node.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
      return { text: scope.innerText, controls: interactive.map(node => node.getAttribute('aria-label') || node.innerText || node.getAttribute('name') || node.id), viewportControls: inViewport.length, totalControls: interactive.length, scrollY, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }
    })
    result.checkpoints.push({ name, ...state })
    await page.screenshot({ path: resolve(out, `${tag}${persona.id}-${name}.png`), fullPage: true })
  }
  async function click(name, exact = true) {
    const control = page.getByRole('button', { name, exact })
    const bounds = await control.boundingBox()
    result.actions.push({ name: String(name), requiresScroll: bounds && (bounds.y < 0 || bounds.y + bounds.height > 740), bounds })
    await control.click({ timeout: 10000 })
  }
  try {
    await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'))
    await page.goto(base + '?app=1')
    const receipt = await context.request.get(base + 'trainoracle-deploy-receipt.json')
    if (receipt.ok() && receipt.headers()['content-type']?.includes('json')) result.source = (await receipt.json()).sourceSha
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '훈련', exact: true }).click()
    await page.getByRole('button', { name: persona.event, exact: true }).waitFor()
    await snapshot('entry')
    if (!persona.minutes) {
      await click(persona.event)
      await click('기록 없이')
    } else {
      await click(persona.event)
      await click(/^내 기록/, false)
      await page.getByLabel('분', { exact: true }).fill(persona.minutes)
      await page.getByLabel('초', { exact: true }).fill(persona.seconds)
      await page.getByText('기록 날짜 추가', { exact: true }).click()
      await page.getByLabel('기록 달성일', { exact: true }).fill('2026-09-25')
      await snapshot('record-entry')
      await click('기록 입력 완료')
    }
    await click(persona.minutes ? /구조화된 훈련/ : /훈련 계획에 맞춰 달려 본 경험/, false)
    await click(/^3일/, false)
    await click(/통증은 없고 몸 상태는 평소와 같아요/, false)
    await page.getByRole('heading', { name: '계획이 준비됐어요', exact: true }).waitFor()
    await snapshot('result')
    const confirm = page.getByRole('button', { name: '기준 기록 확인하기', exact: true })
    if (await confirm.count()) {
      await confirm.click()
      await snapshot('pace-confirm')
      await click('이 기록으로 개인 페이스 적용')
    }
    await click('이 일정으로 시작')
    await expect(page.getByRole('heading', { name: '9일 훈련 계획', exact: true })).toBeVisible()
    await snapshot('active')
    const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.plan-beta.v1') || 'null'))
    result.generatedPlan = { startDate: plan.intake.startDate, candidateId: plan.activePlan.candidateId, sessions: plan.activePlan.sessions }
    const main = plan.activePlan.sessions.find(session => session.role === 'QUALITY')
    const date = new Date(plan.intake.startDate + 'T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + main.day - 1)
    const dateString = date.toISOString().slice(0, 10)
    await page.clock.setFixedTime(new Date(dateString + 'T03:00:00Z'))
    await page.reload()
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '훈련', exact: true }).click()
    await page.locator(`button[data-date="${dateString}"]`).click()
    await page.getByRole('dialog').waitFor()
    await snapshot('main-detail')
    if (!persona.minutes && process.env.EDIT_PLAN === '1') {
      const beforeEdit = JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.plan-beta.v1'))))
      await page.getByRole('dialog').getByText('일지·진행 기록', { exact: true }).click()
      await click('이 훈련 수정')
      const editor = page.getByRole('region', { name: '이 훈련 수정' })
      await editor.waitFor()
      await editor.getByRole('checkbox', { name: '이 훈련은 아직 시작하지 않았어요.' }).check()
      await snapshot('workout-editor')
      const composition = editor.getByRole('combobox', { name: '훈련 구성', exact: true })
      const options = await composition.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label:node.textContent })))
      result.editChoices = options
      const alternative = options.find(option => option.label?.includes('세트형 시간') && option.value !== main.prescription.catalogWorkout.catalogId)
      if (!alternative) throw Error('No alternative reviewed workout exposed')
      await composition.selectOption(alternative.value)
      const longer = editor.getByRole('checkbox', { name: /긴 구성임을 확인하고 동의/ })
      if (await longer.count()) await longer.check()
      await editor.getByRole('button', { name: '이 구성으로 바꾸기', exact: true }).click()
      await editor.getByRole('button', { name: '변경안 미리보기', exact: true }).click()
      await snapshot('edit-preview')
      await editor.getByRole('button', { name: '취소', exact: true }).click()
      if (JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.plan-beta.v1')))) !== beforeEdit) throw Error('Cancel changed stored plan')
      await page.locator(`button[data-date="${dateString}"]`).click()
      await page.getByRole('dialog').waitFor()
      result.editCancelPreservedPlan = true
      await page.getByRole('dialog').getByText('일지·진행 기록', { exact: true }).click()
      await click('이 훈련 수정')
      await editor.waitFor()
      await editor.getByRole('checkbox', { name: '이 훈련은 아직 시작하지 않았어요.' }).check()
      await composition.selectOption(alternative.value)
      if (await longer.count()) await longer.check()
      await editor.getByRole('button', { name: '이 구성으로 바꾸기', exact: true }).click()
      await editor.getByRole('button', { name: '변경안 미리보기', exact: true }).click()
      await editor.getByRole('checkbox', { name: '지금 통증이나 몸 상태 이상이 없어요.' }).check()
      await editor.getByRole('button', { name: '변경안 적용하기', exact: true }).click()
      await page.reload()
      await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '훈련', exact: true }).click()
      const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.plan-beta.v1')))
      if (edited.activePlan.sessions.find(session => session.day === main.day && session.slot === main.slot).prescription.catalogWorkout.catalogId !== alternative.value) throw Error('Applied edit did not survive reload')
      result.editAppliedAndReopened = true
      await page.locator(`button[data-date="${dateString}"]`).click()
      await page.getByRole('dialog').waitFor()
    }
    await page.getByRole('dialog').locator(`[data-session-slot="${main.slot}"]`).getByRole('button', { name: '이 훈련 일지 쓰기', exact: true }).click()
    await click('일부만 했거나 내용을 바꿨어요')
    await click(main.slot === 'PM' ? '오후' : '오전')
    await click(/^RPE 7,/, false)
    await click('없어요')
    await click('횟수를 줄였어요')
    await snapshot('journal-review')
    await click('이대로 저장')
    await expect(page.getByRole('button', { name: '완료', exact: true })).toBeVisible()
    await snapshot('journal-saved')
    await click('완료')
    await snapshot('returned-session')
    await click('달력으로 돌아가기')
    await page.reload()
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '훈련', exact: true }).click()
    await page.locator(`button[data-date="${dateString}"]`).click()
    await snapshot('reopened-session')
    result.journal = await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.journal.v1') || 'null'))
    await click('달력으로 돌아가기')
    await page.clock.setFixedTime(new Date('2026-10-16T03:00:00Z'))
    await page.reload()
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '훈련', exact: true }).click()
    await page.getByRole('heading', { name: '9일 훈련 계획', exact: true }).waitFor()
    await snapshot('cycle-ended')
    const summary = page.locator('summary', { hasText: '현재 기준으로 새 계획안 받기' })
    if (await summary.count()) await summary.click()
    await click('현재 기준으로 다음 계획안 만들기')
    await click(/통증은 없고 몸 상태는 평소와 같아요/, false)
    await page.getByRole('heading', { name: '계획이 준비됐어요', exact: true }).waitFor()
    await snapshot('next-cycle-result')
    if (await confirm.count()) {
      await confirm.click()
      const record = page.getByRole('button', { name: /^추천 · 최근 경기/ })
      if (await record.count()) await record.click()
      await click('이 기록으로 개인 페이스 적용')
    }
    await click('이 일정으로 시작')
    await snapshot('next-cycle-active')
    result.status = 'PASS'
  } catch (error) {
    result.status = 'INCOMPLETE'
    result.failure = error.message
    await snapshot('failure').catch(() => {})
  }
  results.push(result)
  writeFileSync(resolve(out, `plan-${tag}${persona.id}.json`), JSON.stringify(result, null, 2) + '\n')
  writeFileSync(resolve(out, `plan-${tag}journeys.json`), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify({ persona: persona.id, status: result.status, failure: result.failure, checkpoints: result.checkpoints.map(x => ({ name:x.name, controls:x.totalControls, viewportControls:x.viewportControls, horizontalOverflow:x.horizontalOverflow })), errors:result.errors }))
  await context.close()
}
await browser.close()
