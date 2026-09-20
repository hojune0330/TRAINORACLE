import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" } })

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? route.continue() : route.abort()
  })
})

test("groups a busy day into one destination and keeps the populated home short", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.addInitScript(() => {
    const post = (id: string, date: string) => ({
      id, kind: "post-session", date, savedAt: `${date}T09:00:00.000Z`,
      syncState: "local", system: "base", title: "합성 테스트 기록", distanceKm: "5",
      durationMin: "30", avgPace: "6:00", rpe: 4, memo: "", memoPurpose: "PRIVATE_SELF_ONLY",
    })
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      post("morning", "2026-07-14"), post("afternoon", "2026-07-14"),
      { id: "evening", kind: "evening", date: "2026-07-14", savedAt: "2026-07-14T21:00:00.000Z",
        syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {}, mood: 0, note: "" },
      ...Array.from({ length: 12 }, (_, index) => post(`previous-${index}`, `2026-07-${String(index + 1).padStart(2, "0")}`)),
    ]))
  })
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => document.fonts.ready)
  const day = page.getByRole("button", { name: "2026년 7월 14일 기록 3개 보기 · 훈련 2 · 하루 마무리 1" })
  await expect(day).toBeVisible()
  await expect(page.getByRole("region", { name: "최근 하루 기록" })).toHaveCount(1)
  await expect(page.getByRole("region", { name: "기록 습관" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "오늘 기록하기", exact: true })).toBeInViewport({ ratio: 1 })
  const geometry = await page.locator(".app-scroll-region").evaluate(el => ({ height: el.scrollHeight, viewport: el.clientHeight, overflow: el.scrollWidth > el.clientWidth }))
  console.log("HOME_HUB_POPULATED", JSON.stringify(geometry))
  expect(geometry.height).toBeLessThanOrEqual(1100)
  expect(geometry.overflow).toBe(false)
  for (const button of await page.locator(".home-hub button").all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({ path: testInfo.outputPath("home-populated-393x852.png"), animations: "disabled" })
  await day.click()
  await expect(page.locator(".journal-day-reader")).toBeVisible()
  await expect(page.getByRole("button", { name: /훈련.*펼쳐보기/u })).toHaveCount(2)
  await page.getByRole("button", { name: "홈으로 돌아가기", exact: true }).click()
  await expect(day).toBeVisible()
})

test("keeps optional destinations discoverable and returns to home without clipping enlarged text", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole("button", { name: "오늘 기록 남기기", exact: true })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole("button", { name: "훈련 계획 만들기", exact: true })).toBeInViewport({ ratio: 1 })
  console.log("HOME_HUB_EMPTY", await page.locator(".app-scroll-region").evaluate(el => JSON.stringify({ height: el.scrollHeight, viewport: el.clientHeight })))
  await page.screenshot({ path: testInfo.outputPath("home-welcome-375x667.png"), animations: "disabled" })
  await page.getByRole("button", { name: "훈련 배우기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  await page.getByRole("button", { name: "이전 화면", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동을 기록해요" })).toBeVisible()
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "일지 꾸미기·포인트" })).toBeVisible()
  await expect(page.getByRole("region", { name: "기록 습관" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로가기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동을 기록해요" })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".home-hub, .home-hub *")].filter(el => !(el instanceof SVGElement))
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    nodes.forEach((el, index) => el.style.setProperty("font-size", `${sizes[index]! * 2}px`, "important"))
  })
  expect(await page.locator(".app-scroll-region").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const button of await page.locator(".home-hub button").all()) {
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath("home-320-double-text.png"), animations: "disabled" })
})
