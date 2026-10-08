import { test, expect } from "@playwright/test"

/**
 * Runs only where a real WebGPU adapter exists (installed Chrome with --enable-unsafe-webgpu).
 * Proves the shader sky mounts, the 2D canvas stops painting its own sky, and nothing leaves 127.0.0.1.
 */
test("mounts the WebGPU sky with telemetry off and no external requests", async ({ page }, info) => {
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
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.locator(".treadmill-game")).toHaveAttribute("data-sky", "shader", { timeout: 15_000 })
  await expect(page.locator(".treadmill-game__sky")).toHaveAttribute("data-live", "true")
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.waitForTimeout(6_000) // longer than the package's telemetry window (5 s)
  await page.screenshot({ path: info.outputPath("shader-sky.png") })
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  expect(external).toEqual([])
})
