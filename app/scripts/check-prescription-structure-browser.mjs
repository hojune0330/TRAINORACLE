import { build, preview } from "vite"
import { chromium } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"

const root = fileURLToPath(new URL("../", import.meta.url))
const output = resolve(root, "test-results/prescription-structure-v3")
await mkdir(output, { recursive: true })
console.log("Preparing isolated component browser check")
const outDir = resolve(output, "build")
const config = { configFile: false, envDir: resolve(root, "e2e/fixtures"), root, base: "./",
  resolve: { alias: { "@impl": resolve(root, "../impl/src") } },
  esbuild: { jsx: "automatic" },
  build: { outDir, emptyOutDir: false, copyPublicDir: false,
    rollupOptions: { input: resolve(root, "e2e/fixtures/prescription-structure-v3.html") } },
}
await build(config)
const server = await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } })
let browser
try {
  console.log("Local fixture server started")
  const address = server.httpServer.address()
  browser = await chromium.launch({ channel: "chrome", headless: true })
  console.log("Browser started")
  const results = []
  for (const width of [320, 375, 1440]) {
    for (const enlarged of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: "reduce" })
      console.log(`Page created: ${width}, enlarged=${enlarged}`)
      const errors = []
      page.on("pageerror", error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${address.port}/e2e/fixtures/prescription-structure-v3.html`)
      console.log("Fixture loaded")
      await page.getByLabel("계획된 전체 시간").waitFor()
      const enlargeText = async () => page.evaluate(() => {
        for (const element of document.querySelectorAll("body *")) {
          element.style.removeProperty("font-size")
          element.style.removeProperty("line-height")
        }
        const sizes = [...document.querySelectorAll("body *")].map(element => ({ element,
          size: parseFloat(getComputedStyle(element).fontSize), line: getComputedStyle(element).lineHeight }))
        for (const { element, size, line } of sizes) {
          element.style.setProperty("font-size", `${size * 2}px`, "important")
          if (line !== "normal") element.style.setProperty("line-height", `${parseFloat(line) * 2}px`, "important")
        }
      })
      if (enlarged) await enlargeText()
      assert.match(await page.getByLabel("계획된 전체 시간").textContent(), /49분 20초/)
      assert.match(await page.getByLabel("변경 전 시간과 비교").textContent(), /9분 20초 길어요/)
      const select = page.getByLabel("검토 구성")
      await select.focus()
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("Enter")
      await page.getByText(/50분 20초/).waitFor()
      await select.selectOption("P-GLY-S")
      await page.getByText(/전체 시간 미산출/).waitFor()
      assert.match(await page.getByLabel("변경 전 시간과 비교").textContent(), /비교할 수 없어요/)
      if (enlarged) await enlargeText()
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
      assert.ok(dimensions.scrollWidth <= dimensions.width + 1, JSON.stringify({ width, enlarged, dimensions }))
      assert.deepEqual(errors, [])
      await page.screenshot({ path: resolve(output, `${width}-${enlarged ? 'large' : 'normal'}.png`), fullPage: true })
      results.push({ width, enlarged, errors: errors.length, ...dimensions })
      await page.close()
    }
  }
  await writeFile(resolve(output, "results.json"), JSON.stringify({ scope: "ISOLATED_REAL_COMPONENT_NOT_FULL_APP", results }, null, 2))
  console.log(JSON.stringify(results))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.httpServer.closeAllConnections()
  await new Promise((resolveClose, reject) => server.httpServer.close(error => error ? reject(error) : resolveClose()))
}
