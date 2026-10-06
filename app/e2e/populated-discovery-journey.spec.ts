import { expect, test } from "@playwright/test"

for (const width of [320, 375]) {
  test(`populated calendar keeps records discoverable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    await page.clock.setFixedTime(new Date("2026-10-06T03:00:00Z"))
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
    await page.addInitScript(() => {
      const entries = Array.from({ length: 40 }, (_, index) => {
        const day = new Date("2026-10-05T09:00:00Z")
        day.setUTCDate(day.getUTCDate() - index)
        const date = day.toISOString().slice(0, 10)
        return { id: `synthetic-${index}`, kind: "post-session", date, savedAt: day.toISOString(), syncState: "local",
          system: "base", title: `모의 훈련 ${index + 1}`, distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
          memo: "", fieldProvenance: Object.fromEntries(["distanceKm", "durationMin", "avgPace", "rpe"].map(key => [key, { provenance: "MISSING" }])) }
      })
      localStorage.setItem("trainoracle.journal.v1", JSON.stringify(entries))
    })
    await page.goto("/?app=1&uitest=1")
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
    const archive = page.getByTestId("journal-archive")
    await expect(archive.getByRole("grid", { name: "2026년 10월 달력" })).toBeVisible()
    await expect(archive.getByRole("button", { name: "최근 일지 · 10/05", exact: true })).toBeVisible()
    await archive.getByRole("button", { name: /2026년 10월 5일/ }).click()
    await expect(page.getByRole("dialog")).toContainText("2026년 10월 5일 월요일")
    await expect(page.getByRole("dialog")).toContainText("기록 1")
    await page.getByRole("button", { name: "일지·메모 원문 열기", exact: true }).click()
    await expect(page.getByText("모의 훈련 1", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "일지 목록으로 돌아가기", exact: true }).click()
    await expect(archive.getByRole("grid", { name: "2026년 10월 달력" })).toBeVisible()
    await archive.locator("summary").filter({ hasText: "월별 기록 모아보기" }).click()
    await expect(archive.getByText("다른 달의 일지 찾기", { exact: true })).toBeVisible()
    await archive.getByRole("button", { name: "2026년 9월 훈련 후 30건", exact: true }).click()
    await expect(archive.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
    await archive.getByRole("button", { name: "최근 일지 · 10/05", exact: true }).click()
    await expect(archive.getByRole("grid", { name: "2026년 10월 달력" })).toBeVisible()
    await expect(archive.getByRole("heading", { name: "2026년 10월", exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath("populated-calendar.png"), fullPage: true })
    // Reduced height checks layout under occlusion; this is not an actual phone keyboard test.
    await page.setViewportSize({ width, height: 430 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.evaluate(() => {
      const sized = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(node => node.getClientRects().length > 0)
        .map(node => ({ node, size: parseFloat(getComputedStyle(node).fontSize) }))
      for (const { node, size } of sized) node.style.setProperty("font-size", `${size * 2}px`, "important")
    })
    await page.screenshot({ path: info.outputPath("populated-double-text-short-height.png"), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(errors).toEqual([])
  })
}
