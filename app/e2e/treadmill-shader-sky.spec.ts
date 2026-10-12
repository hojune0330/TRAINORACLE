import { test, expect } from "@playwright/test"

/**
 * Runs only where a real WebGPU adapter exists (installed Chrome with --enable-unsafe-webgpu).
 * Proves the shader sky mounts behind a 2.5D city, "low effects" turns it off, and nothing leaves 127.0.0.1.
 */
test("mounts the WebGPU sky with telemetry off, respects low effects, and makes no external requests", async ({ page }, info) => {
  const external: string[] = []
  page.on("request", request => {
    const url = new URL(request.url())
    if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") external.push(request.url())
  })
  await page.goto("/?app=1")
  const adapter = await page.evaluate(async () => {
    const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return Boolean(gpu && await gpu.requestAdapter())
  })
  test.skip(!adapter, "No WebGPU adapter in this browser")
  // Seed a device save with season 1 cleared up to Daegu so Busan is open.
  await page.evaluate(() => localStorage.setItem("trainoracle.minigame.progress.v1", JSON.stringify({
    version: "MINIGAME_PROGRESS_V1", character: "r01", settingsUpdatedAt: "2026-10-08T00:00:00.000Z",
    cities: { seoul: { stars: 3, bestScore: 2000, clears: 1 }, daejeon: { stars: 2, bestScore: 1500, clears: 1 }, daegu: { stars: 1, bestScore: 900, clears: 1 } },
    settings: { sound: false, vibration: false, effects: "high", view: "auto", motion: "system", controls: "normal", runSide: "left", jumpGuide: true },
  })))
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-sky", "canvas")
  await page.getByRole("button", { name: /^부산/ }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-sky", "shader", { timeout: 15_000 })
  await expect(page.locator(".treadmill-game__sky")).toHaveAttribute("data-live", "true")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.waitForTimeout(6_000) // longer than the package's telemetry window (5 s)
  await page.screenshot({ path: info.outputPath("busan-shader.png") })
  await page.getByRole("button", { name: /게임 메뉴/ }).click()
  await page.getByRole("dialog", { name: "게임 메뉴" }).getByText("낮음", { exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-sky", "canvas")
  await page.getByRole("button", { name: "투어 지도로" }).click()
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  expect(external).toEqual([])
})
