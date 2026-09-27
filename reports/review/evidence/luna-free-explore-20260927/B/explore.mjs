import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "..", "..", "..", "..", "..")
const appDir = join(repo, "app")
const { chromium } = await import(pathToFileURL(join(appDir, "node_modules/@playwright/test/index.mjs")))
const personas = JSON.parse(await readFile(join(here, "personas.json"), "utf8")).personas
const preferences = {
  R06: ["현재 수준", "훈련 후 변화", "훈련 비교", "일지", "분석", "기록하기", "오늘 기록", "훈련 배우기"],
  R07: ["훈련 비교", "일지", "분석", "훈련 구성", "우선 훈련", "현재 수준", "계획"],
  R08: ["오늘 기록", "일지 예시", "훈련 배우기", "기록하기", "일지", "계획", "분석"],
  R09: ["계획", "훈련 계획", "오늘 기록", "일지", "분석", "현재 수준", "훈련 배우기"],
  R10: ["일지", "훈련 비교", "오늘 기록", "분석", "계획", "현재 수준", "기록하기"],
}
const blockedHosts = new Set()
const results = []
let planProvisioning = { attempted: false, success: false, reason: "not applicable" }
const browser = await chromium.launch({ headless: true })
try {
  let planOnlyState = null
  const planSetup = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: "block" })
  await planSetup.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin === "http://127.0.0.1:4209") return route.continue()
    blockedHosts.add(url.host)
    return route.abort()
  })
  const setupPage = await planSetup.newPage()
  planProvisioning = { attempted: true, success: false, steps: [] }
  try {
    await setupPage.goto("http://127.0.0.1:4209/?app=1", { waitUntil: "domcontentloaded" })
    await setupPage.getByRole("button", { name: "계획", exact: true }).click({ timeout: 3000 })
    planProvisioning.steps.push("계획 화면 열기")
    const begin = setupPage.getByRole("button", { name: "내 계획 받기", exact: true }).first()
    await begin.click({ timeout: 3000 })
    await setupPage.getByRole("radio", { name: "기록 없이" }).click({ timeout: 3000 })
    await setupPage.getByRole("combobox", { name: "종목" }).selectOption("1500")
    await setupPage.getByRole("button", { name: "내 계획 받기", exact: true }).click({ timeout: 3000 })
    await setupPage.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click({ timeout: 3000 })
    await setupPage.getByRole("button", { name: /^3일/u }).click({ timeout: 3000 })
    await setupPage.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click({ timeout: 3000 })
    await setupPage.waitForTimeout(350)
    await setupPage.screenshot({ path: join(here, "R09-plan-fixture-attempt-03.png"), fullPage: false })
    planOnlyState = await setupPage.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
    planProvisioning = { attempted: true, success: Object.keys(planOnlyState).some(key => key.startsWith("trainoracle.plan-beta")), steps: ["계획 탭", "기록 없이 선택", "1500m 선택", "3일 일정", "합성 상태 확인"], localStorageKeys: Object.keys(planOnlyState).filter(key => key.startsWith("trainoracle.plan-beta")) }
  } catch (error) {
    planProvisioning = { ...planProvisioning, error: error.message.split("\n")[0] }
  }
  await planSetup.close()
  for (const persona of personas) {
    const [width, height] = persona.viewport
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", reducedMotion: "reduce" })
    await context.route("**/*", route => {
      const url = new URL(route.request().url())
      if (url.origin === "http://127.0.0.1:4209") return route.continue()
      blockedHosts.add(url.host)
      return route.abort()
    })
    const entries = persona.journal.map((entry, index) => ({
      id: `${persona.id}-synthetic-${index + 1}`, kind: "post-session", date: entry.date,
      savedAt: `${entry.date}T${entry.activitySlot === "PM" ? "17" : "08"}:00:00.000Z`, syncState: "local",
      system: entry.system, title: entry.title, distanceKm: entry.distanceKm, durationMin: entry.durationMin,
      avgPace: entry.avgPace, rpe: entry.rpe, memo: "", memoPurpose: "PRIVATE_SELF_ONLY",
      ...(entry.activitySlot ? { activitySlot: entry.activitySlot } : {}),
    }))
    if (persona.id === "R09" && planOnlyState && planProvisioning.success) {
      await context.addInitScript(state => { for (const [key, value] of Object.entries(state)) localStorage.setItem(key, value) }, planOnlyState)
      await context.addInitScript(raw => localStorage.setItem("trainoracle.journal.v1", raw), JSON.stringify(entries))
    } else {
      await context.addInitScript(raw => localStorage.setItem("trainoracle.journal.v1", raw), JSON.stringify(entries))
    }
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto("http://127.0.0.1:4209/?app=1", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    const actions = []
    const visited = new Set()
    const snapshot = async () => page.evaluate(() => ({
      url: location.pathname + location.search,
      headings: [...document.querySelectorAll("h1,h2,h3")].filter(el => el.getClientRects().length).map(el => el.textContent?.trim()).filter(Boolean),
      buttons: [...document.querySelectorAll("button")].map((el, index) => ({ index, text: el.innerText.trim().replace(/\s+/gu, " "), label: (el.getAttribute("aria-label") || "").trim(), disabled: el.disabled, visible: Boolean(el.getClientRects().length) })).filter(button => button.visible),
      body: document.body.innerText.replace(/\s+/gu, " ").slice(0, 850),
      geometry: (() => { const el = document.querySelector(".app-scroll-region") || document.documentElement; return { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight } })(),
    }))
    const start = await snapshot()
    await page.screenshot({ path: join(here, `${persona.id}-attempt-03-start.png`), fullPage: false })
    const failedAttempts = []
    for (let attempt = 0; actions.length < 12 && attempt < 24; attempt++) {
      const before = await snapshot()
      const screen = before.headings.join(" / ") || before.body.slice(0, 100)
      const choices = before.buttons.filter(button => !button.disabled && button.text && button.visible && !/^\d{1,2}$/u.test(button.text) && !/더보기|설정|계정|로그아웃|삭제|휴지통|공유|내보내기|동기화|결제/iu.test(`${button.text} ${button.label}`))
      const unvisited = choices.filter(button => !visited.has(`${screen}|${button.text}|${button.label}`))
      const pool = unvisited.length ? unvisited : choices.filter(button => /뒤로|이전 화면|홈으로 돌아/iu.test(`${button.text} ${button.label}`))
      if (!pool.length) break
      const order = preferences[persona.id]
      const score = button => {
        const text = `${button.text} ${button.label}`
        const rank = order.findIndex(token => text.includes(token))
        if (rank >= 0) return 100 - rank * 3
        if (/뒤로|이전 화면|홈으로 돌아/iu.test(text)) return 18
        if (/^(홈|일지|기록하기|계획|분석)$/u.test(button.text)) return 10
        return 0
      }
      const target = [...pool].sort((a, b) => score(b) - score(a))[0]
      const key = `${screen}|${target.text}|${target.label}`
      visited.add(key)
      const label = `${target.text} ${target.label}`
      const reason = /뒤로|이전 화면|홈으로 돌아/iu.test(label) ? "현재 화면에서 더 살펴볼 만한 항목을 찾지 못해 익숙한 위치로 되돌아감"
        : /현재 수준|분석 결과/iu.test(label) ? (persona.id === "R06" ? "저장한 한 건이 어떤 의미로 읽히는지 궁금해함" : "요약 분석이 자신의 기록 수와 맞는지 보고 싶어함")
        : /훈련 비교|일지|기록/iu.test(label) ? (persona.id === "R10" ? "하루 두 세션이 한 날짜에서 구분되는지 살펴봄" : "기록이 어디에 모이고 어떻게 다시 열리는지 확인함")
        : /계획/iu.test(label) ? "계획을 만들거나 다시 보는 진입이 무엇을 여는지 궁금해함"
        : /배우기|예시/iu.test(label) ? "쉬었던 뒤 부담 없는 설명이나 예시부터 찾아봄"
        : /오늘|기록하기/iu.test(label) ? "기록 시작 화면에서 요구하는 정보량을 가늠하려 함"
        : "현재 화면에서 자신의 관심과 가장 가까워 보이는 선택지를 눌러봄"
      try {
        const control = page.locator("button").nth(target.index)
        await control.scrollIntoViewIfNeeded({ timeout: 900 })
        await control.click({ timeout: 1600 })
        await page.waitForTimeout(200)
      } catch (error) {
        failedAttempts.push({ screen, attempted: target.text, accessibleLabel: target.label, reason, result: error.message.split("\n")[0] })
        continue
      }
      const after = await snapshot()
      const changed = before.url !== after.url || before.headings.join("|") !== after.headings.join("|") || before.body !== after.body
      if (changed) actions.push({ n: actions.length + 1, screen, action: target.text, reason, result: after.headings.join(" / ") || after.body.slice(0, 140), url: after.url, counted: true })
      if (actions.length === 6 || actions.length === 12) await page.screenshot({ path: join(here, `${persona.id}-attempt-03-step-${actions.length}.png`), fullPage: false })
    }
    const beforeReload = await page.evaluate(() => {
      let list = []; try { list = JSON.parse(localStorage.getItem("trainoracle.journal.v1") || "[]") } catch {}
      return { journalKeyPresent: localStorage.getItem("trainoracle.journal.v1") !== null, journalCount: list.length, activePlanKeyPresent: Object.keys(localStorage).some(key => key.startsWith("trainoracle.plan-beta")) }
    })
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(450)
    const afterReload = await page.evaluate(() => {
      let list = []; try { list = JSON.parse(localStorage.getItem("trainoracle.journal.v1") || "[]") } catch {}
      return { journalCount: list.length, activePlanKeyCount: Object.keys(localStorage).filter(key => key.startsWith("trainoracle.plan-beta")).length }
    })
    const end = await snapshot()
    results.push({ id: persona.id, start, endHeadings: end.headings, actionCount: actions.filter(action => action.counted).length, actions, failedAttempts, viewport: persona.viewport, beforeReload, afterReload, errors, planProvisioning: persona.id === "R09" ? planProvisioning : undefined })
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(join(here, "actions-attempt-03.json"), JSON.stringify({ target: "http://127.0.0.1:4209/?app=1", externalWriteBoundary: "all browser requests outside 127.0.0.1:4209 were aborted", blockedHosts: [...blockedHosts], planProvisioning, results }, null, 2), "utf8")
console.log(JSON.stringify({ blockedHosts: [...blockedHosts], planProvisioning, personas: results.map(result => ({ id: result.id, actions: result.actionCount, startHeadings: result.start.headings, endHeadings: result.endHeadings, beforeReload: result.beforeReload, afterReload: result.afterReload, pageErrors: result.errors })) }, null, 2))
