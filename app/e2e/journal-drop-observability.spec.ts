import { expect, test } from "@playwright/test"

test("reports only counts when malformed persisted entries are dropped", async ({ page }) => {
  const warnings: string[] = []
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text())
  })
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 10)
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
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      { ...base, id: "invalid", mood: 999, memo: "PRIVATE_DROP_SECRET" },
      { ...base, id: "valid", mood: 4, memo: "" },
    ]))
  })

  await page.goto("/?app=1&uitest=1")

  await expect.poll(() => warnings).toContain("[JSTORE] dropped=1 loaded=1")
  expect(warnings.join(" ")).not.toContain("PRIVATE_DROP_SECRET")
})
