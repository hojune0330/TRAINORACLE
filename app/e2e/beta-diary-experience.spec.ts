import { expect, test } from "@playwright/test"

for (const hasEarnedHistory of [false, true]) {
test(`uses the diary flow with ${hasEarnedHistory ? "previously earned" : "no backfilled"} points`, async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript((earnedHistory) => {
    const entries = Array.from({ length: 8 }, (_, index) => {
      const day = new Date()
      day.setDate(day.getDate() - (index + 1))
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
    if (earnedHistory) {
      window.localStorage.setItem("trainoracle.engagement.v2", JSON.stringify({
        version: 2,
        visitDates: [],
        journalDates: entries.map((entry) => entry.date),
        pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
      }))
    }
  }, hasEarnedHistory)

  await page.goto("/?app=1&uitest=1")

  // The redesigned home keeps condition inputs in the memo's optional guide.
  await page.getByText("컨디션 추가", { exact: true }).click()
  await page.getByRole("button", { name: "기분", exact: true }).click()
  const goodMood = page.getByRole("button", { name: "기분 4 좋음", exact: true })
  await goodMood.click()
  await expect(goodMood).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "기분 입력 안 함", exact: true }).click()
  await expect(goodMood).toHaveAttribute("aria-pressed", "false")
  await page.getByRole("button", { name: "다른 항목", exact: true }).click()

  // Historical entries stay visible; only a stored award history supplies past points.
  const balance = `베타 포인트 · 사용 가능 ${hasEarnedHistory ? 32 : 0}P`
  await page.getByRole("button", { name: "일지 꾸미기" }).click()
  const editor = page.getByRole("dialog", { name: "일지 꾸미기", exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole("button", { name: "일지", exact: true })).toHaveAttribute("aria-pressed", "true")
  await editor.getByRole("button", { name: "꾸미기 재료 도구" }).click()
  await expect(editor.getByText(balance, { exact: true })).toBeVisible()
  await editor.getByRole("button", { name: "꾸미기 완료" }).click()
  await expect(page.getByRole("heading", { name: "훈련과 기록", exact: true })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
  await page.getByRole("radio", { name: "기록 묶음" }).click()
  await expect(page.getByRole("heading", { name: "기록 묶음" })).toBeVisible()
  await page.getByText("주기 시작일과 표시 기준", { exact: true }).click()
  await expect(page.getByText(/계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
  const cycleRange = page.getByText(/· (?:9|10)일 구간$/u)
  const previousRange = await cycleRange.textContent()
  await page.getByRole("button", { name: "이전 주기" }).click()
  await expect(cycleRange).not.toHaveText(previousRange ?? "")

  await page.getByRole("navigation", { name: "일지 메뉴" }).getByRole("button", { name: "일지 나가기" }).click()
  await expect(page.getByRole("heading", { name: "훈련과 기록", exact: true })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈" }).click()
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "배우기", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "훈련 용어집·도움말" }).click()
  await page.getByRole("button", { name: "앱 이용 안내", exact: true }).click()
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
}
