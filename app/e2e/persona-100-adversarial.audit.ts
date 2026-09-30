// Opt-in audit only: excluded from Playwright's default test filename pattern.
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { enterPlanWithoutRecord, refinePlan } from "./plan-flow"
import { undersizedInteractiveTargets } from "./touch-audit"

const ROOT = path.resolve(import.meta.dirname, "../../.scratch/persona-100-browser")
const ORIGIN = "http://127.0.0.1:4419"
const WIDTHS = [320, 360, 375, 390, 768, 1280]
const EVENTS = [800, 1500, 3000, 5000, 10000, 21097, 42195]
const EXPERIENCE = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"]
const EXPERIENCE_LABEL = [/달리기를 막 시작했어요/u, /훈련 계획에 맞춰 달려 본 경험/u, /구조화된 훈련과 경기 경험/u]
const FOCUS = [/골고루.*MIX/u, /편하게 오래.*BASE/u, /조금 힘들게 꾸준히.*LT/u,
  /숨차게 반복.*VO₂/u, /짧고 세게.*GLY/u, /스피드.*ATP-PC/u, /회복만.*REC/u]
const ENTRY = ["홈", "계획", "일지", "분석"]
type Finding = { code: string; severity: "P1" | "P2"; phase: string; evidence: unknown }
type Evidence = {
  persona: ReturnType<typeof persona>; run: string; source: string; phase: string; attempted: boolean;
  generated: boolean; safetyBlocked: boolean; finalized: boolean; productErrors: string[]; harnessErrors: string[];
  findings: Finding[]; steps: { phase: string; detail: unknown }[]; audits: unknown[];
  networkBlocked: unknown[]; pageErrors: string[]; screenshots: string[]; numeric: unknown[];
}

function persona(n: number) {
  const seed = 0x930000 + n * 7919
  return { id: `synthetic-p${String(n).padStart(3, "0")}`, n, seed,
    width: WIDTHS[(n - 1) % WIDTHS.length]!, height: n % 3 === 0 ? 568 : n % 3 === 1 ? 800 : 667,
    entry: ENTRY[(n - 1) % ENTRY.length]!, event: EVENTS[(n * 3) % EVENTS.length]!,
    experience: EXPERIENCE[Math.floor((n - 1) / 4) % 3]!, experienceIndex: Math.floor((n - 1) / 4) % 3,
    focusIndex: (n * 5) % 7, days: [3, 4, 5, 6, "EVERY_DAY"][(n * 3) % 5]!,
    frame: [7, 9, 10][Math.floor(n / 7) % 3]!, twice: n % 9 === 0,
    safety: n % 10 === 0 ? "REVIEW_REQUIRED" : "NO_KNOWN_RISK",
    record: n % 3 === 0 ? "current" : n % 3 === 1 ? "stale" : "none",
    currentEntry: n % 11 === 0, reducedMotion: n % 4 === 0,
    zoom: n % 10 === 3 ? 2 : n % 10 === 7 ? 1.25 : 1,
    habit: ["help-back", "keyboard-cancel", "tab-return", "reload", "scroll"][(n * 7) % 5]!,
    recordSeconds: 1080 + n * 2.25, catalogChoiceIndex: n * 13,
  }
}

function add(e: Evidence, code: string, evidence: unknown, severity: "P1" | "P2" = "P2") {
  if (!e.findings.some(f => f.code === code && f.phase === e.phase)) e.findings.push({ code, severity, phase: e.phase, evidence })
}

async function capture(page: Page, e: Evidence, label: string) {
  const file = path.join(ROOT, e.run, e.persona.id, `${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  e.screenshots.push(path.relative(ROOT, file).replaceAll("\\", "/"))
}

async function audit(page: Page, e: Evidence, label: string) {
  e.phase = label
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth, layout: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth, scroll: scrollY,
    height: document.documentElement.scrollHeight, screenHeight: innerHeight,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    zoom: getComputedStyle(document.documentElement).zoom,
    scrollers: [...document.querySelectorAll<HTMLElement>("main, .mobile-frame, .screen, .app-shell, [role=dialog]")]
      .map(el => ({ name: el.className, top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY })),
    clipped: [...document.querySelectorAll<HTMLElement>("button,input,select,summary,[role=dialog]")].filter(el => el.checkVisibility())
      .flatMap(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1
        ? [{ name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 70), left: r.left, right: r.right }] : [] }).slice(0, 20),
  }))
  // Ignore subpixel rounding of a specified 44px target, not genuinely small hit areas.
  const smallTargets = (await undersizedInteractiveTargets(page.locator("body"))).filter(t => t.width < 43.5 || t.height < 43.5)
  e.audits.push({ label, geometry, smallTargets })
  if (geometry.width > geometry.layout + 1) add(e, "HORIZONTAL_OVERFLOW", geometry)
  if (smallTargets.length) add(e, "SMALL_TAP_TARGET", smallTargets)
  if ((e.persona.n <= 6 && ["entry", "generated", "picker", "active"].includes(label)) || label === "numeric-gap") await capture(page, e, label)
}

async function click(page: Page, e: Evidence, target: Locator, name: string) {
  e.phase = name
  await target.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  await target.click()
  e.steps.push({ phase: name, detail: { scrollY: before, label: name } })
}

async function picker(page: Page, e: Evidence) {
  const root = page.locator(".catalog-workout-picker")
  if (!await root.count()) { e.numeric.push({ kind: "catalog-picker-not-present", reason: "existing detailed lane or no eligible non-rest session" }); return }
  await click(page, e, root.locator(":scope > summary"), "open-catalog")
  const address = root.getByRole("combobox", { name: "바꿀 일정", exact: true })
  const addresses = await address.locator("option").evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value))
  if (e.persona.focusIndex === 1 || e.persona.focusIndex === 6) {
    await address.selectOption(addresses[e.persona.n % addresses.length]!)
  }
  const select = root.getByRole("combobox", { name: "훈련 구성", exact: true })
  const initialSelection = await select.inputValue()
  const initialRecord = root.getByRole("combobox", { name: "참고 페이스에 사용할 5km 기록" })
  const initialRecordValue = await initialRecord.count() ? await initialRecord.inputValue() : null
  const options = await select.locator("option").evaluateAll(nodes => nodes.map(n => ({ id: (n as HTMLOptionElement).value, name: n.textContent })))
  const catalog = JSON.parse(await readFile(path.join(ROOT, "baseline/impl/src/prescription/all-workout-catalog.json"), "utf8")).rows as { id: string; eventDistances: number[]; experience: string[] }[]
  const incompatible = options.filter(o => {
    const entry = catalog.find(r => r.id === o.id)
    return entry && (!entry.eventDistances.includes(e.persona.event) || !entry.experience.includes(e.persona.experience))
  })
  e.steps.push({ phase: "catalog-pool", detail: { address: await address.inputValue(), options, incompatible } })
  if (incompatible.length) add(e, "INCOMPATIBLE_POOL", incompatible)

  // Prefer a compatible distance configuration so numeric gaps are actually exercised.
  const compatible = options.filter(o => !incompatible.includes(o))
  const candidates = compatible.filter(o => /X-|P-INTRO/u.test(o.id))
  const choice = (candidates.length ? candidates : compatible.length ? compatible : options)[e.persona.catalogChoiceIndex % (candidates.length || compatible.length || options.length)]!
  await select.selectOption(choice.id)
  const record = root.getByRole("combobox", { name: "참고 페이스에 사용할 5km 기록" })
  if (await record.count() && e.persona.record !== "none") await record.selectOption(`synthetic-record-${e.persona.n}`)
  const pending = root.getByRole("spinbutton", { includeHidden: true })
  const missingSummary = root.locator("summary", { hasText: /^미정 구간 시간 정하기/u })
  const apply = root.getByRole("button", { name: "이 구성으로 바꾸기", exact: true })
  const missingCount = await pending.count()
  const hidden = missingCount > 0 && !await pending.first().isVisible()
  e.numeric.push({ kind: "catalog-preview", choice: choice.id, missingCount, hidden,
    applyEnabled: await apply.isEnabled(), text: await root.innerText(), address: await address.inputValue() })
  if (hidden && !await apply.isEnabled()) add(e, "HIDDEN_REQUIRED_NUMERIC", { choice: choice.id, missingCount, text: await root.innerText() })
  if (missingCount) await audit(page, e, "numeric-gap")

  const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
  const currentRecordValue = await record.count() ? await record.inputValue() : null
  const visiblyChanged = choice.id !== initialSelection || currentRecordValue !== initialRecordValue
  e.steps.push({ phase: "draft-comparison", detail: { initialSelection, choice: choice.id, initialRecordValue, currentRecordValue, visiblyChanged } })
  if (visiblyChanged && await start.count() && await start.isEnabled()) {
    // Probe silent finalization in selected journeys; remaining journeys recover and apply explicitly.
    if (e.persona.n % 8 === 1) {
      e.phase = "finalize-with-unapplied-draft"
      const expectedAddress = await address.inputValue()
      await click(page, e, start, e.phase)
      const raw = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
      if (raw) {
        const saved = JSON.parse(raw)
        const [day, slot] = expectedAddress.split(":")
        const actual = saved.activePlan?.sessions?.find((s: { day: number; slot: string }) => s.day === Number(day) && s.slot === slot)
        e.finalized = true
        add(e, "UNAPPLIED_DRAFT_FINALIZED", { previewCatalogId: choice.id, savedCatalogId: actual?.prescription?.catalogWorkout?.catalogId ?? null, address: expectedAddress }, "P1")
        return
      }
    } else {
      add(e, "START_ENABLED_WITH_UNAPPLIED_DRAFT", { choice: choice.id, missingCount }, "P1")
    }
  }

  e.phase = "numeric-recovery"
  if (missingCount && hidden) await missingSummary.click()
  for (let i = 0; i < missingCount; i++) {
    const control = pending.nth(i)
    const label = await control.evaluate(el => (el as HTMLInputElement).labels?.[0]?.textContent ?? "")
    // Deliberate synthetic direct targets, never inferred as a real athlete prescription.
    const match = label.match(/(\d+(?:\.\d+)?)m/u)
    const distance = Number(match?.[1] ?? 200)
    const seconds = /회복/u.test(label) ? 75 + e.persona.n % 20 : Math.max(8, distance / (3.5 + e.persona.n % 5 * 0.2))
    await control.fill(String(Number(seconds.toFixed(2))))
  }
  const confirmations = root.getByRole("checkbox")
  for (let i = 0; i < await confirmations.count(); i++) await confirmations.nth(i).check()
  await audit(page, e, "picker")
  if (!await apply.isEnabled()) {
    e.numeric.push({ kind: "catalog-remains-blocked", choice: choice.id, text: await root.innerText() })
    add(e, "CATALOG_APPLY_DEADEND", { choice: choice.id, text: await root.innerText() })
    // The parent fix supplies an explicit cancel. Baseline fallback is logged, not a pass.
    const cancel = root.getByRole("button", { name: /취소/u }).first()
    if (await cancel.isVisible()) await cancel.click()
    return
  }
  const submitted = await pending.evaluateAll(nodes => nodes.map(n => ({ label: (n as HTMLInputElement).labels?.[0]?.textContent, value: (n as HTMLInputElement).value })))
  await apply.click()
  e.steps.push({ phase: "catalog-applied", detail: { choice: choice.id, submitted, text: await root.innerText() } })

  // Re-selecting the same applied session must not erase its input basis.
  if (addresses.length > 1) {
    const selectedAddress = await address.inputValue()
    await address.selectOption(addresses.find(a => a !== selectedAddress)!)
    await address.selectOption(selectedAddress)
    const restored = await root.getByRole("spinbutton", { includeHidden: true }).evaluateAll(nodes => nodes.map(n => (n as HTMLInputElement).value))
    const restoredRecord = await record.count() ? await record.inputValue() : null
    if (submitted.some(s => s.value !== "") && restored.some(v => v === "")
      || e.persona.record === "current" && await record.count() && restoredRecord === "") {
      add(e, "APPLIED_INPUTS_LOST_ON_RETURN", { submitted, restored, restoredRecord, selectedAddress }, "P1")
    }
    e.numeric.push({ kind: "applied-input-restoration", submitted, restored, restoredRecord })
    const cancel = root.getByRole("button", { name: /취소/u }).first()
    if (await cancel.isVisible()) await cancel.click()
  }
}

for (let n = 1; n <= 100; n++) {
  const p = persona(n)
  test(`${p.id} ${p.width}px ${p.entry} ${p.experience} ${p.event}m ${p.habit}`, async ({ page, context }, info) => {
    const run = info.project.name || "baseline"
    const e: Evidence = { persona: p, run, source: run === "current" ? "working-tree" : "9085282-frozen", phase: "setup",
      attempted: false, generated: false, safetyBlocked: false, finalized: false, productErrors: [], harnessErrors: [],
      findings: [], steps: [], audits: [], networkBlocked: [], pageErrors: [], screenshots: [], numeric: [] }
    await mkdir(path.join(ROOT, run, p.id), { recursive: true })
    page.on("pageerror", error => e.pageErrors.push(error.message))
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin !== ORIGIN || !["GET", "HEAD"].includes(req.method()) || /\/(?:api|auth|rest)\//u.test(url.pathname)) {
        e.networkBlocked.push({ method: req.method(), destination: url.origin === ORIGIN ? "local-api" : "external", pathname: url.pathname })
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })
    await context.routeWebSocket("**/*", route => {
      const url = new URL(route.url())
      if (url.hostname === "127.0.0.1" && url.port === "4419") route.connectToServer()
      else { e.networkBlocked.push({ method: "WEBSOCKET", destination: "external" }); route.close() }
    })
    await page.setViewportSize({ width: p.width, height: p.height })
    await page.emulateMedia({ reducedMotion: p.reducedMotion ? "reduce" : "no-preference" })
    await page.clock.setFixedTime(new Date("2026-09-30T03:00:00Z"))
    await page.addInitScript(p => {
      let randomState = p.seed
      Math.random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296 }
      if (sessionStorage.getItem("synthetic-persona-initialized")) return
      sessionStorage.setItem("synthetic-persona-initialized", p.id)
      if (p.record !== "none") localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
        schemaVersion: 1, id: `synthetic-record-${p.n}`, purpose: "RECENT_RESULT", eventDistanceM: 5000,
        performanceSeconds: p.recordSeconds, achievedOn: p.record === "current" ? "2026-09-10" : "2023-01-10",
        seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
        sourceRef: `athlete-record:synthetic-record-${p.n}`, savedAt: "2026-09-30T03:00:00Z",
      }]))
    }, p)
    const nav = () => page.getByRole("navigation", { name: "주 탭" })
    try {
      await page.goto("/?app=1&uitest=1")
      await expect(nav()).toBeVisible()
      if (p.zoom !== 1) await page.addStyleTag({ content: `html { zoom: ${p.zoom}; }` })
      if (p.entry !== "홈") await click(page, e, nav().getByRole("button", { name: p.entry, exact: true }), "entry-tab")
      await audit(page, e, "entry")
      if (p.entry === "일지" || p.entry === "분석") {
        const action = page.getByRole("button", { name: p.entry === "일지" ? "내 첫 기록 남기기" : "첫 기록 남기기", exact: true })
        await click(page, e, action, "empty-state-record-entry")
        await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
        e.steps.push({ phase: "record-entry", detail: await page.locator("main").innerText() })
        const back = page.getByRole("button", { name: /뒤로|이전/u }).first()
        if (await back.isVisible()) { await back.click(); e.steps.push({ phase: "record-entry-back", detail: await page.locator("main").innerText() }) }
      }
      if (p.habit === "reload") { await page.reload(); await expect(nav()).toBeVisible() }
      if (p.habit === "keyboard-cancel") {
        await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Escape")
        e.steps.push({ phase: "keyboard-entry", detail: await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.slice(0, 70)) })
      }
      await click(page, e, nav().getByRole("button", { name: "계획", exact: true }), "plan-entry")
      const reuse = page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })
      if (await reuse.isVisible()) throw new Error("Unexpected previous intake in a fresh isolated context")
      e.attempted = true
      e.phase = "plan-input"
      if (p.currentEntry) {
        await page.getByRole("combobox", { name: "종목", exact: true }).selectOption(String(p.event))
        const total = p.event === 800 ? 121.5 + n / 10 : p.event === 1500 ? 265.25 + n / 4 : p.event === 3000 ? 570.5 + n : p.recordSeconds * p.event / 5000
        await page.getByLabel("분", { exact: true }).fill(String(Math.floor(total / 60)))
        await page.getByLabel("초", { exact: true }).fill(String(Number((total % 60).toFixed(2))))
        await page.getByLabel("기록 달성일").fill("2026-09-10")
        await page.getByRole("button", { name: "내 계획 받기", exact: true }).click()
      } else await enterPlanWithoutRecord(page, String(p.event))
      if (p.habit === "help-back") {
        const help = page.getByRole("button", { name: /설명 보기/u }).first()
        if (await help.isVisible()) { await help.click(); await page.keyboard.press("Escape"); e.steps.push({ phase: "help-escape", detail: "opened actual product help, pressed Escape" }) }
      }
      await page.locator(".plan-choice").filter({ hasText: EXPERIENCE_LABEL[p.experienceIndex] }).click()
      if (p.habit === "help-back") {
        await page.getByRole("button", { name: "이전", exact: true }).click()
        await page.locator(".plan-choice").filter({ hasText: EXPERIENCE_LABEL[p.experienceIndex] }).click()
      }
      await page.getByRole("button", { name: p.days === "EVERY_DAY" ? /^매일/u : new RegExp(`^${p.days}일`, "u") }).click()
      await page.getByRole("button", { name: p.safety === "REVIEW_REQUIRED"
        ? /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u : /통증은 없고 몸 상태는 평소와 같아요/u }).click()
      if (p.safety === "REVIEW_REQUIRED") {
        e.phase = "intentional-safety-block"
        await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
        expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
        e.safetyBlocked = true
        await audit(page, e, "safety-block")
      } else {
        e.phase = "generate"
        await expect(page.getByRole("heading", { name: "계획이 준비됐어요", exact: true })).toBeVisible()
        e.generated = true
        await refinePlan(page, "훈련 종류", FOCUS[p.focusIndex]!)
        if (p.currentEntry && await page.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).isVisible()) await page.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
        if (!p.currentEntry && p.frame !== 9) await refinePlan(page, "달력 길이", p.frame === 7 ? /7일만 먼저 받기/u : /10일 계획 받기/u)
        if (p.twice) await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u)
        if (p.habit === "tab-return") {
          e.phase = "tab-return"
          const before = await page.locator("main").innerText()
          await nav().getByRole("button", { name: "홈", exact: true }).click()
          await nav().getByRole("button", { name: "계획", exact: true }).click()
          if (!await page.getByRole("heading", { name: "계획이 준비됐어요", exact: true }).isVisible()) {
            add(e, "GENERATED_DRAFT_LOST_ON_TAB_RETURN", { before, after: await page.locator("main").innerText() })
            await capture(page, e, "draft-lost-tab-return")
            // Re-enter explicitly to continue method inspection; loss remains a failing finding.
            await enterPlanWithoutRecord(page, String(p.event))
            await page.locator(".plan-choice").filter({ hasText: EXPERIENCE_LABEL[p.experienceIndex] }).click()
            await page.locator(".plan-choice").filter({ hasText: p.days === "EVERY_DAY" ? /^매일/u : new RegExp(`^${p.days}일`, "u") }).click()
            await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
            await refinePlan(page, "훈련 종류", FOCUS[p.focusIndex]!)
            if (p.frame !== 9) await refinePlan(page, "달력 길이", p.frame === 7 ? /7일만 먼저 받기/u : /10일 계획 받기/u)
            if (p.twice) await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u)
          }
        }
        if (p.habit === "keyboard-cancel") { await page.keyboard.press("Tab"); await page.keyboard.press("Escape") }
        await audit(page, e, "generated")
        await picker(page, e)
        const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
        if (!e.finalized && await start.count()) {
          if (await start.isEnabled()) {
            await click(page, e, start, "explicit-finalize")
            await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
            e.finalized = true
          } else {
            e.numeric.push({ kind: "finalize-blocked", visibleStatus: await page.locator("main").innerText() })
          }
        }
        if (e.finalized) {
          await audit(page, e, "active")
          const state = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
          const saved = state ? JSON.parse(state) : null
          e.numeric.push({ kind: "saved-session-prescriptions", sessions: saved?.activePlan?.sessions ?? [] })
          await page.reload()
          await nav().getByRole("button", { name: "계획", exact: true }).click()
          await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
          expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(state)
          if (p.n % 4 === 2) {
            const diary = page.getByRole("button", { name: /(?:오전|오후) 훈련 기록 남기기/u }).first()
            if (await diary.isVisible()) {
              await click(page, e, diary, "linked-journal")
              await expect(page.getByRole("button", { name: "계획대로 마쳤어요", exact: true })).toBeVisible()
              e.steps.push({ phase: "linked-journal", detail: await page.locator("main").innerText() })
              await audit(page, e, "linked-journal")
            }
          }
        }
      }
    } catch (error) {
      const message = `${e.phase}: ${error instanceof Error ? error.message : String(error)}`
      if (e.phase === "setup" || /Target.*closed|browserType.launch|net::ERR_CONNECTION_REFUSED|ENOENT|strict mode violation/u.test(message)) e.harnessErrors.push(message)
      else e.productErrors.push(message)
      await capture(page, e, "failure").catch(screenshotError => e.harnessErrors.push(String(screenshotError)))
    } finally {
      if (e.pageErrors.length) add(e, "RUNTIME_PAGE_ERROR", e.pageErrors, "P1")
      await writeFile(path.join(ROOT, run, p.id, "evidence.json"), JSON.stringify(e, null, 2))
      if (!page.isClosed()) {
        await writeFile(path.join(ROOT, run, p.id, "synthetic-local-state.json"), JSON.stringify(await page.evaluate(() => ({
          local: { ...localStorage }, session: { ...sessionStorage },
        })), null, 2))
      }
      await info.attach("per-persona-evidence", { path: path.join(ROOT, run, p.id, "evidence.json"), contentType: "application/json" })
    }
    expect(e.harnessErrors, `${p.id} harness errors`).toEqual([])
    expect(e.productErrors, `${p.id} product errors`).toEqual([])
    expect(e.findings.map(f => `${f.severity}:${f.code}@${f.phase}`), `${p.id} confirmed observations (not a UX pass)`).toEqual([])
  })
}
