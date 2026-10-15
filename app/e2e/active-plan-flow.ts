import { expect, type Locator, type Page } from "@playwright/test"

export async function expectActivePlanHeading(page: Page, days = 9): Promise<void> {
  await expect(page.getByRole("heading", {
    name: new RegExp(`^${days}일 훈련 계획$`, "u"),
  })).toBeVisible()
}

export async function openActiveSessionDetails(
  page: Page,
  expectedText?: string | RegExp,
): Promise<Locator> {
  await openActivePlanCards(page)
  const total = await page.locator(".active-plan .plan-schedule-preview > li").count()
  for (let dayIndex = 0; dayIndex < total; dayIndex += 1) {
    const reader = await openActiveDayReader(page, dayIndex)
    const records = reader.locator("[data-session-records]")
    for (let sessionIndex = 0; sessionIndex < await records.count(); sessionIndex += 1) {
      await openSessionRecords(records.nth(sessionIndex))
    }
    if (expectedText === undefined) return reader
    if (await reader.getByText(expectedText).first().isVisible()) return reader
    const notation = reader.locator("details").filter({ has: page.getByText("기존 훈련 표기", { exact: true }) })
    for (let index = 0; index < await notation.count(); index += 1) {
      if (await notation.nth(index).getAttribute("open") === null) {
        await notation.nth(index).getByText("기존 훈련 표기", { exact: true }).click()
      }
    }
    if (await reader.getByText(expectedText).first().isVisible()) return reader
  }

  throw new Error(`Could not find a visible active-plan session matching ${String(expectedText)}`)
}

export async function openActivePlanCards(page: Page): Promise<void> {
  await closeActiveDayReader(page)
  await expect(page.locator(".active-plan")).toBeVisible()
  const list = page.getByRole("group", { name: "계획 일정 보기", exact: true })
    .getByRole("button", { name: "하루씩", exact: true })
  if (await list.getAttribute("aria-pressed") !== "true") await list.click()
  await expect(list).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기", exact: true })).toBeVisible()
}

export async function openActiveDayReader(page: Page, dayIndex = 0): Promise<Locator> {
  await openActivePlanCards(page)
  const cards = page.locator(".active-plan .plan-schedule-preview > li")
  const total = await cards.count()
  expect(dayIndex).toBeGreaterThanOrEqual(0)
  expect(dayIndex).toBeLessThan(total)
  const dateChoice = page.getByRole("group", { name: "훈련 날짜 선택", exact: true }).getByRole("button").nth(dayIndex)
  await dateChoice.click()
  await expect(dateChoice).toHaveAttribute("aria-pressed", "true")
  const card = cards.nth(dayIndex)
  const date = await card.locator("header time").textContent()
  expect(date).toBeTruthy()
  const trigger = card.getByRole("button", { name: /전체 처방 보기$/u })
  await expect(trigger).toHaveAccessibleName(`${date} 전체 처방 보기`)
  await trigger.click()
  const reader = page.locator(".plan-day-reader[open]")
  await expect(reader).toBeVisible()
  await expect(reader.getByRole("heading", { level: 2 })).toContainText(date!)
  await expect(reader.getByRole("button", { name: "크게 보기 이전 날짜", exact: true })).toBeVisible()
  await expect(reader.getByRole("button", { name: "크게 보기 다음 날짜", exact: true })).toBeVisible()
  return reader
}

export async function closeActiveDayReader(page: Page): Promise<void> {
  const reader = page.locator(".plan-day-reader[open]")
  if (await reader.count()) {
    await reader.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
    await expect(reader).toHaveCount(0)
  }
}

export async function openSessionRecords(session: Locator): Promise<void> {
  const records = session.locator("[data-session-records]")
  const target = await session.getAttribute("data-session-records") === null ? records : session
  await expect(target).toHaveCount(1)
  if (await target.getAttribute("open") === null) {
    await target.getByText("일지·진행 기록", { exact: true }).click()
  }
  await expect(target).toHaveAttribute("open", "")
}
