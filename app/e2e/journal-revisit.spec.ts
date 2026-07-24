import { expect, test } from "@playwright/test"

test("edits a past journal and adds another entry to the same date", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "past-session",
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "이지런",
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
        plannedRpe: { provenance: "MISSING" },
        objectiveComponents: { provenance: "MISSING" },
      },
    }]))
  })
  await page.goto("/?app=1")

  await page.getByRole("button", { name: /2026.*07.*20.*이지런.*상세/u }).click()
  await expect.poll(
    () => page.locator(".app-scroll-region").evaluate((element) => element.scrollTop),
  ).toBe(0)
  await page.getByRole("button", { name: "이지런 일지 수정" }).click()
  await expect(page.getByRole("textbox", { name: "세션 제목" })).toHaveValue("이지런")
  await page.getByRole("textbox", { name: "세션 제목" }).fill("회복 이지런")
  await page.getByRole("button", { name: /^수정 저장/u }).click()

  await expect(page.getByText("회복 이지런", { exact: true })).toBeVisible()
  const afterEdit = await page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1"))
  expect(afterEdit?.match(/"id":"past-session"/gu)).toHaveLength(1)
  expect(afterEdit).toContain('"title":"회복 이지런"')

  await page.getByRole("button", { name: "이 날짜에 일지 더 쓰기" }).click()
  await expect(page.getByText(/2026.*07.*20/u)).toBeVisible()
  await page.getByRole("button", { name: /회복.*하루 마무리/u }).click()
  await page.getByRole("button", { name: "감정 4 좋음" }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  await expect(page.getByText(/EVENING CHECK-IN/u)).toBeVisible()
  const afterAdd = await page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1"))
  expect(afterAdd?.match(/"date":"2026-07-20"/gu)).toHaveLength(2)
  expect(afterAdd).toContain('"kind":"evening"')
})
