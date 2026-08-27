// 로그인 발견성 실화면 검증 (2026-08-27)
// 1) 신규 사용자(환영 홈): 헤더에 "로그인" 버튼 노출 확인 + 스크린샷
// 2) 버튼 클릭 → 계정 화면(로그인 또는 가입) 진입 확인 + 스크린샷
// 3) 일지 있는 사용자(일지 홈)에서도 동일 노출 확인
import { chromium } from "playwright"

const base = "http://127.0.0.1:4173/"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 667 } })

// 1) 신규 사용자 환영 홈
await page.goto(base)
await page.waitForSelector(".training-home__header")
const loginBtn = page.getByRole("button", { name: "로그인 또는 가입" })
console.log("welcome-home login button visible:", await loginBtn.isVisible())
console.log("login button text:", (await loginBtn.textContent())?.trim())
await page.screenshot({ path: "e2e-review/garden/21-login-entry-welcome.png" })

// 2) 클릭 → 계정 화면
await loginBtn.click()
await page.waitForSelector("h1")
const h1 = await page.locator("h1").first().textContent()
console.log("account screen h1:", h1?.trim())
const google = await page.getByRole("button", { name: /Google로 계속하기/ }).isVisible().catch(() => false)
const email = await page.getByRole("button", { name: /이메일로 계속하기/ }).isVisible().catch(() => false)
const localBtn = await page.getByRole("button", { name: /계정 없이 계속 사용/ }).isVisible().catch(() => false)
console.log("gateway buttons — google:", google, "email:", email, "local:", localBtn)
await page.screenshot({ path: "e2e-review/garden/22-login-entry-account.png" })

// 뒤로 → 홈 복귀 확인
await page.getByRole("button", { name: "뒤로" }).click()
await page.waitForSelector(".training-home__header")
console.log("back to home OK")

// 3) 일지 있는 사용자 (JOURNAL 모드)
await page.evaluate(() => {
  const entry = {
    id: "test-1", date: new Date().toISOString().slice(0, 10),
    kind: "post-session", memo: "테스트", createdAtMs: Date.now(),
  }
  localStorage.setItem("trainoracle.journal.v1", JSON.stringify({ version: 1, entries: [entry] }))
})
await page.reload()
await page.waitForSelector(".training-home__header")
const loginBtn2 = page.getByRole("button", { name: "로그인 또는 가입" })
console.log("journal-home login button visible:", await loginBtn2.isVisible().catch(() => false))
await page.screenshot({ path: "e2e-review/garden/23-login-entry-journal-home.png" })

await browser.close()
console.log("DONE")
