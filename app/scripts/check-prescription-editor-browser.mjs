import { build, preview } from "vite"
import { chromium } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"

const root = fileURLToPath(new URL("../", import.meta.url))
const output = resolve(root, "test-results/prescription-editor-v3")
await mkdir(output, { recursive: true })
const config = { configFile: false, envDir: resolve(root, "e2e/fixtures"), root, base: "./",
  resolve: { alias: { "@impl": resolve(root, "../impl/src") } }, esbuild: { jsx: "automatic" },
  build: { outDir: resolve(output, "build"), emptyOutDir: false, copyPublicDir: false,
    rollupOptions: { input: resolve(root, "e2e/fixtures/prescription-editor-v3.html") } } }
await build(config)
const server = await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } })
let browser
try {
  browser = await chromium.launch({ channel: "chrome", headless: true })
  const results = [], address = server.httpServer.address()
  for (const width of [320, 375, 1440]) for (const enlarged of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 667 }, reducedMotion: "reduce" })
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${address.port}/e2e/fixtures/prescription-editor-v3.html`)
    await page.getByRole("button", { name: "편집기 열기" }).click()
    await page.getByRole("dialog", { name: "훈련 구성 조정" }).waitFor()
    const enlargeText = () => page.evaluate(() => {
      for (const element of document.querySelectorAll("dialog *")) {
        element.style.removeProperty("font-size")
        element.style.removeProperty("line-height")
      }
      const sizes = [...document.querySelectorAll("dialog *")].map(element => ({ element,
        size: parseFloat(getComputedStyle(element).fontSize), line: getComputedStyle(element).lineHeight }))
      for (const { element, size, line } of sizes) {
        element.style.setProperty("font-size", `${size * 2}px`, "important")
        if (line !== "normal") element.style.setProperty("line-height", `${parseFloat(line) * 2}px`, "important")
      }
    })
    if (enlarged) await enlargeText()
    assert.equal(await page.getByRole("radio", { name: "시험용 세트 구성" }).count(), 0)
    await page.getByRole("button", { name: "다른 검토된 구성 보기" }).click()
    const choice = page.getByRole("radio", { name: "시험용 세트 구성" })
    await choice.focus()
    await page.keyboard.press("Space")
    await page.getByRole("button", { name: "기본 선택지만 보기" }).click()
    assert.equal(await choice.isChecked(), true)
    if (enlarged) await enlargeText()
    const dimensions = await page.getByRole("dialog").evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }))
    assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify({ width, enlarged, dimensions }))
    const contentDimensions = await page.locator(".prescription-adjustment__content").evaluate(element =>
      ({ client: element.clientWidth, scroll: element.scrollWidth }))
    assert.ok(contentDimensions.scroll <= contentDimensions.client + 1, JSON.stringify({ width, enlarged, contentDimensions }))
    await page.locator(".prescription-adjustment__content").evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: resolve(output, `${width}-${enlarged ? "large" : "normal"}.png`) })
    const applyBounds = await page.getByRole("button", { name: "변경안 적용" }).boundingBox()
    assert.ok(applyBounds && applyBounds.y >= 0 && applyBounds.y + applyBounds.height <= 668 && applyBounds.height >= 44)
    await page.getByRole("button", { name: "변경안 적용" }).click()
    assert.equal(await page.getByRole("status").textContent(), "적용: C2")
    assert.equal(await page.getByRole("dialog").count(), 0)
    assert.deepEqual(errors, [])
    results.push({ width, enlarged, errors: errors.length, ...dimensions, contentDimensions, applyBounds, applied: "C2" })
    await page.close()
  }
  await writeFile(resolve(output, "results.json"), JSON.stringify({ scope: "ISOLATED_EDITOR_SYNTHETIC_AUTHORITY_NOT_DEPLOYMENT", results }, null, 2))
  console.log(JSON.stringify(results))
} finally {
  await browser?.close()
  server.httpServer.closeAllConnections()
  await new Promise((resolveClose, reject) => server.httpServer.close(error => error ? reject(error) : resolveClose()))
}
