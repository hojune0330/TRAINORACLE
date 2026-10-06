import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const out = path.resolve(app, "../reports/review/evidence/workout-memo-20261006")
const base = process.env.MEMO_QA_URL ?? "http://127.0.0.1:4466"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
const failures = []
page.on("pageerror", error => failures.push(error.message))
const cases = []
try {
  await page.goto(`${base}/e2e/fixtures/workout-memo.html`)
  await page.setViewportSize({ width: 320, height: 900 })
  if (!await page.getByRole("button", { name: "자세히", exact: true }).isVisible()
    || !await page.getByRole("button", { name: "간단히", exact: true }).isVisible()) throw Error("Memo choices are hidden at entry")
  if (await page.locator(".workout-memo-paper").count()) throw Error("Expected choice before opening a memo")
  await page.screenshot({ path: path.join(out, "memo-entry-320.png"), fullPage: true })
  await page.getByRole("button", { name: "간단히", exact: true }).click()
  if (await page.locator(".workout-memo-paper").first().getAttribute("data-layout") !== "compact") throw Error("One-tap compact entry failed")
  await page.evaluate(() => document.fonts.ready)
  const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })))
  if (!fonts.some(font => font.family.includes("Pretendard") && font.status === "loaded")) throw Error("Expected self-hosted Pretendard")
  for (const layout of ["full", "compact"]) {
    await page.getByRole("button", { name: layout === "full" ? "자세히" : "간단히", exact: true }).click()
    for (const width of [320, 375, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    for (const paper of ["노랑 종이", "분홍 종이", "흰 종이"]) {
      await page.getByRole("button", { name: paper }).click()
      await page.screenshot({ path: path.join(out, `memo-${width}-${paper.startsWith("노랑") ? "yellow" : paper.startsWith("분홍") ? "pink" : "white"}${layout === "compact" ? "-compact" : ""}.png`), fullPage: true })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      if (overflow) throw Error(`Horizontal overflow: ${width}/${paper}`)
      const height = await page.locator(".workout-memo-paper").first().evaluate(element => element.getBoundingClientRect().height)
      cases.push({ width, paper, layout, height, horizontalOverflow: overflow })
    }
    }
  }
  const fullHeight = cases.find(item => item.layout === "full" && item.width === 375 && item.paper === "노랑 종이").height
  const compactHeight = cases.find(item => item.layout === "compact" && item.width === 375 && item.paper === "노랑 종이").height
  if (compactHeight >= fullHeight) throw Error("Compact did not reduce memo height")
  await page.setViewportSize({ width: 320, height: 900 })
  await page.evaluate(() => {
    for (const [token, value] of Object.entries({ "--fs-body": "29px", "--fs-caption": "24px", "--fs-h3": "36px", "--fs-app-title": "48px", "--fs-body-sm": "26px" })) document.documentElement.style.setProperty(token, value)
  })
  for (const layout of ["full", "compact"]) {
    await page.getByRole("button", { name: layout === "full" ? "자세히" : "간단히", exact: true }).click()
    await page.screenshot({ path: path.join(out, `memo-320-text-200${layout === "compact" ? "-compact" : ""}.png`), fullPage: true })
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw Error(`200% text overflow: ${layout}`)
  }
  await page.evaluate(() => document.documentElement.removeAttribute("style"))
  await page.emulateMedia({ reducedMotion: "reduce" })
  const reducedAnimation = await page.locator(".workout-memo-tool__body").first().evaluate(element => getComputedStyle(element).animationName)
  if (reducedAnimation !== "none") throw Error("Reduced motion not respected")
  await page.getByRole("button", { name: "노랑 종이" }).click()
  await page.getByRole("button", { name: "자세히", exact: true }).click()
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "저장", exact: true }).click()
  const download = await downloading
  const pngPath = path.join(out, "exported-workout-memo-yellow.png")
  await download.saveAs(pngPath)
  const encoded = (await readFile(pngPath)).toString("base64")
  const pixels = await page.evaluate(async encoded => {
    const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode()
    const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data
    let dark = 0
    for (let i = 0; i < data.length; i += 4) if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++
    return { width: img.width, height: img.height, darkPixels: dark, firstPixel: Array.from(data.slice(0, 4)) }
  }, encoded)
  if (pixels.width !== 1080 || pixels.darkPixels < 1000 || pixels.firstPixel[3] !== 255) throw Error("PNG is blank or invalid")
  await page.getByRole("button", { name: "간단히", exact: true }).click()
  const compactDownloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "저장", exact: true }).click()
  await (await compactDownloading).saveAs(path.join(out, "exported-workout-memo-yellow-compact.png"))
  // Optional mode switch is keyboard-operable and keeps the same prescription.
  await page.getByRole("button", { name: "자세히", exact: true }).focus()
  await page.keyboard.press("Space")
  if (await page.getByRole("button", { name: "자세히", exact: true }).getAttribute("aria-pressed") !== "true") throw Error("Layout keyboard switch failed")
  const copied = []
  await page.evaluate(() => { window.memoCopies = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => window.memoCopies.push(text) } }) })
  await page.getByRole("button", { name: "복사", exact: true }).click()
  copied.push(...await page.evaluate(() => window.memoCopies))
  if (!copied[0]?.includes("반복 사이: 2분 조깅") || !copied[0]?.includes("가속 달리기 (전력질주 아님)") || copied[0]?.includes("SYNTHETIC_NOT_AN_ACCOUNT")) throw Error("Wrong/private memo copy")
  // The disclosure does not change history; Back from its parent must still close just the reader.
  await page.getByRole("button", { name: "훈련 방법과 이유" }).click()
  await page.getByRole("dialog").waitFor({ state: "visible" })
  const historyLength = await page.evaluate(() => history.length)
  await page.getByRole("dialog").getByRole("button", { name: "간단히", exact: true }).click()
  if (historyLength !== await page.evaluate(() => history.length)) throw Error("Memo added a nested navigation entry")
  await page.goBack()
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  const appPage = await context.newPage()
  appPage.on("pageerror", error => failures.push(error.message))
  await appPage.goto(`${base}/?app=1&oracleV2=1`)
  await appPage.getByRole("button", { name: "더보기", exact: true }).click()
  await appPage.getByRole("heading", { name: "더보기", exact: true }).waitFor()
  await appPage.getByRole("button", { name: "페이스 계산", exact: true }).click()
  await appPage.getByRole("heading", { name: "어떤 종목의 기록인가요?" }).waitFor()
  await appPage.goBack()
  await appPage.getByRole("heading", { name: "더보기", exact: true }).waitFor()
  await appPage.close()
  if (failures.length) throw Error(failures.join("\n"))
  await writeFile(path.join(out, "browser-result.json"), JSON.stringify({ directOneTapEntry: "pass (both choices visible before opening)", cases, fonts, text200Percent: "pass (both layouts)", reducedMotion: reducedAnimation, pixels, compactHeight: { full: fullHeight, compact: compactHeight }, keyboardLayout: "pass", copy: "pass", readerBack: "pass", moreCalculatorBack: "pass", pageErrors: failures, scope: "synthetic local component, native reader and real app More navigation; not production/account persistence" }, null, 2))
  console.log(JSON.stringify({ status: "pass", cases: cases.length, pixels, out }))
} finally { await context.close(); await browser.close() }
