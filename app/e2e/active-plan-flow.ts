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
    const slots = reader.getByRole("navigation", { name: "오전·오후 바로가기" }).getByRole("button")
    const slotCount = await slots.count()
    for (let slotIndex = 0; slotIndex < Math.max(1, slotCount); slotIndex += 1) {
      if (slotCount) await slots.nth(slotIndex).click()
      const records = reader.locator("[data-session-records]:visible")
      for (let index = 0; index < await records.count(); index += 1) await openSessionRecords(records.nth(index))
      if (expectedText === undefined) return reader
      const session = reader.locator("[data-session-slot]:visible")
      if (await session.getByText(expectedText).first().isVisible()) return reader
      const notation = session.locator("details").filter({ has: page.getByText("기존 훈련 표기", { exact: true }) })
      for (let index = 0; index < await notation.count(); index += 1) {
        if (await notation.nth(index).getAttribute("open") === null) {
          await notation.nth(index).getByText("기존 훈련 표기", { exact: true }).click()
        }
      }
      if (await session.getByText(expectedText).first().isVisible()) return reader
    }
  }

  throw new Error(`Could not find a visible active-plan session matching ${String(expectedText)}`)
}

export async function openActivePlanCards(page: Page): Promise<void> {
  await closeActiveDayReader(page)
  await expect(page.locator(".active-plan")).toBeVisible()
  const list = page.getByRole("radiogroup", { name: "계획 일정 보기", exact: true })
    .getByRole("radio", { name: "하루씩", exact: true })
  if (await list.getAttribute("aria-checked") !== "true") await list.click()
  await expect(list).toHaveAttribute("aria-checked", "true")
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
    await reader.getByRole("button", { name: /^(?:달력|하루씩)으로 돌아가기$/u, exact: true }).click()
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
