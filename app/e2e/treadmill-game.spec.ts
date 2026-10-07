import { test, expect, type Page } from "@playwright/test"

async function openGame(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.hostname === "127.0.0.1" || url.protocol === "data:" ? route.continue() : route.abort()
  })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.getByRole("heading", { name: "멈추면 밀려나는 트랙" })).toBeVisible()
  await page.clock.install()
  // Keep simulated time fixed between input calls, including slow mobile screenshots.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100)
}

test("inaction falls; restart, pointer recovery, pause and exit remain usable", async ({ page }) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.clock.runFor(7500)
  await expect(page.getByRole("status").filter({ hasText: "뒤쪽 끝에서 떨어졌어요" })).toBeVisible()
  await page.getByRole("button", { name: "다시 시작", exact: true }).click()
  const run = page.getByRole("button", { name: "달리기 꾹" })
  await run.hover(); await page.mouse.down(); await page.clock.runFor(1500)
  const before = Number((await page.getByLabel("게임 에너지", { exact: true }).textContent())!.replace(/\D/g, ""))
  await page.mouse.up(); await page.clock.runFor(500)
  const after = Number((await page.getByLabel("게임 에너지", { exact: true }).textContent())!.replace(/\D/g, ""))
  expect(after).toBeGreaterThan(before)
  await page.getByRole("button", { name: "일시정지", exact: true }).click()
  const frozen = await page.getByLabel("경기 진행 시간").textContent()
  await page.clock.runFor(2000)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(frozen!)
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  await page.clock.runFor(10000)
  await page.getByRole("button", { name: "미니게임", exact: true }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 80")
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible()
})

test("clears three stages with live controls and resets the build", async ({ page }, info) => {
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  for (let stage = 0; stage < 2; stage++) {
    await page.keyboard.down("ArrowRight"); await page.clock.runFor(10100); await page.keyboard.up("ArrowRight")
    await expect(page.getByRole("heading", { name: "안전 발판 · 강화 하나 선택" })).toBeVisible()
    const time = await page.getByLabel("경기 진행 시간").textContent()
    await page.clock.runFor(2000)
    await expect(page.getByLabel("경기 진행 시간")).toHaveText(time!)
    if (stage === 0) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath("checkpoint.png"), fullPage: true })
    }
    await page.getByRole("button", { name: /일정한 박자/ }).click()
    await expect(page.getByRole("button", { name: "계속", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "계속", exact: true }).click()
  }
  await page.clock.runFor(1500)
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(2950)
  await page.keyboard.press("Space"); await page.clock.runFor(3170)
  await page.keyboard.press("Space"); await page.clock.runFor(2450); await page.keyboard.up("ArrowRight")
  await expect(page.getByRole("status").filter({ hasText: "세 구간 완주!" })).toBeVisible()
  await page.screenshot({ path: info.outputPath("clear.png"), fullPage: true })
  await page.getByRole("button", { name: "다시 시작", exact: true }).click()
  await expect(page.getByText("1/3 · 트랙", { exact: true })).toBeVisible()
  await expect(page.getByText(/^이번 판:/)).toHaveCount(0)
  await expect(page.getByLabel("게임 에너지", { exact: true })).toHaveText("에너지 80")
})

test("focus loss pauses and reduced motion preserves movement and controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openGame(page)
  await page.getByRole("button", { name: "시작", exact: true }).click()
  await page.keyboard.down("ArrowRight"); await page.clock.runFor(500); await page.keyboard.up("ArrowRight")
  await page.getByRole("button", { name: "대시" }).click()
  await expect(page.getByLabel("게임 에너지", { exact: true })).not.toHaveText("에너지 80")
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(page.getByRole("button", { name: "계속", exact: true })).toBeVisible()
  const frozen = await page.getByLabel("경기 진행 시간").textContent()
  await page.clock.runFor(3000)
  await expect(page.getByLabel("경기 진행 시간")).toHaveText(frozen!)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
