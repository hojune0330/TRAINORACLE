import { expect, test, type Page } from "@playwright/test"
import {
  TOUCH_PROJECTS,
  auditTouchTargets,
  expectMinimumTouchSize,
  expectNoHorizontalOverflow,
  meetsTouchContract,
  openEntry,
  openEveningStage,
} from "./touch-audit"

function requireTouchProject(projectName: string) {
  test.skip(!TOUCH_PROJECTS.has(projectName), "Rendered size assertions only apply to touch viewports")
}

async function expectSaveActionUnobstructed(page: Page) {
  const save = page.getByRole("button", { name: /^저장/u })
  const navigation = page.getByRole("navigation", { name: "주 탭" })
  await expect(save).toBeVisible()
  await save.scrollIntoViewIfNeeded()
  const saveBox = await save.boundingBox()
  expect(saveBox).not.toBeNull()
  expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  const saveBottom = (saveBox?.y ?? 0) + (saveBox?.height ?? 0)
  if (await navigation.count() > 0) {
    await expect(navigation).toHaveCount(1)
    const navigationBox = await navigation.boundingBox()
    expect(navigationBox).not.toBeNull()
    expect(saveBottom).toBeLessThanOrEqual((navigationBox?.y ?? 0) + 0.5)
  } else {
    // The active recording task intentionally hides the primary tab bar.
    await expect(navigation).toHaveCount(0)
    const viewportBottom = await page.evaluate(() => document.documentElement.clientHeight)
    expect(saveBottom).toBeLessThanOrEqual(viewportBottom)
  }
  expect(await save.evaluate(button => {
    const box = button.getBoundingClientRect()
    return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
  })).toBe(true)
}

test("does not round a 43x44 target up to the touch contract", () => {
  expect(meetsTouchContract(43, 44)).toBe(false)
  expect(meetsTouchContract(44, 44)).toBe(true)
})

test("keeps core journal controls at least 44px tall", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /자세히 기록.*운동별로 자세히/u)
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "실제로 한 운동 수정", exact: true }).click()
  const privateMemo = page.getByRole("radio", { name: "나만의 메모" })
  const trainingMemo = page.getByRole("radio", { name: "훈련 메모" })

  await auditTouchTargets(page, [
    { name: "post.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "post.energy-help", locator: page.getByRole("button", { name: /훈련 목적과 에너지 대사 설명 보기/u }) },
    { name: "post.energy", locator: page.getByRole("button", { name: /^(REC 회복 운동|BASE 기초 지구력|LT 지속 페이스|VO₂ 강한 유산소 반복|GLY 짧은 고강도 반복|ATP-PC 스피드·가속|MIX 여러 강도 조합)$/u }), count: 7 },
    { name: "post.title", locator: page.getByRole("textbox", { name: "세션 제목" }), heightOnly: true },
  ])
  const base = page.getByRole("button", { name: "BASE 기초 지구력" })
  const rest = page.getByRole("button", { name: "REC 회복" })
  await base.click()
  await rest.click()
  await expect(base).toHaveAttribute("aria-pressed", "false")
  await expect(rest).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: "거리와 시간 수정", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "post.distance", locator: page.getByRole("textbox", { name: "거리 (km)" }), heightOnly: true },
    { name: "post.duration", locator: page.getByRole("textbox", { name: "시간 (분)" }), heightOnly: true },
    { name: "post.pace", locator: page.getByRole("textbox", { name: "평균 페이스 (/km)" }), heightOnly: true },
    { name: "post.pace-help", locator: page.getByRole("button", { name: /페이스 설명 보기/u }) },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: "운동 강도 수정", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "post.rpe", locator: page.getByRole("button", { name: /^(?:[1-9]|10)$/u }), count: 10 },
    { name: "post.rpe-help", locator: page.getByRole("button", { name: /RPE 설명 보기/u }), count: 2 },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: "메모 수정", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "post.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "post.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "post.memo", locator: page.getByRole("textbox", { name: "훈련 메모 내용" }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "post.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  await expectNoHorizontalOverflow(page)
  await expectSaveActionUnobstructed(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-2-shared.png" })
  }
})

test("keeps the journal title centered at touch widths", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  for (const entryName of [/자세히 기록.*운동별로 자세히/u, /컨디션·메모/u, /경기 기록.*경기 전후 기록·컨디션/u]) {
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
  await openEntry(page, /자세히 기록.*운동별로 자세히/u)
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "운동 강도 수정", exact: true }).click()
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
  await openEveningStage(page, "수면")
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
    { name: "evening.sleep-hours", locator: page.getByRole("textbox", { name: "수면 시간" }), heightOnly: true },
    { name: "evening.sleep-quality", locator: page.getByRole("button", { name: /^수면 질 [1-5]/u }), count: 5 },
  ])
  const sleepFirst = page.getByRole("button", { name: /^수면 질 1/u })
  const sleepLast = page.getByRole("button", { name: /^수면 질 5/u })
  await sleepFirst.click()
  await sleepLast.click()
  await expect(sleepFirst).toHaveAttribute("aria-pressed", "false")
  await expect(sleepLast).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^체중 · 안정시 심박 (입력|수정)$/u }).click()
  await auditTouchTargets(page, [
    { name: "evening.weight", locator: page.getByRole("textbox", { name: "체중 (kg)" }), heightOnly: true },
    { name: "evening.heart-rate", locator: page.getByRole("textbox", { name: "안정시 심박 (bpm)" }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^기분 (입력|수정)$/u }).click()
  await auditTouchTargets(page, [
    { name: "evening.mood", locator: page.getByRole("button", { name: /^기분 [1-5]/u }), count: 5 },
  ])
  const moodFirst = page.getByRole("button", { name: /^기분 1/u })
  const moodLast = page.getByRole("button", { name: /^기분 5/u })
  await moodFirst.click()
  await moodLast.click()
  await expect(moodFirst).toHaveAttribute("aria-pressed", "false")
  await expect(moodLast).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^몸 상태 (입력|수정)$/u }).click()
  const picker = page.getByRole("group", { name: "몸 부위 선택", exact: true })
  await auditTouchTargets(page, [
    { name: "evening.body-groups", locator: picker.getByRole("button"), count: 7, heightOnly: true },
  ])
  const selected = page.getByRole("group", { name: "선택한 부위", exact: true })
  let selectedCount = 0
  for (const { id, name } of bodyParts) {
    if (selectedCount > 0) await page.getByRole("button", { name: "다른 부위 추가", exact: true }).click()
    const label = name.replace("햄스트링", "허벅지 뒤")
    const groupName = label.replace(/^(오른|왼) /u, "")
    await picker.getByRole("button", { name: groupName, exact: true }).click()
    const dialog = page.getByRole("dialog")
    if (/^(오른|왼) /u.test(label)) {
      const sides = dialog.getByRole("group", { name: `${groupName} 좌우 선택` })
      await auditTouchTargets(page, [{ name: `evening.${id}.sides`, locator: sides.getByRole("button"), count: 2, heightOnly: true }])
      await sides.getByRole("button", { name: label, exact: true }).click()
    }
    const levels = dialog.getByRole("group", { name: "통증 정도", exact: true })
    await auditTouchTargets(page, [{ name: `evening.${id}.levels`, locator: levels.getByRole("button"), count: 5 }])
    const first = levels.getByRole("button", { name: `${name} 통증 1단계`, exact: true })
    await first.focus()
    const scrollBeforeSpace = await page.evaluate(() => window.scrollY)
    await page.keyboard.press("Space")
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeSpace)
    await expect(dialog.getByRole("button", { name: `${name}, 통증 1/5`, exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "입력 완료", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    selectedCount += 1
    await expect(selected.getByRole("button")).toHaveCount(selectedCount)
  }
  const orderedLabels = await selected.getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label") ?? ""))
  expect(orderedLabels.map(label => label.split(",")[0])).toEqual(bodyPartNames)
  await selected.getByRole("button", { name: "오른 무릎, 통증 1/5", exact: true }).click()
  const kneeDialog = page.getByRole("dialog")
  await kneeDialog.getByRole("button", { name: "오른 무릎 통증 3단계", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(kneeDialog.getByRole("button", { name: "오른 무릎, 통증 3/5", exact: true })).toBeVisible()
  await kneeDialog.getByRole("button", { name: "입력 완료", exact: true }).click()
  await expect(selected.getByRole("button", { name: "오른 무릎, 통증 3/5", exact: true })).toBeFocused()
  await expect(page.locator("svg [role='button']")).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인", exact: true }).click()
  await page.getByRole("button", { name: /^메모 (입력|수정)$/u }).click()
  await auditTouchTargets(page, [
    { name: "evening.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "evening.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "evening.memo", locator: page.getByRole("textbox", { name: "오늘의 메모" }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "evening.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  await expectNoHorizontalOverflow(page)
  await expectSaveActionUnobstructed(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-4-body-button.png" })
  }
})

test("keeps race stages, checks, fields, and help controls touchable", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /경기 기록.*경기 전후 기록·컨디션/u)

  const privateMemo = page.getByRole("radio", { name: "나만의 메모" })
  const trainingMemo = page.getByRole("radio", { name: "훈련 메모" })
  await auditTouchTargets(page, [
    { name: "race.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "race.stage", locator: page.getByRole("button", { name: /^경기 직[전후]$/u }), count: 2 },
    { name: "race.tension", locator: page.getByRole("button", { name: /^긴장도 (?:[1-9]|10)$/u }), count: 10 },
    { name: "race.condition", locator: page.getByRole("button", { name: /^컨디션 [1-5]$/u }), count: 5 },
    { name: "race.goal-minute", locator: page.getByRole("spinbutton", { name: "목표 페이스 분" }), heightOnly: true },
    { name: "race.goal-second", locator: page.getByRole("spinbutton", { name: "목표 페이스 초" }), heightOnly: true },
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
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "경기 직후" }).click()
  await auditTouchTargets(page, [
    { name: "race.record", locator: page.getByRole("textbox", { name: "경기 기록" }), heightOnly: true },
    { name: "race.rank", locator: page.getByRole("textbox", { name: "경기 순위" }), heightOnly: true },
    { name: "race.result", locator: page.getByRole("textbox", { name: "경기 결과" }), heightOnly: true },
    { name: "race.pb-help", locator: page.getByRole("button", { name: /PB 설명 보기/u }) },
    { name: "race.post-mood", locator: page.getByRole("button", { name: /^감정 [1-5]$/u }), count: 5 },
  ])
  const moodOne = page.getByRole("button", { name: "감정 1", exact: true })
  const moodFive = page.getByRole("button", { name: "감정 5", exact: true })
  await moodOne.click()
  await moodFive.click()
  await expect(moodOne).toHaveAttribute("aria-pressed", "false")
  await expect(moodFive).toHaveAttribute("aria-pressed", "true")
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: /^메모 (추가|수정)$/u }).click()
  await auditTouchTargets(page, [
    { name: "race.private-label", locator: privateMemo.locator("xpath=.."), heightOnly: true },
    { name: "race.training-label", locator: trainingMemo.locator("xpath=.."), heightOnly: true },
    { name: "race.memo", locator: page.getByRole("textbox", { name: "경기 메모" }), heightOnly: true },
  ])
  await privateMemo.focus()
  await page.keyboard.press("ArrowRight")
  await expect(trainingMemo).toBeChecked()
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await auditTouchTargets(page, [
    { name: "race.save", locator: page.getByRole("button", { name: /^저장/u }) },
  ])
  await expectNoHorizontalOverflow(page)
  await expectSaveActionUnobstructed(page)
})

test("keeps the help mark small while its hit area and popover remain usable", async ({ page }, testInfo) => {
  await openEntry(page, /자세히 기록.*운동별로 자세히/u)
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "실제로 한 운동 수정", exact: true }).click()
  const help = page.getByRole("button", { name: /훈련 목적과 에너지 대사 설명 보기/u })
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
