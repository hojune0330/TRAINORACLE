import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

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
  "../.omo/evidence/personalized-prescription-algorithm-v2/task-8/ui-lifecycle",
)
const finalEvidenceDir = path.resolve(
  process.cwd(),
  "../.omo/evidence/personalized-prescription-algorithm-v2/final-3",
)

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true })
  await mkdir(finalEvidenceDir, { recursive: true })
})

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
  { name: "320x568", width: 320, height: 568, projectionLength: 7 },
  { name: "375x667", width: 375, height: 667, projectionLength: 9 },
  { name: "768x1024", width: 768, height: 1024, projectionLength: 10 },
  { name: "1440x900", width: 1440, height: 900, projectionLength: 9 },
] as const) {
  test(`activates an immutable ${viewport.projectionLength}-day successor at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedRecords(page)
    await openPlan(page)
    await createBoundActivePlan(page, viewport.projectionLength)
    await assertCurrentBuild(page)

    await expect(page.getByRole("button", { name: "현재 계획을 먼저 기록해 주세요" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "다음 계획 조정하기" })).toHaveCount(0)
    await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)
    await assertNoHorizontalOverflow(page)
    await completeVisibleTrainingSessions(page)
    const activeBefore = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))

    await assertTouchTargets(page)
    const adaptationAction = page.getByRole("button", { name: "다음 계획 조정하기" })
    await expect(adaptationAction).toBeVisible()
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
    await expect(page.getByText("현재 활성 계획과 진행 기록은 바뀌지 않았습니다", { exact: false }))
      .toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activeBefore)
    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByText("다음 주기에 사용할 보수적인 계획", { exact: false }))
      .toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activeBefore)

    await page.getByRole("button", { name: "현재 계획으로 돌아가기" }).click()
    const candidateBefore = await activeCandidateId(page)
    await page.getByText("오전 훈련 방법과 기록", { exact: true }).first().click()
    await page.getByLabel("DAY 1 오전 진행 기록")
      .getByRole("button", { name: "휴식" })
      .click()
    await expect.poll(() => page.evaluate(
      () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
    )).not.toBe(activeBefore)
    const laterActiveBytes = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
    expect(await activeCandidateId(page)).toBe(candidateBefore)

    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByRole("heading", { name: "조정 이유를 선택해 주세요" })).toBeVisible()
    await expect(page.getByText("다음 주기에 사용할 보수적인 계획")).toHaveCount(0)
    await page.getByRole("button", { name: /다음 계획을 조정하고 싶어요/u }).click()
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
    await page.getByRole("button", { name: /훈련량을 조금 줄인 다음 계획/u }).click()
    await page.getByRole("button", { name: "이 다음 계획 선택하기" }).click()
    await expect(page.getByText("현재 활성 계획과 진행 기록은 바뀌지 않았습니다", { exact: false }))
      .toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(laterActiveBytes)

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
    await expect(page.getByText("다음 주기에 사용할 보수적인 계획", { exact: false }))
      .toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(laterActiveBytes)
    await page.getByRole("button", { name: "현재 계획으로 돌아가기" }).click()
    await page.getByRole("button", { name: "선택한 다음 계획 시작하기" }).click()
    await expect(page.getByRole("group", { name: "다음 계획 시작 전 몸 상태 확인" })).toBeVisible()
    await page.getByRole("group", { name: "다음 계획 시작 전 몸 상태 확인" })
      .getByRole("button", { name: "통증 없고 몸 상태는 평소와 같아요" })
      .click()
    await expect(page.getByRole("status").filter({
      hasText: "선택한 다음 계획을 시작했어요",
    })).toBeVisible()
    expect(await activeCandidateId(page)).not.toBe(candidateBefore)
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.adaptation.v1"))).toBeNull()
    expect(await page.evaluate(() => JSON.parse(
      window.localStorage.getItem("trainoracle.plan-beta.history.v1") ?? "[]",
    ))).toHaveLength(1)
    const activatedBytes = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activatedBytes)
    expect(await page.evaluate(() => JSON.parse(
      window.localStorage.getItem("trainoracle.plan-beta.history.v1") ?? "[]",
    ))).toHaveLength(1)
    if (viewport.name === "375x667") {
      const storageSnapshot = await page.evaluate(() => {
        const readJson = (key: string) => {
          const raw = window.localStorage.getItem(key)
          return raw === null ? null : JSON.parse(raw) as unknown
        }
        return {
          kind: "TRAINORACLE_PLAN_STORAGE_SNAPSHOT",
          privacy: "STRUCTURED_PLAN_FIELDS_ONLY_NO_RAW_TEXT",
          viewport: { width: window.innerWidth, height: window.innerHeight },
          activePlan: readJson("trainoracle.plan-beta.v1"),
          adaptationContext: readJson("trainoracle.plan-adaptation-context.v1"),
          pendingSuccessor: readJson("trainoracle.plan-beta.adaptation.v1"),
          history: readJson("trainoracle.plan-beta.history.v1"),
        }
      })
      await writeFile(
        path.join(finalEvidenceDir, "storage-snapshot-375x667.json"),
        `${JSON.stringify(storageSnapshot, null, 2)}\n`,
        "utf8",
      )
    }
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

async function createBoundActivePlan(page: Page, projectionLength: 7 | 9 | 10): Promise<void> {
  await page.getByRole("button", { name: /^5000m\b/u }).click()
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
  await page.getByRole("button", { name: /5000m 경기 페이스 상세 훈련 포함/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await expect(page.getByRole("heading", { name: "이번에 며칠 계획을 받을까요?" })).toBeVisible()
  await page.getByRole("button", {
    name: projectionLength === 7
      ? /^7일만 먼저 받기/u
      : new RegExp(`^${projectionLength}일 계획 받기`, "u"),
  }).click()
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획 후보 보기" }).click()

  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await expect(picker).toBeVisible()
  await picker.getByRole("button", { name: /개인 최고.*18분 30초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
  await expect(page.getByRole("heading", {
    name: new RegExp(`${projectionLength}일 훈련 계획`, "u"),
  })).toBeVisible()
}

async function completeVisibleTrainingSessions(page: Page): Promise<void> {
  const cards = page.getByRole("list", { name: "날짜별 계획 미리보기" })
    .getByRole("group", { name: /훈련 \d+개/u })
  const dayCount = await cards.count()
  expect(dayCount).toBeGreaterThan(0)
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const card = cards.nth(dayIndex)
    const details = card.getByText(/훈련 방법과 기록/u)
    const sessionCount = await details.count()
    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
      await details.nth(sessionIndex).click()
      await card.getByRole("button", { name: "완료", exact: true }).nth(sessionIndex).click()
    }
    if (dayIndex < dayCount - 1) {
      await page.getByRole("button", { name: "다음 날짜" }).click()
    }
  }
  await expect(page.getByRole("button", { name: "다음 계획 조정하기" })).toBeVisible()
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
