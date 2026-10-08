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
    notation: /10 × 200m @ (?:30\.5s\/200m · )?800m RP · r60s Stand/u,
    paceBasis: "기준: 800m 최근 경기 2분 2초",
    expectedPrescription: { targetEventDistanceM: 800, targetRepSeconds: 30.5,
      repetitionsPerSet: 10, repetitionDistanceM: 200, repetitionRecoverySeconds: 60,
      repetitionRecoveryMode: "STAND", totals: { qualityDistanceM: 2000,
        repetitionRecoveryOccurrences: 9, repetitionRecoveryTotalSeconds: 540 } },
    work: "200m를 약 31초 기준으로 10회 · 주요 구간 거리 2000m",
    recovery: "9번 · 매번 60초 서서 쉬기 · 총 540초",
  },
  {
    eventDistanceM: 1500,
    focus: /혼합 훈련/u,
    notation: /3 × 500m @ (?:81\.7s\/500m · )?1500m RP · r3min Stand/u,
    paceBasis: "기준: 1500m 최근 경기 4분 5초",
    expectedPrescription: { targetEventDistanceM: 1500, targetRepSeconds: 245 * 500 / 1500,
      repetitionsPerSet: 3, repetitionDistanceM: 500, repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "STAND", totals: { qualityDistanceM: 1500,
        repetitionRecoveryOccurrences: 2, repetitionRecoveryTotalSeconds: 360 } },
    work: "500m를 약 1분 22초 기준으로 3회 · 주요 구간 거리 1500m",
    recovery: "2번 · 매번 180초 서서 쉬기 · 총 360초",
  },
  {
    eventDistanceM: 3000,
    focus: /유산소 반복 훈련/u,
    notation: /4 × 800m @ (?:162\.9s\/800m · )?3K RP · r3min Walk/u,
    paceBasis: "기준: 3000m 최근 경기 10분 11초",
    expectedPrescription: { targetEventDistanceM: 3000, targetRepSeconds: 611 * 800 / 3000,
      repetitionsPerSet: 4, repetitionDistanceM: 800, repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "WALK", totals: { qualityDistanceM: 3200,
        repetitionRecoveryOccurrences: 3, repetitionRecoveryTotalSeconds: 540 } },
    work: "800m를 약 2분 43초 기준으로 4회 · 주요 구간 거리 3200m",
    recovery: "3번 · 매번 180초 걷기 · 총 540초",
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
  await openPlanRefinement(page, "안내 방식")
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
    const schedule = page.getByRole("region", { name: "일정·운동 시간", exact: true })
    await expect(schedule.getByText(fixture.notation).first()).toBeVisible()
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
    await expect(selectedSession.getByText(fixture.paceBasis, { exact: true }).first()).toBeVisible()
    await selectedSession.getByText("자세히 보기 · 수행 순서", { exact: true }).click()
    await expect(selectedSession.getByText(fixture.work).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.recovery).first()).toBeVisible()
    await expect(selectedSession.getByText("준비", { exact: true })).toBeVisible()
    await expect(selectedSession.getByText("정리", { exact: true })).toBeVisible()
    await expect(selectedSession.getByText(fixture.notation).first()).toBeVisible()
    await selectedSession.getByRole("button", { name: "훈련 방법과 이유", exact: true }).first().click()
    const explanation = page.getByRole("dialog")
    await expect(explanation.getByText(fixture.notation).first()).toBeVisible()
    await explanation.getByRole("tab", { name: "이유·근거" }).click()
    await expect(explanation.getByText("저장된 처방과 설명 버전이 일치해요.")).toBeVisible()
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
      await page.locator(".active-plan__execution-check").first().screenshot({
        path: testInfo.outputPath(`execution-check-${fixture.eventDistanceM}m.png`),
      })
    }
    await page.getByRole("button", {
      name: "통증 없고 평소와 같음 · 시작 확인",
    }).click()
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toBeVisible()
    await activeSession.getByRole("button", { name: "완료" }).click()
    await expect(page.getByRole("button", {
      name: /통증 없고 평소와 같음 · (시작|다시 시작) 확인/u,
    })).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "시작할 수 있어요" })).toHaveCount(0)
    await expect(page.getByText(/이미 결과를 기록한 세션은 다시 시작하지 않아요/u).first())
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
    await expect(page.getByText("통증 기록 후 확인")).toBeVisible()
    await expect(page.getByRole("button", {
      name: "통증·이상 또는 잘 모르겠음",
    })).toBeVisible()
    expect(browserErrors).toEqual([])
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await page.getByText(fixture.notation).first().scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath(`active-${fixture.eventDistanceM}m.png`),
      })
    }
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true)
  })
}
