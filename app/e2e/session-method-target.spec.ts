import { expect, test } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"
import { expectActivePlanHeading } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

test("selects a later MAIN, confirms pace, saves and reloads the exact slot", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => {
    if (localStorage.getItem("trainoracle.athlete-records.v1")) return
    const now = new Date().toISOString()
    localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
      schemaVersion: 1, id: "e2e-target-record", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
      performanceSeconds: 1111, achievedOn: now.slice(0, 10), seasonId: null,
      enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: "athlete-record:e2e-target-record", savedAt: now,
    }]))
  })
  await page.goto(`${process.env.PLAYWRIGHT_APP_PATH ?? "/"}?app=1`)
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await page.getByRole("button", { name: /^5000m\b/u }).click()
  await page.getByRole("button", { name: /일반부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }).click()
  await page.getByRole("button", { name: /5000m 경기 페이스 상세 훈련 포함/u }).click()
  await page.getByRole("button", { name: /^매일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 두 번 운동할게요/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
  await page.locator("summary").filter({ hasText: "상세 훈련을 적용할 날" }).click()
  const slots = page.getByRole("group", { name: "개인 페이스로 안내받을 주요 훈련" })
  const choices = slots.getByRole("radio")
  expect(await choices.count()).toBeGreaterThan(1)
  const last = choices.last()
  await last.check()
  await expect(last).toBeChecked()
  await slots.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath("session-target.png") })
  if (test.info().project.name === "touch-narrow") {
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await slots.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath("session-target-large-text.png") })
    await page.evaluate(() => { document.documentElement.style.fontSize = "" })
  }
  const evidence = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await evidence.getByRole("button", { name: /개인 최고.*18분 31초/u }).click()
  await evidence.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(evidence.getByRole("status")).toContainText("상세 훈련 수치를 적용")
  await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
  await expectActivePlanHeading(page)
  const read = () => page.evaluate(() => {
    const value = localStorage.getItem("trainoracle.plan-beta.v1")
    if (value === null) throw new Error("Expected stored plan")
    const state = JSON.parse(value)
    const main = state.activePlan.sessions.filter((s: { role: string }) => s.role === "QUALITY")
    const detail = main.filter((s: { prescription: { kind: string } }) => s.prescription.kind === "PACE_TARGET")
    return { detailCount: detail.length, day: detail[0]?.day, slot: detail[0]?.slot,
      lastMainDay: main.at(-1)?.day, seconds: detail[0]?.prescription.targetRepSeconds, state: value }
  })
  const stored = await read()
  expect(stored.detailCount).toBe(1)
  expect(stored.day).toBe(stored.lastMainDay)
  expect(stored.seconds).toBe(222.2)
  await page.reload()
  expect(await read()).toEqual(stored)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
