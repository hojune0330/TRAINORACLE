import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import { mockPlanCollectionServer } from "./fixtures/account-plan-collection-server"
import { writeFile } from "node:fs/promises"
import type {} from "./fixtures/account-plan-ui"

const origin = "http://127.0.0.1:4383"
const owner = "11111111-1111-4111-8111-111111111111"
const otherOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const fixture = "/e2e/fixtures/account-plan-service-mobile.ts"

async function install(context: BrowserContext) {
  await context.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === "/__account_record_test__") return route.fulfill({ contentType: "text/html",
      body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Synthetic mobile history</title><body></body></html>' })
    if (url.pathname === "/src/domain/account/account-journal-api.ts") {
      const response = await route.fetch(), body = await response.text()
      const flag = 'return env.VITE_FEATURE_ACCOUNT_JOURNAL === "true" && env.VITE_KILL_ACCOUNT_JOURNAL !== "true";'
      if (body.split(flag).length !== 2) throw Error("Feature flag route no longer matches")
      return route.fulfill({ response, body: body.replace(flag, "return true;") })
    }
    if (url.pathname === "/src/domain/account/supabase-client.ts") return route.fulfill({ contentType: "application/javascript", body: `
      import { activeLocalAccount } from '/src/domain/account/local-journal-ownership.ts';
      export async function supabase() { return {
        auth: { getSession: async () => ({ data: { session: { user: { id: activeLocalAccount() }, access_token: 'synthetic-token' } }, error: null }) },
        functions: { invoke: async (name, options) => {
          const response = await fetch(name === 'account-plan-collection' ? '/__collection_api__' : '/__record_api__', {
            method: 'POST', signal: options.signal, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerId: activeLocalAccount(), request: options.body }) });
          return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } };
        } }
      }; }
      export function __resetSupabaseForTest() {}
    ` })
    if (url.pathname === "/__record_api__") {
      const { request } = route.request().postDataJSON()
      return route.fulfill({ status: request.action === "list" ? 200 : 404, contentType: "application/json",
        body: JSON.stringify(request.action === "list" ? { kind: "list", documents: [], deletedDocuments: [], nextCursor: null } : { code: "NOT_FOUND" }) })
    }
    return route.continue()
  })
}

async function prepare(page: Page, context: BrowserContext, count: number, hasCurrent = true) {
  await install(context)
  const server = await mockPlanCollectionServer(); await server.install(context)
  await page.goto("/__account_record_test__")
  const parts = await page.evaluate(async ({ fixture, count, hasCurrent }) =>
    (await import(/* @vite-ignore */ fixture)).seed(count, hasCurrent), { fixture, count, hasCurrent })
  server.indexes.set(owner, { revision: 1, index: parts.index })
  for (const part of [...parts.snapshots, ...parts.progress]) server.parts.set(`${owner}:${part.id}`, part)
  await page.evaluate(async () => {
    const refreshPath = "/@react-refresh", uiPath = "/e2e/fixtures/account-plan-ui.tsx"
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type,
      __vite_plugin_react_preamble_installed__: true })
    await (await import(/* @vite-ignore */ uiPath)).mount()
  })
  await expect(page.getByText(`계정에 보관한 계획 ${count}개`, { exact: false })).toBeVisible()
  if (hasCurrent) {
    await expect.poll(() => server.calls.filter(call => call.request.action === "readPart").length).toBe(4)
    await expect.poll(() => page.evaluate(() => window.accountPlanUi.service.snapshot().status)).toBe("READY")
  }
  return { server, parts }
}

async function doubleText(page: Page) {
  await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    const tokens = Array.from(style).filter(name => name.startsWith("--fs-"))
      .map(name => [name, style.getPropertyValue(name).trim()] as const)
    for (const [name, value] of tokens) if (/^[\d.]+px$/u.test(value))
      document.documentElement.style.setProperty(name, `${parseFloat(value) * 2}px`)
  })
}

async function checkHistoryFit(page: Page) {
  const dimensions = await page.locator(".account-plan-history").evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: innerWidth, right: rect.right, scroll: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll("main *")].filter(node => node.getBoundingClientRect().right > innerWidth + 1)
        .map(node => ({ tag: node.tagName, className: node.className, right: node.getBoundingClientRect().right })),
      font: parseFloat(getComputedStyle(element).fontSize),
      targets: [...element.querySelectorAll("summary, button")].filter(node => node.getBoundingClientRect().height > 0)
        .map(node => ({ height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width,
          overflow: node.scrollWidth - node.clientWidth })) }
  })
  expect(dimensions.font).toBe(29)
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.scroll, JSON.stringify(dimensions.overflowing)).toBeLessThanOrEqual(dimensions.width)
  for (const target of dimensions.targets) {
    expect(target.height).toBeGreaterThanOrEqual(44)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.overflow).toBeLessThanOrEqual(1)
  }
  return dimensions
}

for (const width of [320, 375]) test(`mobile ${width} 200% text: 100-plan loading, HTTP failure, retry and bounded originals`, async ({ page, context }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width, height: 667 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  const { server, parts } = await prepare(page, context, 100)
  const current = await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)
  await expect.poll(() => server.calls.filter(call => call.request.action === "readPart").length).toBe(4)
  await doubleText(page)
  let release!: () => void, held = false
  const barrier = new Promise<void>(resolve => { release = resolve })
  await page.route("**/__collection_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (!held && request.action === "readPart" && request.partId === parts.snapshots[1]!.id) {
      held = true; await barrier
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"UNAVAILABLE"}' })
    }
    return route.fallback()
  })
  const history = page.locator(".account-plan-history")
  await history.locator(":scope > summary").click()
  await expect(history.getByRole("status")).toContainText("과거 계획 불러오는 중")
  await expect.poll(() => held).toBe(true)
  await history.evaluate(element => element.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: info.outputPath(`loading-${width}-200.png`) })
  release()
  await expect(history.getByRole("alert")).toContainText("연결 상태를 확인하고 다시 시도")
  expect(await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toEqual(current)
  expect(await history.locator('section[aria-label="계정 계획 원본"]').count()).toBe(0)
  const errorFit = await checkHistoryFit(page)
  await history.evaluate(element => element.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: info.outputPath(`failure-${width}-200.png`) })
  await page.evaluate(async fixture => (await import(/* @vite-ignore */ fixture)).startProbe(), fixture)
  await history.getByRole("button", { name: "과거 계획 다시 불러오기" }).click()
  await expect(history.locator(":scope > details")).toHaveCount(10, { timeout: 90_000 })
  const timing = await page.evaluate(async fixture => (await import(/* @vite-ignore */ fixture)).stopProbe(), fixture)
  expect(timing.frames).toBeGreaterThan(0)
  expect(await history.locator('section[aria-label="계정 계획 원본"]').count()).toBe(0)
  await history.locator(":scope > details > summary").first().focus()
  await page.keyboard.press("Enter")
  await expect(history.locator('section[aria-label="계정 계획 원본"]')).toHaveCount(1)
  await history.evaluate(element => element.scrollIntoView({ block: "start" }))
  await page.screenshot({ path: info.outputPath(`original-${width}-200.png`) })
  const loadedFit = await checkHistoryFit(page)
  await history.locator(":scope > details > summary").nth(1).click()
  await expect(history.locator('section[aria-label="계정 계획 원본"]')).toHaveCount(1)
  for (let count = 20; count <= 100; count += 10) {
    await history.getByRole("button", { name: /보관한 계획 더 보기/u }).click()
    await expect(history.locator(":scope > details")).toHaveCount(Math.min(count, 99))
  }
  await expect(history.getByRole("button", { name: /보관한 계획 더 보기/u })).toHaveCount(0)
  await history.locator(":scope > summary").click()
  await expect(history.locator('section[aria-label="계정 계획 원본"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toEqual(current)
  expect(errors).toEqual([])
  const evidence = JSON.stringify({ width, count: 100,
    packet: "synthetic V3 stateFixture, one session per plan", timing, errorFit, loadedFit, errors }, null, 2)
  await writeFile(info.outputPath("runtime-evidence.json"), evidence)
  await info.attach("runtime-evidence", { contentType: "application/json", body: evidence })
})

for (const failResponse of [true, false]) test(`mobile delayed history response failure=${failResponse} after owner switch cannot show old originals or failure`, async ({ page, context }, info) => {
  await page.setViewportSize({ width: 320, height: 667 })
  const { parts } = await prepare(page, context, 18)
  let release!: () => void, held = false
  const barrier = new Promise<void>(resolve => { release = resolve })
  await page.route("**/__collection_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (request.action === "readPart" && request.partId === parts.snapshots[1]!.id) {
      held = true; await barrier
      if (failResponse) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"UNAVAILABLE"}' })
    }
    return route.fallback()
  })
  await page.locator(".account-plan-history > summary").click()
  await expect.poll(() => held).toBe(true)
  const oldWork = page.evaluate(() => {
    const service = window.accountPlanUi.service
    return "loadHistory" in service && service.loadHistory()
  })
  await page.evaluate(async ({ fixture, otherOwner }) => {
    (await import(/* @vite-ignore */ fixture)).setActiveLocalAccount(otherOwner)
    window.accountPlanUi.plan()
  }, { fixture, otherOwner })
  release()
  expect(await oldWork).toBe(false)
  await expect(page.getByText("저장된 계획 없음", { exact: true })).toBeVisible()
  await expect(page.locator(".account-plan-history")).toHaveCount(0)
  await expect(page.getByRole("region", { name: "계정 계획 원본" })).toHaveCount(0)
  await expect(page.getByText(/과거 계획을 불러오지 못했어요/u)).toHaveCount(0)
  await page.screenshot({ path: info.outputPath("owner-switch-320.png") })
})

for (const hasCurrent of [true, false]) test(`mobile cancel history with current=${hasCurrent}: delayed completion stays cancelled until explicit retry`, async ({ page, context }, info) => {
  await page.setViewportSize({ width: 320, height: 667 })
  let release!: () => void, held = false, delayedReleased = false, enabled = !hasCurrent
  const barrier = new Promise<void>(resolve => { release = resolve })
  await page.route("**/__collection_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (enabled && !held && request.action === "readPart") {
      held = true; await barrier
      await route.fallback(); delayedReleased = true
      return
    }
    return route.fallback()
  })
  const { server } = await prepare(page, context, 18, hasCurrent)
  enabled = true
  const current = await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)
  if (hasCurrent) await page.locator(".account-plan-history > summary").click()
  await expect.poll(() => held).toBe(true)
  const oldWork = page.evaluate(() => {
    const service = window.accountPlanUi.service
    return "loadHistory" in service && service.loadHistory()
  })
  await page.getByRole("button", { name: "불러오기 취소" }).click()
  await expect(page.getByText("과거 계획 확인 대기", { exact: true })).toBeVisible()
  await doubleText(page)
  await page.screenshot({ path: info.outputPath(`cancelled-current-${hasCurrent}-320-200.png`) })
  expect(await oldWork).toBe(false)
  expect(await page.evaluate(() => {
    const service = window.accountPlanUi.service
    if (!("loadHistory" in service)) throw Error("Expected collection service")
    const view = service.snapshot()
    return { status: view.historyStatus, loaded: view.historyLoaded, progress: view.historyProgress }
  })).toEqual({ status: "IDLE", loaded: false, progress: { loaded: 0, total: 18 } })
  expect(await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toEqual(current)
  await expect(page.getByRole("button", { name: "과거 계획 불러오기", exact: true })).toBeVisible()
  if (!hasCurrent) await expect(page.getByRole("button", { name: "개인 계획 파일 불러오기", exact: true })).toHaveCount(0)
  const callsAfterCancel = server.calls.length
  await page.getByRole("button", { name: "과거 계획 불러오기", exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const view = window.accountPlanUi.service.snapshot()
    return "historyLoaded" in view && view.historyLoaded
  })).toBe(true)
  expect(delayedReleased).toBe(false)
  expect(server.calls.length).toBeGreaterThan(callsAfterCancel)
  release()
  await expect.poll(() => delayedReleased).toBe(true)
  expect(await page.evaluate(() => window.accountPlanUi.service.snapshot().currentPlan)).toEqual(current)
})
