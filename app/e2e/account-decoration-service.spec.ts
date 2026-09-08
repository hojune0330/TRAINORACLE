import { expect, test, type Page } from "@playwright/test"
import { mockRecordServer } from "./fixtures/account-journal-record-server"
import type { AccountDecorationDocument } from "../src/domain/account/account-decoration-schema"
import type {} from "./fixtures/account-decoration-service"

async function load(page: Page) {
  await page.goto("/__account_record_test__")
  await page.addScriptTag({ type: "module", url: "/e2e/fixtures/account-decoration-service.ts" })
  await page.waitForFunction(() => !!window.accountDecorationHarness)
}
let server: ReturnType<typeof mockRecordServer<AccountDecorationDocument>>
test.beforeEach(async ({ context, page }) => {
  server = mockRecordServer<AccountDecorationDocument>(); await server.install(context); await load(page)
})
test("account decoration saves, survives a new device and never writes plaintext localStorage", async ({ page, browser }) => {
  const state = await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    if (!await h.hydrateAccountDecorations()) throw Error("Missing initial state")
    const current = h.loadDecorationState()
    const next = { ...current, pages: [{ date: "2026-09-08", items: [{ itemId: "TEXT_STICKER" as const,
      text: "SYNTHETIC_NOTE", inkId: "TEXT_INK_NAVY" as const,
      transform: { xPercent: 24, yPercent: 65, scale: 1.5, rotationDeg: -15 } }] }] }
    const saved = await h.persistAccountDecorations(next, h.readDecorationStateSerialized())
    return { saved, state: h.loadDecorationState(), local: { ...localStorage } }
  })
  expect(state.saved).toMatchObject({ ok: true, storage: "ACCOUNT" })
  expect(state.state.pages[0]?.items[0]).toMatchObject({ text: "SYNTHETIC_NOTE", transform: { xPercent: 24, scale: 1.5 } })
  expect(Object.keys(state.local).some(key => key.includes("decorations"))).toBe(false)
  expect(await page.evaluate(async () => JSON.stringify(await window.accountDecorationHarness.rawRecords()))).not.toContain("SYNTHETIC_NOTE")
  const fresh = await browser.newContext({ serviceWorkers: "block" })
  try {
    await server.install(fresh); const other = await fresh.newPage(); await load(other)
    expect(await other.evaluate(async () => {
      const h = window.accountDecorationHarness
      return { loaded: await h.hydrateAccountDecorations(), state: h.loadDecorationState() }
    })).toEqual({ loaded: true, state: state.state })
  } finally { await fresh.close() }
})
test("lost receipt replays the same operation after reload", async ({ page }) => {
  await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())
  server.loseReceipt()
  expect(await page.evaluate(() => {
    const h = window.accountDecorationHarness
    return h.persistAccountDecorations(h.loadDecorationState(), h.readDecorationStateSerialized())
  })).toMatchObject({ ok: true, storage: "PENDING" })
  await page.reload(); await load(page)
  expect(await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())).toBe(true)
  const saves = server.calls.filter(call => call.request.action === "save")
  expect(saves).toHaveLength(2); expect(saves[1]).toEqual(saves[0])
  expect([...server.documents.values()].map(value => value.revision)).toEqual([1])
})
test("legacy writes fail closed and stale expected state cannot replace a newer state", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDecorationHarness; await h.hydrateAccountDecorations()
    const original = h.readDecorationStateSerialized()
    const state = h.loadDecorationState()
    const changed = { ...state, library: { ...state.library, favoriteItemIds: [state.equipped.themeId] } }
    const first = await h.persistAccountDecorations(changed, original)
    return { first, stale: await h.persistAccountDecorations(state, original), legacy: h.saveDecorationState(state) }
  })
  expect(result).toMatchObject({ first: { ok: true }, stale: { ok: false, code: "STALE_STATE" }, legacy: { ok: false } })
})
test("A-B-A switch invalidates an in-flight reply and isolates projected contents", async ({ page }) => {
  await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())
  const release = server.holdNext("save")
  const saving = page.evaluate(async () => {
    const h = window.accountDecorationHarness
    return h.persistAccountDecorations(h.loadDecorationState(), h.readDecorationStateSerialized())
  })
  await expect.poll(() => server.calls.some(call => call.request.action === "save")).toBe(true)
  expect(await page.evaluate(() => {
    const h = window.accountDecorationHarness; h.setActiveLocalAccount(h.other)
    const hidden = h.readAccountDecorationState(); h.setActiveLocalAccount(h.owner)
    return { hidden, returned: h.readAccountDecorationState() }
  })).toEqual({ hidden: null, returned: null })
  release(); expect(await saving).toMatchObject({ ok: false })
})

async function credits(page: Page, legacySpentPoints = 0) {
  await page.route("**/__record_api__", async route => {
    const { ownerId, request } = route.request().postDataJSON()
    if (request.action !== "rewardSummary") return route.fallback()
    const documentSpent = [...server.documents.entries()].find(([key]) => key.startsWith(ownerId + ":"))?.[1].document.data.spentPoints ?? 0
    const spentPoints = Math.max(0, documentSpent - legacySpentPoints)
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ kind: "rewardSummary", ownerId,
      today: "2026-09-08", points: 100, spentPoints, availablePoints: 100 - spentPoints, journalDays: 25, visitDays: 0,
      visitedToday: false, journalRecordedToday: false, ...(legacySpentPoints ? { legacySpentPoints } : {}) }) })
  })
}

async function mount(page: Page) {
  await page.evaluate(async () => {
    const refreshPath = "/@react-refresh", fixturePath = "/e2e/fixtures/account-decoration-ui.tsx"
    const refresh = await import(/* @vite-ignore */ refreshPath)
    refresh.default.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fixture = await import(/* @vite-ignore */ fixturePath)
    fixture.mount()
  })
}

test("generic canvas save cannot manufacture ownership or points", async ({ page }) => {
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const state = h.loadDecorationState(), item = h.paidItem
    return h.persistAccountDecorations({ ...state, ownedItemIds: [...state.ownedItemIds, item.id], spentPoints: item.cost }, h.readDecorationStateSerialized())
  })).toMatchObject({ ok: false, code: "INVALID_STATE" })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(0)
})

test("pending purchase is never projected as owned until matching ACK", async ({ page }) => {
  await credits(page)
  await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())
  const release = server.holdNext("save")
  try {
    await page.evaluate(() => { const h = window.accountDecorationHarness; h.pending = h.purchaseAccountDecoration(h.paidItem.id, h.readDecorationStateSerialized()) })
    await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(1)
    expect(await page.evaluate(async () => {
      const h = window.accountDecorationHarness
      return { owned: h.loadDecorationState().ownedItemIds.includes(h.paidItem.id), pending: (await h.view())?.state }
    })).toEqual({ owned: false, pending: "PENDING" })
    release()
    expect(await page.evaluate(() => window.accountDecorationHarness.pending)).toMatchObject({ ok: true, storage: "ACCOUNT" })
    expect(await page.evaluate(() => { const h = window.accountDecorationHarness; return h.loadDecorationState().ownedItemIds.includes(h.paidItem.id) })).toBe(true)
  } finally { release() }
})

test("offline pending purchase stays unowned across reload and retries the same operation once", async ({ page }) => {
  await credits(page)
  await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())
  server.offline(true)
  expect(await page.evaluate(() => { const h = window.accountDecorationHarness; return h.purchaseAccountDecoration(h.paidItem.id, h.readDecorationStateSerialized()) })).toMatchObject({ ok: true, storage: "PENDING" })
  await load(page)
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    return h.loadDecorationState().ownedItemIds.includes(h.paidItem.id)
  })).toBe(false)
  server.offline(false)
  expect(await page.evaluate(() => window.accountDecorationHarness.hydrateAccountDecorations())).toBe(true)
  const saves = server.calls.filter(call => call.request.action === "save")
  expect(saves.length).toBeGreaterThan(1)
  expect(saves.every(call => JSON.stringify(call) === JSON.stringify(saves[0]))).toBe(true)
  expect([...server.documents.values()].map(value => value.revision)).toEqual([1])
})

test("existing scoped decoration migration is explicit, owner bound and preserves source", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDecorationHarness, key = h.activeDecorationStorageKeyV3()
    const state = { ...h.createEmptyDecorationState(), pages: [{ date: "2026-09-08", items: [{ itemId: "TEXT_STICKER" as const,
      text: "LEGACY_PRIVATE", inkId: "TEXT_INK_NAVY" as const, transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }] }
    const raw = JSON.stringify(state); localStorage.setItem(key, raw)
    await h.hydrateAccountDecorations()
    const before = h.loadDecorationState().pages.length
    const review = await h.reviewAccountDecorationMigration()
    if (!review) throw Error("Missing migration review")
    const accepted = await h.migrateAccountDecorations(review)
    return { before, accepted, after: h.loadDecorationState(), retained: localStorage.getItem(key) === raw }
  })
  expect(result).toMatchObject({ before: 0, accepted: true, after: { pages: [{ items: [{ text: "LEGACY_PRIVATE" }] }] }, retained: true })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(1)
})

test("paid legacy migration keeps its purpose across lost ACK and permits only new credit spending afterward", async ({ page }, testInfo) => {
  await credits(page, 700)
  server.loseReceipt()
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const state = h.createEmptyDecorationState()
    const legacy = { ...state, spentPoints: 700, ownedItemIds: [...state.ownedItemIds, h.paidItems[0]!.id] }
    const raw = JSON.stringify(legacy), key = h.activeDecorationStorageKeyV3()
    localStorage.setItem(key, raw)
    const review = await h.reviewAccountDecorationMigration()
    return { accepted: await h.migrateAccountDecorations(review!),
      owned: h.loadDecorationState().ownedItemIds.includes(h.paidItems[0]!.id),
      purpose: (await h.view())?.pending?.writePurpose, retained: localStorage.getItem(key) === raw }
  })).toEqual({ accepted: false, owned: false, purpose: "MIGRATION", retained: true })
  await page.reload(); await load(page)
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    return { hydrated: await h.hydrateAccountDecorations(), owned: h.loadDecorationState().ownedItemIds.includes(h.paidItems[0]!.id) }
  })).toEqual({ hydrated: true, owned: true })
  const migrations = server.calls.filter(call => call.request.action === "save")
  expect(migrations).toHaveLength(2)
  expect(migrations[1]).toEqual(migrations[0])
  expect(migrations[0]!.request).toMatchObject({ writePurpose: "MIGRATION", expectedRevision: 0 })
  const release = server.holdNext("save")
  try {
    await page.evaluate(() => { const h = window.accountDecorationHarness; h.pending = h.purchaseAccountDecoration(h.paidItems[1]!.id, h.readDecorationStateSerialized()) })
    await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(3)
    expect(await page.evaluate(() => { const h = window.accountDecorationHarness; return h.loadDecorationState().ownedItemIds.includes(h.paidItems[1]!.id) })).toBe(false)
  } finally { release() }
  const purchased = await page.evaluate(async () => {
    const h = window.accountDecorationHarness, result = await h.pending
    return { result, total: h.loadDecorationState().spentPoints, expected: 700 + h.paidItems[1]!.cost,
      remaining: 100 - h.paidItems[1]!.cost }
  })
  expect(purchased.result).toMatchObject({ ok: true, storage: "ACCOUNT", remainingPoints: purchased.remaining })
  expect(purchased.total).toBe(purchased.expected)
  await mount(page)
  await page.getByRole("button", { name: "이 계정의 기기 꾸미기 확인" }).click()
  await expect(page.getByText(/구매 증빙 미검증 보존본/)).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("decoration-migration-375.png"), fullPage: true })
})

test("ineligible legacy preservation stays pending and never grants ownership", async ({ page }) => {
  await page.route("**/__record_api__", route => {
    const { request } = route.request().postDataJSON()
    return request.action === "save" ? route.fulfill({ status: 403, contentType: "application/json", body: "{}" }) : route.fallback()
  })
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const state = h.createEmptyDecorationState()
    const raw = JSON.stringify({ ...state, spentPoints: 900, ownedItemIds: [...state.ownedItemIds, h.paidItem.id] })
    localStorage.setItem(h.activeDecorationStorageKeyV3(), raw)
    const review = await h.reviewAccountDecorationMigration()
    return { accepted: await h.migrateAccountDecorations(review!), owned: h.loadDecorationState().ownedItemIds.includes(h.paidItem.id),
      pending: (await h.view())?.pending?.writePurpose, retained: localStorage.getItem(h.activeDecorationStorageKeyV3()) === raw }
  })).toEqual({ accepted: false, owned: false, pending: "MIGRATION", retained: true })
})

test("existing account state cannot receive a second legacy ownership grant", async ({ page }) => {
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const state = h.loadDecorationState()
    await h.persistAccountDecorations(state, h.readDecorationStateSerialized())
    localStorage.setItem(h.activeDecorationStorageKeyV3(), JSON.stringify({ ...state, spentPoints: h.paidItem.cost,
      ownedItemIds: [...state.ownedItemIds, h.paidItem.id] }))
    return h.migrateAccountDecorations((await h.reviewAccountDecorationMigration())!)
  })).toBe(false)
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(1)
})

test("migration refuses stale or lossy source instead of dropping unknown stickers", async ({ page }) => {
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness, key = h.activeDecorationStorageKeyV3()
    await h.hydrateAccountDecorations()
    localStorage.setItem(key, JSON.stringify(h.createEmptyDecorationState()))
    const review = await h.reviewAccountDecorationMigration()
    const invalid = JSON.stringify({ ...h.createEmptyDecorationState(), pages: [{ date: "2026-09-08", items: [{ itemId: "FUTURE_STICKER", text: "DO_NOT_DROP" }] }] })
    localStorage.setItem(key, invalid)
    return { stale: await h.migrateAccountDecorations(review!), invalid: (await h.reviewAccountDecorationMigration())?.state,
      retained: localStorage.getItem(key) === invalid }
  })).toEqual({ stale: false, invalid: null, retained: true })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(0)
})

test("fetch failure is not empty state and UI remains noneditable", async ({ page }) => {
  await page.route("**/__record_api__", route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }))
  await mount(page)
  await expect(page.getByText("꾸미기 조회에 실패했어요. 기기의 보관 내용은 지우지 않았어요.")).toBeVisible()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await expect(page.getByRole("dialog", { name: "이 일지 꾸미기", exact: true })).toHaveCount(0)
})

test("unavailable native IDB fails visibly without an unhandled rejection or plaintext fallback", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.evaluate(() => {
    window.accountDecorationHarness.disposeAccountDecorations()
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined })
  })
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    return { loaded: await h.hydrateAccountDecorations(), status: h.accountDecorationStatus(),
      saved: h.saveDecorationState(h.createEmptyDecorationState()), local: { ...localStorage } }
  })).toMatchObject({ loaded: false, status: "FAILED", saved: { ok: false, code: "STORAGE_UNAVAILABLE" }, local: {} })
  await mount(page)
  await expect(page.getByText("꾸미기 조회에 실패했어요. 기기의 보관 내용은 지우지 않았어요.")).toBeVisible()
  expect(errors).toEqual([])
})

test("native canvas text edit, drag, undo and reload preserve encrypted private sticker", async ({ page }, testInfo) => {
  await credits(page); await mount(page)
  await expect(page.getByText("계정에 저장된 꾸미기가 없어요.")).toBeVisible()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "글 스티커 도구" , exact: true }).click()
  await page.getByRole("textbox").fill("CANVAS_PRIVATE")
  await page.getByRole("button", { name: "붙이기", exact: true }).click()
  const placement = page.getByTestId("journal-decoration-item-0")
  await expect(placement).toContainText("CANVAS_PRIVATE")
  await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(1)
  await expect(page.getByText("꾸미기 저장 중", { exact: true })).toHaveCount(0)
  const before = await page.evaluate(() => window.accountDecorationHarness.loadDecorationState().pages[0]!.items[0]!.transform)
  const box = await placement.boundingBox()
  if (!box) throw Error("Missing real canvas placement")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 25, { steps: 8 }); await page.mouse.up()
  await expect.poll(async () => (await page.evaluate(() => window.accountDecorationHarness.loadDecorationState().pages[0]!.items[0]!.transform)).xPercent).not.toBe(before.xPercent)
  await expect(page.getByText("꾸미기 저장 중", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "꾸미기 되돌리기", exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.accountDecorationHarness.loadDecorationState().pages[0]!.items[0]!.transform)).toEqual(before)
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("decoration-" + width + ".png"), fullPage: true })
  }
  await load(page); await mount(page)
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("CANVAS_PRIVATE")
  expect(await page.evaluate(async () => JSON.stringify({ raw: await window.accountDecorationHarness.rawRecords(), local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain("CANVAS_PRIVATE")
  await page.evaluate(() => window.accountDecorationHarness.setActiveLocalAccount(window.accountDecorationHarness.other))
  await expect(page.getByText("CANVAS_PRIVATE", { exact: true })).toHaveCount(0)
})

async function conflict(page: Page) {
  await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const next = { ...h.loadDecorationState(), pages: [{ date: "2026-09-08", items: [{ itemId: "TEXT_STICKER" as const,
      text: "DECOR_BASE", inkId: "TEXT_INK_NAVY" as const, transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }] }
    await h.persistAccountDecorations(next, h.readDecorationStateSerialized())
  })
  const [key, stored] = [...server.documents.entries()][0]!
  const remote = structuredClone(stored); remote.revision = 2
  Object.assign(remote.document.data.pages[0]!.items[0]!, { text: "DECOR_REMOTE" })
  server.documents.set(key, remote)
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness, next = structuredClone(h.loadDecorationState())
    Object.assign(next.pages[0]!.items[0]!, { text: "DECOR_LOCAL" })
    return h.persistAccountDecorations(next, h.readDecorationStateSerialized())
  })).toMatchObject({ ok: false, code: "STALE_STATE" })
  return { key, documentId: remote.documentId }
}

test("conflict compares fresh server revisions and exposes encrypted archive in owner-only UI after reload", async ({ page }, testInfo) => {
  const { key } = await conflict(page)
  const review = await page.evaluate(() => window.accountDecorationHarness.loadAccountDecorationConflict())
  expect(review).toMatchObject({ local: { pages: [{ items: [{ text: "DECOR_LOCAL" }] }] }, remote: { pages: [{ items: [{ text: "DECOR_REMOTE" }] }] } })
  await page.setViewportSize({ width: 375, height: 812 })
  await mount(page)
  await page.getByRole("button", { name: "두 꾸미기 비교하기" }).click()
  await expect(page.getByRole("region", { name: "계정에 저장된 내용" })).toContainText("DECOR_REMOTE")
  await page.getByRole("radio", { name: "이 기기 내용 사용" }).check()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("decoration-conflict-375.png"), fullPage: true })
  server.documents.get(key)!.revision = 3
  Object.assign(server.documents.get(key)!.document.data.pages[0]!.items[0]!, { text: "DECOR_LATEST" })
  expect(await page.evaluate(review => window.accountDecorationHarness.resolveAccountDecorationConflict(review!, "LOCAL"), review)).toBe(false)
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness, latest = await h.loadAccountDecorationConflict()
    return h.resolveAccountDecorationConflict(latest!, "REMOTE")
  })).toBe(true)
  await load(page); await mount(page)
  await page.getByRole("button", { name: "꾸미기 보존본 보기" }).click()
  await page.locator("summary").filter({ hasText: /^기기 / }).first().click()
  await expect(page.getByRole("region", { name: "보존된 기기 꾸미기" }).first()).toContainText("DECOR_LOCAL")
  await expect(page.getByRole("region", { name: "보존된 계정 꾸미기" }).first()).toContainText("DECOR_REMOTE")
  expect(await page.evaluate(async () => JSON.stringify(await window.accountDecorationHarness.rawRecords()))).not.toMatch(/DECOR_LOCAL|DECOR_REMOTE|DECOR_LATEST/)
  await page.evaluate(() => window.accountDecorationHarness.setActiveLocalAccount(window.accountDecorationHarness.other))
  await expect(page.getByText("DECOR_LOCAL", { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => { const h = window.accountDecorationHarness; return h.readAccountDecorationConflictArchive(h.owner) })).toBeNull()
})

test("two tabs cannot resolve over a newer local decoration edit", async ({ page, context }) => {
  await conflict(page)
  const review = await page.evaluate(() => window.accountDecorationHarness.loadAccountDecorationConflict())
  const count = server.calls.filter(call => call.request.action === "read").length
  const release = server.holdNext("read"), second = await context.newPage()
  try {
    await load(second)
    await page.evaluate(review => { const h = window.accountDecorationHarness; h.pending = h.resolveAccountDecorationConflict(review!, "REMOTE") }, review)
    await expect.poll(() => server.calls.filter(call => call.request.action === "read").length).toBe(count + 1)
    await second.evaluate(() => window.accountDecorationHarness.editFromOtherTab("SECOND_TAB"))
    release()
    expect(await page.evaluate(() => window.accountDecorationHarness.pending)).toBe(false)
    expect(await page.evaluate(() => window.accountDecorationHarness.view())).toMatchObject({ state: "CONFLICT", draft: { data: { pages: [{ items: [{ text: "SECOND_TAB" }] }] } } })
  } finally { release(); await second.close() }
})

test("remote deletion creates a resolvable durable conflict and cannot resurrect on hydrate", async ({ page }) => {
  const { key, documentId } = await conflict(page)
  server.documents.delete(key); server.tombstones.set(key, { documentId, revision: 3 })
  const saves = server.calls.filter(call => call.request.action === "save").length
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    const review = await h.loadAccountDecorationConflict()
    return { review, forbidden: await h.resolveAccountDecorationConflict(review!, "LOCAL"), accepted: await h.resolveAccountDecorationConflict(review!, "REMOTE") }
  })).toMatchObject({ review: { remote: null }, forbidden: false, accepted: true })
  await load(page)
  expect(await page.evaluate(async () => {
    const h = window.accountDecorationHarness
    await h.hydrateAccountDecorations()
    return { status: h.accountDecorationStatus(), projection: h.readAccountDecorationState(), archived: (await h.readAccountDecorationConflictArchive(h.owner))?.length }
  })).toMatchObject({ status: "DELETED", projection: null, archived: expect.any(Number) })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(saves)
})

test("surface recovers from a thrown async save and keeps unsaved text for retry", async ({ page }) => {
  await page.route("**/src/domain/account/account-decoration-service.ts*", async route => {
    const response = await route.fetch(), body = await response.text()
    const signature = "export async function persistAccountDecorations(candidate, expectedSerialized) {"
    expect(body.split(signature)).toHaveLength(2)
    await route.fulfill({ response, body: body.replace(signature, signature + ' if (globalThis.__decorFailOnce) { globalThis.__decorFailOnce = false; throw new Error("INJECTED_SAVE"); }') })
  })
  await load(page); await credits(page); await mount(page)
  await expect(page.getByText("계정에 저장된 꾸미기가 없어요.")).toBeVisible()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "글 스티커 도구" }).click()
  await page.getByRole("textbox").fill("RETRY_PRIVATE")
  await page.evaluate(() => Object.assign(window, { __decorFailOnce: true }))
  await page.getByRole("button", { name: "붙이기", exact: true }).click()
  await expect(page.getByText("꾸미기 저장 중", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("textbox")).toHaveValue("RETRY_PRIVATE")
  await page.getByRole("button", { name: "붙이기", exact: true }).click()
  await expect(page.getByTestId("journal-decoration-asset-0")).toHaveText("RETRY_PRIVATE")
})
