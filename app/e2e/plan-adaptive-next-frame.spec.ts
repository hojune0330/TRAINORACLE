import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import path from "node:path"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })
const appPath = process.env.PLAYWRIGHT_APP_PATH ?? "/"
const expectedAsset = process.env.PLAYWRIGHT_EXPECTED_PLAN_BETA_ASSET
const expectedPort = process.env.PLAYWRIGHT_EXPECTED_PORT
test.skip(
  expectedAsset === undefined && expectedPort === undefined,
  "requires the isolated adaptive next-frame runner",
)
const evidenceDir = path.resolve(
  process.cwd(),
  "../../../.omo/evidence/trainoracle-adaptive-replanning/task-4/ui-lifecycle",
)

const records = [{
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000005000",
  purpose: "PERSONAL_BEST",
  eventDistanceM: 5000,
  performanceSeconds: 1_110,
  achievedOn: "2026-08-01",
  seasonId: null,
  enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:00000000-0000-4000-8000-000000005000",
  savedAt: "2026-08-01T12:00:00.000Z",
}] as const

for (const viewport of [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const) {
  test(`creates and reloads an immutable next-frame successor at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedRecords(page)
    await openPlan(page)
    await createBoundActivePlan(page)
    await assertCurrentBuild(page)
    const activeBefore = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))

    await expect(page.getByRole("button", { name: "다음 계획 조정하기" })).toBeVisible()
    await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)
    await assertNoHorizontalOverflow(page)
    await assertTouchTargets(page)
    const adaptationAction = page.getByRole("button", { name: "다음 계획 조정하기" })
    await adaptationAction.focus()
    await expect(adaptationAction).toBeFocused()
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}-initial-active.png`),
      fullPage: true,
    })

    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }).click()
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
    await page.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }).click()

    await expect(page.getByRole("heading", { name: "바뀌는 것" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "그대로인 것" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "불확실한 점" })).toBeVisible()
    await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertTouchTargets(page)
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}-review.png`),
      fullPage: true,
    })

    await page.getByRole("button", { name: "이 다음 계획 선택하기" }).click()
    await expect(page.getByRole("status")).toContainText("현재 활성 계획과 진행 기록은 바뀌지 않았습니다")
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activeBefore)
    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByRole("status")).toContainText("다음 주기에 사용할 보수적인 계획")
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activeBefore)

    await page.getByRole("button", { name: "현재 계획으로 돌아가기" }).click()
    const candidateBefore = await activeCandidateId(page)
    await page.getByLabel("DAY 1 오전 진행 기록")
      .getByRole("button", { name: "완료" })
      .click()
    const laterActiveBytes = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
    expect(laterActiveBytes).not.toBe(activeBefore)
    expect(await activeCandidateId(page)).toBe(candidateBefore)

    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByRole("heading", { name: "조정 이유를 선택해 주세요" })).toBeVisible()
    await expect(page.getByText("다음 주기에 사용할 보수적인 계획")).toHaveCount(0)
    await page.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }).click()
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
    await page.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }).click()
    await page.getByRole("button", { name: "이 다음 계획 선택하기" }).click()
    await expect(page.getByRole("status")).toContainText("현재 활성 계획과 진행 기록은 바뀌지 않았습니다")
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(laterActiveBytes)

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByRole("status")).toContainText("다음 주기에 사용할 보수적인 계획")
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(laterActiveBytes)
    await assertNoHorizontalOverflow(page)
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}-final-pending.png`),
      fullPage: true,
    })
  })
}

async function activeCandidateId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const stored = window.localStorage.getItem("trainoracle.plan-beta.v1")
    if (stored === null) return null
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== "object" || parsed === null || !("activePlan" in parsed)) return null
    const activePlan = parsed.activePlan
    if (typeof activePlan !== "object" || activePlan === null || !("candidateId" in activePlan)) return null
    return typeof activePlan.candidateId === "string" ? activePlan.candidateId : null
  })
}

async function seedRecords(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    window.localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify(seed))
  }, records)
}

async function openPlan(page: Page): Promise<void> {
  await page.goto(`${appPath}?app=1`)
  await page.getByRole("navigation", { name: "주 탭" })
    .getByRole("button", { name: "계획" })
    .click()
}

async function createBoundActivePlan(page: Page): Promise<void> {
  await page.getByRole("button", { name: /5km/u }).click()
  await expect(page.getByRole("button", { name: /일반부/u })).toBeVisible()
  await page.getByRole("button", { name: /일반부/u }).click()
  await expect(page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u })).toBeVisible()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await expect(page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })).toBeVisible()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await expect(page.getByLabel("미리보기 기준").getByText(
    "구조화된 훈련과 경기 경험이 많아요",
    { exact: true },
  )).toBeVisible()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()

  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await expect(picker).toBeVisible()
  await picker.getByRole("button", { name: /개인 최고.*18분 30초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await page.getByRole("button", { name: /반복 인터벌 포함 선택하기/u }).click()
  await expect(page.getByRole("heading", { name: /반복 인터벌 포함 9일 계획/u })).toBeVisible()
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => ({
    documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    bodyFits: document.body.scrollWidth <= window.innerWidth,
  }))).toEqual({ documentFits: true, bodyFits: true })
}

async function assertTouchTargets(page: Page): Promise<void> {
  const undersized = await page.locator(".plan-adaptation button:visible").evaluateAll((buttons) => (
    buttons.flatMap((button) => {
      const rect = button.getBoundingClientRect()
      return rect.width >= 44 && rect.height >= 44
        ? []
        : [{
            label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "button",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }]
    })
  ))
  expect(undersized).toEqual([])
}

async function assertCurrentBuild(page: Page): Promise<void> {
  if (expectedAsset === undefined || expectedPort === undefined) {
    throw new Error("Adaptive E2E requires an isolated port and expected PlanBeta asset")
  }
  expect(expectedPort).not.toBe("4173")
  expect(new URL(page.url()).port).toBe(expectedPort)
  const assets = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => /\/assets\/PlanBeta-[^/]+\.js$/u.test(name)))
  expect(assets).toEqual([`${new URL(page.url()).origin}/assets/${expectedAsset}`])
}
