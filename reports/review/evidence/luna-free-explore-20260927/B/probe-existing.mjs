import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "..", "..", "..", "..", "..")
const appDir = join(repo, "app")
const { chromium } = await import(pathToFileURL(join(appDir, "node_modules/@playwright/test/index.mjs")))
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: "block" })
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.origin === "http://127.0.0.1:4209" ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  await page.goto("http://127.0.0.1:4209/?app=1", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: join(here, "probe-home.png"), fullPage: false })
  console.log(JSON.stringify(await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    headings: [...document.querySelectorAll("h1,h2,h3")].map(el => el.textContent?.trim()).filter(Boolean),
    buttons: [...document.querySelectorAll("button")].filter(el => el.getClientRects().length).map(el => ({ text: el.innerText.trim(), label: el.getAttribute("aria-label"), disabled: el.disabled })),
    bodyText: document.body.innerText.slice(0, 2200),
  })), null, 2))
  await context.close()
} finally {
  await browser.close()
}
