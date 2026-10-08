import { expect, type Page } from "@playwright/test"

export async function selectNineDayProjection(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "며칠짜리 달력을 받을까요?",
  })).toBeVisible()
  await page.getByRole("button", { name: /^9일 계획 받기/u }).click()
}

export async function openPlanRefinement(page: Page, label: string): Promise<void> {
  const purposeLabel = ["운동할 날", "달력 길이", "시간대", "하루 두 번", "대회 날짜"].includes(label)
    ? "일정·운동 시간"
    : "훈련 조절"
  const purposeEntry = page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: purposeLabel, exact: true })
  if (await purposeEntry.count()) {
    if (await purposeEntry.getAttribute("aria-expanded") !== "true") await purposeEntry.click()
    const purpose = page.getByRole("region", { name: purposeLabel, exact: true })
    await expect(purpose).toBeVisible()
    await purpose.getByRole("button", { name: new RegExp(`^${label} 바꾸기`) }).click()
    return
  }

  const panel = page.getByTestId("plan-refine")
  if (await panel.getAttribute("open") === null) await panel.locator("summary").click()
  await panel.getByRole("button", { name: new RegExp(`^${label} 바꾸기`) }).click()
}

export async function refinePlan(page: Page, label: string, answer: string | RegExp): Promise<void> {
  await openPlanRefinement(page, label)
  await page.getByRole("button", { name: answer, exact: typeof answer === "string" }).click()
  await expect(page.locator('[data-testid="plan-refine"], [role="group"][aria-label="계획 확인·변경"]')).toBeAttached()
}

export async function completeQuickPlan(page: Page, options: {
  event?: string | RegExp
  experience?: string | RegExp
  days?: string | RegExp
  review?: boolean
} = {}): Promise<void> {
  await enterPlanWithoutRecord(page, options.event)
  await page.getByRole("button", { name: options.experience ?? /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: options.days ?? /^3일/u }).click()
  await page.getByRole("button", { name: options.review
    ? /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u
    : /통증은 없고 몸 상태는 평소와 같아요/u }).click()
}

export async function enterPlanWithoutRecord(page: Page, event: string | RegExp = /^1500m/u): Promise<void> {
  const match = typeof event === "string" ? event : event.source
  const label = /하프|21097/u.test(match) ? "하프 마라톤" : /마라톤|42195/u.test(match) ? "마라톤"
    : /10km|10000/u.test(match) ? "10km" : /5km|5000/u.test(match) ? "5km"
    : /3000/u.test(match) ? "3000m" : /800/u.test(match) ? "800m" : "1500m"
  await page.getByRole("button", { name: label, exact: true }).click()
  await page.getByRole("button", { name: "기록 없이", exact: true }).click()
}

export async function completeDetailedPlan(page: Page, options: {
  event?: string | RegExp
  experience?: string | RegExp
  days?: string | RegExp
  division?: string | RegExp
  focus?: string | RegExp
  template?: string | RegExp
  time?: string | RegExp
  frame?: string | RegExp
  twice?: boolean
} = {}): Promise<void> {
  await completeQuickPlan(page, options)
  if (options.division) await refinePlan(page, "참가 부문", options.division)
  await refinePlan(page, "훈련 종류", options.focus ?? /지속 페이스 훈련/u)
  if (options.template) await refinePlan(page, "안내 방식", options.template)
  if (options.frame) await refinePlan(page, "달력 길이", options.frame)
  if (options.time) await refinePlan(page, "시간대", options.time)
  if (options.twice) await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u)
  await openPlanOptions(page, true)
}

export async function openPlanOptions(page: Page, expandA = false): Promise<void> {
  const purposeEntry = page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "일정·운동 시간", exact: true })
  if (await purposeEntry.count()) {
    if (await purposeEntry.getAttribute("aria-expanded") !== "true") await purposeEntry.click()
    const schedule = page.getByRole("region", { name: "일정·운동 시간", exact: true })
    await expect(schedule).toBeVisible()
    const toggle = schedule.getByRole("button", { name: "계획안 A 일정 펼치기" })
    if (expandA && await toggle.count()) await toggle.click()
    return
  }

  const options = page.locator(".plan-detailed-options").filter({ has: page.locator("summary", { hasText: "기록·시작일·다른 일정 확인" }) })
  if (await options.getAttribute("open") === null) await options.locator(":scope > summary").click()
  const toggle = page.getByRole("button", { name: "계획안 A 일정 펼치기" })
  if (expandA && await toggle.count()) await toggle.click()
}
