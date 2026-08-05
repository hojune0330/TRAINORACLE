import { expect, test } from "@playwright/test"

test("uses the diary context, decoration, cycle archive, and easy FAQ as one flow", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const entries = Array.from({ length: 8 }, (_, index) => {
      const day = new Date()
      day.setDate(day.getDate() - index)
      const date = [
        day.getFullYear(),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0"),
      ].join("-")
      return {
        id: `beta-diary-${index}`,
        kind: "post-session",
        date,
        savedAt: `${date}T09:00:00.000Z`,
        syncState: "local",
        system: "base",
        title: `beta diary ${index}`,
        distanceKm: "5",
        durationMin: "30",
        avgPace: "6:00",
        rpe: 4,
        memo: "",
        fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" },
          durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" },
        },
      }
    })
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify(entries))
  })

  await page.goto("/?app=1&uitest=1")

  await page.getByRole("button", { name: "기분 좋음" }).click()
  await page.getByRole("button", { name: "몸 상태 가벼움" }).click()
  await page.getByRole("button", { name: "날씨 흐림" }).click()
  await expect(page.getByRole("button", { name: "기분 좋음" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText("위치정보를 사용하지 않아요.")).toBeVisible()

  // WORK_ORDER_UX2 §2-2: 꾸미기 상점 진입점은 홈에서 제거됐다(포인트 구조 PHILOSOPHY §9-9 위반).
  // 상점 리디자인은 후속 작업으로 분리 — 여기선 홈에 진입 버튼이 없음을 확인만 한다.
  await expect(page.getByRole("button", { name: /꾸미기 열기/u })).toHaveCount(0)

  await page.getByRole("button", { name: "전체 보기" }).click()
  await page.getByRole("button", { name: "9.5일 주기" }).click()
  await expect(page.getByRole("heading", { name: "9.5일 주기 일지" })).toBeVisible()
  await expect(page.getByText(/계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
  await page.getByRole("button", { name: "이전 주기" }).click()
  await expect(page.getByText(/· 9일 구간$/u)).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈" }).click()
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "쉬운 도움말과 FAQ" }).click()
  await expect(page.getByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
  await page.getByText("나중에 월 구독이나 광고가 생길 수 있나요?").click()
  await expect(page.getByText(/TrainOracle 베타는 현재 무료입니다/u)).toBeVisible()

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 393, height: 852 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "주 탭" }).getByRole("button")).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  expect(consoleErrors).toEqual([])
})
