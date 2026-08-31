import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import path from "node:path"
import { selectNineDayProjection } from "./plan-flow"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })
const appPath = process.env.PLAYWRIGHT_APP_PATH ?? "/"


const evidenceDir = path.resolve(
  process.cwd(),
  "../.omo/evidence/personalized-auto-prescription/task-6-personalized-auto-prescription",
)

const currentRecords = [
  {
    schemaVersion: 1,
    id: "e2e-pb-5k",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-05-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:e2e-pb-5k",
    savedAt: "2026-05-10T12:00:00.000Z",
  },
  {
    schemaVersion: 1,
    id: "e2e-sb-5k",
    purpose: "SEASON_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1140,
    achievedOn: "2026-04-20",
    seasonId: "2026",
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:e2e-sb-5k",
    savedAt: "2026-04-20T12:00:00.000Z",
  },
] as const

async function seedRecords(page: Page, records: unknown): Promise<void> {
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

async function reachExperiencedFiveKCandidates(
  page: Page,
  divisionName: RegExp = /일반부/u,
): Promise<void> {
  await page.getByRole("button", { name: /^5000m\b/u }).click()
  await page.getByRole("button", { name: divisionName }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }).click()
  await page.getByRole("button", { name: /5000m 경기 페이스 상세 훈련 포함/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
}

async function assertViewportIntegrity(page: Page): Promise<void> {
  expect(await page.evaluate(() => ({
    documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    bodyFits: document.body.scrollWidth <= window.innerWidth,
  }))).toEqual({ documentFits: true, bodyFits: true })
}

async function assertKeyboardFocus(page: Page): Promise<void> {
  await page.keyboard.press("Tab")
  const focus = await page.evaluate(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return null
    const style = window.getComputedStyle(active)
    return {
      tag: active.tagName,
      text: active.textContent?.trim().slice(0, 80) ?? "",
      visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
    }
  })
  expect(focus).not.toBeNull()
  expect(focus?.visible).toBe(true)
}

async function assertTouchTargets(page: Page): Promise<void> {
  const undersized = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
    "button, input, select, summary, [role='button']",
  )].flatMap((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return []
    return rect.width >= 44 && rect.height >= 44
      ? []
      : [{
          label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 60) ?? element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }]
  }))
  expect(undersized).toEqual([])
}

async function assertEvidenceHelpDoesNotOverlap(page: Page): Promise<void> {
  const strip = page.locator(".plan-source-strip")
    .filter({ has: page.locator(".plan-source-strip__title") })
    .first()
  const geometry = await strip.evaluate((element) => {
    const title = element.querySelector<HTMLElement>(".plan-source-strip__title")
    const button = element.querySelector<HTMLElement>("strong button")
    const detail = element.querySelector<HTMLElement>("small")
    if (title === null || button === null || detail === null) return null
    const titleRect = title.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const detailRect = detail.getBoundingClientRect()
    const focusRect = {
      left: buttonRect.left - 2,
      right: buttonRect.right + 2,
      top: buttonRect.top - 2,
      bottom: buttonRect.bottom + 2,
    }
    const intersects = (rect: DOMRect) => !(
      focusRect.right <= rect.left
      || focusRect.left >= rect.right
      || focusRect.bottom <= rect.top
      || focusRect.top >= rect.bottom
    )
    return {
      titleOverlap: intersects(titleRect),
      detailOverlap: intersects(detailRect),
    }
  })
  expect(geometry).toEqual({ titleOverlap: false, detailOverlap: false })
}

async function bindFirstRecord(page: Page): Promise<void> {
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /개인 최고.*18분 30초/u }).click()
  await picker.getByText("다른 같은 종목 기록과 비교").click()
  await picker.getByRole("button", { name: /비교 기록.*시즌 최고.*19분/u }).click()
  await expect(picker.getByText(/기준 기록.*18분 30초/u)).toBeVisible()
  await expect(picker.getByText(/비교만.*19분/u)).toBeVisible()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
}

for (const viewport of [
  { name: "mobile-375x667", width: 375, height: 667 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const) {
  test(`binds, selects, reloads, and rechecks the exact prescription at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const browserErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text())
    })
    page.on("pageerror", (error) => browserErrors.push(error.message))
    await seedRecords(page, currentRecords)
    await openPlan(page)
    await reachExperiencedFiveKCandidates(page)
    await bindFirstRecord(page)

    await expect(page.getByText(/5×1000m @5000m RP.*r150.*JOG/u).first()).toBeVisible()
    await expect(page.getByText(/4번.*150초.*조깅.*600초/u).first()).toBeVisible()
    await expect(page.getByText(/기준 기록.*18분 30초.*2026-05-10/u).first()).toBeVisible()
    await assertViewportIntegrity(page)
    await assertTouchTargets(page)
    await assertKeyboardFocus(page)
    await assertEvidenceHelpDoesNotOverlap(page)
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}-candidates.png`),
      fullPage: true,
    })

    await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
    await expectActivePlanHeading(page)
    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    const activeSession = await openActiveSessionDetails(page, /5×1000m @5000m RP.*r150.*JOG/u)
    await activeSession.getByText("시작 전 확인").click()
    await expect(page.getByRole("button", {
      name: "통증 없고 평소와 같음 · 다시 시작 확인",
    })).toHaveCount(0)
    await page.getByRole("button", { name: "통증 없고 평소와 같음 · 시작 확인" }).click()
    await expect(page.locator(".plan-execution-status")).toContainText("시작할 수 있어요")
    await page.getByRole("button", { name: "통증·이상 또는 잘 모르겠음" }).click()
    await expect(page.locator(".plan-execution-status")).toContainText("상세 세션을 시작하지 않아요")
    await assertViewportIntegrity(page)
    await assertTouchTargets(page)
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}-active.png`),
      fullPage: true,
    })
    expect(browserErrors).toEqual([])
  })
}

test("keeps youth and adult 5K eligibility and dose identical", async ({ browser }) => {
  const storedDoses: unknown[] = []

  for (const divisionName of [/중등부/u, /일반부/u]) {
    const context = await browser.newContext({ serviceWorkers: "block" })
    const page = await context.newPage()
    await seedRecords(page, currentRecords)
    await openPlan(page)
    await reachExperiencedFiveKCandidates(page, divisionName)
    await expect(page.getByText(new RegExp(`참가 부문: ${divisionName.source}`, "u"))).toBeVisible()
    await bindFirstRecord(page)
    await expect(page.getByText(/5×1000m @5000m RP.*r150.*JOG/u).first()).toBeVisible()
    await page.getByRole("button", { name: /시간 조절 계획 선택하기/u }).click()
    await expectActivePlanHeading(page)

    storedDoses.push(await page.evaluate(() => {
      const raw = window.localStorage.getItem("trainoracle.plan-beta.v1")
      if (raw === null) throw new Error("Expected an active plan snapshot")
      const stored = JSON.parse(raw) as {
        readonly activePlan: {
          readonly selectedEnergyIntent: string
          readonly frame: unknown
          readonly sessions: unknown
        }
      }
      return {
        selectedEnergyIntent: stored.activePlan.selectedEnergyIntent,
        frame: stored.activePlan.frame,
        sessions: stored.activePlan.sessions,
      }
    }))

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" })
      .getByRole("button", { name: "계획" })
      .click()
    await openActiveSessionDetails(page, /5×1000m @5000m RP.*r150.*JOG/u)
    await context.close()
  }

  expect(storedDoses).toHaveLength(2)
  expect(storedDoses[0]).toEqual(storedDoses[1])
})

test("requires reconfirmation after replacing the selected record", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await seedRecords(page, currentRecords)
  await openPlan(page)
  await reachExperiencedFiveKCandidates(page)
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /개인 최고.*18분 30초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(page.getByText(/5×1000m @5000m RP.*r150.*JOG/u).first()).toBeVisible()

  await picker.getByRole("button", { name: /^시즌 최고.*19분/u }).click()
  await expect(page.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeDisabled()
  await expect(page.getByText(/5×1000m @5000m RP/u)).toHaveCount(0)
  await expect(page.getByText("새로 고른 기준 기록을 확인한 뒤 계획을 선택해 주세요.")).toBeVisible()

  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(page.getByRole("button", { name: /시간 조절 계획 선택하기/u })).toBeEnabled()
  await page.getByText("기준 기록·중단·낮춤 규칙 보기").first().click()
  await expect(page.getByText(/기준 기록.*5000m.*19분.*2026-04-20/u).first()).toBeVisible()
})
test("keeps stale evidence RPE-only", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await seedRecords(page, [{
    ...currentRecords[0],
    id: "e2e-stale-5k",
    achievedOn: "2024-01-01",
    sourceRef: "athlete-record:e2e-stale-5k",
  }])
  await openPlan(page)
  await reachExperiencedFiveKCandidates(page)
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /개인 최고.*18분 30초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(picker).toContainText("선택한 기록일이 현재 기준 범위를 벗어났어요")
  await expect(page.getByText(/5×1000m @5000m RP/u)).toHaveCount(0)
  await page.screenshot({ path: path.join(evidenceDir, "mobile-375x667-stale.png"), fullPage: true })
})

test("keeps missing evidence RPE-only", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openPlan(page)
  await reachExperiencedFiveKCandidates(page)
  await expect(page.getByText(/사용할 수 있는 경기 기록이 없어 RPE 계획/u)).toBeVisible()
  await expect(page.getByText(/5×1000m @5000m RP/u)).toHaveCount(0)
})

test("D9 blocks before candidates", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await seedRecords(page, currentRecords)
  await openPlan(page)
  await page.getByRole("button", { name: /^5000m\b/u }).click()
  await page.getByRole("button", { name: /일반부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증.*부상.*몸 이상/u }).click()
  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  await expect(page.getByText("선택 가능한 계획 2가지")).toHaveCount(0)
  await page.screenshot({ path: path.join(evidenceDir, "mobile-375x667-d9-blocked.png"), fullPage: true })
  await assertViewportIntegrity(page)
})
