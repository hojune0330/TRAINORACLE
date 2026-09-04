import { expect, test } from "@playwright/test"
import { undersizedInteractiveTargets } from "./touch-audit"

test.use({ serviceWorkers: "block" })

test("missing-record journey resumes the same choices and explicitly binds a non-divisible record", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"))
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  for (const name of [/^5000m\b/u, /고등부/u, /구조화된 훈련과 경기 경험이 많아요/u,
    /통증은 없고 몸 상태는 평소와 같아요/u, "내 계획 완성하기", /강한 유산소 반복.*VO₂/u,
    /5000m 경기 페이스 상세 훈련 포함/u, /^3일/u, /^9일 계획 받기/u,
    /아침에 운동해요/u, /하루 한 번 운동/u, "날짜 없이 계획안 보기"]) {
    await page.getByRole("button", { name, exact: typeof name === "string" }).click()
  }
  await page.getByLabel("계획 시작 날짜").fill("2026-09-10")
  await expect(page.getByRole("button", { name: "시간 조절 계획 선택하기" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "계획안 A 일정 접기" })).toBeEnabled()
  await page.getByRole("button", { name: "경기 기록 추가·관리" }).click()
  await page.getByLabel("기록 분", { exact: true }).fill("18")
  await page.getByLabel("기록 초", { exact: true }).fill("31")
  await page.getByLabel("달성일", { exact: true }).fill("2026-09-01")
  await page.getByRole("button", { name: "기록 저장", exact: true }).click()
  await page.getByRole("button", { name: "계획으로", exact: true }).click()
  await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
  await expect(page.getByLabel("계획 시작 날짜")).toHaveValue("2026-09-10")
  const evidence = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await expect(evidence).toBeFocused()
  await expect.poll(async () => {
    const box = await evidence.getByRole("heading", { name: "개인 페이스 기준 기록" }).boundingBox()
    return box !== null && box.y >= 0 && box.y < page.viewportSize()!.height / 2
  }).toBe(true)
  await expect(evidence.getByRole("button", { name: /개인 최고.*18분 31초/u })).toHaveAttribute("aria-pressed", "false")
  await expect(evidence.getByRole("button", { name: "이 기록으로 개인 페이스 적용" })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("record-return.png") })
  expect(await undersizedInteractiveTargets(evidence)).toEqual([])
  await evidence.getByRole("button", { name: /개인 최고.*18분 31초/u }).click()
  await evidence.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(evidence.getByRole("status")).toBeFocused()
  await page.getByRole("button", { name: "시간 조절 계획 선택하기" }).click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획", exact: true })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!))
  expect(saved.intake).toMatchObject({ startDate: "2026-09-10", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL", experienceBand: "EXPERIENCED" })
  const prescribed = saved.activePlan.sessions.filter((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET")
  expect(prescribed).toHaveLength(1)
  expect(prescribed[0].prescription.targetRepSeconds).toBe(222.2)
  expect(prescribed[0].prescription.repetitionRecoverySeconds).toBe(150)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
