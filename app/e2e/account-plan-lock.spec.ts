import { test, expect, type Page } from "@playwright/test"
import type {} from "./fixtures/account-plan-lock"

async function open(page: Page, hold = false) {
  await page.goto("/__account_lock_test__")
  await page.evaluate(async hold => {
    const path = "/e2e/fixtures/account-plan-lock.ts"
    ;(await import(/* @vite-ignore */ path)).setup(hold)
  }, hold)
}
test.beforeEach(async ({ context }) => {
  await context.route("**/__account_lock_test__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Lock test</title>" }))
})
test("two actual tabs serialize the entire account operation with native Web Locks", async ({ page, context }) => {
  const other = await context.newPage()
  await open(page, true); await open(other)
  await page.evaluate(() => { void window.accountLockHarness.service.hydrate() })
  await expect.poll(() => page.evaluate(() => window.accountLockHarness.calls())).toBe(1)
  await other.evaluate(() => { void window.accountLockHarness.service.hydrate() })
  await expect.poll(() => other.evaluate(async () => (await navigator.locks.query()).pending?.filter(lock => lock.name?.startsWith("trainoracle-account-plan-collection:")).length)).toBe(1)
  expect(await other.evaluate(() => window.accountLockHarness.calls())).toBe(0)
  await page.evaluate(() => window.accountLockHarness.release())
  await expect.poll(() => other.evaluate(() => window.accountLockHarness.service.snapshot().status)).toBe("EMPTY")
  expect(await other.evaluate(() => window.accountLockHarness.calls())).toBe(1)
  await page.evaluate(() => window.accountLockHarness.service.close())
  await other.evaluate(() => window.accountLockHarness.service.close())
})
for (const mode of ["missing", "rejected"] as const) test(`native browser lock ${mode} does not touch account data`, async ({ page }) => {
  await open(page)
  const result = await page.evaluate(async mode => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: mode === "missing" ? undefined
      : { request: async () => { throw Error("Synthetic lock refusal") } } })
    const before = await indexedDB.databases()
    const ok = await window.accountLockHarness.service.hydrate()
    const view = window.accountLockHarness.service.snapshot()
    window.accountLockHarness.service.close()
    return { ok, status: view.status, supported: view.browserSupported, calls: window.accountLockHarness.calls(),
      unchanged: JSON.stringify(await indexedDB.databases()) === JSON.stringify(before) }
  }, mode)
  expect(result).toEqual({ ok: false, status: "FAILED", supported: false, calls: 0, unchanged: true })
})
