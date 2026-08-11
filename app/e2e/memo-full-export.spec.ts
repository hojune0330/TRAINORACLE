import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { createRecoveryCode, encryptPrivateNote } from "../src/domain/account/private-note-crypto"

test("makes a memo-inclusive backup only after confirmation without sending the export over the network", async ({ page }) => {
  const secret = "OWNER_EXPORT_ONLY_SECRET"
  const recoveryCode = createRecoveryCode()
  const encrypted = await encryptPrivateNote(secret, recoveryCode)
  const date = new Date().toISOString().slice(0, 10)
  await page.addInitScript(({ encrypted, recoveryCode, date }) => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "memo-full-export",
      kind: "post-session",
      date,
      savedAt: `${date}T00:00:00.000Z`,
      syncState: "local",
      system: "lt",
      title: "tempo",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }]))
    window.localStorage.setItem("trainoracle.private-memo.v1", JSON.stringify({
      version: 1,
      records: { "memo-full-export": { encrypted } },
    }))
    window.sessionStorage.setItem("trainoracle.private-note.recovery.v1", recoveryCode)
  }, { encrypted, recoveryCode, date })
  await page.goto("/?app=1")
  await page.waitForLoadState("networkidle")
  await expect.poll(() => page.evaluate(() => {
    const values = Array.from({ length: window.localStorage.length }, (_, index) => {
      const key = window.localStorage.key(index)
      return key === null ? "" : window.localStorage.getItem(key) ?? ""
    })
    return values.join("\n")
  })).not.toContain(secret)
  const exportNetworkRequests: string[] = []
  const downloads: string[] = []
  page.on("request", (request) => {
    const isDataRequest = ["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())
      || request.method() !== "GET"
    const isRemoteRequest = new URL(request.url()).origin !== new URL(page.url()).origin
    if (isDataRequest || isRemoteRequest) exportNetworkRequests.push(request.url())
  })
  page.on("download", (download) => downloads.push(download.suggestedFilename()))

  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: /\uBA54\uBAA8 \uD3EC\uD568 \uD30C\uC77C \uB0B4\uBCF4\uB0B4\uAE30/u }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("button", { name: "\uCDE8\uC18C" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(downloads).toEqual([])

  await page.getByRole("button", { name: /\uBA54\uBAA8 \uD3EC\uD568 \uD30C\uC77C \uB0B4\uBCF4\uB0B4\uAE30/u }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "\uD30C\uC77C \uB9CC\uB4E4\uAE30" }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toContain("full-backup")
  const path = await download.path()
  if (path === null) throw new Error("The full export did not create a readable download.")
  await expect(readFile(path, "utf8")).resolves.toContain(secret)
  expect(exportNetworkRequests).toEqual([])
})
