import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function openPlan(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
}

async function answerFirstThree(page: Page, review = false): Promise<void> {
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", {
    name: review
      ? /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u
      : /통증은 없고 몸 상태는 평소와 같아요/u,
  }).click()
}

test("shows an unsaved, non-selectable preview after three clear decisions", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)

  await expect(page.getByRole("heading", { name: "계획 형태 미리보기" })).toBeVisible()
  await expect(page.getByText(
    /훈련일.*첫 계획 길이.*7.*9.*10.*훈련 목적.*시간.*하루 한 번.*두 번/u,
  )).toBeVisible()
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()

  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await expect(page.getByRole("heading", {
    name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
  })).toBeVisible()
})

test("blocks review-risk before any preview or candidates", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page, true)

  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "계획 형태 미리보기" })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(0)
})

test("moves the single expanded schedule between candidates and allows collapse", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()

  const candidateA = page.getByRole("button", { name: "후보 A 일정 접기" })
  const candidateB = page.getByRole("button", { name: "후보 B 일정 펼치기" })
  await expect(candidateA).toHaveAttribute("aria-expanded", "true")
  await expect(candidateB).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await candidateB.click()
  await expect(page.getByRole("button", { name: "후보 A 일정 펼치기" }))
    .toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("button", { name: "후보 B 일정 접기" }))
    .toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await page.getByRole("button", { name: "후보 B 일정 접기" }).click()
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(0)
})
