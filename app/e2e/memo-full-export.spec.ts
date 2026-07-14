import { expect, test } from "@playwright/test"

test("makes a memo-inclusive backup only after confirmation and without a network request", async ({ page }) => {
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 10)
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "memo-full-export",
      kind: "post-session",
      date,
      savedAt: `${date}T00:00:00.000Z`,
      syncState: "local",
      system: "lt",
      title: "tempo",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 6,
      memo: "OWNER_EXPORT_ONLY_SECRET",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }]))
  })
  await page.goto("/?app=1")
  const networkRequests: string[] = []
  page.on("request", (request) => networkRequests.push(request.url()))

  await page.getByRole("button", { name: /메모 포함 파일 내보내기/u }).click()
  await expect(page.getByRole("dialog", { name: "메모까지 포함할까요?" })).toBeVisible()
  await page.getByRole("button", { name: "취소" }).click()
  await expect(page.getByRole("dialog", { name: "메모까지 포함할까요?" })).toHaveCount(0)

  await page.getByRole("button", { name: /메모 포함 파일 내보내기/u }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "파일 만들기" }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toContain("full-backup")
  expect(networkRequests).toEqual([])
})
