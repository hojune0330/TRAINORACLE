import { expect, test } from "@playwright/test"

const entries = [
  {
    id: "archive-post-1",
    kind: "post-session",
    date: "2026-06-18",
    savedAt: "2026-06-18T09:00:00.000Z",
    syncState: "local",
    system: "VO2",
    title: "400m 인터벌",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "4:10",
    rpe: 8,
    memo: "ARCHIVE_PRIVATE_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
  {
    id: "archive-evening-1",
    kind: "evening",
    date: "2026-06-18",
    savedAt: "2026-06-18T20:00:00.000Z",
    syncState: "local",
    sleepH: 7,
    sleepQuality: 4,
    weightKg: "",
    restingHr: "",
    painParts: { calf: 2 },
    mood: 4,
    note: "ARCHIVE_PRIVATE_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
]

test("keeps the browsed month after a calendar day is opened and closed", async ({ page }, testInfo) => {
  await page.addInitScript((savedEntries) => {
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify(savedEntries))
  }, entries)
  await page.goto("/?app=1")

  const archive = page.getByRole("region", { name: "일지 아카이브" })
  await expect(archive).toBeVisible()
  await expect(archive).not.toContainText("ARCHIVE_PRIVATE_TEXT")
  await expect(archive.getByRole("button", { name: /ARCHIVE_PRIVATE_TEXT/u })).toHaveCount(0)
  await archive.getByRole("button", { name: "이전 달" }).click()
  await expect(archive.getByRole("heading", { name: /2026년 6월 일지/u })).toBeVisible()

  await archive.getByRole("button", { name: /6월 18일/u }).click()
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()

  await expect(archive.getByRole("heading", { name: /2026년 6월 일지/u })).toBeVisible()
  await archive.getByRole("button", { name: "주간 보기" }).click()
  await archive.getByRole("button", { name: "다음 주" }).click()
  await archive.getByRole("button", { name: "다음 주" }).click()
  await expect(archive.getByRole("heading", { name: "6월 15일 - 6월 21일" })).toBeVisible()
  await expect(archive.getByText("1일 · 2건 · 40분 · 8km")).toBeVisible()
  await expect(archive.getByText("통증 2/5")).toBeVisible()
  await archive.getByRole("button", { name: /6월 18일/u }).click()
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(archive.getByRole("heading", { name: "6월 15일 - 6월 21일" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("journal-archive.png"), fullPage: true })
})
