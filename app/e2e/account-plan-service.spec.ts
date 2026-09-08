import { test, expect, type Page } from "@playwright/test"
import { mockRecordServer } from "./fixtures/account-journal-record-server"
import { mockPlanCollectionServer } from "./fixtures/account-plan-collection-server"
import type {} from "./fixtures/account-plan-service"
import type {} from "./fixtures/account-plan-ui"
import type {} from "./fixtures/account-plan-collection"
import type { AccountPlanDocument } from "../src/domain/account/account-plan-document-schema"

async function load(page: Page) {
  await page.goto("/__account_record_test__")
  await page.evaluate(async () => { const path = "/e2e/fixtures/account-plan-service.ts"; (await import(/* @vite-ignore */ path)).setup() })
}
let server: ReturnType<typeof mockRecordServer<AccountPlanDocument>>
let collection: Awaited<ReturnType<typeof mockPlanCollectionServer>>
test.beforeEach(async ({ context, page }) => {
  server = mockRecordServer<AccountPlanDocument>(); await server.install(context)
  collection = await mockPlanCollectionServer(); await collection.install(context); await load(page)
})

test("native encrypted buffer, progress and current pointer recover on a fresh device without overwriting originals", async ({ page, browser }) => {
  expect(await page.evaluate(async () => {
    const h = window.accountPlanHarness
    localStorage.setItem("device-original-sentinel", "SYNTHETIC_ORIGINAL")
    return [await h.service.hydrate(), await h.select()]
  })).toEqual([true, "ACCOUNT"])
  const original = await page.evaluate(() => window.accountPlanHarness.service.snapshot())
  const raw = await page.evaluate(async () => JSON.stringify(await window.accountPlanHarness.rawRecords()))
  expect(raw).not.toContain("BETA_ACTIVE_PLAN_SNAPSHOT")
  expect(raw).not.toContain(original.currentPlan!.planId)
  expect(raw).toContain("ciphertext")
  const fresh = await browser.newContext({ serviceWorkers: "block" })
  try {
    await server.install(fresh)
    const device = await fresh.newPage(); await load(device)
    expect(await device.evaluate(async () => { const h = window.accountPlanHarness; await h.service.hydrate(); return h.service.snapshot().currentPlan })).toEqual(original.currentPlan)
    expect(await device.evaluate(async () => {
      const h = window.accountPlanHarness, packet = structuredClone(h.packet)
      Reflect.set(packet.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
      return h.service.mutate({ kind: "PROGRESS", packet }, h.service.snapshot().fingerprint!)
    })).toBe("ACCOUNT")
    await page.reload(); await load(page)
    const result = await page.evaluate(async () => {
      const h = window.accountPlanHarness; await h.service.hydrate()
      return { current: h.service.snapshot().currentPlan, original: localStorage.getItem("device-original-sentinel") }
    })
    expect(result).toMatchObject({ original: "SYNTHETIC_ORIGINAL", current: { kind: "read_only", executionAuthority: "NONE",
      packet: { state: { progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] } } } })
    expect(await page.evaluate(async () => {
      const s = window.accountPlanHarness.service
      return s.mutate({ kind: "ARCHIVE", planId: s.snapshot().currentPlan!.planId }, s.snapshot().fingerprint!)
    })).toBe("ACCOUNT")
    expect(await device.evaluate(async () => { const s = window.accountPlanHarness.service; await s.hydrate(); return s.snapshot().currentPlan })).toBeNull()
  } finally { await fresh.close() }
})

test("native pending bytes survive reload, require fresh selection review and retain the same operation", async ({ page }) => {
  await page.evaluate(() => window.accountPlanHarness.service.hydrate())
  server.offline(true)
  expect(await page.evaluate(() => window.accountPlanHarness.select())).toBe("PENDING")
  const pending = await page.evaluate(async () => (await window.accountPlanHarness.view())!.pending)
  expect(pending).not.toBeNull()
  server.offline(false)
  await page.reload(); await load(page)
  await page.evaluate(() => window.accountPlanHarness.service.hydrate())
  expect(await page.evaluate(() => window.accountPlanHarness.service.retry())).toBe("PENDING")
  expect(await page.evaluate(async () => (await window.accountPlanHarness.view())!.pending)).toEqual(pending)
  expect(await page.evaluate(() => window.accountPlanHarness.service.retry(() => true))).toBe("ACCOUNT")
  const calls = server.calls.filter(c => c.request.action === "save")
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
})

test("fresh device never sees another owner's current plan", async ({ page }) => {
  await page.evaluate(async () => { const h = window.accountPlanHarness; await h.service.hydrate(); await h.select() })
  expect(await page.evaluate(() => {
    const h = window.accountPlanHarness
    h.setActiveLocalAccount("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    return h.service.snapshot()
  })).toMatchObject({ status: "IDLE", document: null, currentPlan: null })
})

async function mountUi(page: Page) {
  await page.evaluate(async () => {
    const refreshPath = "/@react-refresh", uiPath = "/e2e/fixtures/account-plan-ui.tsx"
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type,
      __vite_plugin_react_preamble_installed__: true })
    await (await import(/* @vite-ignore */ uiPath)).mount()
  })
}

async function loadCollection(page: Page) {
  await page.goto("/__account_record_test__")
  await page.evaluate(async () => {
    const path = "/e2e/fixtures/account-plan-collection.ts"
    ;(await import(/* @vite-ignore */ path)).setup()
  })
}

test("partitioned native buffer encrypts parts and a fresh device reads current before requested history", async ({ page, browser }) => {
  test.setTimeout(60_000)
  await loadCollection(page)
  expect(await page.evaluate(async () => { const h = window.accountCollectionHarness; await h.service.hydrate(); return h.select() })).toBe("ACCOUNT")
  expect(await page.evaluate(async () => {
    const h = window.accountCollectionHarness
    const packets = Array.from({ length: 17 }, (_, i) => {
      const packet = structuredClone(h.packet)
      Reflect.set(packet.state, "generatedAt", new Date(Date.now() - (i + 1) * 86_400_000).toISOString())
      return packet
    })
    return h.service.importHistory(packets, h.service.snapshot().fingerprint!, () => true)
  })).toBe("ACCOUNT")
  const current = await page.evaluate(() => window.accountCollectionHarness.service.snapshot().currentPlan)
  const raw = await page.evaluate(async () => JSON.stringify(await window.accountCollectionHarness.rawRecords()))
  expect(raw).toContain("ciphertext"); expect(raw).not.toContain("BETA_ACTIVE_PLAN_SNAPSHOT")
  expect(raw).not.toContain(current!.planId)
  const fresh = await browser.newContext({ serviceWorkers: "block" })
  try {
    await server.install(fresh); await collection.install(fresh)
    const device = await fresh.newPage(); await loadCollection(device)
    const start = collection.calls.length
    const view = await device.evaluate(async () => { const s = window.accountCollectionHarness.service; await s.hydrate(); return s.snapshot() })
    expect(view.currentPlan).toEqual(current)
    expect(view.historyLoaded).toBe(false)
    expect(view.totalPlans).toBe(18)
    expect(view.confirmedDocument!.data.plans).toHaveLength(1)
    expect(collection.calls.slice(start).filter(c => c.request.action === "readPart")).toHaveLength(2)
    expect(await device.evaluate(() => window.accountCollectionHarness.service.loadHistory())).toBe(true)
    expect(await device.evaluate(() => window.accountCollectionHarness.service.snapshot().historyLoaded)).toBe(true)
    expect(await device.evaluate(() => window.accountCollectionHarness.service.snapshot().confirmedDocument!.data.plans.length)).toBe(18)
  } finally { await fresh.close() }
})

test("partitioned native pending survives reload and reuses its exact operation after fresh review", async ({ page }) => {
  test.setTimeout(60_000)
  await loadCollection(page)
  await page.evaluate(() => window.accountCollectionHarness.service.hydrate())
  collection.offline(true)
  expect(await page.evaluate(() => window.accountCollectionHarness.select())).toBe("PENDING")
  collection.offline(false)
  await loadCollection(page)
  await page.evaluate(() => window.accountCollectionHarness.service.hydrate())
  expect(await page.evaluate(() => window.accountCollectionHarness.service.snapshot().currentPlan)).toBeNull()
  expect(await page.evaluate(() => window.accountCollectionHarness.service.retry(() => true))).toBe("ACCOUNT")
  expect(collection.receipts.size).toBe(1)
  expect(await page.evaluate(() => window.accountCollectionHarness.service.snapshot().status)).toBe("READY")
})

test("actual PlanBeta selection, progress, archive and Home/journal projections use the account pointer", async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message))
  await page.evaluate(() => localStorage.setItem("trainoracle.plan-beta.v1", "SYNTHETIC_DEVICE_ORIGINAL"))
  await mountUi(page)
  for (const name of [/^1500m/u, /고등부/u, /훈련 계획에 맞춰 달려 본 경험/u,
    /통증은 없고 몸 상태는 평소와 같아요/u, /^내 계획 완성하기$/u, /지속 페이스.*LT/u,
    /RPE 기준으로 받기/u, /^3일/u, /9일 계획 받기/u, /날마다 달라요/u, /하루 한 번 운동/u,
    /^날짜 없이 계획안 보기$/u]) await page.getByRole("button", { name }).click()
  await page.getByRole("button", { name: /선택하기/u }).first().click()
  await expect(page.getByText("계정에 저장됨", { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan?.kind)).toBe("read_only")
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).first().click()
  await page.getByRole("button", { name: "완료", exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => {
    const current = window.accountPlanUi.service.snapshot().currentPlan
    return current?.kind === "read_only" ? current.packet.state.progress.length : 0
  })).toBe(1)
  await page.evaluate(() => window.accountPlanUi.home())
  await expect(page.getByRole("button", { name: /다음 훈련/u }).first()).toBeVisible()
  await page.getByRole("button", { name: /다음 훈련/u }).first().click()
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).first().click()
  await page.getByRole("button", { name: /이 훈련.*일지/u }).first().click()
  await expect.poll(() => page.evaluate(() => !!window.accountPlanUi.draft())).toBe(true)
  await page.evaluate(() => window.accountPlanUi.journal())
  await page.getByText("계획한 훈련과 비교하기", { exact: true }).click()
  await expect(page.getByText(/이 일지와 연결된 현재 계획/u)).toBeVisible()
  await page.evaluate(() => window.accountPlanUi.plan())
  await page.getByRole("button", { name: "현재 계획 보관", exact: true }).click()
  await page.getByRole("button", { name: "보관하고 현재 계획 끝내기", exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toBeNull()
  await page.evaluate(() => window.accountPlanUi.journal())
  await page.getByText("계획한 훈련과 비교하기", { exact: true }).click()
  await expect(page.getByText(/그때 보관한 계획/u)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe("SYNTHETIC_DEVICE_ORIGINAL")
  expect(collection.calls.filter(c => c.request.action === "commit")).toHaveLength(3)
  expect(errors).toEqual([])
})

test("actual recovery UI preserves an old unsent plan as account history without activating it or erasing the old outbox", async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.evaluate(() => window.accountPlanHarness.service.hydrate())
  server.offline(true)
  expect(await page.evaluate(() => window.accountPlanHarness.select())).toBe("PENDING")
  const old = await page.evaluate(() => window.accountPlanHarness.view())
  server.offline(false)
  await mountUi(page)
  await expect(page.getByRole("heading", { name: "아직 계정에 반영되지 않은 계획이 있어요" })).toBeVisible()
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 667 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const button = await page.getByRole("button", { name: "계획 원본으로 보관", exact: true }).boundingBox()
    expect(button!.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath(`legacy-recovery-${width}.png`), fullPage: true })
  }
  await page.getByRole("button", { name: "계획 원본으로 보관", exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const view = window.accountPlanUi.service.snapshot()
    return "legacyPending" in view ? view.legacyPending : null
  })).toBe(false)
  expect(await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toBeNull()
  expect(await page.evaluate(() => window.accountPlanHarness.view())).toEqual(old)
  const account = [...collection.indexes.values()][0]!
  expect(account.index.currentPlanId).toBeNull(); expect(account.index.plans).toHaveLength(1)
  await loadCollection(page)
  expect(await page.evaluate(async () => {
    const s = window.accountCollectionHarness.service; await s.hydrate(); await s.loadHistory()
    return { pending: s.snapshot().legacyPending, current: s.snapshot().currentPlan,
      archive: s.snapshot().confirmedDocument!.data.plans[0]!.archivedAt }
  })).toMatchObject({ pending: false, current: null, archive: expect.any(String) })
})
