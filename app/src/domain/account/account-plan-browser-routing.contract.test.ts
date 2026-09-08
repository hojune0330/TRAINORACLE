import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import preview from "../../../playwright.config"
import account from "../../../playwright.account-plan-service.config"
import mobile from "../../../playwright.account-plan-service-mobile.config"

it.each([
  ["account-plan-service.spec.ts", account],
  ["account-plan-collection-preparation.spec.ts", account],
  ["account-plan-lock.spec.ts", account],
  ["account-plan-service-mobile.spec.ts", mobile],
])("%s runs in its Vite fixture runner, not the built-preview suite", (file, runner) => {
  expect(preview.testIgnore).toContain(`**/${file}`)
  expect([runner.testMatch].flat()).toContain(file)
  expect(runner.globalSetup).toBeTruthy()
})

it("CI runs both dedicated account runners after the normal browser suite", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"))
  const script = pkg.scripts["test:e2e:account-plan-service"]
  expect(script).toContain("--config playwright.account-plan-service.config.ts")
  expect(script).toContain("&& playwright test --config playwright.account-plan-service-mobile.config.ts")
  const workflow = readFileSync("../.github/workflows/ci.yml", "utf8")
  expect(workflow).toContain("npm run test:e2e:account-plan-service")
})
