import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.platform === "win32" && process.env.LOCALAPPDATA) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = `${process.env.LOCALAPPDATA}/ms-playwright`
}
const { chromium, expect } = await import("@playwright/test")

// Real app entry, synthetic public configuration, fresh signed-out contexts.
// Browser network is restricted to this loopback server; no credentials or auth submissions.
const output = fileURLToPath(new URL("../../../auth-improvement-preparation-20261114/browser-smoke/", import.meta.url))
const syntheticEnv = {
  MODE: "test", DEV: true, PROD: false, BASE_URL: "/",
  VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_SUPABASE_URL: "https://auth-smoke.invalid",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_synthetic_auth_smoke_000000000",
  VITE_GOOGLE_AUTH_ENABLED: "true", VITE_PASSWORD_AUTH_ENABLED: "true",
  VITE_PASSWORD_AUTH_OPERATIONS_APPROVED: "true",
  VITE_PRIVACY_POLICY_URL: "https://legal-smoke.invalid/privacy", VITE_PRIVACY_POLICY_VERSION: "2026-11-04",
  VITE_TERMS_OF_SERVICE_URL: "https://legal-smoke.invalid/terms", VITE_TERMS_OF_SERVICE_VERSION: "2026-11-04",
}
// Vite injects the whole import.meta.env object separately in development.
// Supply the synthetic values through its normal environment resolution too.
for (const key of Object.keys(process.env)) if (key.startsWith("VITE_")) delete process.env[key]
for (const [key, value] of Object.entries(syntheticEnv)) if (key.startsWith("VITE_")) process.env[key] = value
const server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)),
  envFile: false, envDir: false, define: { "import.meta.env": JSON.stringify(syntheticEnv) },
  optimizeDeps: { entries: ["index.html"] },
  server: { host: "127.0.0.1", port: 4397, strictPort: true }, logLevel: "error" })
let browser
const results = []
try {
  await server.listen()
  const origin = "http://127.0.0.1:4397"
  browser = await chromium.launch({ headless: true })
  await mkdir(output, { recursive: true })
  for (const width of [320, 375, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" })
    const external = [], errors = []
    await context.route("**/*", route => {
      const url = new URL(route.request().url())
      if (url.origin === origin) return route.continue()
      external.push(url.origin + url.pathname)
      return route.abort()
    })
    const page = await context.newPage()
    page.on("pageerror", error => errors.push(error.message))
    await page.goto(origin, { waitUntil: "domcontentloaded" })
    const homeLogin = page.getByRole("button", { name: "로그인", exact: true })
    const homeSignup = page.getByRole("button", { name: "회원가입", exact: true })
    await expect(homeLogin).toBeVisible()
    await expect(homeSignup).toBeVisible()
    const loginBounds = await homeLogin.boundingBox(), signupBounds = await homeSignup.boundingBox()
    assert(loginBounds.width < width / 2 && signupBounds.width < width / 2, "home account actions remain compact")
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `home horizontal overflow at ${width}`)
    await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true })
    await homeSignup.click()
    await expect(page.getByRole("heading", { name: "회원가입", exact: true })).toBeVisible()
    await expect(page.getByLabel("이메일", { exact: true })).toBeVisible()
    await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Google로 회원가입", exact: true })).toBeVisible()
    await expect(page.getByLabel("생년월일", { exact: true })).toHaveCount(0)
    for (const mode of ["signup", "login"]) {
      if (mode === "login") {
        await page.getByRole("button", { name: "로그인", exact: true }).click()
        await expect(page.getByRole("heading", { name: "로그인", exact: true })).toBeVisible()
        await expect(page.getByRole("button", { name: "Google로 로그인", exact: true })).toBeVisible()
      }
      await expect(page.getByRole("button", { name: /계정 삭제|내 자료 관리|내보내기/ })).toHaveCount(0)
      await expect(page.getByRole("heading", { name: /AI|코칭|인공지능/ })).toHaveCount(0)
      await expect(page.locator(".account-password")).toBeVisible()
      // The content-scroll hook settles after 220ms. Check the final viewport,
      // not merely DOM visibility before a delayed alignment clips the header.
      await page.waitForTimeout(350)
      const title = page.getByRole("heading", { name: mode === "signup" ? "회원가입" : "로그인", exact: true })
      await expect(title).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeInViewport({ ratio: 1 })
      const overflow = await page.evaluate(() => [...document.querySelectorAll("html, body, .app-scroll-region")]
        .some(element => element.scrollWidth > element.clientWidth + 1))
      assert.equal(overflow, false, `${mode} horizontal overflow at ${width}`)
      await page.screenshot({ path: `${output}/${mode}-${width}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [], `page errors at ${width}`)
    results.push({ width, states: ["home", "signup", "login"], externalBlocked: external })
    await context.close()
  }
  await writeFile(`${output}/result.json`, JSON.stringify({ simulation: "local Chromium viewports; no real account or iPhone verification", results }, null, 2))
  console.log(JSON.stringify({ passed: true, output, results }))
} finally {
  await browser?.close()
  await server.close()
}
