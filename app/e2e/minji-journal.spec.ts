import { expect, test } from "@playwright/test"

test("opens Minji's diary as a readable page stack", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))

  await page.goto("/")
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "민지의 예시 일지" }).click()

  const pageButton = page.getByRole("button", { name: /2개월.*힘든 날에 함께 보인 것/u })
  await pageButton.click()
  await expect(page.getByRole("heading", { name: "힘든 날에 함께 보인 것" })).toBeFocused()
  await expect(page.getByText("잠 때문이라고 확정할 수는 없어요. 함께 보인 기록일 뿐이에요.")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("minji-diary-page.png"), fullPage: true })

  await page.getByRole("button", { name: "민지의 일지 닫기" }).click()
  await expect(pageButton).toBeFocused()
  expect(errors).toEqual([])
})
