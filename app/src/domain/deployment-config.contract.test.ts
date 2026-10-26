import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

const workflow = readFileSync(
  join(process.cwd(), "..", ".github", "workflows", "ci.yml"),
  "utf8",
)
const exampleEnvironment = readFileSync(join(process.cwd(), ".env.example"), "utf8")
const preservingBuilder = readFileSync(join(process.cwd(), "..", ".tools", "build-oracle-pages-release.mjs"), "utf8")
const publicConfiguration = readFileSync(join(process.cwd(), "..", ".tools", "oracle-public-release-config.mjs"), "utf8")

const requiredFeatureVariables = [
  "ACCOUNT_PUBLIC_ENABLED",
  "FEATURE_SYNC",
  "FEATURE_SHARING",
  "FEATURE_PLAN_PROPOSALS",
  "FEATURE_PLAN_BACKUP",
  "FEATURE_PUBLIC_PROFILE",
  "FEATURE_EXPERIMENTAL_FATIGUE",
  "FEATURE_DECORATION_SHOP",
  "FEATURE_PRODUCT_ANALYTICS",
  "FEATURE_FEEDBACK_BOARD",
] as const

const requiredKillVariables = [
  "KILL_ACCOUNT",
  "KILL_SYNC",
  "KILL_SHARING",
  "KILL_PLAN_PROPOSALS",
  "KILL_PLAN_BACKUP",
  "KILL_PUBLIC_PROFILE",
  "KILL_EXPERIMENTAL_FATIGUE",
  "KILL_DECORATION_SHOP",
  "KILL_PRODUCT_ANALYTICS",
  "KILL_FEEDBACK_BOARD",
] as const

describe("hosted beta feature controls", () => {
  it("allows an operator to request a fresh guarded deployment", () => {
    expect(workflow).toMatch(/on:\s*[\s\S]*?workflow_dispatch:/u)
    const condition = parse(workflow).jobs["deploy-pages"].if
    expect(condition).toContain("(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'")
    expect(condition).toContain("needs.delivery-complete.result == 'success'")
    expect(condition).toContain("(needs.delivery-scope.outputs.full == 'true' || needs.delivery-scope.outputs.reused == 'true')")
    expect(condition).toContain("!contains(github.event.head_commit.message, '[manual-pages]')")
  })

  it("preserves published switches while keeping the shared-origin account held", () => {
    expect(workflow).toContain("node .tools/build-oracle-pages-release.mjs --account-held")
    expect(preservingBuilder).toContain("origin/gh-pages:index.html")
    expect(preservingBuilder).toContain("PUBLIC_CONFIGURATION_AMBIGUOUS")
    expect(preservingBuilder).toContain("if (accountHeld) configuration = holdSharedOriginAccount(configuration)")
    expect(publicConfiguration).toContain("VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true'")
    expect(preservingBuilder).toContain("if (!accountHeld) throw Error('CANONICAL_ACCOUNT_HOLD_REQUIRED')")
  })

  it("validates the published configuration before building and ignores ambient secret files", () => {
    const clearAmbient = preservingBuilder.indexOf("if (name.startsWith('VITE_')) delete process.env[name]")
    const inject = preservingBuilder.indexOf("Object.assign(process.env, configuration)")
    const releaseCheck = preservingBuilder.indexOf("validateHostedReleaseEnvironment(configuration)")
    const reject = preservingBuilder.indexOf("if (issues.length) throw Error")
    const build = preservingBuilder.indexOf("await build({ root: app, envFile: false")
    expect(clearAmbient).toBeGreaterThan(-1)
    expect(inject).toBeGreaterThan(clearAmbient)
    expect(releaseCheck).toBeGreaterThan(inject)
    expect(reject).toBeGreaterThan(releaseCheck)
    expect(build).toBeGreaterThan(reject)
  })

  it("documents every switch without putting credentials in source control", () => {
    for (const suffix of [...requiredFeatureVariables, ...requiredKillVariables]) {
      expect(exampleEnvironment).toContain(`VITE_${suffix}=`)
    }
    expect(exampleEnvironment).toContain("VITE_SUPABASE_URL=")
    expect(exampleEnvironment).toContain("VITE_SUPABASE_ANON_KEY=")
    expect(exampleEnvironment).not.toContain("service_role")
  })
})
