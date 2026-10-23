import { expect, test } from "@playwright/test"
import {
  TOUCH_PROJECTS,
  auditTouchTargets,
  expectMinimumTouchSize,
  expectNoHorizontalOverflow,
  openEntry,
  openEveningStage,
  seedTouchAuditEntries,
} from "./touch-audit"

function requireTouchProject(projectName: string) {
  test.skip(!TOUCH_PROJECTS.has(projectName), "Rendered size assertions only apply to touch viewports")
}

test("audits empty home and chooser touch actions", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await page.goto("/")
  await expect(page.getByRole("navigation", { name: "홈 바로가기" })).toBeVisible()
  const services = page.getByRole("navigation", { name: "홈 바로가기" })
  await auditTouchTargets(page, [
    { name: "empty-home.first-entry", locator: page.getByRole("button", { name: "오늘 운동 기록 쓰기" }), heightOnly: true },
    { name: "empty-home.create-plan", locator: page.getByRole("button", { name: "훈련 계획 받기" }), heightOnly: true },
    { name: "empty-home.learn", locator: services.getByRole("button", { name: "훈련법 읽기" }), heightOnly: true },
    { name: "empty-home.decorate", locator: services.getByRole("button", { name: "일지 꾸미기" }), heightOnly: true },
    { name: "empty-home.more", locator: page.getByRole("button", { name: "더보기", exact: true }) },
  ])
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  // 홈의 주 행동은 세부 입력 전에 빠른 기록으로 시작한다.
  await page.getByRole("button", { name: "오늘 운동 기록 쓰기" }).click()
  await auditTouchTargets(page, [
    { name: "quick.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "quick.outcome", locator: page.getByRole("button", { name: /^(운동을 마쳤어요|하던 운동을 일부만 했어요|가볍게 움직였어요|오늘은 쉬었어요|하려던 운동을 건너뛰었어요)$/u }), count: 5, heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  // Leave the blank recording task before using the main tabs.
  await page.getByRole("button", { name: "← 뒤로", exact: true }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await auditTouchTargets(page, [
    { name: "chooser.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "chooser.post", locator: page.getByRole("button", { name: /자세히 기록.*운동별로 자세히/u }), heightOnly: true },
    { name: "chooser.evening", locator: page.getByRole("button", { name: /컨디션·메모.*수면·몸 상태·기분·메모/u }), heightOnly: true },
    { name: "chooser.race", locator: page.getByRole("button", { name: /경기 기록.*경기 전후 기록·컨디션/u }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
})

test("audits populated home, detail, and trends actions", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  const entries = page.getByRole("region", { name: "최근 하루 기록" }).getByRole("button", { name: /기록 2개 보기/u })
  await auditTouchTargets(page, [
    { name: "populated-home.open-today", locator: page.getByRole("button", { name: "오늘 기록 보기" }), heightOnly: true },
    { name: "populated-home.add", locator: page.getByRole("button", { name: "기록 더 남기기" }), heightOnly: true },
    { name: "populated-home.entries", locator: entries, count: 1, heightOnly: true },
    { name: "populated-home.tabs", locator: page.getByRole("navigation", { name: "주 탭" }).getByRole("button"), count: 5 },
  ])
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: "백업·복원·휴지통" }).click()
  await auditTouchTargets(page, [
    { name: "more.export", locator: page.getByRole("button", { name: /내 일지 데이터 내려받기/u }), heightOnly: true },
    { name: "more.full-export", locator: page.getByRole("button", { name: /메모 포함 파일 내보내기/u }), heightOnly: true },
  ])
  await page.getByRole("button", { name: /메모 포함 파일 내보내기/u }).click()
  await auditTouchTargets(page, [
    { name: "full-export.cancel", locator: page.getByRole("button", { name: "취소" }) },
    { name: "full-export.confirm", locator: page.getByRole("button", { name: "파일 만들기" }) },
  ])
  await page.getByRole("button", { name: "취소" }).click()
  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await expectNoHorizontalOverflow(page)
  await entries.nth(0).click()
  await auditTouchTargets(page, [
    { name: "detail.summary", locator: page.locator(".journal-entry-summary"), count: 2 },
    { name: "detail.expand-all", locator: page.getByRole("button", { name: "모두 펼쳐보기" }) },
    { name: "detail.manage", locator: page.getByRole("button", { name: "추가·수정" }) },
    { name: "detail.decorate", locator: page.getByRole("button", { name: "일지 꾸미기 열기" }) },
  ])
  const decorationLauncher = page.getByRole("button", { name: "일지 꾸미기 열기" })
  const primaryNavigation = page.getByRole("navigation", { name: "주 탭" })
  await decorationLauncher.scrollIntoViewIfNeeded()
  const decorationBox = await decorationLauncher.boundingBox()
  const navigationBox = await primaryNavigation.boundingBox()
  expect(decorationBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect((decorationBox?.y ?? 0) + (decorationBox?.height ?? 0)).toBeLessThanOrEqual((navigationBox?.y ?? 0) + 0.5)
  const manageToggle = page.getByRole("button", { name: "추가·수정" })
  await expect(manageToggle).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByTestId("journal-add-entry")).toBeHidden()
  await expect(page.locator('[data-testid^="journal-edit-"]')).toHaveCount(2)
  await expect(page.locator('[data-testid^="journal-edit-"]').first()).toBeHidden()
  await manageToggle.click()
  await auditTouchTargets(page, [
    { name: "detail.add-entry", locator: page.getByTestId("journal-add-entry") },
    { name: "detail.edit-entry", locator: page.locator('[data-testid^="journal-edit-"]'), count: 2 },
  ])
  await manageToggle.click()
  await page.getByRole("button", { name: "모두 펼쳐보기" }).click()
  await auditTouchTargets(page, [
    { name: "detail.back", locator: page.getByRole("button", { name: "홈으로 돌아가기" }) },
    { name: "detail.delete", locator: page.getByRole("button", { name: "이 일지 지우기" }), count: 2, heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클" }).click()
  await page.getByRole("group", { name: "훈련 분석 자세히 보기" }).getByRole("button", { name: "월별 변화", exact: true }).click()
  const metricButtons = page
    .getByRole("region", { name: "최근 4개월 추이" })
    .getByRole("group", { name: "추이 항목" })
    .getByRole("button")
  await auditTouchTargets(page, [
    { name: "trends.back", locator: page.getByRole("button", { name: "뒤로", exact: true }) },
    { name: "trends.metrics", locator: metricButtons, count: 4 },
  ])
  await expectNoHorizontalOverflow(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: testInfo.outputPath("touch-targets-320.png") })
  }
})

test("saves post-session and evening entries through the mobile shell", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /자세히 기록.*운동별로 자세히/u)
  await page.getByRole("button", { name: "휴식", exact: true }).click()
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: /^저장/u }).click()
  await page.getByRole("button", { name: "닫기", exact: true }).click()
  await expect(page.getByRole("button", { name: /기록 1개 보기 · 훈련 1/u })).toHaveCount(1)
  await openEveningStage(page, "수면")
  await page.getByRole("button", { name: /^수면 질 3/u }).click()
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/u }).click()
  await page.getByRole("button", { name: "닫기", exact: true }).click()
  await expect(page.getByRole("button", { name: /기록 2개 보기 · 훈련 1 · 컨디션·메모 1/u })).toHaveCount(1)
})

test("keeps the review toast dismissal touchable", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /빠르게 기록.*거리·시간·힘든 정도/u)
  await page.getByRole("button", { name: "오늘은 쉬었어요", exact: true }).click()
  await page.getByRole("button", { name: "글 추가", exact: true }).click()
  await page.getByRole("textbox", { name: "일지 내용", exact: true }).fill("무릎이 아파")
  await page.getByRole("radio", { name: "훈련 메모" }).click()
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await page.getByRole("button", { name: "완료", exact: true }).click()
  const alert = page.getByRole("alert")
  await expect(alert).toBeVisible()
  await expect(alert).toContainText("자동 확인을 완료하지 못했어요. 안전 여부를 판정한 것이 아니에요.")
  await expectMinimumTouchSize(alert.getByRole("button", { name: "검토 안내 닫기" }))
})
