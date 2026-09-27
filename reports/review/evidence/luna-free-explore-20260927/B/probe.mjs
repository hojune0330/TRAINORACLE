import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "..", "..", "..", "..", "..")
const appDir = join(repo, "app")
const require = createRequire(join(appDir, "package.json"))
const viteModule = await import(pathToFileURL(join(appDir, "node_modules/vite/dist/node/index.js")))
const reactModule = await import(pathToFileURL(join(appDir, "node_modules/@vitejs/plugin-react/dist/index.js")))
const playwright = await import(pathToFileURL(join(appDir, "node_modules/@playwright/test/index.mjs")))
const { createServer } = viteModule
const react = reactModule.default
const { chromium } = playwright

const server = await createServer({
  configFile: false,
  root: appDir,
  envDir: here,
  cacheDir: join(here, "vite-cache"),
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@impl": join(repo, "impl/src") } },
  server: { host: "127.0.0.1", port: 4209, strictPort: true, fs: { allow: [repo] }, hmr: { host: "127.0.0.1" } },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: "block" })
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.origin === "http://127.0.0.1:4209" ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  await page.goto("http://127.0.0.1:4209/?app=1", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(here, "probe-home.png"), fullPage: false })
  const state = await page.evaluate(() => ({
    title: document.title,
    headings: [...document.querySelectorAll("h1,h2,h3")].map(el => el.textContent?.trim()).filter(Boolean),
    buttons: [...document.querySelectorAll("button")].filter(el => el.getClientRects().length).map(el => ({ text: el.innerText.trim(), label: el.getAttribute("aria-label"), disabled: el.disabled })),
    bodyText: document.body.innerText.slice(0, 1800),
  }))
  console.log(JSON.stringify({ state, blockedExternal: "route guard installed" }, null, 2))
  await context.close()
} finally {
  await browser?.close()
  await server.close()
}
