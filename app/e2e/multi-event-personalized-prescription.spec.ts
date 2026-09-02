import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"
import { selectNineDayProjection } from "./plan-flow"

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
    focus: /짧은 고강도 반복.*GLY/u,
    notation: /10×200m @800m RP.*r60.*STAND/u,
    summary: "총 10회 · 주요 구간 2000m · 200m당 31초",
    execution: "준비, 10회 본운동과 9번의 사이 회복, 정리 순서로 진행하세요.",
    work: "200m를 31초 목표로 10회 · 주요 구간 거리 2000m",
    recovery: "9번 · 매번 60초 서서 쉬기 · 총 540초",
  },
  {
    eventDistanceM: 1500,
    focus: /여러 강도 조합.*MIX/u,
    notation: /3×500m @1500m RP.*r180.*STAND/u,
    summary: "총 3회 · 주요 구간 1500m · 500m당 1분 22초",
    execution: "준비, 3회 본운동과 2번의 사이 회복, 정리 순서로 진행하세요.",
    work: "500m를 1분 22초 목표로 3회 · 주요 구간 거리 1500m",
    recovery: "2번 · 매번 180초 서서 쉬기 · 총 360초",
  },
  {
    eventDistanceM: 3000,
    focus: /강한 유산소 반복.*VO₂/u,
    notation: /4×800m @3000m RP.*r180.*WALK/u,
    summary: "총 4회 · 주요 구간 3200m · 800m당 2분 43초",
    execution: "준비, 4회 본운동과 3번의 사이 회복, 정리 순서로 진행하세요.",
    work: "800m를 2분 43초 목표로 4회 · 주요 구간 거리 3200m",
    recovery: "3번 · 매번 180초 걷기 · 총 540초",
  },
] as const

async function seedRecords(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    window.localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify(seed))
  }, records)
}

async function reachExactEventCandidates(
  page: Page,
  eventDistanceM: number,
  focus: RegExp,
): Promise<void> {
  await page.goto(`${appPath}?app=1`)
  await page.getByRole("navigation", { name: "주 탭" })
    .getByRole("button", { name: "계획" })
    .click()
  await page.getByRole("button", { name: new RegExp(`^${eventDistanceM}m`, "u") }).click()
  await page.getByRole("button", { name: /일반부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: focus }).click()
  const detailChoice = page.getByRole("button", {
    name: new RegExp(`${eventDistanceM}m 경기 페이스 상세 훈련 포함`, "u"),
  })
  await expect(detailChoice).toContainText("반복 사이")
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
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
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

    const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
    const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
    const pickerBox = await picker.boundingBox()
    const comparisonBox = await comparison.boundingBox()
    expect(pickerBox?.y).toBeLessThan(comparisonBox?.y ?? 0)
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
    await expect(picker.getByRole("status")).toBeFocused()

    await expect(page.getByText(fixture.notation).first()).toBeVisible()
    if (process.env.CAPTURE_PLAN_QA === "1") {
      await picker.scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath(`candidate-${fixture.eventDistanceM}m.png`),
      })
    }
    await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
    await expectActivePlanHeading(page)
    const selectedSession = await openActiveSessionDetails(page, fixture.notation)
    await expect(selectedSession.getByText(fixture.summary).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.execution).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.work).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.recovery).first()).toBeVisible()
    await expect(selectedSession.getByText(fixture.notation).first()).toBeVisible()

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    const activeSession = await openActiveSessionDetails(page, fixture.notation)
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
