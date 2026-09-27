import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const started = Date.now()
const deadline = started + 350000
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..', '..', '..', '..')
const { chromium } = await import(pathToFileURL(join(repo, 'app/node_modules/@playwright/test/index.mjs')))
const all = JSON.parse(await readFile(join(here, 'personas.json'), 'utf8')).personas
const personas = all.filter(p => ['R06', 'R07', 'R09', 'R10'].includes(p.id))
const origin = 'http://127.0.0.1:4209'
const target = `${origin}/?app=1`
const blockedHosts = new Set()
const report = {
  startedAt: new Date(started).toISOString(), target, syntheticOnly: true,
  scope: 'R06/R07/R09/R10 only; maximum 12 settled UI changes each; 360 seconds total',
  method: 'Visible-button choices ranked by persona curiosity and previously visited screen; no assigned route or success mission. Setup/reload/failed/no-change clicks excluded.',
  networkBoundary: 'All requests outside exact local origin aborted; service workers blocked.',
  results: [], status: 'running'
}
const persist = async () => {
  report.elapsedMs = Date.now() - started
  report.blockedHosts = [...blockedHosts]
  await writeFile(join(here, 'supplement.json'), JSON.stringify(report, null, 2), 'utf8')
}
const within = () => { if (Date.now() >= deadline) throw new Error('TOTAL_TIME_LIMIT') }
const bounded = (ms = 2500) => { within(); return Math.max(1, Math.min(ms, deadline - Date.now())) }
const guard = async context => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    blockedHosts.add(url.host)
    return route.abort()
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close())
}
const snapshot = async page => page.evaluate(() => {
  const dialog = document.querySelector('dialog[open]')
  const root = dialog || document.body
  const allButtons = [...document.querySelectorAll('button')]
  const visible = el => {
    const css = getComputedStyle(el)
    return el.getClientRects().length && css.visibility !== 'hidden' && css.display !== 'none'
      && css.pointerEvents !== 'none' && !el.closest('[inert],[aria-hidden="true"]')
      && (!el.checkVisibility || el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }))
  }
  const buttons = [...root.querySelectorAll('button')].filter(el => visible(el)
    && !el.disabled && el.getAttribute('aria-disabled') !== 'true').map(el => ({
      index: allButtons.indexOf(el), text: el.innerText.trim().replace(/\s+/gu, ' '),
      label: (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim(),
      selected: el.getAttribute('aria-selected'), pressed: el.getAttribute('aria-pressed'),
      expanded: el.getAttribute('aria-expanded'), current: el.getAttribute('aria-current'),
      inDialog: Boolean(dialog)
    }))
  return {
    url: location.pathname + location.search + location.hash, dialog: Boolean(dialog),
    headings: [...root.querySelectorAll('h1,h2,h3')].filter(visible).map(el => el.textContent.trim()),
    body: root.innerText.replace(/\s+/gu, ' ').trim(), buttons,
    modes: [...root.querySelectorAll('[role="tab"],[role="radio"],input:checked')].filter(visible).map(el => ({
      text: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim(),
      selected: el.getAttribute('aria-selected'), checked: el.getAttribute('aria-checked') || el.checked
    })),
    geometry: { width: innerWidth, documentWidth: document.documentElement.scrollWidth }
  }
})
const signature = s => JSON.stringify([s.url, s.dialog, s.headings, s.body,
  s.buttons.map(b => [b.text, b.label, b.selected, b.pressed, b.expanded, b.current]), s.modes])
const settled = async page => {
  let last = await snapshot(page)
  for (let i = 0; i < 5; i++) {
    within()
    await page.waitForTimeout(250)
    const next = await snapshot(page)
    if (signature(last) === signature(next) && !/^(불러오는 중|로딩 중)/u.test(next.body)) return next
    last = next
  }
  return last
}
const storage = async page => page.evaluate(() => {
  const parse = value => { try { return JSON.parse(value) } catch { return null } }
  const journalRaw = localStorage.getItem('trainoracle.journal.v1')
  const journal = parse(journalRaw)
  const plans = Object.entries(localStorage).filter(([key]) => key.startsWith('trainoracle.plan-beta')).map(([key, value]) => {
    const parsed = parse(value)
    return { key, activePlan: parsed?.activePlan ?? null }
  })
  return { journalCount: Array.isArray(journal) ? journal.length : null, journalRaw, plans,
    activePlanPresent: plans.some(p => p.activePlan && typeof p.activePlan === 'object' && Object.keys(p.activePlan).length > 0) }
})
const interests = {
  R06: ['현재 수준', '내 기록', '훈련 후 변화', '분석', '일지', '오늘 기록', '훈련 배우기'],
  R07: ['훈련 비교', '내 기록', '훈련 구성', '일지', '분석', '우선 훈련', '계획'],
  R09: ['계획', '오늘 훈련', '훈련 보기', '오늘 기록', '일지', '분석', '훈련 배우기'],
  R10: ['기록 2개', '훈련 2', '오전', '오후', '일지', '훈련 비교', '오늘 기록', '분석']
}
const forbidden = /더보기|설정|계정|로그인|로그아웃|삭제|휴지통|공유|내보내기|동기화|결제|연결|바로가기|꾸미기/u
const back = /닫기|뒤로|돌아|취소|이전 화면/u
const choose = (persona, screen, visited, selectedCounts) => {
  const keyBase = `${screen.url}|${screen.dialog}|${screen.headings.join('|')}|${screen.body.slice(0, 160)}`
  const candidates = screen.buttons.filter(b => {
    const name = `${b.text} ${b.label}`.trim()
    return name && !forbidden.test(name) && !visited.has(`${keyBase}|${name}`)
      && b.current !== 'page' && b.selected !== 'true' && b.pressed !== 'true'
      && !/^\d{1,2}$/u.test(name)
  }).map(button => {
    const name = `${button.text} ${button.label}`.trim()
    const rank = interests[persona.id].findIndex(word => name.includes(word))
    let score = rank < 0 ? 5 : 100 - rank * 6
    let reason = rank < 0 ? '현재 화면에서 아직 열어보지 않은 설명이나 선택지가 궁금해짐' : `${persona.interest}; 화면의 '${interests[persona.id][rank]}' 표시가 관심과 가까워 선택`
    if (screen.dialog && !back.test(name)) { score += 45; reason += '; 열린 대화상자의 내용을 먼저 살펴봄' }
    if (back.test(name)) { score = 15; reason = '현재 내용을 살핀 뒤 다른 선택지를 보려고 닫거나 되돌아감' }
    if (/기록 \d+개|훈련 후 \d+건/u.test(name)) score += 18
    if (/기분|몸 상태|날씨/u.test(name)) score -= 35
    score -= (selectedCounts.get(name) || 0) * 35
    return { button, name, score, reason, visitKey: `${keyBase}|${name}` }
  }).sort((a, b) => b.score - a.score)
  return candidates[0]
}

await persist()
const browser = await chromium.launch({ headless: true })
let hardLimit = false
const timer = setTimeout(() => { hardLimit = true; void browser.close() }, 355000 - (Date.now() - started))

async function preparePlan() {
  const state = { attempted: true, success: false, steps: [] }
  report.planProvisioning = state
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await guard(context)
  const page = await context.newPage()
  page.setDefaultTimeout(3000)
  const click = async (locator, label) => { await locator.click({ timeout: bounded(3000) }); state.steps.push(label) }
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: bounded(10000) })
    await click(page.getByRole('button', { name: '계획', exact: true }), '계획 탭')
    await click(page.getByRole('button', { name: '내 계획 받기', exact: true }).first(), '계획 합성 준비')
    await click(page.getByRole('radio', { name: '기록 없이' }), '기록 없이')
    await page.getByRole('combobox', { name: '종목' }).selectOption('1500', { timeout: bounded() })
    state.steps.push('1500m')
    await click(page.getByRole('button', { name: '내 계획 받기', exact: true }), '후보 요청')
    await click(page.getByRole('button', { name: /훈련 계획에 맞춰 달려 본 경험/u }), '합성 훈련 경험')
    await click(page.getByRole('button', { name: /^3일/u }), '주 3일')
    await click(page.getByRole('button', { name: /통증은 없고 몸 상태는 평소와 같아요/u }), '합성 몸 상태')
    state.beforeActivation = await settled(page)
    state.storageBeforeActivation = await storage(page)
    await click(page.getByRole('button', { name: '이 일정으로 시작', exact: true }), '이 일정으로 시작')
    state.afterActivation = await settled(page)
    state.storageAfterActivation = await storage(page)
    state.success = state.storageAfterActivation.activePlanPresent
    state.screenshot = 'supplement-R09-fixture-active.png'
    await page.screenshot({ path: join(here, state.screenshot), timeout: bounded() })
    const storageState = await context.storageState()
    await writeFile(join(here, 'supplement-R09-fixture.json'), JSON.stringify({ syntheticOnly: true, provisioning: state, storageState }, null, 2), 'utf8')
    if (!state.success) throw new Error('R09 activePlan object not present after activation; exploration not valid')
    return storageState
  } catch (error) {
    state.error = error.message
    await writeFile(join(here, 'supplement-R09-fixture.json'), JSON.stringify({ syntheticOnly: true, provisioning: state }, null, 2), 'utf8')
    throw error
  } finally { await context.close().catch(() => {}); await persist() }
}

try {
  for (const persona of personas) {
    const result = { id: persona.id, interest: persona.interest, viewport: persona.viewport, startedAt: new Date().toISOString(), actions: [], failedClicks: [], noChangeClicks: [], errors: [], status: 'running' }
    report.results.push(result)
    let context
    try {
      within()
      let storageState = persona.id === 'R09' ? await preparePlan() : { cookies: [], origins: [] }
      const entries = persona.journal.map((entry, index) => ({
        id: `${persona.id}-synthetic-${index + 1}`, kind: 'post-session', date: entry.date,
        savedAt: `${entry.date}T${entry.activitySlot === 'PM' ? '17' : '08'}:00:00.000Z`, syncState: 'local',
        system: entry.system, title: entry.title, distanceKm: entry.distanceKm, durationMin: entry.durationMin,
        avgPace: entry.avgPace, rpe: entry.rpe, memo: '', memoPurpose: 'PRIVATE_SELF_ONLY',
        ...(entry.activitySlot ? { activitySlot: entry.activitySlot } : {})
      }))
      let local = storageState.origins.find(item => item.origin === origin)
      if (!local) { local = { origin, localStorage: [] }; storageState.origins.push(local) }
      local.localStorage = local.localStorage.filter(item => item.name !== 'trainoracle.journal.v1')
      local.localStorage.push({ name: 'trainoracle.journal.v1', value: JSON.stringify(entries) })
      result.fixture = `supplement-${persona.id}-initial-storage.json`
      await writeFile(join(here, result.fixture), JSON.stringify({ syntheticOnly: true, storageState }, null, 2), 'utf8')
      context = await browser.newContext({ storageState, viewport: { width: persona.viewport[0], height: persona.viewport[1] }, serviceWorkers: 'block', reducedMotion: 'reduce' })
      await guard(context)
      const page = await context.newPage()
      page.setDefaultTimeout(2500)
      page.on('pageerror', error => result.errors.push(error.message))
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: bounded(10000) })
      result.start = await settled(page)
      result.initialStorage = await storage(page)
      if (persona.id === 'R09' && !result.initialStorage.activePlanPresent) throw new Error('R09 activePlan missing in exploration context')
      result.startScreenshot = `supplement-${persona.id}-start.png`
      await page.screenshot({ path: join(here, result.startScreenshot), timeout: bounded() })
      const visited = new Set(), selectedCounts = new Map()
      for (let attempt = 0; result.actions.length < 12 && attempt < 28; attempt++) {
        within()
        const before = await settled(page)
        const choice = choose(persona, before, visited, selectedCounts)
        if (!choice) { result.stopReason = '더 살펴볼 미방문 안전 버튼이 없어 중단'; break }
        visited.add(choice.visitKey)
        selectedCounts.set(choice.name, (selectedCounts.get(choice.name) || 0) + 1)
        const evidence = { attempt: attempt + 1, action: choice.button.text || choice.button.label, accessibleLabel: choice.button.label, reason: choice.reason, before, alternatives: before.buttons.map(b => b.text || b.label) }
        try {
          const control = page.locator('button').nth(choice.button.index)
          const allowed = await control.evaluate(el => {
            const dialog = document.querySelector('dialog[open]')
            return (!dialog || dialog.contains(el)) && !el.closest('[inert]')
          })
          if (!allowed) throw new Error('button scope changed before click')
          await control.scrollIntoViewIfNeeded({ timeout: bounded(1200) })
          await control.click({ trial: true, timeout: bounded(1200) })
          await control.click({ timeout: bounded(1500) })
        } catch (error) { result.failedClicks.push({ ...evidence, error: error.message.split('\n')[0] }); continue }
        const after = await settled(page)
        if (signature(before) === signature(after)) { result.noChangeClicks.push({ ...evidence, after }); continue }
        const n = result.actions.length + 1
        const screenshot = `supplement-${persona.id}-${String(n).padStart(2, '0')}.png`
        result.actions.push({ ...evidence, n, counted: true, after, screenshot })
        await page.screenshot({ path: join(here, screenshot), timeout: bounded() })
      }
      result.beforeReload = await storage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: bounded(10000) })
      result.end = await settled(page)
      result.afterReload = await storage(page)
      result.persistence = {
        seedMethod: 'context storageState applied once; no addInitScript reseeding',
        journalExactMatch: result.beforeReload.journalRaw === result.afterReload.journalRaw,
        activePlansExactMatch: JSON.stringify(result.beforeReload.plans) === JSON.stringify(result.afterReload.plans)
      }
      result.status = result.actions.length === 12 ? 'completed_12_changes' : 'partial'
      result.stopReason ||= result.actions.length === 12 ? '12회 실제 변화 상한 도달' : '시도 상한 도달'
    } catch (error) {
      result.status = result.actions.length ? 'partial' : 'failed'
      result.stopReason = error.message.split('\n')[0]
    } finally {
      result.actionCount = result.actions.length
      result.endedAt = new Date().toISOString()
      await persist()
      console.log(JSON.stringify({ id: result.id, status: result.status, actions: result.actionCount, failedClicks: result.failedClicks.length, noChangeClicks: result.noChangeClicks.length, stopReason: result.stopReason, paths: result.actions.map(a => a.action), persistence: result.persistence }))
      if (context) await context.close().catch(() => {})
    }
    if (Date.now() >= deadline || hardLimit) break
  }
} finally {
  clearTimeout(timer)
  await browser.close().catch(() => {})
  report.status = hardLimit || Date.now() >= deadline ? 'time_limit' : 'finished'
  report.endedAt = new Date().toISOString()
  await persist()
  console.log(JSON.stringify({ status: report.status, elapsedMs: report.elapsedMs, blockedHosts: report.blockedHosts }))
}
