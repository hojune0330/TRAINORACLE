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
  const cards = page.locator(".plan-schedule-preview > li")
  const position = page.getByLabel("현재 날짜 위치")
  const next = page.getByRole("button", { name: "다음 날짜" })
  const currentPosition = await position.textContent()
  const total = await cards.count()
  let currentIndex = Math.max(0, Number.parseInt(currentPosition?.split("/")[0] ?? "1", 10) - 1)

  while (currentIndex < total) {
    const activeCard = cards.nth(currentIndex)
    await expect(activeCard).toHaveAttribute("data-active-card", "true")
    await expect(activeCard).toBeVisible()
    const expanders = activeCard.getByText(/훈련 방법과 기록/u)
    for (let sessionIndex = 0; sessionIndex < await expanders.count(); sessionIndex += 1) {
      const expander = expanders.nth(sessionIndex)
      if (await expander.isVisible()) await expander.click()
    }

    if (expectedText === undefined) return activeCard
    const target = activeCard.getByText(expectedText).first()
    if (await target.isVisible()) return activeCard

    currentIndex += 1
    if (currentIndex >= total) break
    await next.click()
    await expect(position).toHaveText(`${currentIndex + 1}/${total}`)
  }

  throw new Error(`Could not find a visible active-plan session matching ${String(expectedText)}`)
}
