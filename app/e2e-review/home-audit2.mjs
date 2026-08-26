import { chromium } from "@playwright/test"
const BASE = "http://localhost:4173/"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } })
const page = await ctx.newPage()
await page.goto(BASE)
await page.waitForTimeout(800)
// find scrollable container
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter((el) => el.scrollHeight > el.clientHeight + 50)
  return els.map((el) => ({ tag: el.tagName, cls: el.className?.toString().slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight }))
})
console.log(JSON.stringify(info, null, 1))
const steps = 6
for (let i = 1; i <= steps; i++) {
  await page.evaluate(({ i, steps }) => {
    const el = [...document.querySelectorAll("*")].find((el) => el.scrollHeight > el.clientHeight + 50 && el.tagName !== "HTML" && el.tagName !== "BODY") ?? document.scrollingElement
    el.scrollTop = (el.scrollHeight - el.clientHeight) * i / steps
  }, { i, steps })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e-review/home-audit/01-empty-scroll-${i}.png` })
}
await browser.close()
console.log("DONE")
