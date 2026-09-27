import { chromium } from "../../../../app/node_modules/@playwright/test/index.mjs"
import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: "block" })
await context.route("**/*", route => {
  const request = route.request()
  return new URL(request.url()).origin === "http://127.0.0.1:4209" && ["GET", "HEAD"].includes(request.method())
    ? route.continue() : route.abort()
})
const page = await context.newPage()
const dialogs = []
page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.dismiss() })
try {
  await page.goto("http://127.0.0.1:4209/?app=1&uitest=1")
  await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
  await page.getByRole("button", { name: "가볍게 움직였어요", exact: true }).click()
  await page.getByRole("button", { name: "오전", exact: true }).click()
  await page.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요", exact: true }).click()
  await page.getByRole("button", { name: "없어요", exact: true }).click()
  await page.getByRole("button", { name: "글 추가", exact: true }).click()
  await page.getByLabel("나만의 메모", { exact: true }).check()
  await page.getByLabel("일지 내용", { exact: true }).fill("SYNTHETIC UNSAVED INPUT")
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
  const afterExit = await page.locator("body").innerText()
  await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
  const afterReopen = await page.locator("body").innerText()
  await writeFile(new URL("unsaved-exit.json", import.meta.url), JSON.stringify({
    syntheticOnly: true, build: "app/dist", finalSaveWasNotClicked: true, dialogs,
    afterExit, afterReopen, journalPersisted: await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1") !== null),
  }, null, 2))
  await page.screenshot({ path: fileURLToPath(new URL("unsaved-exit.png", import.meta.url)), fullPage: true })
} finally { await context.close(); await browser.close() }
