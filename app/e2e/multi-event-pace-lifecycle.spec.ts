import { test, expect, type Page } from "@playwright/test"
import type { PlanBetaStateV3 } from "../src/domain/plan-beta-schema"
import type { AthleteRecord } from "../src/domain/athlete-records"
import type * as Harness from "./fixtures/multi-event-pace-lifecycle"

const PLAN = "trainoracle.plan-beta.v1", RECORDS = "trainoracle.athlete-records.v1", JOURNAL = "trainoracle.journal.v1"
const HISTORY = "trainoracle.plan-beta.history.v1"
const helperPath = "/e2e/fixtures/multi-event-pace-lifecycle.ts"
const TODAY = "2026-10-02", DATE = "2026-09-25"
type Extra = { seconds: number; date: string | null; purpose: "RECENT_RESULT" | "PERSONAL_BEST" | "RACE_GOAL" }
type Persona = { id: string; name: string; event: number; seconds: number; changed: number; goal?: boolean;
  overBudget?: number;
  extras?: Extra[]; condition?: "recent" | "pb" | "unknown" | "unknown-apply" | "ambiguous" | "rolling" | "scope" | "offline" | "retry";
  slot?: "PM"; partial?: boolean; width?: number }

const events = [
  { event: 800, seconds: 121.5, changed: 124.25 },
  { event: 1500, seconds: 241.25, changed: 245.75 },
  { event: 3000, seconds: 541.75, changed: 548.5 },
  { event: 5000, seconds: 1111.5, changed: 1126.25 },
  // Keep the original slower inputs as required negative branches, not erased failures.
  { event: 10000, seconds: 2401.25, changed: 2370.75, overBudget: 2433.75 },
  { event: 21097.5, seconds: 5400.5, changed: 5310.25, overBudget: 5480.25 },
  { event: 42195, seconds: 11401.75, changed: 11248.25, overBudget: 11555.25 },
] as const
const personas: Persona[] = [
  ...events.map((event, index) => ({ ...event, id: `MEP-${String(index + 1).padStart(2, "0")}`,
    name: `${event.event}m actual fractional`, width: index % 2 ? 375 : 1280 })),
  ...events.map((event, index) => ({ ...event, id: `MEP-${String(index + 8).padStart(2, "0")}`,
    name: `${event.event}m aspirational goal`, goal: true, partial: index % 2 === 1 })),
  { ...events[0], id: "MEP-15", name: "newer slower actual beats old PB and fastest goal", condition: "recent",
    extras: [{ seconds: 118, date: "2025-08-01", purpose: "PERSONAL_BEST" }, { seconds: 115, date: null, purpose: "RACE_GOAL" }] },
  { ...events[1], id: "MEP-16", name: "explicit PB survives newer slower recommendation", condition: "pb",
    extras: [{ seconds: 241.25, date: DATE, purpose: "PERSONAL_BEST" }, { seconds: 252, date: "2026-09-30", purpose: "RECENT_RESULT" }] },
  { ...events[2], id: "MEP-17", name: "unknown-date faster actual never becomes recent", condition: "unknown",
    extras: [{ seconds: 530, date: null, purpose: "PERSONAL_BEST" }] },
  { ...events[4], id: "MEP-18", name: "explicit unknown-date long RP update retains null", condition: "unknown-apply" },
  { ...events[0], id: "MEP-19", name: "same-date conflicting actuals require explicit choice", condition: "ambiguous",
    extras: [{ seconds: 122.75, date: DATE, purpose: "RECENT_RESULT" }] },
  { ...events[1], id: "MEP-20", name: "inclusive rolling boundary does not replace recent source", condition: "rolling",
    extras: [{ seconds: 230, date: "2025-10-02", purpose: "PERSONAL_BEST" }, { seconds: 225, date: "2025-10-01", purpose: "PERSONAL_BEST" }] },
  { ...events[2], id: "MEP-21", name: "PM actual retains AM planned occurrence and partial outcome", slot: "PM", partial: true, width: 320 },
  { ...events[0], id: "MEP-22", name: "guest-to-synthetic-account scope rejects stale apply", condition: "scope" },
  { ...events[1], id: "MEP-23", name: "offline guest apply persists before reconnect", condition: "offline", width: 375 },
  { ...events[3], id: "MEP-24", name: "failed plan write is not success and explicit retry completes", condition: "retry", partial: true },
]

async function stored<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null"), key) as Promise<T>
}
async function plan(page: Page) {
  const result = await stored<PlanBetaStateV3>(page, PLAN)
  expect(result?.version, "An actual accepted plan must exist").toBe(3)
  return result
}
async function tab(page: Page, name = "훈련") {
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name, exact: true }).click()
}
function timeText(seconds: number) {
  const rounded = Math.round(seconds * 10) / 10
  return rounded >= 60 ? `${Math.floor(rounded / 60)}분 ${Number((rounded % 60).toFixed(1))}초` : `${rounded}초`
}
function timeFields(seconds: number) {
  return { minutes: String(Math.floor(seconds / 60)), seconds: String(Number((seconds % 60).toFixed(4))) }
}
async function numeric(page: Page) {
  return page.evaluate(async path => (await import(/* @vite-ignore */ path) as typeof Harness).numeric(), helperPath)
}
async function assertNumeric(page: Page, persona: Persona, seconds: number, source: AthleteRecord) {
  const rows = await numeric(page)
  expect(rows.length, "There must be at least one actual numeric MAIN, not an RPE fallback").toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.source.id).toBe(source.id)
    expect(row.source.seconds).toBe(seconds)
    expect(row.source.event === 21097 ? 21097.5 : row.source.event).toBe(persona.event)
    const pace = seconds * 1000 / persona.event
    const scale = row.unit === "seconds" ? row.distance / 1000 : 1
    expect(["RACE_AVERAGE_V1", "FIVE_K_THRESHOLD_V1"]).toContain(row.model)
    const offsets = row.model === "FIVE_K_THRESHOLD_V1" ? [24 * 1000 / 1609.344, 30 * 1000 / 1609.344] : [0, 0]
    expect(row.minimum).toBeCloseTo((pace + offsets[0]!) * scale, 8)
    expect(row.maximum).toBeCloseTo((pace + offsets[1]!) * scale, 8)
    if (persona.goal) {
      expect(row.source.kind).toBe("GOAL")
      expect(row.source.purpose).not.toBe("CURRENT_CAPABILITY")
    } else expect(row.source.kind).not.toBe("GOAL")
  }
  return rows
}
async function openRecords(page: Page, active: boolean) {
  if (active) await page.getByRole("button", { name: "기준 기록·페이스 바꾸기", exact: true }).click()
  else {
    await page.locator("summary", { hasText: "기록 관리·훈련표 읽기" }).click()
    await page.getByRole("button", { name: "내 경기 기록", exact: true }).click()
  }
  await expect(page.getByRole("heading", { name: "내 경기 기록", exact: true })).toBeVisible()
}
async function enterRecord(page: Page, event: number, extra: Extra) {
  await page.getByRole("combobox", { name: "기록 역할" }).selectOption(extra.purpose)
  await page.getByRole("combobox", { name: "종목 거리" }).selectOption(String(event))
  await page.getByRole("button", { name: "시간 입력", exact: true }).click()
  const fields = timeFields(extra.seconds)
  await page.getByRole("textbox", { name: "기록 분", exact: true }).fill(fields.minutes)
  await page.getByRole("textbox", { name: "기록 초", exact: true }).fill(fields.seconds)
  await page.getByRole("button", { name: extra.purpose === "RACE_GOAL" ? "목표 확인" : "날짜 확인", exact: true }).click()
  if (extra.purpose !== "RACE_GOAL") await page.getByRole("textbox", { name: "달성일", exact: true }).fill(extra.date ?? "")
  await page.getByRole("button", { name: "기록 저장", exact: true }).click()
  await expect.poll(async () => (await stored<AthleteRecord[]>(page, RECORDS))?.some(row =>
    row.eventDistanceM === event && row.performanceSeconds === extra.seconds
    && row.purpose === extra.purpose && row.achievedOn === extra.date)).toBe(true)
  return (await stored<AthleteRecord[]>(page, RECORDS)).find(row => row.eventDistanceM === event
    && row.performanceSeconds === extra.seconds && row.purpose === extra.purpose && row.achievedOn === extra.date)!
}
async function chooseLongEventRacePace(page: Page, event: number, recordId: string) {
  const catalogId = event === 10000 ? "RP-10000-DISTANCE"
    : event === 21097.5 ? "RP-HALF-DISTANCE" : "RP-42195-DISTANCE"
  await page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "훈련 조절", exact: true }).click()
  const picker = page.getByRole("region", { name: "다른 훈련으로 바꾸기" })
  await picker.getByRole("combobox", { name: "훈련 구성" }).selectOption(catalogId)
  await picker.locator("summary", { hasText: "기록으로 구간 페이스 정하기" }).click()
  await picker.getByRole("combobox", { name: "1000m 구간의 기준" }).selectOption(recordId)
  const longer = picker.getByRole("checkbox", { name: /준비·회복·정리까지/u })
  if (await longer.count()) await longer.check()
  await picker.getByRole("button", { name: "이 구성으로 바꾸기" }).click()
  await expect(picker).toContainText("계획안에 반영했어요")
}
async function confirmNumeric(page: Page, sourceId: string) {
  const confirmation = page.getByRole("button", { name: "기준 기록 확인하기", exact: true })
  if (await confirmation.isVisible()) {
    await confirmation.click()
    const all = await stored<AthleteRecord[]>(page, RECORDS)
    const source = all.find(row => row.id === sourceId)!
    expect(source).toBeDefined()
    const views = await page.evaluate(async ({ path, event }) =>
      (await import(/* @vite-ignore */ path) as typeof Harness).records(event), { path: helperPath, event: source.eventDistanceM })
    const shown = all.filter(row => row.eventDistanceM === source.eventDistanceM)
      .sort((a, b) => Number(b.id === views.choices.recommendedRecordId) - Number(a.id === views.choices.recommendedRecordId))
    const index = shown.findIndex(row => row.id === sourceId)
    expect(index).toBeGreaterThanOrEqual(0)
    await page.getByRole("group", { name: "기준 기록 선택", exact: true }).getByRole("button").nth(index).click()
    await page.getByRole("button", { name: source.purpose === "RACE_GOAL" ? "이 목표 기록으로 페이스 적용" : "이 기록으로 개인 페이스 적용", exact: true }).click()
  } else {
    const offer = page.getByRole("button", { name: "이 기록으로 목표 페이스 보기", exact: true })
    if (await offer.isVisible()) {
      const section = page.getByRole("region", { name: "최근 기록으로 페이스 추천" })
      await section.locator("summary", { hasText: "기준 바꾸기" }).click()
      await section.getByRole("combobox", { name: "기준 기록", exact: true }).selectOption(sourceId)
      await offer.click()
    }
  }
  // Absence of confirmation never grants a pass: the persisted numeric assertion is mandatory.
}

async function assertBoundSuccessor(page: Page, persona: Persona, source: AthleteRecord,
  predecessor: PlanBetaStateV3, rows: Awaited<ReturnType<typeof numeric>>, startDate: Date) {
  // Inspect the untouched candidate's binding and raw UI numbers without applying a new draft.
  await page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "훈련 조절", exact: true }).click()
  const picker = page.getByRole("region", { name: "다른 훈련으로 바꾸기" })
  await expect(picker).toBeVisible()
  const addresses = [...new Set(rows.map(row => `${row.day}:${row.slot}`))]
  expect(addresses.length).toBeGreaterThan(0)
  const evidence = []
  for (const address of addresses) {
    const mainRows = rows.filter(row => `${row.day}:${row.slot}` === address)
    const session = predecessor.activePlan.sessions.find(row => `${row.day}:${row.slot}` === address)!
    expect(session.prescription.kind).toBe("RPE_TIME_RANGE")
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected an inherited catalog MAIN")
    const catalogId = session.prescription.catalogWorkout!.catalogId
    // Only switch the inspected occurrence, never select a record or apply an editor draft.
    await picker.getByRole("combobox", { name: "바꿀 일정", exact: true }).selectOption(address)
    await expect(picker.getByRole("combobox", { name: "훈련 구성", exact: true })).toHaveValue(catalogId)
    const references = picker.locator("details", { has: page.locator("summary", { hasText: /^기록으로 구간 페이스 정하기$/ }) })
    await references.locator(":scope > summary").click()
    const distances = [...new Set(mainRows.map(row => row.distance))]
    for (const distance of distances) {
      const selected = references.getByRole("combobox", { name: `${distance}m 구간의 기준`, exact: true })
      await expect(selected).toHaveValue(source.id)
      await expect(selected.locator("option:checked")).toContainText(timeText(source.performanceSeconds))
      await expect(selected.locator("option:checked")).toContainText(source.achievedOn ?? (persona.goal ? "미래 목표" : "날짜 미입력"))
    }
    await expect(references.getByRole("status")).toContainText(persona.goal
      ? "목표기록 기준이에요. 현재 경기력을 뜻하지 않아요."
      : source.achievedOn === null ? "날짜 미입력 기록이에요. 최근 기록인지 확인해 주세요." : `${source.achievedOn} 경기의 평균 속도예요.`)
    const formula = picker.locator("details", { has: page.locator("summary", { hasText: /^기준 기록·계산식$/ }) })
    await formula.locator(":scope > summary").click()
    const basis = `경기 평균 페이스: ${source.performanceSeconds}초 ÷ ${persona.event}m × 1,000m`
    await expect(formula.getByText(basis, { exact: true })).toBeVisible()
    await expect(formula).toContainText("RACE_AVERAGE_V1")
    const raw = formula.locator("p").filter({ hasText: /^반올림 전 구간 시간:/ })
    await expect(raw).toHaveCount(distances.length)
    const rawTexts = await raw.allTextContents()
    const targets = rawTexts.map(text => {
      const match = /^반올림 전 구간 시간: ([0-9.]+)초$/.exec(text)
      expect(match, "Same-event RP must expose an exact raw number, not a range or fallback").not.toBeNull()
      return Number(match![1])
    })
    for (const [index, distance] of distances.entries()) {
      expect(targets[index]).toBeCloseTo(source.performanceSeconds * distance / persona.event, 8)
    }
    await expect(picker.getByRole("button", { name: "이 구성으로 바꾸기", exact: true })).toBeDisabled()
    await expect(picker.getByRole("button", { name: "변경 취소", exact: true })).toHaveCount(0)
    evidence.push({ address, catalogId, recordId: source.id, basis, rawTexts, distances, targets })
    await formula.locator(":scope > summary").click()
    await references.locator(":scope > summary").click()
  }
  for (const address of addresses) {
    const main = rows.find(row => `${row.day}:${row.slot}` === address)!
    const date = new Date(startDate)
    date.setUTCDate(date.getUTCDate() + main.day - 1)
    await page.getByRole("button", { name: new RegExp(`${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`) }).click()
    await expect(page.getByRole("dialog")).toContainText(`${Math.round(main.minimum * 10) / 10}s`)
    await page.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
  }
  return evidence
}

{
  expect(personas).toHaveLength(24)
  expect(new Set(personas.map(row => row.id)).size).toBe(24)
  expect(new Set(personas.map(row => row.name)).size).toBe(24)
  expect(personas.filter(row => row.overBudget !== undefined).map(row => row.id))
    .toEqual(["MEP-05", "MEP-06", "MEP-07", "MEP-12", "MEP-13", "MEP-14", "MEP-18"])
  for (const persona of personas.filter(row => row.overBudget !== undefined)) {
    expect(persona.changed).toBeLessThan(persona.seconds)
    expect(persona.overBudget).toBeGreaterThan(persona.seconds)
  }
  for (const event of events) expect(personas.filter(row => row.event === event.event && row.goal)).toHaveLength(1)
}

for (const persona of personas) test(`${persona.id} ${persona.name}`, async ({ page, context, baseURL }, info) => {
  const completed: string[] = [], errors: string[] = []
  let overBudgetVerified = false
  const step = async <T>(name: string, work: () => Promise<T>) => test.step(name, async () => {
    const result = await work(); completed.push(name); return result
  })
  page.on("pageerror", error => errors.push(error.message))
  const appOrigin = new URL(baseURL ?? "").origin
  await context.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
  await page.setViewportSize({ width: persona.width ?? 1280, height: 900 })
  await page.clock.setFixedTime(new Date(`${TODAY}T03:00:00Z`))
  try {
    const source = await step("01 record input and provenance", async () => {
      await page.goto("/?app=1")
      await tab(page)
      await openRecords(page, false)
      for (const extra of persona.extras ?? []) await enterRecord(page, persona.event, extra)
      await page.getByRole("button", { name: "계획으로", exact: true }).click()
      const eventLabel = persona.event === 21097.5 ? "하프 마라톤"
        : persona.event === 42195 ? "마라톤"
        : persona.event === 10000 ? "10km"
        : persona.event === 5000 ? "5km" : `${persona.event}m`
      await page.getByRole("button", { name: eventLabel, exact: true }).click()
      await page.getByRole("button", { name: persona.goal ? "목표만 있어요" : "내 기록", exact: true }).click()
      const fields = timeFields(persona.seconds)
      await page.getByLabel("분", { exact: true }).fill(fields.minutes)
      await page.getByLabel("초", { exact: true }).fill(fields.seconds)
      if (!persona.goal) {
        await page.getByText("기록 날짜 추가", { exact: true }).click()
        await page.getByLabel("기록 달성일", { exact: true }).fill(DATE)
      }
      await page.getByRole("button", { name: persona.goal ? "목표 입력 완료" : "기록 입력 완료", exact: true }).click()
      await page.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/ }).click()
      await page.getByRole("button", { name: /^3일/ }).click()
      await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }).click()
      const all = await stored<AthleteRecord[]>(page, RECORDS)
      const record = all?.find(row => row.performanceSeconds === persona.seconds
        && (persona.goal ? row.purpose === "RACE_GOAL" : row.purpose !== "RACE_GOAL"))
      expect(record, "Input must be durably stored, including goals").toBeDefined()
      expect(record!.eventDistanceM).toBe(persona.event)
      expect(record!.achievedOn).toBe(persona.goal ? null : DATE)
      expect(record!.verificationState).toBe("SELF_REPORTED")
      if (persona.event >= 10000) await chooseLongEventRacePace(page, persona.event, record!.id)
      expect(await stored(page, PLAN)).toBeNull()
      return record!
    })
    const first = await step("02 first plan with actual target seconds", async () => {
      if (persona.event < 10000) await confirmNumeric(page, source.id)
      await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
      await expect(page.getByRole("heading", { name: /훈련 계획$/ }).first()).toBeVisible()
      await expect.poll(() => stored(page, PLAN)).not.toBeNull()
      const saved = await plan(page)
      const rows = await assertNumeric(page, persona, persona.seconds, source)
      const mainDate = new Date(`${saved.intake.startDate}T03:00:00Z`)
      mainDate.setUTCDate(mainDate.getUTCDate() + rows[0]!.day - 1)
      await page.getByRole("button", { name: new RegExp(`${mainDate.getUTCFullYear()}년 ${mainDate.getUTCMonth() + 1}월 ${mainDate.getUTCDate()}일`) }).click()
      await expect(page.getByRole("dialog")).toContainText(`${Math.round(rows[0]!.minimum * 10) / 10}s`)
      await page.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
      const views = await page.evaluate(async ({ path, event }) =>
        (await import(/* @vite-ignore */ path) as typeof Harness).records(event), { path: helperPath, event: persona.event })
      if (persona.condition === "recent" || persona.condition === "unknown" || persona.condition === "rolling") {
        expect(views.choices.recommendedRecordId).toBe(source.id)
      }
      if (persona.condition === "pb") expect(views.choices.recommendedRecordId).not.toBe(source.id)
      if (persona.condition === "ambiguous") {
        expect(views.choices.latestStatus).toBe("AMBIGUOUS")
        expect(views.choices.recommendedRecordId).toBeNull()
      }
      if (persona.condition === "unknown") {
        const unknown = views.all.find(row => row.achievedOn === null && row.purpose !== "RACE_GOAL")!
        expect(unknown).toBeDefined()
        const unknownOption = views.choices.options.find(row => row.recordId === unknown.id)
        expect(unknownOption, "Unknown-date actual must remain an explicit selectable option").toBeDefined()
        expect(unknownOption!.badges).not.toContain("RECENT_ACTUAL")
        expect(unknownOption!.badges).not.toContain("ROLLING_12_BEST")
      }
      if (persona.condition === "rolling") {
        const included = views.all.find(row => row.achievedOn === "2025-10-02")!
        const excluded = views.all.find(row => row.achievedOn === "2025-10-01")!
        expect(views.choices.options.find(row => row.recordId === included.id)!.badges).toContain("ROLLING_12_BEST")
        expect(views.choices.options.find(row => row.recordId === excluded.id)!.badges).not.toContain("ROLLING_12_BEST")
      }
      return saved
    })
    const updated = await step("03 source change preview and explicit apply", async () => {
      const before = await plan(page), beforeRows = await numeric(page)
      await openRecords(page, true)
      const preview = page.getByRole("region", { name: "기록에 따른 계획 변경" })
      if (persona.overBudget !== undefined) await test.step("slower record over accepted budget is visibly blocked", async () => {
        const snapshots = await page.evaluate(({ planKey, journalKey }) => ({
          plan: localStorage.getItem(planKey), journal: localStorage.getItem(journalKey),
        }), { planKey: PLAN, journalKey: JOURNAL })
        const budgets = await page.evaluate(async ({ path, event, seconds }) =>
          (await import(/* @vite-ignore */ path) as typeof Harness).longEventBudget(event, seconds),
        { path: helperPath, event: persona.event, seconds: persona.overBudget! })
        expect(budgets.length, "Negative path must cover a real distance MAIN and its accepted budget").toBeGreaterThan(0)
        for (const budget of budgets) expect(budget.proposedMaximumSeconds).toBeGreaterThan(budget.acceptedMaximumSeconds)
        const rejected = await enterRecord(page, persona.event, { seconds: persona.overBudget!,
          date: persona.goal || persona.condition === "unknown-apply" ? null : "2026-10-01",
          purpose: persona.goal ? "RACE_GOAL" : "RECENT_RESULT" })
        await expect(preview, "Overbudget record must automatically surface the blocked notice").toBeVisible()
        await expect(preview.getByRole("status")).toContainText("확인한 시간 범위를 벗어나")
        await expect(preview).toContainText("계획은 바꾸지 않았어요")
        const exclusions = preview.locator("details", { has: page.locator("summary", { hasText: /^바꾸지 않은 훈련/ }) })
        await exclusions.locator("summary").click()
        for (const budget of budgets) {
          await expect(exclusions.getByRole("listitem").filter({ hasText:
            `${budget.day}일째 ${budget.slot === "AM" ? "오전" : "오후"} · 기존 구성과 확인한 시간 범위 안에서 이 기록을 적용할 수 없어요.` })).toBeVisible()
        }
        await expect(preview.getByRole("button", { name: "남은 훈련에 적용", exact: true })).toHaveCount(0)
        await expect(preview.getByRole("checkbox")).toHaveCount(0)
        expect(await page.evaluate(key => localStorage.getItem(key), PLAN)).toBe(snapshots.plan)
        expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL)).toBe(snapshots.journal)
        expect(await numeric(page)).toEqual(beforeRows)
        await page.screenshot({ path: info.outputPath("overbudget-blocked.png"), fullPage: true, animations: "disabled" })
        await preview.getByRole("button", { name: "계획은 그대로 두기", exact: true }).click()
        await page.reload(); await tab(page)
        expect(await page.evaluate(key => localStorage.getItem(key), PLAN)).toBe(snapshots.plan)
        expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL)).toBe(snapshots.journal)
        expect((await stored<AthleteRecord[]>(page, RECORDS)).find(row => row.id === rejected.id)).toEqual(rejected)
        await assertNumeric(page, persona, persona.seconds, source)
        overBudgetVerified = true
        await info.attach("overbudget-branch-receipt", { contentType: "application/json",
          body: JSON.stringify({ record: rejected, budgets, autoOpened: true, reasonVisible: true,
            applyAbsent: true, planAndJournalUnchangedAfterReload: true }, null, 2) })
        await openRecords(page, true)
      })
      const successBudgets = persona.overBudget === undefined ? [] : await page.evaluate(async ({ path, event, seconds }) =>
        (await import(/* @vite-ignore */ path) as typeof Harness).longEventBudget(event, seconds),
      { path: helperPath, event: persona.event, seconds: persona.changed })
      for (const budget of successBudgets) expect(budget.proposedMaximumSeconds).toBeLessThanOrEqual(budget.acceptedMaximumSeconds)
      const record = await enterRecord(page, persona.event, { seconds: persona.changed,
        date: persona.goal || persona.condition === "unknown-apply" ? null : persona.overBudget === undefined ? "2026-10-01" : TODAY,
        purpose: persona.goal ? "RACE_GOAL" : "RECENT_RESULT" })
      const currentRecords = await stored<AthleteRecord[]>(page, RECORDS)
      await expect(preview, "A valid new same-event record must automatically surface the bound MAIN's pace-change preview").toBeVisible()
      await expect(preview).toContainText(timeText(beforeRows[0]!.minimum))
      await expect(preview).toContainText("→")
      expect(await stored(page, PLAN)).toEqual(before)
      expect(await stored(page, JOURNAL) ?? []).toEqual([])
      if (persona.condition === "scope") {
        const result = await page.evaluate(async ({ path, id }) =>
          (await import(/* @vite-ignore */ path) as typeof Harness).scopeSwitch(id), { path: helperPath, id: record.id })
        expect(result).toEqual({ result: "blocked", unchanged: true, otherPlan: null })
        await page.reload(); await tab(page); await openRecords(page, true)
        await page.locator(".athlete-record-row").nth(currentRecords.findIndex(row => row.id === record.id))
          .getByRole("button", { name: "이 기록으로 페이스 변경 보기" }).click()
      }
      if (persona.condition === "offline") await context.setOffline(true)
      if (persona.condition === "retry") await page.evaluate(async path =>
        (await import(/* @vite-ignore */ path) as typeof Harness).dropNextPlanWrite(), helperPath)
      await preview.getByRole("checkbox").check()
      await preview.getByRole("button", { name: "남은 훈련에 적용", exact: true }).click()
      if (persona.condition === "retry") {
        await expect(preview.getByRole("button", { name: "변경안 다시 확인" })).toBeVisible()
        expect(await stored(page, PLAN)).toEqual(before)
        await expect(preview).not.toContainText("남은 훈련에 적용했어요")
        await preview.getByRole("button", { name: "변경안 다시 확인" }).click()
        await preview.getByRole("checkbox").check()
        await preview.getByRole("button", { name: "남은 훈련에 적용", exact: true }).click()
      }
      await expect(preview).toContainText("남은 훈련에 적용했어요")
      await context.setOffline(false)
      const after = await plan(page)
      expect(after.activePlan.candidateId).not.toBe(first.activePlan.candidateId)
      expect(after.activePlanEdit?.action).toBe("PACE_REFERENCE")
      expect(after.progress).toEqual(first.progress)
      expect(after.activePlan.sessions.map(row => [row.day, row.slot, row.role])).toEqual(first.activePlan.sessions.map(row => [row.day, row.slot, row.role]))
      for (const old of first.activePlan.sessions) {
        const next = after.activePlan.sessions.find(row => row.day === old.day && row.slot === old.slot)!
        if (old.role !== "QUALITY") expect(next).toEqual(old)
        if (old.prescription.kind === "PACE_TARGET" && next.prescription.kind === "PACE_TARGET") {
          for (const key of ["repetitionRecoverySeconds", "setRecoverySeconds", "repetitionDistanceM"] as const) {
            expect(next.prescription[key]).toEqual(old.prescription[key])
          }
        }
      }
      await assertNumeric(page, persona, persona.changed, record)
      for (const budget of successBudgets) {
        const session = after.activePlan.sessions.find(row => row.day === budget.day && row.slot === budget.slot)!
        expect(session.prescription.kind).toBe("RPE_TIME_RANGE")
        if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Long-event MAIN lost its catalog prescription")
        expect(session.prescription.durationMinutes.maximum * 60).toBeCloseTo(budget.proposedMaximumSeconds, 8)
        expect(session.prescription.durationMinutes.maximum * 60).toBeLessThanOrEqual(budget.acceptedMaximumSeconds)
      }
      await preview.getByRole("button", { name: "계획으로 돌아가기", exact: true }).click()
      await page.reload(); await tab(page)
      expect(await plan(page)).toEqual(after)
      return { state: after, source: record }
    })
    const edited = await step("04 real plan edit preserves numeric MAIN", async () => {
      const choice = await page.evaluate(async path => (await import(/* @vite-ignore */ path) as typeof Harness).editChoice(), helperPath)
      await page.locator("[data-plan-edit-button]").click()
      await page.getByRole("button", { name: "훈련 내용 바꾸기", exact: true }).click()
      const editor = page.getByRole("region", { name: "이 훈련 수정" })
      await editor.getByLabel("수정할 훈련").selectOption(`${choice.source.day}:${choice.source.slot}`)
      await editor.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }).check()
      if (choice.action === "DURATION") await editor.getByLabel("새 최대 시간 · 분").fill(String(choice.maximumMinutes))
      else {
        await editor.getByRole("combobox", { name: "훈련 구성", exact: true }).selectOption(choice.catalogId!)
        await editor.getByRole("button", { name: "이 구성으로 바꾸기", exact: true }).click()
      }
      await editor.getByRole("button", { name: "변경안 미리보기", exact: true }).click()
      await expect(editor.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible()
      expect(await plan(page)).toEqual(updated.state)
      await editor.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요." }).check()
      await editor.getByRole("button", { name: "변경안 적용하기", exact: true }).click()
      await expect(editor).toHaveCount(0)
      const after = await plan(page)
      expect(after.activePlan.candidateId).not.toBe(updated.state.activePlan.candidateId)
      expect(after.activePlanEdit?.action).toBe(choice.action)
      expect(after.activePlan.sessions.filter(row => row.role === "QUALITY"))
        .toEqual(updated.state.activePlan.sessions.filter(row => row.role === "QUALITY"))
      await assertNumeric(page, persona, persona.changed, updated.source)
      return after
    })
    const journal = await step("05 journal actual execution and saved reader", async () => {
      const main = (await numeric(page))[0]!
      const date = new Date(`${edited.intake.startDate}T03:00:00Z`)
      date.setUTCDate(date.getUTCDate() + main.day - 1)
      await page.clock.setFixedTime(date)
      await page.reload(); await tab(page)
      await page.getByRole("button", { name: new RegExp(`${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`) }).click()
      await page.getByText("일지·진행 기록", { exact: true }).click()
      await page.getByRole("button", { name: "이 훈련 일지 쓰기", exact: true }).click()
      await page.getByRole("button", { name: persona.partial ? "일부만 했거나 내용을 바꿨어요" : "계획대로 마쳤어요", exact: true }).click()
      await page.getByRole("button", { name: persona.slot === "PM" || main.slot === "PM" ? "오후" : "오전", exact: true }).click()
      await page.getByRole("button", { name: /^힘든 정도 7\/10,/ }).click()
      await page.getByRole("button", { name: "없어요", exact: true }).click()
      if (persona.partial) await page.getByRole("button", { name: "횟수를 줄였어요", exact: true }).click()
      await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
      await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요.", exact: true })).toBeVisible()
      const entries = await stored<Array<{ id: string; date: string; rpe: number; activityOutcome: string; activitySlot: string;
        plannedSessionLink: { sessionDay: number; sessionSlot: string } }>>(page, JOURNAL)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ date: date.toISOString().slice(0, 10), rpe: 7,
        activityOutcome: persona.partial ? "PARTIAL" : "COMPLETED", activitySlot: persona.slot ?? main.slot,
        plannedSessionLink: { sessionDay: main.day, sessionSlot: main.slot } })
      expect((await plan(page)).progress).toEqual([])
      await page.getByRole("button", { name: "완료", exact: true }).click()
      const returnToCalendar = page.getByRole("button", { name: "달력으로 돌아가기", exact: true })
      if (await returnToCalendar.isVisible()) await returnToCalendar.click()
      await tab(page)
      await page.getByRole("button", { name: "연결된 일지 기록 보기", exact: true }).click()
      await expect(page.getByRole("tabpanel")).toContainText("직접 기록한 RPE 7")
      await page.screenshot({ path: info.outputPath("saved-journal.png"), fullPage: true, animations: "disabled" })
      return entries
    })
    await step("06 successor plan and immutable historical journal", async () => {
      const predecessorRows = await numeric(page)
      const nextDate = new Date(`${edited.intake.startDate}T03:00:00Z`)
      nextDate.setUTCDate(nextDate.getUTCDate() + 10)
      await page.clock.setFixedTime(nextDate)
      await page.reload(); await tab(page)
      await page.getByRole("button", { name: "다음 계획안 만들기", exact: true }).click()
      await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }).click()
      const previewKeys = [PLAN, HISTORY, JOURNAL, RECORDS]
      const previewStorage = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), previewKeys)
      const boundEvidence = persona.overBudget === undefined ? null
        : await assertBoundSuccessor(page, persona, updated.source, edited, predecessorRows, nextDate)
      if (boundEvidence === null) await confirmNumeric(page, updated.source.id)
      else {
        expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), previewKeys)).toEqual(previewStorage)
        await info.attach("successor-bound-ui-receipt", { contentType: "application/json",
          body: JSON.stringify({ source: updated.source, boundEvidence, recordSelectionChanged: false,
            editorApplied: false, storageUnchangedDuringInspection: true }, null, 2) })
      }
      await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
      await expect.poll(async () => (await plan(page)).activePlan.candidateId).not.toBe(edited.activePlan.candidateId)
      const successor = await plan(page)
      expect(successor.intake.startDate).toBe(nextDate.toISOString().slice(0, 10))
      const successorRows = await assertNumeric(page, persona, persona.changed, updated.source)
      if (boundEvidence !== null) {
        const references = successor.activePlan.sessions.filter(row => row.role === "QUALITY").flatMap(row =>
          row.prescription.kind === "RPE_TIME_RANGE" ? row.prescription.catalogWorkout?.inputs.paceReferences ?? [] : [])
        expect(references.length).toBeGreaterThan(0)
        for (const reference of references) expect(reference).toMatchObject({ recordId: updated.source.id,
          performanceSeconds: persona.changed, eventDistanceM: persona.event, achievedOn: updated.source.achievedOn,
          kind: persona.goal ? "GOAL" : "ACTUAL", model: "RACE_AVERAGE_V1" })
      }
      const history = await stored<Array<{ candidateId: string; originalPlan: PlanBetaStateV3 }>>(page, HISTORY)
      const archived = history.filter(row => row.candidateId === edited.activePlan.candidateId)
      expect(archived).toHaveLength(1)
      expect(archived[0]!.originalPlan).toEqual(edited)
      expect(await stored(page, JOURNAL)).toEqual(journal)
      await page.reload(); await tab(page)
      expect(await plan(page)).toEqual(successor)
      expect(await stored(page, HISTORY)).toEqual(history)
      expect(await stored(page, JOURNAL)).toEqual(journal)
      expect(await assertNumeric(page, persona, persona.changed, updated.source)).toEqual(successorRows)
      expect(errors).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      await page.screenshot({ path: info.outputPath("successor.png"), fullPage: true, animations: "disabled" })
      await info.attach("successor-accepted-receipt", { contentType: "application/json",
        body: JSON.stringify({ candidateId: successor.activePlan.candidateId, startDate: successor.intake.startDate,
          source: updated.source, successorRows, predecessorId: edited.activePlan.candidateId,
          archivedOriginalExact: true, planHistoryAndJournalExactAfterReload: true }, null, 2) })
    })
  } finally {
    if (!page.isClosed()) await context.setOffline(false)
    await info.attach("lifecycle-stage-receipt", { contentType: "application/json",
      body: JSON.stringify({ persona, proof: "synthetic guest browser; scope-switch probe is not authenticated account proof",
        completed, overBudgetRequired: persona.overBudget !== undefined, overBudgetVerified,
        fullLifecycle: completed.length === 6 && info.errors.length === 0
          && (persona.overBudget === undefined || overBudgetVerified), errors }, null, 2) })
  }
})
