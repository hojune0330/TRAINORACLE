import { expect, test } from "@playwright/test"

test("writes direct and skipped post-session provenance without a test query", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByRole("button", { name: /자세히 기록.*운동별로 자세히/u }).click()
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "거리와 시간 수정", exact: true }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: "운동 강도 수정", exact: true }).click()
  await page.getByRole("button", { name: "6", exact: true }).click()
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("to-local-journal.journal.v2"))).not.toBeNull()
  const entry = await page.evaluate(() => {
    const raw = window.localStorage.getItem("to-local-journal.journal.v2")
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
  await expect(day).toBeVisible()
  await expect(day).not.toContainText("8 km")
  await day.click()
  await expect(page.getByText("legacy tempo", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "홈으로 돌아가기", exact: true }).click()
  await expect(page.getByRole("button", { name: "훈련량·변화 보기", exact: true })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클" }).click()
  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  const detailMenu = page.getByRole("group", { name: "훈련 분석 자세히 보기" })
  await detailMenu.getByRole("button", { name: "훈련량", exact: true }).click()
  await expect(distance.getByText("최근 합계는 없어요. 아래 기간을 넓혀 지난 기록을 확인할 수 있어요.", { exact: true })).toBeVisible()
  await expect(distance.getByText(/집계 기준에 맞지 않아 제외한 기록 1건/u).first()).toBeVisible()
})
