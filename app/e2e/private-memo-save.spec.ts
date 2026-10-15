import { expect, test } from "@playwright/test"

test("typing a private memo keeps the textarea above the memo task action", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-race").click()
  await page.getByRole("button", { name: "메모 추가", exact: true }).click()
  await page.getByRole("radio", { name: "나만의 메모" }).check()
  await page.evaluate(() => document.fonts.ready)
  const field = page.getByRole("textbox", { name: "경기 메모", exact: true })
  await field.scrollIntoViewIfNeeded()
  await field.focus()
  const before = await field.boundingBox()
  await field.pressSequentially("synthetic")
  await expect(page.getByRole("button", { name: "나만의 메모 저장 준비", exact: true })).toHaveAttribute("aria-expanded", "false")
  const after = await field.boundingBox()
  const sticky = await page.getByRole("button", { name: "입력 확인으로", exact: true }).boundingBox()
  expect(before).not.toBeNull(); expect(after).not.toBeNull(); expect(sticky).not.toBeNull()
  expect(after!.y).toBeLessThanOrEqual(before!.y + 2)
  expect(after!.y + after!.height).toBeLessThanOrEqual(sticky!.y)
  await expect(page.getByLabel("기존 복구 코드", { exact: true })).toHaveCount(0)
})

test("prepares encryption without leaving the race form and saves without plaintext storage", async ({ page }, testInfo) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-race").click()
  await page.getByRole("button", { name: "메모 추가", exact: true }).click()
  await page.getByRole("radio", { name: "나만의 메모" }).check()
  await page.getByRole("textbox", { name: "경기 메모", exact: true }).fill("synthetic-private-browser-fixture")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/ }).click()
  await expect(page.getByRole("alert")).toContainText("복구 코드를 준비")
  await expect(page.getByTestId("save-error")).toHaveCount(0)
  await page.getByRole("region", { name: "나만의 메모 저장 준비" }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("inline-encryption-setup.png") })
  // Synthetic non-production code; never collect the owner's memo or key.
  await page.getByRole("button", { name: "코드가 있어요", exact: true }).click()
  await page.getByLabel("기존 복구 코드", { exact: true }).fill("A1B2-C3D4-E5F6-A7B8-C9D0-E1F2-A3B4-C5D6")
  await page.getByRole("button", { name: "이 코드로 저장 준비", exact: true }).click()
  await expect(page.getByText(/암호화 준비가 됐어요/)).toBeVisible()
  await expect(page.getByRole("textbox", { name: "경기 메모", exact: true })).toHaveValue("synthetic-private-browser-fixture")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("to-local-journal.journal.v2") ?? "[]").length)).toBe(1)
  const result = await page.evaluate(() => ({
    entries: JSON.parse(localStorage.getItem("to-local-journal.journal.v2") ?? "[]"),
    rawLeaked: JSON.stringify(localStorage).includes("synthetic-private-browser-fixture"),
    vaultPresent: localStorage.getItem("to-local-journal.private-memo.v2") !== null,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  expect(result.entries[0]).toMatchObject({ kind: "race", memo: "", memoPurpose: "PRIVATE_SELF_ONLY" })
  expect(result.rawLeaked).toBe(false)
  expect(result.vaultPresent).toBe(true)
  expect(result.overflow).toBe(false)
  await page.getByRole("region", { name: "오늘 기록을 남겼어요.", exact: true }).getByRole("button", { name: "닫기", exact: true }).click()
  await page.getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-race").click()
  await page.getByRole("button", { name: "긴장도 6", exact: true }).click()
  await page.getByRole("button", { name: "메모 추가", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "경기 메모", exact: true })).toHaveValue("")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("to-local-journal.journal.v2") ?? "[]").length)).toBe(2)
  expect(await page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem("to-local-journal.journal.v2") ?? "[]") as { id: string }[]
    return new Set(entries.map(entry => entry.id)).size
  })).toBe(2)
})
