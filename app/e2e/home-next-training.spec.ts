import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function answerPlanQuestions(page: Page): Promise<void> {
  await completeDetailedPlan(page, { division: /고등부/u })
}

test("shows a saved upcoming training on home and opens its existing plan", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2099, 0, 10, 12))
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await answerPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2099-01-11")
  await page.getByRole("button", { name: /선택하기|이 일정으로 시작/u }).first().click()
  await page.getByRole("button", { name: "홈" }).click()

  const nextTraining = page.getByRole("article", { name: "내일 훈련" })
  await expect(nextTraining).toContainText("1월 11일")
  await expect(nextTraining).not.toContainText("훈련 내용 보기")
  await expect(nextTraining).not.toContainText("목표 페이스")
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const entry = nextTraining.getByRole("button", { name: "2099-01-11 오전 훈련 상세", exact: true })
  await entry.click()
  const reader = page.getByRole("dialog", { name: /^2099년 1월 11일/u })
  await expect(reader).toBeVisible()
  await expect(reader.getByRole("article", { name: "훈련 메모 미리보기" })).toContainText("힘든 정도")
  await expect(reader).not.toContainText("목표 페이스")
  await reader.getByRole("button", { name: /^(?:달력|하루씩)으로 돌아가기$/u, exact: true }).click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획", exact: true })).toBeVisible()
  if (await page.evaluate(() => matchMedia("(max-width: 767px)").matches)) {
    await expect(page.getByRole("group", { name: "훈련 날짜 선택" })).toBeVisible()
    await expect(page.getByRole("button", { name: "1월 11일 일요일 선택", exact: true })).toHaveAttribute("aria-pressed", "true")
  } else await expect(page.getByRole("grid", { name: "2099년 1월 달력" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
})
