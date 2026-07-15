import { expect, test } from "@playwright/test"
import {
  TOUCH_PROJECTS,
  auditTouchTargets,
  expectMinimumTouchSize,
  expectNoHorizontalOverflow,
  expectSaveAboveNavigation,
  meetsTouchContract,
  openEntry,
} from "./touch-audit"

function requireTouchProject(projectName: string) {
  test.skip(!TOUCH_PROJECTS.has(projectName), "Rendered size assertions only apply to touch viewports")
}

test("does not round a 43x44 target up to the touch contract", () => {
  expect(meetsTouchContract(43, 44)).toBe(false)
  expect(meetsTouchContract(44, 44)).toBe(true)
})

test("keeps core journal controls at least 44px tall", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /훈련 후/u)
  const privateMemo = page.getByRole("radio", { name: "나만의 메모" })
  const trainingMemo = page.getByRole("radio", { name: "훈련 메모" })

  await auditTouchTargets(page, [
    { name: "post.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "post.energy-help", locator: page.getByRole("button", { name: /강도 시스템 설명 보기/u }) },
    { name: "post.energy", locator: page.getByRole("button", { name: /^(BA BASE|LT LT|V2 VO2|GL GLY|AP ATP|RE REST)$/u }), count: 6 },
    { name: "post.title", locator: page.getByRole("textbox", { name: "세션 제목" }), heightOnly: true },
    { name: "post.distance", locator: page.getByRole("textbox", { name: "거리 (km)" }), heightOnly: true },
    { name: "post.duration", locator: page.getByRole("textbox", { name: "시간 (분)" }), heightOnly: true },
    { name: "post.pace", locator: page.getByRole("textbox", { name: "평균 페이스 (/km)" }), heightOnly: true },
    { name: "post.pace-help", locator: page.getByRole("button", { name: /페이스 설명 보기/u }) },
    { name: "post.rpe", locator: page.getByRole("button", { name: /^(?:[1-9]|10)$/u }), count: 10 },
    { name: "post.rpe-help", locator: page.getByRole("button", { name: /RPE 설명 보기/u }) },
    { name: "post.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "post.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "post.memo", locator: page.getByRole("textbox", { name: "훈련 메모 내용" }), heightOnly: true },
    { name: "post.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  const base = page.getByRole("button", { name: "BA BASE" })
  const rest = page.getByRole("button", { name: "RE REST" })
  await base.click()
  await rest.click()
  await expect(base).toHaveAttribute("aria-pressed", "false")
  await expect(rest).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await expectSaveAboveNavigation(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-2-shared.png" })
  }
})

test("keeps the journal title centered at touch widths", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  for (const entryName of [/훈련 후/u, /하루 마무리/u, /경기 직전\/직후/u]) {
    await openEntry(page, entryName)
    const topbarBox = await page.locator(".entry-topbar").boundingBox()
    const titleBox = await page.locator(".entry-topbar__title").boundingBox()
    const topbarCenter = (topbarBox?.x ?? 0) + (topbarBox?.width ?? 0) / 2
    const titleCenter = (titleBox?.x ?? 0) + (titleBox?.width ?? 0) / 2
    expect(Math.abs(topbarCenter - titleCenter)).toBeLessThanOrEqual(2)
    await expectNoHorizontalOverflow(page)
  }
})

test("lays out ten-point scales as two ordered rows on narrow touch screens", async ({ page }, testInfo) => {
  test.skip(!["mobile-chromium", "touch-narrow"].includes(testInfo.project.name), "Two-row layout is a mobile touch contract")
  await openEntry(page, /훈련 후/u)
  const buttons = Array.from({ length: 10 }, (_, index) => page.getByRole("button", { name: String(index + 1), exact: true }))
  const boxes = await Promise.all(buttons.map(async (button) => {
    await expectMinimumTouchSize(button)
    return button.boundingBox()
  }))

  expect(boxes.slice(0, 5).every((box) => box?.y === boxes[0]?.y)).toBe(true)
  expect(boxes.slice(5).every((box) => box?.y === boxes[5]?.y)).toBe(true)
  expect(boxes[5]?.y).toBeGreaterThan(boxes[0]?.y ?? 0)
  expect(boxes[5]?.x).toBe(boxes[0]?.x)
  const first = page.getByRole("button", { name: "1", exact: true })
  const tenth = page.getByRole("button", { name: "10", exact: true })
  await first.click()
  await expect(first).toHaveAttribute("aria-pressed", "true")
  await tenth.click()
  await expect(tenth).toHaveAttribute("aria-pressed", "true")
  await expect(first).toHaveAttribute("aria-pressed", "false")
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-3-ten-value.png" })
  }
})

test("keeps evening controls and every body-part selector touchable", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /하루 마무리/u)
  const bodyParts = [
    { id: "rKnee", name: "오른 무릎" }, { id: "lKnee", name: "왼 무릎" },
    { id: "rCalf", name: "오른 종아리" }, { id: "lCalf", name: "왼 종아리" },
    { id: "rHam", name: "오른 햄스트링" }, { id: "lHam", name: "왼 햄스트링" },
    { id: "lBack", name: "허리" }, { id: "rFoot", name: "오른 발" },
    { id: "lFoot", name: "왼 발" }, { id: "rShin", name: "정강이" },
  ]
  const bodyPartNames = bodyParts.map((part) => part.name)
  const privateMemo = page.getByRole("radio", { name: "나만의 메모" })
  const trainingMemo = page.getByRole("radio", { name: "훈련 메모" })

  await auditTouchTargets(page, [
    { name: "evening.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "evening.sleep-range", locator: page.getByRole("slider", { name: "수면 시간" }), heightOnly: true },
    { name: "evening.sleep-quality", locator: page.getByRole("button", { name: /^수면 질 [1-5]/u }), count: 5 },
    { name: "evening.weight", locator: page.getByRole("textbox", { name: "체중 (kg)" }), heightOnly: true },
    { name: "evening.heart-rate", locator: page.getByRole("textbox", { name: "안정시 심박 (bpm)" }), heightOnly: true },
    { name: "evening.mood", locator: page.getByRole("button", { name: /^감정 [1-5]/u }), count: 5 },
    { name: "evening.body-part", locator: page.getByRole("button", { name: /통증/u }), count: 10, heightOnly: true },
    { name: "evening.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "evening.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "evening.memo", locator: page.getByRole("textbox", { name: "오늘의 메모" }), heightOnly: true },
    { name: "evening.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  for (const prefix of ["수면 질", "감정"]) {
    const first = page.getByRole("button", { name: new RegExp(`^${prefix} 1`, "u") })
    const last = page.getByRole("button", { name: new RegExp(`^${prefix} 5`, "u") })
    await first.click()
    await last.click()
    await expect(first).toHaveAttribute("aria-pressed", "false")
    await expect(last).toHaveAttribute("aria-pressed", "true")
  }
  const bodyButtons = page.getByRole("button", { name: /통증/u })
  const orderedLabels = await bodyButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""))
  expect(orderedLabels.map((label) => label.split(",")[0])).toEqual(bodyPartNames)
  expect(await page.locator('[data-body-part="rKnee"]').getAttribute("r")).toBe("6")
  for (const { id, name } of bodyParts) {
    const selectedBefore = await bodyButtons.evaluateAll((buttons) => buttons.filter((button) => button.getAttribute("aria-pressed") === "true").length)
    const button = page.getByRole("button", { name: new RegExp(`^${name}.*통증`, "u") })
    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await expect(bodyButtons).toHaveCount(10)
    expect(await bodyButtons.evaluateAll((buttons) => buttons.filter((item) => item.getAttribute("aria-pressed") === "true").length)).toBe(selectedBefore + 1)
    expect(await page.locator(`[data-body-part="${id}"]`).getAttribute("r")).toBe("9")
  }
  expect(await page.locator('[data-body-part="rKnee"]').getAttribute("r")).toBe("9")
  const rightKnee = page.getByRole("button", { name: /^오른 무릎.*통증/u })
  await rightKnee.focus()
  const scrollBeforeSpace = await page.evaluate(() => window.scrollY)
  await page.keyboard.press("Space")
  await expect(rightKnee).toHaveAccessibleName(/통증 2단계/u)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeSpace)
  await page.keyboard.press("Enter")
  await expect(rightKnee).toHaveAccessibleName(/통증 3단계/u)
  await expect(rightKnee).toBeFocused()
  await expect(page.locator("svg [role='button']")).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await expectSaveAboveNavigation(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-4-body-button.png" })
  }
})

test("keeps race stages, checks, fields, and help controls touchable", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /경기 직전\/직후/u)

  const privateMemo = page.getByRole("radio", { name: "나만의 메모" })
  const trainingMemo = page.getByRole("radio", { name: "훈련 메모" })
  await auditTouchTargets(page, [
    { name: "race.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "race.stage", locator: page.getByRole("button", { name: /^경기 직[전후]$/u }), count: 2 },
    { name: "race.tension", locator: page.getByRole("button", { name: /^긴장도 (?:[1-9]|10)$/u }), count: 10 },
    { name: "race.condition", locator: page.getByRole("button", { name: /^컨디션 [1-5]$/u }), count: 5 },
    { name: "race.goal-minute", locator: page.getByRole("spinbutton", { name: "목표 페이스 분" }), heightOnly: true },
    { name: "race.goal-second", locator: page.getByRole("spinbutton", { name: "목표 페이스 초" }), heightOnly: true },
    { name: "race.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "race.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "race.memo", locator: page.getByRole("textbox", { name: "경기 메모" }), heightOnly: true },
  ])
  for (const scale of ["긴장도", "컨디션"]) {
    const last = scale === "긴장도" ? 10 : 5
    const firstButton = page.getByRole("button", { name: `${scale} 1`, exact: true })
    const lastButton = page.getByRole("button", { name: `${scale} ${last}`, exact: true })
    await firstButton.click()
    await expect(firstButton).toHaveAttribute("aria-pressed", "true")
    await lastButton.click()
    await expect(lastButton).toHaveAttribute("aria-pressed", "true")
    await expect(firstButton).toHaveAttribute("aria-pressed", "false")
  }
  await privateMemo.focus()
  await page.keyboard.press("ArrowRight")
  await expect(trainingMemo).toBeChecked()
  await page.getByRole("button", { name: "경기 직후" }).click()
  await auditTouchTargets(page, [
    { name: "race.record", locator: page.getByRole("textbox", { name: "경기 기록" }), heightOnly: true },
    { name: "race.rank", locator: page.getByRole("textbox", { name: "경기 순위" }), heightOnly: true },
    { name: "race.result", locator: page.getByRole("textbox", { name: "경기 결과" }), heightOnly: true },
    { name: "race.pb-help", locator: page.getByRole("button", { name: /PB 설명 보기/u }) },
    { name: "race.post-mood", locator: page.getByRole("button", { name: /^감정 [1-5]$/u }), count: 5 },
    { name: "race.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  const moodOne = page.getByRole("button", { name: "감정 1", exact: true })
  const moodFive = page.getByRole("button", { name: "감정 5", exact: true })
  await moodOne.click()
  await moodFive.click()
  await expect(moodOne).toHaveAttribute("aria-pressed", "false")
  await expect(moodFive).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await expectSaveAboveNavigation(page)
})

test("keeps the help mark small while its hit area and popover remain usable", async ({ page }, testInfo) => {
  await openEntry(page, /훈련 후/u)
  const help = page.getByRole("button", { name: /강도 시스템 설명 보기/u })
  if (TOUCH_PROJECTS.has(testInfo.project.name)) await expectMinimumTouchSize(help)
  const markBox = await help.locator("span").boundingBox()
  expect(markBox?.width).toBe(14)
  expect(markBox?.height).toBe(14)
  await help.click()
  const popover = page.locator(".popover-surface")
  await expect(popover).toBeVisible()
  const popoverBox = await popover.boundingBox()
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(popoverBox?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((popoverBox?.x ?? 0) + (popoverBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth)
  await page.keyboard.press("Escape")
  await expect(popover).toBeHidden()
  await page.screenshot({ path: `../.omo/evidence/mobile-touch-targets/task-5-${testInfo.project.name}.png` })
})
