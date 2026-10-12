import { expect, test } from "@playwright/test"

test("preserves malformed legacy bytes without opening a partial journal or logging private content", async ({ page }) => {
  const consoleMessages: string[] = []
  page.on("console", (message) => {
    consoleMessages.push(message.text())
  })
  const date = "2026-07-01"
  const base = {
    kind: "race",
    date,
    savedAt: `${date}T00:00:00.000Z`,
    syncState: "local",
    stage: "post",
    record: "4:08.21",
    rank: "",
    result: "",
    memoPurpose: "PRIVATE_SELF_ONLY",
  }
  const originalRaw = JSON.stringify([
    { ...base, id: "invalid", mood: 999, memo: "PRIVATE_DROP_SECRET" },
    { ...base, id: "valid", mood: 4, memo: "" },
  ])
  await page.addInitScript(raw => window.localStorage.setItem("trainoracle.journal.v1", raw), originalRaw)

  await page.goto("/?app=1&uitest=1")

  await expect(page.getByRole("heading", { name: "기록을 확인하지 못했어요", exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1"))).toBe(originalRaw)
  expect(await page.evaluate(() => window.localStorage.getItem("to-local-journal.journal.v2"))).toBeNull()
  expect(consoleMessages.join(" ")).not.toContain("PRIVATE_DROP_SECRET")
})
