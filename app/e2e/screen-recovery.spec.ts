import { expect, test } from "@playwright/test"

test.describe("screen asset recovery", () => {
  test.use({ serviceWorkers: "block" })

  test("a failed guide leaves navigation usable and recovers after a real reload", async ({ page }, testInfo) => {
    await page.route("**/assets/Guide-*.js", route => route.abort())
    await page.goto("/?app=1")
    await page.getByRole("button", { name: "일지 예시 보기", exact: true }).click()
    await expect(page.getByRole("heading", { name: "화면 파일을 불러오지 못했어요" })).toBeVisible()
    const nav = page.getByRole("navigation", { name: "주 탭" })
    await expect(nav).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("guide-failure-tabs-retained.png") })
    await nav.getByRole("button", { name: "계획", exact: true }).click()
    await expect(page.getByTestId("error-boundary")).toHaveCount(0)
    await nav.getByRole("button", { name: "홈", exact: true }).click()
    await page.getByRole("button", { name: "일지 예시 보기", exact: true }).click()
    await expect(page.getByTestId("error-boundary")).toBeVisible()
    await page.unroute("**/assets/Guide-*.js")
    await page.getByTestId("error-retry").click()
    await expect(page.getByTestId("error-boundary")).toHaveCount(0)
    await page.getByRole("button", { name: "일지 예시 보기", exact: true }).click()
    await expect(page.getByTestId("error-boundary")).toHaveCount(0)
    await expect(page.getByText(/민지/u).first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("guide-recovered.png") })
  })

  test("failed plan reload returns to plan and leaves stored bytes unchanged", async ({ page }) => {
    await page.route("**/assets/PlanBeta-*.js", route => route.abort())
    await page.goto("/?app=1")
    await page.evaluate(() => localStorage.setItem("screen-recovery-test-sentinel", "unchanged"))
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
    await expect(page.getByTestId("error-boundary")).toBeVisible()
    await page.unroute("**/assets/PlanBeta-*.js")
    await page.getByTestId("error-retry").click()
    await expect(page.getByRole("heading", { name: "내 계획 받기" })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("screen-recovery-test-sentinel"))).toBe("unchanged")
  })

  test("failed recovery probe stays put instead of looping reloads", async ({ page }) => {
    await page.route("**/assets/PlanBeta-*.js", route => route.abort())
    await page.goto("/?app=1")
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
    await expect(page.getByTestId("error-boundary")).toBeVisible()
    await page.route("**/*screen-recovery-check=1*", route => route.abort())
    let reloads = 0
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) reloads += 1 })
    await page.getByTestId("error-retry").click()
    await expect(page.getByRole("status")).toContainText("화면 파일을 받을 수 없어요")
    expect(reloads).toBe(0)
    await expect(page.getByTestId("error-retry")).toBeEnabled()
  })
})

test("PWA keeps an offline shell but recovery checks do not pretend the server is online", async ({ page, context }) => {
  await page.goto("/?app=1&pwa-test=1")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.reload()
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const names = await caches.keys()
    const name = names.find(value => value.startsWith("trainoracle-v6:"))
    if (!name) return false
    return (await (await caches.open(name)).keys()).some(request => request.url.includes("/assets/"))
  })).toBe(true)
  await context.setOffline(true)
  expect(await page.evaluate(async () => {
    try { await fetch("/?screen-recovery-check=1", { cache: "no-store" }); return true }
    catch { return false }
  })).toBe(false)
  await page.reload()
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await context.setOffline(false)
})
