import { expect, test } from "@playwright/test"

const enabledBuild = process.env.FATIGUE_EVIDENCE_BUILD === "true"

test("keeps experimental fatigue hidden in the default public build", async ({ page }) => {
  test.skip(enabledBuild, "enabled-build scenario runs separately")
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()

  await expect(page.getByRole("heading", { name: "피로도 나눠 보기" })).toHaveCount(0)
})

test("records exact self-report evidence before showing the experimental composite", async ({ page }) => {
  test.skip(!enabledBuild, "requires a build with the experimental fatigue flag")
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()

  const panel = page.getByRole("region", { name: "피로도 나눠 보기" })
  await expect(panel.getByText(/아직 저장된 피로 기록이 없어요/u)).toBeVisible()
  await panel.getByRole("checkbox", { name: /통합 참고값 보기/u }).check()
  await expect(panel.getByText(/^통합 참고값 \d+\/10$/u)).toHaveCount(0)

  await panel.getByLabel("신경계 피로").fill("8")
  await panel.getByRole("button", { name: "지금 값 기록하기" }).click()

  await expect(panel.getByText(/통합 참고값 6\/10/u)).toBeVisible()
  await expect(panel.getByText(/내가 직접 고른 값/u)).toBeVisible()
  await expect(panel.getByText(/불확실성 큼/u)).toBeVisible()
  const stored = await page.evaluate(() => window.localStorage.getItem("trainoracle.fatigue-experiment.v1"))
  expect(stored).not.toContain("memo")
  expect(stored).toContain("SELF_REPORTED_SLIDERS")
  expect(stored).toContain("HIGH_SUBJECTIVE_ONLY")
})
