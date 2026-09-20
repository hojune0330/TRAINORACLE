import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { writeFile } from "node:fs/promises"
import { createServer, type ViteDevServer } from "vite"
import type { AccountJournalRecord } from "../src/domain/account/account-journal-record-schema"
import { mockPlanCollectionServer } from "./fixtures/account-plan-collection-server"
import { openActiveSessionDetails } from "./active-plan-flow"

const origin = "http://127.0.0.1:4497"
const owner = "11111111-1111-4111-8111-111111111111"
const now = "2026-09-19T03:00:00.000Z"
const privateMarker = "SYNTHETIC_PRIVATE_PROSE_NOT_ANALYSIS"
const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase><Activities><Activity Sport="Running">
<Id>2026-09-19T01:00:00Z</Id><Notes>${privateMarker}</Notes>
<Lap StartTime="2026-09-19T01:00:00Z"><TotalTimeSeconds>300</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters>
<Track><Trackpoint><Time>2026-09-19T01:00:00Z</Time><Position><LatitudeDegrees>35.123456</LatitudeDegrees><LongitudeDegrees>127.654321</LongitudeDegrees></Position></Trackpoint></Track></Lap>
<Lap StartTime="2026-09-19T01:05:00Z"><TotalTimeSeconds>4500</TotalTimeSeconds><DistanceMeters>9000</DistanceMeters></Lap>
</Activity></Activities></TrainingCenterDatabase>`

const additionalFiles = [
  { format: "csv", mimeType: "text/csv", sourceMeaning: "MOVING", confirmedMeaning: null, label: "이동 시간", distance: "5km", duration: "25분",
    content: `date,sport,distanceKm,durationMin,durationMeaning,name,memo\n2026-09-19,running,5,25,MOVING,${privateMarker},${privateMarker}` },
  { format: "json", mimeType: "application/json", sourceMeaning: "SOURCE_DEFINED", confirmedMeaning: "TIMER", label: "기록 시간", distance: "5km", duration: "25분",
    content: JSON.stringify([{ date: "2026-09-19", sport: "running", distanceKm: 5, durationMin: 25, name: privateMarker, memo: privateMarker,
      gps: [[35.123456, 127.654321]], analysisEligible: true, provenance: "EXPLICIT" }]) },
  { format: "gpx", mimeType: "application/gpx+xml", sourceMeaning: "ELAPSED", confirmedMeaning: null, label: "전체 경과 시간", distance: "2.002km", duration: "10분",
    content: `<gpx version="1.1"><trk><type>running</type><name>${privateMarker}</name><desc>${privateMarker}</desc><trkseg>
      <trkpt lat="35.123456" lon="127.654321"><time>2026-09-19T01:00:00Z</time></trkpt>
      <trkpt lat="35.141456" lon="127.654321"><time>2026-09-19T01:10:00Z</time></trkpt>
      </trkseg></trk></gpx>` },
] as const

let vite: ViteDevServer
let schema: typeof import("../src/domain/account/account-journal-record-schema")
let comparison: typeof import("../src/domain/import/file-plan-comparison")

test.beforeAll(async () => {
  // Own the in-process loopback server. Do not read a developer's .env or reuse another server.
  const env = {
    VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_KILL_ACCOUNT: "false",
    VITE_SUPABASE_URL: "https://synthetic.invalid", VITE_SUPABASE_ANON_KEY: "synthetic-public-placeholder",
    VITE_PRIVACY_POLICY_URL: "https://synthetic.invalid/privacy", VITE_PRIVACY_POLICY_VERSION: "test-v1",
    VITE_TERMS_OF_SERVICE_URL: "https://synthetic.invalid/terms", VITE_TERMS_OF_SERVICE_VERSION: "test-v1",
    VITE_FEATURE_ACCOUNT_JOURNAL: "true", VITE_KILL_ACCOUNT_JOURNAL: "false",
    VITE_FEATURE_FILE_ANALYSIS_TCX: "true", VITE_KILL_FILE_ANALYSIS_TCX: "false",
    VITE_FEATURE_FILE_ANALYSIS_CSV: "true", VITE_KILL_FILE_ANALYSIS_CSV: "false",
    VITE_FEATURE_FILE_ANALYSIS_JSON: "true", VITE_KILL_FILE_ANALYSIS_JSON: "false",
    VITE_FEATURE_FILE_ANALYSIS_GPX: "true", VITE_KILL_FILE_ANALYSIS_GPX: "false",
  }
  vite = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)), envFile: false, clearScreen: false,
    define: { "import.meta.env.DEV": "false", ...Object.fromEntries(Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])) },
    server: { host: "127.0.0.1", port: 4497, strictPort: true, watch: null, hmr: false },
  })
  try {
    await vite.listen()
    schema = await vite.ssrLoadModule("/src/domain/account/account-journal-record-schema.ts") as typeof schema
    comparison = await vite.ssrLoadModule("/src/domain/import/file-plan-comparison.ts") as typeof comparison
  } catch (error) { await vite.close(); throw error }
})
test.afterAll(async () => { await vite?.close() })

async function mockAccount() {
  const documents = new Map<string, { documentId: string; revision: number; document: AccountJournalRecord }>()
  const calls: { action: string; writePurpose?: string; supportedJournalVersions?: number[]; document?: AccountJournalRecord }[] = []
  const plan = await mockPlanCollectionServer()
  const comparisonOriginalReads: { ownerId: string; planId: string; verified: boolean }[] = []
  let offline = false
  let failReads = false
  return {
    documents, calls, plan, comparisonOriginalReads,
    offline(value: boolean) { offline = value },
    failReads(value: boolean) { failReads = value },
    async install(context: BrowserContext) {
      await context.route("**/*", async route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin) return route.abort()
        if (url.pathname === "/src/domain/account/supabase-client.ts") {
          return route.fulfill({ contentType: "application/javascript", body: `
            export async function supabase() { return {
              auth: {
                getSession: async () => ({ data: { session: { user: { id: '${owner}' }, access_token: 'synthetic-token' } }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
              },
              functions: { invoke: async (name, options) => {
                const response = await fetch(name === 'account-plan-collection' ? '/__collection_api__' : '/__record_api__', {
                  method: 'POST', signal: options.signal, headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ownerId: '${owner}', request: options.body }),
                });
                return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } };
              } },
            }; }
            export function __resetSupabaseForTest() {}
          ` })
        }
        if (url.pathname !== "/__record_api__") return route.continue()
        const { ownerId, request } = route.request().postDataJSON()
        const answer = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
        if (ownerId !== owner) return answer({ code: "AUTH_REQUIRED" }, 401)
        calls.push(structuredClone(request))
        if (failReads && (request.action === "read" || request.action === "list")) return answer({ code: "UNAVAILABLE" }, 503)
        if (request.action === "list") return answer({ kind: "list", documents: [...documents.values()], deletedDocuments: [], nextCursor: null })
        if (request.action === "read") {
          const document = documents.get(request.documentId)
          return document ? answer({ kind: "document", ...document }) : answer({ code: "NOT_FOUND" }, 404)
        }
        if (request.action === "correctImportedObservation") {
          if (offline) return answer({ code: "UNAVAILABLE" }, 503)
          const previous = documents.get(request.documentId)
          if (!previous || previous.revision !== request.expectedRevision) return answer({ kind: "conflict", documentId: request.documentId,
            operationId: request.operationId, currentRevision: previous?.revision ?? 0 }, 409)
          if (!request.supportedJournalVersions?.includes(3)) return answer({ error: "UPGRADE_REQUIRED" }, 426)
          const document = schema.correctAccountJournalImportedObservation(previous.document, request.previousContentRevisionFingerprint,
            request.replacementObservation, request.confirmedChangedFields)
          if (!document) return answer({ error: "INVALID_FILE_OBSERVATION" }, 422)
          const revision = previous.revision + 1
          documents.set(request.documentId, { documentId: request.documentId, revision, document })
          return answer({ kind: "saved", documentId: request.documentId, operationId: request.operationId, revision })
        }
        if (request.action === "confirmComparisonRelation" || request.action === "releaseComparisonRelation") {
          if (offline) return answer({ code: "UNAVAILABLE" }, 503)
          const previous = documents.get(request.documentId)
          if (!previous || previous.revision !== request.expectedRevision) return answer({ kind: "conflict", documentId: request.documentId,
            operationId: request.operationId, currentRevision: previous?.revision ?? 0 }, 409)
          const { supportedJournalVersions, ...command } = request
          if (!supportedJournalVersions?.includes(3)) return answer({ error: "UPGRADE_REQUIRED" }, 426)
          if (command.action === "confirmComparisonRelation") {
            // Owner-scoped stored collection read, never a snapshot or attestation supplied by the browser.
            const index = plan.indexes.get(ownerId)?.index
            const ref = index?.plans.find(item => item.planId === command.relation?.original?.planFingerprint)
            const original = comparison.resolveComparisonOriginalFromPlanCollection(index,
              ref ? plan.parts.get(`${ownerId}:${ref.snapshotId}`) : null,
              ref ? plan.parts.get(`${ownerId}:${ref.progressId}`) : null, command.relation?.original)
            comparisonOriginalReads.push({ ownerId, planId: ref?.planId ?? "", verified: original.status === "ORIGINAL_VERIFIED" })
            if (original.status !== "ORIGINAL_VERIFIED") return answer({ error: "COMPARISON_ORIGINAL_UNAVAILABLE" }, 409)
            if (!schema.validateAccountJournalComparisonConfirmation(previous.document, command, original)) return answer({ error: "INVALID_COMPARISON_RELATION" }, 422)
          }
          const document = schema.applyAccountJournalComparisonMutation(previous.document, command)
          if (!document) return answer({ error: "INVALID_COMPARISON_RELATION" }, 422)
          const revision = previous.revision + 1
          documents.set(request.documentId, { documentId: request.documentId, revision, document })
          return answer({ kind: "saved", documentId: request.documentId, operationId: request.operationId, revision })
        }
        if (request.action !== "save") return answer({ code: "UNSUPPORTED_TEST_ACTION" }, 400)
        if (offline) return answer({ code: "UNAVAILABLE" }, 503)
        // A save acknowledgement is impossible without the real V3 codec and initial-evidence gate.
        const parsed = schema.parseAccountJournalRecord(request.document)
        if (!parsed || parsed.version !== 3 || request.writePurpose !== "FILE_OBSERVATION"
          || !request.supportedJournalVersions?.includes(3) || !schema.validateInitialFileObservationRecord(parsed)) {
          return answer({ code: "INVALID_FILE_OBSERVATION" }, 422)
        }
        const previous = documents.get(request.documentId)
        if (request.expectedRevision !== (previous?.revision ?? 0)) return answer({ kind: "conflict", documentId: request.documentId,
          operationId: request.operationId, currentRevision: previous?.revision ?? 0 }, 409)
        const revision = (previous?.revision ?? 0) + 1
        documents.set(request.documentId, { documentId: request.documentId, revision, document: parsed })
        return answer({ kind: "saved", documentId: request.documentId, operationId: request.operationId, revision })
      })
      await plan.install(context)
    },
  }
}

async function openImport(page: Page, file = { format: "tcx", mimeType: "application/xml", content: tcx, confirmedMeaning: "TIMER" as string | null }) {
  await page.clock.setFixedTime(new Date(now))
  await page.goto("/?app=1")
  await expect.poll(() => page.evaluate(async () => {
    const path = "/src/domain/account/local-journal-ownership.ts"
    return (await import(/* @vite-ignore */ path)).activeLocalAccount()
  })).toBe(owner)
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByTestId("open-import").click()
  await page.getByLabel(/내보낸 활동 파일/u).setInputFiles({ name: `synthetic.${file.format}`, mimeType: file.mimeType, buffer: Buffer.from(file.content) })
  await expect(page.getByTestId("import-draft-row")).toHaveCount(1)
  const review = page.locator("summary").filter({ hasText: "시간과 날짜 확인" })
  await review.focus()
  await review.press("Enter")
  if (file.confirmedMeaning !== null) await page.getByLabel("파일의 시간은 어떤 시간인가요?").selectOption(file.confirmedMeaning)
  else {
    await expect(page.getByText(/파일에 지정된 시간:/u)).toBeVisible()
    await expect(page.getByLabel("파일의 시간은 어떤 시간인가요?")).toHaveCount(0)
  }
  await page.getByTestId("import-draft-row").getByRole("combobox", { name: /저장 방식/u }).selectOption("separate")
}

async function confirmedCount(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/domain/account/account-journal-projection.ts"
    return (await import(/* @vite-ignore */ path)).readAccountJournalProjection().length
  })
}

async function sharedDistance(page: Page) {
  return page.evaluate(async () => {
    const storePath = "/src/domain/journal-store.ts", projectionPath = "/src/domain/journal-observation.ts"
    const distancePath = "/src/domain/cumulative-distance.ts"
    const store = await import(/* @vite-ignore */ storePath)
    const projection = await import(/* @vite-ignore */ projectionPath)
    const distance = await import(/* @vite-ignore */ distancePath)
    const summary = distance.cumulativeDistance(projection.projectStructuredJournalObservations(store.loadEntries()), {
      kind: "WEEK_TO_DATE", startDate: "2026-09-13", endDate: "2026-09-19", precision: "LOCAL_DATE",
    })
    return { totalKm: summary.totalKm, includedSourceCount: summary.includedSourceCount }
  })
}

async function confirmedPlan(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/domain/account/account-plan-service.ts"
    const view = (await import(/* @vite-ignore */ path)).accountPlanService()?.snapshot()
    const current = view?.currentPlan
    if (view?.status !== "READY" || current?.kind !== "read_only") return null
    const state = current.packet.state
    return { planId: current.planId, candidateId: state.activePlan?.candidateId,
      detailed: state.activePlan?.sessions.filter((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET")
        .map((session: { prescription: { templateId: string; targetRepSeconds: number } }) => ({
          templateId: session.prescription.templateId, targetRepSeconds: session.prescription.targetRepSeconds,
        })) }
  })
}

async function saveImport(page: Page) {
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toContainText("계정에 저장됨 1건")
  await expect.poll(() => confirmedCount(page)).toBe(1)
  expect(await sharedDistance(page)).toEqual({ totalKm: 10, includedSourceCount: 1 })
  await page.getByRole("button", { name: "가져온 기록 분석하기" }).click()
  const panel = page.getByTestId("file-analysis-panel")
  await expect(panel.getByText("10km", { exact: true })).toBeVisible()
  await expect(panel.getByText("80분", { exact: true })).toBeVisible()
  await expect(panel.getByText("8분/km", { exact: true })).toBeVisible()
  return panel
}

test("TCX account acknowledgement -> report -> pace plan saved/reopened -> confirmed original comparison saved/reloaded", async ({ page, context, browser }, testInfo) => {
  const account = await mockAccount()
  await account.install(context)
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await openImport(page)
  expect(account.documents.size).toBe(0)
  expect(await confirmedCount(page)).toBe(0)
  expect(await sharedDistance(page)).toEqual({ totalKm: null, includedSourceCount: 0 })
  const panel = await saveImport(page)
  const saved = [...account.documents.values()][0]!.document
  expect(saved.version).toBe(3)
  expect(schema.validateInitialFileObservationRecord(saved)).toBe(true)
  expect(account.calls.filter(call => call.action === "save")).toHaveLength(1)
  const serialized = JSON.stringify(saved)
  for (const forbidden of [privateMarker, "35.123456", "127.654321", "synthetic.tcx", "LatitudeDegrees", "LongitudeDegrees"]) {
    expect(serialized).not.toContain(forbidden)
    await expect(panel).not.toContainText(forbidden)
  }
  const detail = panel.locator("summary").filter({ hasText: "계산에 쓴 기록과 빠진 항목" })
  await detail.focus(); await detail.press("Enter")
  await expect(panel.getByText(/거리 합계와 시간 합계/u)).toBeVisible()
  const segments = panel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 2개 구간" })
  await segments.focus(); await segments.press("Enter")
  await expect(panel.getByRole("row")).toHaveCount(3)
  await panel.locator("h2").evaluate(node => node.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: testInfo.outputPath("confirmed-report-375.png") })
  await panel.getByRole("table").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("confirmed-segments-375.png") })

  // A separate explicitly self-reported race fixture is needed; file distance/time must not create PB authority.
  expect(await page.evaluate(async now => {
    const path = "/src/domain/athlete-records.ts", records = await import(/* @vite-ignore */ path)
    const before = records.loadAthleteRecords(new Date(now))
    const fixture = records.createSelfReportedAthleteRecord({ id: "00000000-0000-4000-8000-000000005001", purpose: "RECENT_RESULT",
      eventDistanceM: 5000, performanceSeconds: 1111.25, achievedOn: "2026-08-15", seasonId: null }, new Date(now))
    const result = records.saveAthleteRecord(fixture, new Date(now))
    return { before, ok: result.ok }
  }, now)).toEqual({ before: [], ok: true })
  const currentPlanBeforeSelection = await confirmedPlan(page)
  const collectionBeforeSelection = JSON.stringify({ indexes: [...account.plan.indexes], parts: [...account.plan.parts] })
  const recordsBeforeSelection = await page.evaluate(async now => {
    const path = "/src/domain/athlete-records.ts"
    return (await import(/* @vite-ignore */ path)).loadAthleteRecords(new Date(now))
  }, now)
  const assertNoAutomaticPlanWrite = async () => {
    expect(await confirmedPlan(page)).toEqual(currentPlanBeforeSelection)
    expect(JSON.stringify({ indexes: [...account.plan.indexes], parts: [...account.plan.parts] })).toBe(collectionBeforeSelection)
    expect(account.plan.calls.filter(call => call.request.action === "stage" || call.request.action === "commit")).toHaveLength(0)
    expect(await page.evaluate(async now => {
      const path = "/src/domain/athlete-records.ts"
      return (await import(/* @vite-ignore */ path)).loadAthleteRecords(new Date(now))
    }, now)).toEqual(recordsBeforeSelection)
  }
  await panel.getByRole("button", { name: "훈련 계획 보기" }).click()
  await page.getByRole("button", { name: /^5000m/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  const refine = page.getByTestId("plan-refine")
  await refine.locator(":scope > summary").click()
  await refine.getByRole("button", { name: /^훈련 종류 바꾸기/u }).click()
  await page.getByRole("button", { name: /숨차게 반복.*VO₂/u }).click()
  const method = page.locator(".plan-method-picker")
  await method.locator(":scope > summary").click()
  const eligibility = await page.evaluate(async now => {
    const path = "/src/screens/plan-beta/plan-template-options.ts"
    const { resolveDetailedPlanTemplateOptions } = await import(/* @vite-ignore */ path)
    const intake = { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" }
    const defaults = resolveDetailedPlanTemplateOptions(intake, now)
    return { familyCount: new Set(defaults.flatMap((option: { method?: { familyId: string } }) => option.method ? [option.method.familyId] : [])).size,
      defaultRefs: defaults.map((option: { ref: unknown }) => option.ref),
      neutralRefs: resolveDetailedPlanTemplateOptions(intake, now, undefined, "NEUTRAL").map((option: { ref: unknown }) => option.ref) }
  }, now)
  expect(eligibility.defaultRefs).toEqual(eligibility.neutralRefs)
  const preference = method.getByRole("group", { name: "추천 선호 (선택)", exact: true })
  await assertNoAutomaticPlanWrite()
  // Workorder 6.4: NEUTRAL = no preference; other configuration = variety; same method = repeat.
  // Reuse the reviewed engine; never manufacture a second eligible family to expose controls.
  if (eligibility.familyCount > 1) {
    await expect(preference.getByRole("radio", { name: "선호 없음", exact: true })).toBeChecked()
    for (const name of ["덜 해본 방법 선호", "해본 방법 선호", "선호 없음"]) {
      await preference.getByRole("radio", { name, exact: true }).check()
      await expect(preference.getByRole("radio", { name, exact: true })).toBeChecked()
      await assertNoAutomaticPlanWrite()
    }
  } else {
    expect(eligibility.familyCount).toBe(1)
    await expect(preference).toHaveCount(0)
    await expect(method.getByText(/상세 방법은 현재 1개/u)).toBeVisible()
  }
  await testInfo.attach("workorder-6.4-method-preference", { contentType: "application/json", body: Buffer.from(JSON.stringify({
    eligibleFamilyCount: eligibility.familyCount, browserToggleExercised: eligibility.familyCount > 1,
    labels: { NEUTRAL: "선호 없음", PREFER_VARIETY: "덜 해본 방법 선호", PREFER_REPEAT: "해본 방법 선호" },
    workorderMapping: { "다른 구성 살펴보기": "PREFER_VARIETY", "같은 방법으로 비교": "PREFER_REPEAT" },
  })) })
  await method.evaluate(node => node.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: testInfo.outputPath("method-preference-eligibility.png"), animations: "disabled" })
  await method.getByRole("radio", { name: /1000m 5회/u }).check()
  const choose = page.getByRole("article", { name: "시간 조절 계획" }).getByRole("button", { name: "이 계획으로 시작하기" })
  await expect(choose).toBeDisabled()
  const record = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await record.getByRole("group", { name: "기준 기록 선택" }).getByRole("button").first().click()
  await record.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  const pace = page.getByRole("complementary", { name: "추천 페이스 기준" }).first()
  await pace.locator("summary").focus(); await pace.locator("summary").press("Enter")
  await expect(pace.getByText("1,111.25초 × 1000m ÷ 5000m")).toBeVisible()
  await pace.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("explicit-pace-candidate.png") })
  await assertNoAutomaticPlanWrite()
  await choose.click()
  await expect(page.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
  await expect.poll(() => account.plan.calls.filter(call => call.request.action === "commit").length).toBe(1)
  expect(account.plan.indexes.get(owner)?.revision).toBe(1)
  const persisted = JSON.stringify([...account.plan.parts.values()])
  expect(persisted).toContain('"targetRepSeconds":222.25')
  expect(persisted).not.toContain(privateMarker)
  await expect.poll(() => confirmedPlan(page)).not.toBeNull()
  const selected = await confirmedPlan(page)
  if (selected === null) throw new Error("Account plan confirmation disappeared before reopen verification")
  expect(selected.detailed).toEqual([{ templateId: "V2-SEED-05", targetRepSeconds: 222.25 }])

  // Fresh storage proves server hydration, not a locally optimistic plan or a button-only transition.
  const reopened = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 }, timezoneId: "Asia/Seoul", serviceWorkers: "block" })
  try {
    await account.install(reopened)
    const next = await reopened.newPage()
    await next.clock.setFixedTime(new Date(now))
    await next.goto("/?app=1")
    await expect.poll(() => confirmedCount(next)).toBe(1)
    await next.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
    await expect(next.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
    await expect.poll(() => confirmedPlan(next)).toEqual(selected)
    expect(account.plan.calls.filter(call => call.request.action === "readPart").length).toBeGreaterThanOrEqual(2)
    expect(account.plan.calls.filter(call => call.request.action === "commit")).toHaveLength(1)
    expect(JSON.stringify([...account.plan.parts.values()])).toBe(persisted)
    await next.getByRole("heading", { name: /9일 훈련 계획/u }).evaluate(node => node.scrollIntoView({ block: "start" }))
    await next.screenshot({ path: testInfo.outputPath("account-plan-reopened.png") })
    const active = await openActiveSessionDetails(next, /5×1000m/u)
    await expect(active.getByText(/5×1000m/u).first()).toBeVisible()
    await active.getByText(/5×1000m/u).first().scrollIntoViewIfNeeded()
    await next.screenshot({ path: testInfo.outputPath("account-plan-reopened-prescription.png") })

    await next.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
    const reopenedPanel = next.getByTestId("file-analysis-panel")
    await reopenedPanel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 2개 구간" }).click()
    await reopenedPanel.getByRole("button", { name: "계획과 비교", exact: true }).click()
    const compare = reopenedPanel.getByRole("group", { name: "계획과 실제 기록 비교", exact: true })
    const choice = compare.getByLabel("비교할 원래 훈련")
    await expect(choice).toBeEnabled()
    const selectedOption = choice.getByRole("option", { name: /2026-09-23.*주요 훈련/u })
    await expect(selectedOption).toHaveCount(1)
    const choiceId = await selectedOption.getAttribute("value")
    if (!choiceId) throw new Error("Acknowledged detailed-plan choice unavailable")
    await choice.selectOption(choiceId)
    const firstWork = compare.getByRole("group", { name: /본운동 운동 · 1,000m/u }).first()
    await firstWork.getByLabel("대응하는 실제 구간").selectOption("0")
    await firstWork.getByLabel("이 구간의 시간").selectOption("TIMER")
    await expect(compare.getByRole("region", { name: "계획과 실제 수치 차이" })).toHaveCount(0)
    await compare.getByRole("button", { name: "선택한 대응 확인·저장" }).click()
    await expect(compare.getByRole("status")).toHaveText("확인한 구간 비교를 계정에 저장했어요.")
    const differences = compare.getByRole("region", { name: "계획과 실제 수치 차이" })
    await expect(differences.getByRole("cell", { name: "0m", exact: true })).toBeVisible()
    await expect(differences.getByRole("cell", { name: "+77.75초", exact: true })).toBeVisible()
    await expect(differences.getByRole("cell", { name: "+77.75초/km", exact: true })).toBeVisible()
    const linked = [...account.documents.values()][0]!
    expect(linked.revision).toBe(2)
    if (linked.document.entry.kind !== "post-session") throw new Error("Expected imported workout")
    const relation = linked.document.entry.comparisonRelations?.[0]
    expect(relation?.original.planFingerprint).toBe(selected.planId)
    expect(relation?.journalRevisionAtConfirmation).toBe(1)
    expect(relation?.segmentMappings).toHaveLength(1)
    expect(linked.document.entry.fileObservation).toEqual(saved.entry.kind === "post-session" ? saved.entry.fileObservation : null)
    expect(linked.document.entry.plannedSessionLink).toBeUndefined()
    expect(account.comparisonOriginalReads).toEqual([{ ownerId: owner, planId: selected.planId, verified: true }])
    expect(account.calls.filter(call => call.action === "confirmComparisonRelation")).toHaveLength(1)
    expect(JSON.stringify([...account.plan.parts.values()])).toBe(persisted)
    await differences.scrollIntoViewIfNeeded()
    await next.screenshot({ path: testInfo.outputPath("comparison-account-confirmed.png") })

    const readsBeforeReload = account.calls.filter(call => call.action === "read" || call.action === "list").length
    await next.reload()
    await expect.poll(() => confirmedCount(next)).toBe(1)
    await next.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
    await reopenedPanel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 2개 구간" }).click()
    await reopenedPanel.getByRole("button", { name: "계획과 비교", exact: true }).click()
    await expect(choice).toBeEnabled()
    await choice.selectOption(choiceId)
    await expect(differences.getByRole("cell", { name: "+77.75초", exact: true })).toBeVisible()
    await expect(compare.getByRole("button", { name: "이 비교 연결 해제" })).toBeVisible()
    await expect(compare.getByRole("button", { name: "선택한 대응 확인·저장" })).toHaveCount(0)
    expect(account.calls.filter(call => call.action === "read" || call.action === "list").length).toBeGreaterThan(readsBeforeReload)
    expect(account.calls.filter(call => call.action === "confirmComparisonRelation")).toHaveLength(1)
    expect(await confirmedPlan(next)).toEqual(selected)
    expect(await sharedDistance(next)).toEqual({ totalKm: 10, includedSourceCount: 1 })
    await differences.scrollIntoViewIfNeeded()
    await next.screenshot({ path: testInfo.outputPath("comparison-account-reloaded.png") })
  } finally { await reopened.close() }
  expect(errors).toEqual([])
})

test("pending account file is excluded until a validated retry acknowledgement", async ({ page, context }) => {
  const account = await mockAccount()
  account.offline(true)
  await account.install(context)
  await openImport(page)
  await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
  await expect(page.getByTestId("import-saved")).toContainText("계정에 저장됨 0건")
  expect(account.documents.size).toBe(0)
  expect(await confirmedCount(page)).toBe(0)
  expect(await sharedDistance(page)).toEqual({ totalKm: null, includedSourceCount: 0 })
  await expect(page.getByRole("button", { name: "가져온 기록 분석하기" })).toHaveCount(0)
  account.offline(false)
  await page.getByRole("button", { name: "저장 상태 다시 확인" }).click()
  await expect(page.getByTestId("import-saved")).toContainText("계정에 저장됨 1건")
  await expect.poll(() => confirmedCount(page)).toBe(1)
  expect(await sharedDistance(page)).toEqual({ totalKm: 10, includedSourceCount: 1 })
})

test("persisted ACK cache stays displayable but cannot authorize file analysis after failed hydration", async ({ page, context }, testInfo) => {
  const account = await mockAccount()
  await account.install(context)
  await openImport(page)
  await saveImport(page)
  account.failReads(true)
  await page.reload()
  await expect.poll(() => page.evaluate(async () => {
    const path = "/src/domain/account/account-journal-projection.ts"
    return (await import(/* @vite-ignore */ path)).accountJournalProjectionStatus()
  })).toBe("FAILED")
  // This cache was created by a real successful browser save, never seeded as a fake acknowledgement.
  expect(await confirmedCount(page)).toBe(1)
  expect(await sharedDistance(page)).toEqual({ totalKm: null, includedSourceCount: 0 })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  const panel = page.getByTestId("file-analysis-panel")
  await expect(page.getByRole("heading", { name: "분석", exact: true, level: 1 })).toBeVisible()
  await expect(panel.getByRole("status")).toContainText("이전에 저장한 파일 기록 1개의 최신 상태를 계정에서 확인하지 못했어요.")
  await expect(panel.getByText("10km", { exact: true })).toHaveCount(0)
  await expect(panel.getByText("80분", { exact: true })).toHaveCount(0)
  await expect(panel.getByRole("button", { name: "훈련 계획 보기" })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("stale-ack-analysis-excluded.png"), animations: "disabled" })
  account.failReads(false)
  expect(await page.evaluate(async () => {
    const path = "/src/domain/account/account-journal-record-service.ts"
    return (await import(/* @vite-ignore */ path)).hydrateAccountJournalRecords()
  })).toBe(true)
  await expect.poll(() => sharedDistance(page)).toEqual({ totalKm: 10, includedSourceCount: 1 })
  await expect(panel.getByText("10km", { exact: true })).toBeVisible()
})

test("a real replacement TCX candidate saves a validated correction and reopens with immutable source identity", async ({ page, context }, testInfo) => {
  const account = await mockAccount()
  await account.install(context)
  await openImport(page)
  const panel = await saveImport(page)
  const originalRecord = [...account.documents.values()][0]!.document
  if (originalRecord.entry.kind !== "post-session") throw new Error("Expected imported workout")
  const original = originalRecord.entry.fileObservation!
  await panel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 2개 구간" }).click()
  await panel.getByRole("button", { name: "시간·파일 기록 정정" }).click()
  const correction = panel.getByRole("group", { name: "가져온 기록 정정", exact: true })
  await correction.getByLabel("같은 운동의 수정 파일").setInputFiles({ name: "synthetic-correction.tcx", mimeType: "application/xml",
    buffer: Buffer.from(tcx.replace("<DistanceMeters>9000</DistanceMeters>", "<DistanceMeters>10000</DistanceMeters>")
      .replace("<TotalTimeSeconds>4500</TotalTimeSeconds>", "<TotalTimeSeconds>5100</TotalTimeSeconds>")) })
  await correction.getByRole("button", { name: /11000m.*5400초.*이 수정본 선택/u }).click()
  await expect(correction.getByLabel(/전체 거리: 10000m.*11000m/u)).toBeVisible()
  const review = correction.locator("summary").filter({ hasText: "시간과 날짜 확인" })
  await review.click()
  await correction.getByLabel("파일의 시간은 어떤 시간인가요?").selectOption("TIMER")
  const checkboxes = correction.getByRole("checkbox")
  expect(await checkboxes.count()).toBeGreaterThanOrEqual(3)
  for (const checkbox of await checkboxes.all()) await checkbox.check()
  await correction.getByRole("button", { name: "확인한 변경 저장" }).click()
  await expect(correction.getByRole("status")).toContainText("정정한 기록을 계정에 저장했어요.")
  const corrected = [...account.documents.values()][0]!
  expect(corrected.revision).toBe(2)
  if (corrected.document.entry.kind !== "post-session") throw new Error("Expected corrected workout")
  expect(corrected.document.entry.fileObservation).toMatchObject({ sourceObservationKey: original.sourceObservationKey,
    sourceIdentityFingerprint: original.sourceIdentityFingerprint, distanceMeters: 11000, durationSeconds: 5400 })
  expect(corrected.document.entry.fileObservation!.contentRevisionFingerprint).not.toBe(original.contentRevisionFingerprint)
  expect(account.calls.filter(call => call.action === "correctImportedObservation")).toHaveLength(1)
  expect(await sharedDistance(page)).toEqual({ totalKm: 11, includedSourceCount: 1 })
  await page.reload()
  await expect.poll(() => sharedDistance(page)).toEqual({ totalKm: 11, includedSourceCount: 1 })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  await expect(panel.getByText("11km", { exact: true })).toBeVisible()
  await expect(panel.getByText("90분", { exact: true })).toBeVisible()
  await panel.locator("h2").evaluate(node => node.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: testInfo.outputPath("real-parser-correction-reopened.png") })
})

for (const file of additionalFiles) {
  test(`${file.format.toUpperCase()} real import -> schema-validated account ACK -> reload -> lapless report`, async ({ page, context }, testInfo) => {
    const account = await mockAccount()
    await account.install(context)
    await openImport(page, file)
    expect(account.documents.size).toBe(0)
    expect(await sharedDistance(page)).toEqual({ totalKm: null, includedSourceCount: 0 })
    await page.getByRole("button", { name: /고른 1건 일지에 저장/u }).click()
    await expect(page.getByTestId("import-saved")).toContainText("계정에 저장됨 1건")
    const stored = [...account.documents.values()][0]!
    expect(stored.revision).toBe(1)
    expect(stored.document.version).toBe(3)
    expect(schema.validateInitialFileObservationRecord(stored.document)).toBe(true)
    if (stored.document.entry.kind !== "post-session") throw new Error("Expected imported workout")
    const observation = stored.document.entry.fileObservation!
    expect(observation).toMatchObject({ format: file.format, source: "FILE_UPLOAD", sport: "RUNNING", date: "2026-09-19",
      durationMeaning: file.sourceMeaning, confirmation: { durationMeaning: file.confirmedMeaning }, laps: [] })
    expect(observation.durationSeconds).toBe(file.format === "gpx" ? 600 : 1500)
    if (file.format === "gpx") {
      expect(observation.distanceMeters).toBeGreaterThan(2000)
      expect(observation.distanceMeters).toBeLessThan(2010)
    } else expect(observation.distanceMeters).toBe(5000)
    const serialized = JSON.stringify(stored.document)
    for (const forbidden of [privateMarker, "35.123456", "35.141456", "127.654321", `synthetic.${file.format}`, "analysisEligible"])
      expect(serialized).not.toContain(forbidden)
    const readsBefore = account.calls.filter(call => call.action === "read" || call.action === "list").length
    await page.reload()
    await expect.poll(() => page.evaluate(async () => {
      const path = "/src/domain/account/account-journal-projection.ts"
      return (await import(/* @vite-ignore */ path)).readCurrentConfirmedAccountJournalProjection().length
    })).toBe(1)
    expect(account.calls.filter(call => call.action === "read" || call.action === "list").length).toBeGreaterThan(readsBefore)
    expect(account.calls.filter(call => call.action === "save")).toHaveLength(1)
    expect(account.documents.get(stored.documentId)).toEqual(stored)
    expect((await sharedDistance(page)).includedSourceCount).toBe(1)
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
    const panel = page.getByTestId("file-analysis-panel")
    await expect(panel.getByText(file.distance, { exact: true })).toBeVisible()
    await expect(panel.getByText(file.duration, { exact: true })).toBeVisible()
    await expect(panel.getByRole("heading", { name: file.label, exact: true })).toBeVisible()
    await panel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 0개 구간" }).click()
    await expect(panel.getByText("전체 기록만 있어 구간별로 나눠 비교할 수 없어요.")).toBeVisible()
    await expect(panel.getByRole("region", { name: "계획과 실제 수치 차이" })).toHaveCount(0)
    await expect(panel.getByRole("button", { name: "선택한 대응 확인·저장" })).toHaveCount(0)
    await expect(panel).not.toContainText(privateMarker)
    await panel.locator("h2").evaluate(node => node.scrollIntoView({ block: "start" }))
    await page.screenshot({ path: testInfo.outputPath(`${file.format}-account-reloaded.png`), animations: "disabled" })
    await panel.getByText("전체 기록만 있어 구간별로 나눠 비교할 수 없어요.").scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`${file.format}-lapless-details.png`), animations: "disabled" })
    const compare = panel.getByRole("button", { name: "계획과 비교", exact: true })
    if (await compare.count() > 0) await expect(compare, "Lapless files must not offer an actionable segment comparison").toBeDisabled()
  })
}

for (const width of [320, 375]) {
  test(`report reflow, keyboard and reduced motion at ${width}px with 200% text`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 812 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    const account = await mockAccount()
    await account.install(context)
    await openImport(page)
    const reviewSelect = page.getByLabel("파일의 시간은 어떤 시간인가요?")
    expect((await reviewSelect.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const panel = await saveImport(page)
    const disclosure = panel.locator("summary").filter({ hasText: "계산에 쓴 기록과 빠진 항목" })
    await disclosure.focus(); await disclosure.press("Enter")
    await expect(disclosure.locator("..")).toHaveAttribute("open")
    await disclosure.press("Space")
    await expect(disclosure.locator("..")).not.toHaveAttribute("open")
    const segment = panel.locator("summary").filter({ hasText: "2026-09-19 · 달리기 · 2개 구간" })
    await segment.focus(); await segment.press("Enter")
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await panel.locator("h2").evaluate(node => node.scrollIntoView({ block: "start" }))
    await page.screenshot({ path: testInfo.outputPath(`report-${width}.png`) })
    const originalFont = await panel.locator("h2").evaluate(node => parseFloat(getComputedStyle(node).fontSize))
    // Explicit text-only enlargement, including fixed-pixel UI text; not claimed as native browser zoom.
    await panel.evaluate(node => {
      const elements = [node, ...node.querySelectorAll<HTMLElement>("*")].filter((element): element is HTMLElement => element instanceof HTMLElement)
      const sizes = elements.map(element => getComputedStyle(element).fontSize)
      elements.forEach((element, index) => { element.style.fontSize = `${parseFloat(sizes[index]!) * 2}px` })
    })
    expect(await panel.locator("h2").evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBe(originalFont * 2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(panel.getByRole("button", { name: "훈련 계획 보기" })).toBeEnabled()
    await segment.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`report-${width}-200pct-text.png`) })
    const scroller = panel.getByRole("region", { name: "2026-09-19 구간 기록", exact: true })
    await scroller.evaluate(node => { node.scrollIntoView({ block: "center" }); node.scrollLeft = 0 })
    await scroller.focus()
    await expect(scroller).toBeFocused()
    expect(await scroller.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none")
    await page.screenshot({ path: testInfo.outputPath(`segments-${width}-200pct-text.png`) })
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true)
    const distance = panel.getByRole("cell", { name: "1,000m", exact: true })
    const geometry = await distance.evaluate(node => {
      const textLineCount = (element: Element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const tops = new Set<number>()
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue
          const textRange = document.createRange()
          textRange.selectNodeContents(walker.currentNode)
          for (const rect of textRange.getClientRects()) tops.add(Math.round(rect.top))
        }
        return tops.size
      }
      // A cell range includes inline-block boxes as well as text; their tops are not line baselines.
      const range = document.createRange()
      range.selectNodeContents(node)
      const wrapperAndTextTops = [...new Set([...range.getClientRects()].map(rect => Math.round(rect.top)))]
      const control = document.createElement("span")
      control.textContent = "1,000m"
      control.style.cssText = "position:fixed;left:-10000px;top:0;display:block;width:2ch;font:28px sans-serif;white-space:normal;overflow-wrap:anywhere;"
      document.body.append(control)
      const table = node.closest("table")!
      const headerLines = Object.fromEntries([...table.querySelectorAll("thead th")]
        .filter(cell => cell.textContent === "구간" || cell.textContent === "종류")
        .map(cell => [cell.textContent, textLineCount(cell)]))
      const category = table.querySelector("tbody td")!
      try { return { text: node.textContent, wrapperAndTextTops, actualTextLines: textLineCount(node), wrappedControlLines: textLineCount(control),
        headerLines, category: category.textContent, categoryLines: textLineCount(category) } }
      finally { control.remove() }
    })
    await testInfo.attach(`numeric-text-geometry-${width}`, { contentType: "application/json", body: Buffer.from(JSON.stringify(geometry)) })
    expect(geometry.text).toBe("1,000m")
    expect(geometry.wrappedControlLines, "The same measurement must detect a deliberately wrapped numeric token").toBeGreaterThan(1)
    expect(geometry.actualTextLines, "A distance and its unit must remain readable as one token at 200% text").toBe(1)
    expect(geometry.headerLines, "Short column headings must not become vertical character stacks").toEqual({ "구간": 1, "종류": 1 })
    expect(geometry.category).toBe("미지정")
    expect(geometry.categoryLines, "The activity category must remain readable as a whole word").toBe(1)
    expect(await scroller.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
    const keyboardScroll = async (key: "ArrowRight" | "ArrowLeft") => {
      await scroller.evaluate(node => {
        node.removeAttribute("data-e2e-scroll-ended")
        node.addEventListener("scrollend", () => node.setAttribute("data-e2e-scroll-ended", "true"), { once: true })
      })
      await scroller.press(key)
      await expect(scroller).toHaveAttribute("data-e2e-scroll-ended", "true")
    }
    await keyboardScroll("ArrowRight")
    await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
    const keyboardOffset = await scroller.evaluate(node => node.scrollLeft)
    await keyboardScroll("ArrowLeft")
    await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeLessThan(keyboardOffset)
    await scroller.evaluate(node => node.removeAttribute("data-e2e-scroll-ended"))
    // Keyboard movement is checked above; move fully right to capture the time explanation unobscured.
    await scroller.evaluate(node => { node.scrollLeft = node.scrollWidth })
    await expect.poll(() => scroller.evaluate(node => Math.abs(node.scrollWidth - node.clientWidth - node.scrollLeft))).toBeLessThanOrEqual(1)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollLeft === 0)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`segments-${width}-200pct-text-right.png`), animations: "disabled" })
    const rightEdge = await scroller.evaluate(node => {
      const box = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height })
      const rect = node.getBoundingClientRect()
      const visible = { left: Math.max(0, rect.left + node.clientLeft), right: Math.min(innerWidth, rect.left + node.clientLeft + node.clientWidth),
        top: Math.max(0, rect.top + node.clientTop), bottom: Math.min(innerHeight, rect.top + node.clientTop + node.clientHeight) }
      const table = node.querySelector("table")!
      const timeCell = table.querySelector("tbody tr:first-child td:last-child")!
      const measureText = (element: Element, prefixLength?: number) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const rectangles: ReturnType<typeof box>[] = []
        let text = ""
        while (walker.nextNode()) {
          const content = walker.currentNode.textContent ?? ""
          if (!content.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(walker.currentNode)
          if (prefixLength !== undefined) range.setEnd(walker.currentNode, Math.min(prefixLength, content.length))
          text += range.toString()
          rectangles.push(...[...range.getClientRects()].map(box))
          if (prefixLength !== undefined) break
        }
        return { text, rectangles }
      }
      return { viewportWidth: innerWidth, scrollerWidth: node.clientWidth, scrollLeft: node.scrollLeft, maxScrollLeft: node.scrollWidth - node.clientWidth,
        tableWidth: table.getBoundingClientRect().width, columnWidths: [...table.querySelectorAll("thead th")].map(cell => ({ label: cell.textContent, width: cell.getBoundingClientRect().width })),
        timeCell: box(timeCell.getBoundingClientRect()), visible, targets: {
          heading: measureText(table.querySelector("thead th:last-child")!),
          duration: measureText(timeCell.querySelector(".file-analysis-value")!),
          descriptionStart: measureText(timeCell.querySelector("small")!, 2),
          description: measureText(timeCell.querySelector("small")!),
        } }
    })
    const boundsPath = testInfo.outputPath(`segments-${width}-200pct-right-bounds.json`)
    await writeFile(boundsPath, JSON.stringify(rightEdge, null, 2))
    await testInfo.attach(`right-edge-text-bounds-${width}`, { contentType: "application/json", path: boundsPath })
    expect(rightEdge.targets.heading.text).toBe("시간")
    expect(rightEdge.targets.duration.text).toBe("5분")
    expect(rightEdge.targets.descriptionStart.text).toBe("뜻을")
    expect(rightEdge.targets.description.text).toBe("뜻을 확인하지 않은 파일 시간")
    for (const [name, target] of Object.entries(rightEdge.targets)) {
      const diagnostic = `${name} must fit inside the visible scroller at maximum horizontal scroll: ${JSON.stringify(rightEdge)}`
      expect(target.rectangles.length, diagnostic).toBeGreaterThan(0)
      for (const rect of target.rectangles) {
        expect(rect.left, diagnostic).toBeGreaterThanOrEqual(rightEdge.visible.left - 1)
        expect(rect.right, diagnostic).toBeLessThanOrEqual(rightEdge.visible.right + 1)
        expect(rect.top, diagnostic).toBeGreaterThanOrEqual(rightEdge.visible.top - 1)
        expect(rect.bottom, diagnostic).toBeLessThanOrEqual(rightEdge.visible.bottom + 1)
      }
    }
  })
}
