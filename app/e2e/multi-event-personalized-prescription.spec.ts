import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"
import { completeDetailedPlan, openPlanOptions, openPlanRefinement } from "./plan-flow"

test.use({ serviceWorkers: "block" })
const appPath = process.env.PLAYWRIGHT_APP_PATH ?? "/"

const records = [
  [800, 122],
  [1500, 245],
  [3000, 611],
  [5000, 1111],
].map(([eventDistanceM, performanceSeconds]) => ({
  schemaVersion: 1,
  id: `e2e-current-${eventDistanceM}`,
  purpose: "RECENT_RESULT",
  eventDistanceM,
  performanceSeconds,
  achievedOn: "2026-08-10",
  seasonId: null,
  enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED",
  sourceRef: `athlete-record:e2e-current-${eventDistanceM}`,
  savedAt: "2026-08-10T12:00:00.000Z",
}))

const cases = [
  {
    eventDistanceM: 800,
    focus: /고강도 반복 훈련/u,
    notation: /10 × 200m/u,
    paceBasis: "기준: 800m 2:02 · 계획에 저장된 기준 기록 · 경기 평균 페이스",
    expectedPrescription: { targetEventDistanceM: 800, targetRepSeconds: 30.5,
      repetitionsPerSet: 10, repetitionDistanceM: 200, repetitionRecoverySeconds: 60,
      repetitionRecoveryMode: "STAND", totals: { qualityDistanceM: 2000,
        repetitionRecoveryOccurrences: 9, repetitionRecoveryTotalSeconds: 540 } },
    work: "200m마다 30.5초",
    recovery: "60초 서서 쉬기",
  },
  {
    eventDistanceM: 1500,
    focus: /혼합 훈련/u,
    notation: /3 × 500m/u,
    paceBasis: "기준: 1500m 4:05 · 계획에 저장된 기준 기록 · 경기 평균 페이스",
    expectedPrescription: { targetEventDistanceM: 1500, targetRepSeconds: 245 * 500 / 1500,
      repetitionsPerSet: 3, repetitionDistanceM: 500, repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "STAND", totals: { qualityDistanceM: 1500,
        repetitionRecoveryOccurrences: 2, repetitionRecoveryTotalSeconds: 360 } },
    work: "500m마다 1분 21.7초",
    recovery: "3분 서서 쉬기",
  },
  {
    eventDistanceM: 3000,
    focus: /유산소 반복 훈련/u,
    notation: /4 × 800m/u,
    paceBasis: "기준: 3000m 10:11 · 계획에 저장된 기준 기록 · 경기 평균 페이스",
    expectedPrescription: { targetEventDistanceM: 3000, targetRepSeconds: 611 * 800 / 3000,
      repetitionsPerSet: 4, repetitionDistanceM: 800, repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "WALK", totals: { qualityDistanceM: 3200,
        repetitionRecoveryOccurrences: 3, repetitionRecoveryTotalSeconds: 540 } },
    work: "800m마다 2분 42.9초",
    recovery: "3분 걷기",
  },
] as const

async function seedRecords(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    window.localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify(seed))
  }, records)
}

async function showCandidatePurpose(
  page: Page,
  name: "훈련 조절" | "일정·운동 시간",
): Promise<void> {
  const entry = page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name, exact: true })
  if (await entry.getAttribute("aria-expanded") !== "true") await entry.click()
  await expect(page.getByRole("region", { name, exact: true })).toBeVisible()
}

async function reachExactEventCandidates(
  page: Page,
  eventDistanceM: number,
  focus: RegExp,
): Promise<void> {
  await page.goto(`${appPath}?app=1`)
  await page.getByRole("navigation", { name: "주 탭" })
    .getByRole("button", { name: "훈련" })
    .click()
  await completeDetailedPlan(page, { event: new RegExp(`^${eventDistanceM}m`, "u"),
    division: /일반부/u, experience: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u,
    focus, time: /아침에 운동해요/u })
  await openPlanRefinement(page, "훈련 구성·페이스")
  const detailChoice = page.getByRole("button", {
    name: new RegExp(`${eventDistanceM}m 경기 페이스 상세 훈련 포함`, "u"),
  })
  await expect(detailChoice).toContainText("내 기록으로 목표 시간 계산")
  await page.getByText("준비·정리와 훈련 표기 보기").click()
  await expect(page.getByText(/준비 15분 RPE/u)).toBeVisible()
  await expect(page.locator(".plan-detailed-prescription code")).toBeVisible()
  if (process.env.CAPTURE_PLAN_QA === "1") {
    await detailChoice.scrollIntoViewIfNeeded()
    await page.screenshot({ path: test.info().outputPath(`template-choice-${eventDistanceM}m.png`) })
  }
  await page.getByRole("button", {
    name: new RegExp(`${eventDistanceM}m 경기 페이스 상세 훈련 포함`, "u"),
  }).click()
}

for (const fixture of cases) {
  test(`creates and reloads the exact ${fixture.eventDistanceM}m prescription`, async ({ page }, testInfo) => {
    await page.setViewportSize(testInfo.project.name === "mobile-chromium"
      ? { width: 375, height: 667 }
      : { width: 1440, height: 900 })
    const browserErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text())
    })
    page.on("pageerror", (error) => browserErrors.push(error.message))
    await seedRecords(page)
    await reachExactEventCandidates(page, fixture.eventDistanceM, fixture.focus)

    await showCandidatePurpose(page, "훈련 조절")
    const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
    await expect(picker.getByRole("button", {
      name: new RegExp(`${fixture.eventDistanceM}m`, "u"),
    })).toBeVisible()
    for (const otherDistance of [800, 1500, 3000, 5000]) {
      if (otherDistance === fixture.eventDistanceM) continue
      await expect(picker.getByRole("button", {
        name: new RegExp(`${otherDistance}m`, "u"),
      })).toHaveCount(0)
    }

    await picker.getByRole("button", {
      name: new RegExp(`${fixture.eventDistanceM}m`, "u"),
    }).click()
    await picker.getByRole("button", {
      name: "이 기록으로 개인 페이스 적용",
    }).click()
    await expect(page.getByRole("heading", { name: "계획이 준비됐어요", exact: true })).toBeFocused()
    await showCandidatePurpose(page, "훈련 조절")
    await expect(picker.getByRole("status")).toBeVisible()
    await expect(picker.getByRole("status")).toHaveText("선택한 기록으로 상세 훈련 수치를 계산했어요.")
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await picker.scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath(`candidate-${fixture.eventDistanceM}m.png`),
      })
    }
    await openPlanOptions(page, true)
    const candidateA = page.getByRole("region", { name: "다른 계획 비교", exact: true }).locator(".plan-candidate").first()
    const workPattern = new RegExp(`${fixture.expectedPrescription.repetitionsPerSet}\\s*×\\s*${fixture.expectedPrescription.repetitionDistanceM}m`, "u")
    await candidateA.getByRole("button", { name: /훈련 내용 보기$/u }).filter({ hasText: workPattern }).click()
    const candidateReader = page.locator(".plan-day-reader[open]")
    await expect(candidateReader).toBeVisible()
    await expect(candidateReader.getByText(fixture.notation).first()).toBeVisible()
    await candidateReader.getByRole("button", { name: /^(?:달력|하루씩)으로 돌아가기$/u }).click()
    await expect(candidateReader).toHaveCount(0)
    await page.getByRole("button", { name: /이 일정으로 시작/u }).click()
    await expectActivePlanHeading(page)
    const storedPrescription = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!)
      const detailed = state.activePlan.sessions.filter((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET")
      if (detailed.length !== 1) throw new Error("Expected exactly one confirmed detailed session")
      return detailed[0].prescription
    })
    expect(storedPrescription).toMatchObject(fixture.expectedPrescription)
    const selectedSession = await openActiveSessionDetails(page, fixture.notation)
    // MAIN keeps the exact targets and recovery; detail restores preparation and cooldown.
    const memo = selectedSession.getByRole("article", { name: "훈련 메모 미리보기" })
    await expect(memo).toBeVisible()
    await expect(memo).toHaveAttribute("data-view", "core")
    await expect(selectedSession.getByText(fixture.work).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.recovery).first()).toBeVisible()
    await expect(memo.getByRole("term").filter({ hasText: /^(준비|정리)$/u })).toHaveCount(0)
    await selectedSession.getByRole("button", { name: "자세히", exact: true }).click()
    await expect(memo).toHaveAttribute("data-view", "method")
    await expect(memo.getByText("준비", { exact: true })).toBeVisible()
    await expect(memo.getByText("정리", { exact: true })).toBeVisible()
    await expect(memo).toContainText(fixture.work)
    await expect(memo).toContainText(fixture.recovery)
    await memo.getByText("이 훈련의 이유", { exact: true }).click()
    await expect(memo).toHaveAttribute("data-view", "explained")
    await expect(memo.getByText(fixture.paceBasis, { exact: true })).toBeVisible()
    await expect(selectedSession.getByText(fixture.notation).first()).toBeVisible()
    await selectedSession.getByRole("button", { name: "이 훈련을 하는 이유", exact: true }).first().click()
    const explanation = page.locator(".session-explanation[open]")
    await explanation.getByRole("tab", { name: "방법", exact: true }).click()
    await expect(explanation.getByText(fixture.notation).first()).toBeVisible()
    await explanation.getByRole("tab", { name: "이유·근거" }).click()
    await expect(explanation.getByText("저장된 처방과 설명 버전이 일치해요.")).toBeVisible()
    await explanation.locator("summary").filter({ hasText: /^구성·회복의 이유와 근거$/u }).click()
    await expect(explanation.getByRole("heading", { name: "회복을 이렇게 넣은 이유", exact: true })).toBeAttached()
    await expect(explanation.getByText(new RegExp(`계산에 사용한 기준 기록: ${fixture.eventDistanceM}m`, "u"))).toBeAttached()
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await page.screenshot({ path: testInfo.outputPath(`explanation-${fixture.eventDistanceM}m.png`) })
    }
    await explanation.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "훈련" })
      .click()
    const activeSession = await openActiveSessionDetails(page, fixture.notation)
    expect(await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!)
      return state.activePlan.sessions.find((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET").prescription
    })).toEqual(storedPrescription)
    await activeSession.getByText("시작 전 확인").click()
    await expect(page.getByRole("button", {
      name: "통증 없고 평소와 같음 · 다시 시작 확인",
    })).toHaveCount(0)
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await activeSession.locator(".active-plan__execution-check").first().screenshot({
        path: testInfo.outputPath(`execution-check-${fixture.eventDistanceM}m.png`),
      })
    }
    await activeSession.getByRole("button", {
      name: "통증 없고 평소와 같음 · 시작 확인",
    }).click()
    await expect(activeSession.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toBeVisible()
    await activeSession.getByRole("button", { name: "완료" }).click()
    await expect(page.getByRole("button", {
      name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u,
    })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toHaveCount(0)
    await expect(activeSession.getByText(/이미 결과를 기록한 세션은 다시 시작하지 않아요/u).first())
      .toBeVisible()
    await activeSession.getByRole("button", { name: "휴식" }).click()
    await expect(page.getByRole("button", {
      name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u,
    })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toHaveCount(0)
    await activeSession.getByRole("button", { name: "건너뜀" }).click()
    await expect(page.getByRole("button", {
      name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u,
    })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toHaveCount(0)
    await activeSession.getByRole("button", { name: "통증 체크" }).click()
    await expect(page.getByRole("button", {
      name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u,
    })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toHaveCount(0)
    await expect(activeSession.getByText("통증 기록 후 확인")).toBeVisible()
    await expect(activeSession.getByRole("button", {
      name: "통증·이상 또는 잘 모르겠음",
    })).toBeVisible()
    expect(browserErrors).toEqual([])
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await activeSession.getByText(fixture.notation).first().scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath(`active-${fixture.eventDistanceM}m.png`),
      })
    }
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true)
  })
}
