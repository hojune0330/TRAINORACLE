import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function openPostSession(page: Page) {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByRole("button", { name: /훈련 후/u }).click()
}

test("saves and reopens subjective intensity with mixed objective components", async ({ page }) => {
  await openPostSession(page)
  await page.getByRole("button", { name: "예상 강도 7" }).click()
  await page.getByRole("button", { name: "8", exact: true }).click()
  await page.getByRole("spinbutton", { name: "반복 횟수" }).fill("6")
  await page.getByRole("spinbutton", { name: "운동 시간 (초)" }).fill("60")
  await page.getByRole("spinbutton", { name: "회복 시간 (초)" }).fill("90")
  await page.getByRole("textbox", { name: "반복 페이스 · 선택" }).fill("3:00")
  await page.getByRole("textbox", { name: "개인 기준 페이스 · 선택" }).fill("3:09")
  await page.getByRole("button", { name: "객관 구성 추가" }).click()

  await page.getByRole("combobox", { name: "객관 기록 종류" }).selectOption("STRENGTH")
  await page.getByRole("textbox", { name: "운동 종류" }).fill("스쿼트")
  await page.getByRole("spinbutton", { name: "세트", exact: true }).fill("4")
  await page.getByRole("spinbutton", { name: "세트당 반복" }).fill("5")
  await page.getByRole("spinbutton", { name: "강도 (%1RM) · 선택" }).fill("80")
  await page.getByRole("spinbutton", { name: "남은 반복 (RIR) · 선택" }).fill("2")
  await page.getByRole("button", { name: "객관 구성 추가" }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  const savedSession = page.getByRole("button", { name: /훈련 .*상세 열기/u })
  await expect(savedSession).toBeVisible()
  await savedSession.click()
  await expect(page.getByText("주관 + 객관 함께 기록")).toBeVisible()
  await expect(page.getByText("운동 비중 40%", { exact: false })).toBeVisible()
  await expect(page.getByText("개인 기준 페이스 대비 5% 빠름 (105%)", { exact: false })).toBeVisible()
  await expect(page.getByText("스쿼트 · 4세트 × 5회", { exact: false })).toBeVisible()
  await expect(page.getByText("80% 1RM", { exact: false })).toBeVisible()
})

test("uses objective records without fabricating missing subjective intensity", async ({ page }) => {
  await openPostSession(page)
  await page.getByRole("combobox", { name: "객관 기록 종류" }).selectOption("PLYOMETRIC")
  await page.getByRole("textbox", { name: "운동 종류" }).fill("바운딩")
  await page.getByRole("spinbutton", { name: "접지 수", exact: true }).fill("40")
  await page.getByRole("spinbutton", { name: "평소 접지 수 · 선택" }).fill("32")
  await page.getByRole("button", { name: "객관 구성 추가" }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  const savedSession = page.getByRole("button", { name: /훈련 .*상세 열기/u })
  await expect(savedSession).toBeVisible()
  await savedSession.click()
  await expect(page.getByText("객관 기록으로만 표시")).toBeVisible()
  await expect(page.getByText("평소 접지 수 대비 125%", { exact: false })).toBeVisible()
  await expect(page.getByText(/RPE \d/u)).toHaveCount(0)
})

test("identifies the objective field that needs correction", async ({ page }) => {
  await openPostSession(page)
  await page.getByRole("spinbutton", { name: "반복 횟수" }).fill("6")
  await page.getByRole("spinbutton", { name: "운동 시간 (초)" }).fill("60")
  await page.getByRole("spinbutton", { name: "회복 시간 (초)" }).fill("90")
  await page.getByRole("textbox", { name: "반복 페이스 · 선택" }).fill("3:99")
  await page.getByRole("button", { name: "객관 구성 추가" }).click()

  await expect(page.getByRole("alert")).toContainText("반복 페이스 · 선택")
  await expect(page.getByRole("textbox", { name: "반복 페이스 · 선택" })).toHaveAttribute("aria-invalid", "true")
})
