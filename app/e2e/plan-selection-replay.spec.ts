import { expect, test, type Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"
import { expectActivePlanHeading } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

async function prepare(page: Page, startDate: string) {
  await page.clock.setFixedTime(new Date("2026-09-06T03:00:00Z"))
  await page.goto(`${process.env.PLAYWRIGHT_APP_PATH ?? "/"}?app=1`)
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await page.getByRole("button", { name: /^5000m/u }).click()
  await page.getByRole("button", { name: /일반부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }).click()
  await page.getByRole("button", { name: /RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /저녁에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 두 번 운동할게요/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
  await page.getByLabel("계획 시작 날짜", { exact: true }).fill(startDate)
  await expect(page.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeEnabled()
}

for (const changedDate of [false, true]) test(`two real tabs: ${changedDate ? "reject changed date" : "acknowledge identical selection"}`, async ({ page, context }) => {
  const other = await context.newPage()
  const errors: string[] = []
  for (const tab of [page, other]) tab.on("pageerror", error => errors.push(error.message))
  await prepare(page, "2026-09-10")
  await prepare(other, changedDate ? "2026-09-11" : "2026-09-10")
  expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe("function")
  await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
  await expectActivePlanHeading(page)
  const snapshot = () => page.evaluate(() => ({
    plan: localStorage.getItem("trainoracle.plan-beta.v1"),
    context: localStorage.getItem("trainoracle.plan-adaptation-context.v1"),
  }))
  const before = await snapshot()
  expect(before.plan).not.toBeNull()
  expect(before.context).not.toBeNull()
  await other.clock.setFixedTime(new Date("2026-09-06T03:01:00Z"))
  await other.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
  if (changedDate) {
    await expect(other.getByRole("alert")).toBeVisible()
    await expect(other.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeVisible()
  } else {
    await expectActivePlanHeading(other)
    await other.reload()
    await other.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
    await expectActivePlanHeading(other)
  }
  expect(await snapshot()).toEqual(before)
  expect(errors).toEqual([])
  await other.close()
})
