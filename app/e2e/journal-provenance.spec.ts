import { expect, test } from "@playwright/test"

test("writes direct and skipped post-session provenance without a test query", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByRole("button", { name: /훈련 후/u }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")
  await page.getByRole("button", { name: "6", exact: true }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1"))).not.toBeNull()
  const entry = await page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.journal.v1")
    return raw === null ? null : JSON.parse(raw)[0]
  })
  expect(entry).toMatchObject({
    kind: "post-session",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "MISSING" },
      avgPace: { provenance: "MISSING" },
      rpe: { provenance: "EXPLICIT" },
    },
  })
})

test("shows a legacy journal entry without allowing it into home totals or trends", async ({ page }) => {
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 10)
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "legacy-provenance",
      kind: "post-session",
      date,
      savedAt: `${date}T00:00:00.000Z`,
      syncState: "local",
      system: "lt",
      title: "legacy tempo",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }]))
  })
  await page.goto("/?app=1")

  const day = page.getByRole("button", { name: /기록 1개 보기 · 훈련 1/u })
  await expect(day).toContainText("기록 1개")
  await day.click()
  await expect(page.getByText("legacy tempo", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "홈으로 돌아가기", exact: true }).click()
  await expect(page.getByRole("button", { name: "훈련 분석 보기", exact: true })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  await expect(distance.getByLabel(/이번 주, 집계 가능한 거리 기록 없음/u)).toBeVisible()
  await expect(distance.getByText(/집계 기준에 맞지 않아 제외한 기록 1건/u).first()).toBeVisible()
})
