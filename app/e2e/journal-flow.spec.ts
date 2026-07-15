import { expect, test } from "@playwright/test"

test("saves a structured race note, carries review attention, and reopens the record", async ({ page }, testInfo) => {
  // Given
  await page.goto("/?app=1")
  if (testInfo.project.name === "reduced-motion") {
    await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true)
  }
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByRole("button", { name: /경기/u }).click()
  await page.getByRole("button", { name: "긴장도 7" }).click()
  await page.getByRole("button", { name: "컨디션 4" }).click()
  await page.getByRole("spinbutton", { name: "목표 페이스 분" }).fill("3")
  await page.getByRole("spinbutton", { name: "목표 페이스 초" }).fill("45")
  await page.getByRole("textbox", { name: "경기 메모" }).fill("무릎이 아파")
  await page.getByRole("radio", { name: "훈련 메모" }).click()
  await page.getByRole("button", { name: "경기 직후" }).click()
  await page.getByRole("button", { name: "감정 5" }).click()
  await page.getByRole("textbox", { name: "경기 기록" }).fill("4:08.21")

  // When
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  await expect(page.getByRole("alert")).toContainText("분석 결과를 확인해야 해요")
  const savedRace = page.getByRole("button", { name: /경기 .*상세 열기/u })
  await expect(savedRace).toBeVisible()
  await savedRace.click()
  await expect(page.getByText("3분 45초/km")).toBeVisible()
  await expect(page.getByText("7/10")).toBeVisible()
  await expect(page.getByText("4/5")).toBeVisible()
  await expect(page.getByText("5/5")).toBeVisible()
  await expect(page.getByText("무릎이 아파")).toBeVisible()
  await expect(page.getByText("훈련 메모")).toBeVisible()
})
