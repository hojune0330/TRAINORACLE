import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const workflow = readFileSync(
  join(process.cwd(), "..", ".github", "workflows", "ci.yml"),
  "utf8",
)
const exampleEnvironment = readFileSync(join(process.cwd(), ".env.example"), "utf8")
const releaseBuilder = readFileSync(join(process.cwd(), "..", ".tools", "build-oracle-pages-release.mjs"), "utf8")

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
  it("allows a fresh deployment after an operator changes feature switches", () => {
    expect(workflow).toMatch(/on:\s*[\s\S]*?workflow_dispatch:/u)
    expect(workflow).toContain(
      "if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'",
    )
  })

  it("preserves published release switches and enforces the shared-origin account hold", () => {
    expect(workflow).toContain("node .tools/build-oracle-pages-release.mjs --account-held")
    expect(releaseBuilder).toContain("publishedModuleNames(git('show', 'origin/gh-pages:index.html'))")
    expect(releaseBuilder).toContain("if (accountHeld) configuration = holdSharedOriginAccount(configuration)")
    expect(releaseBuilder).toContain("if (name.startsWith('VITE_')) delete process.env[name]")
    expect(releaseBuilder).toContain("Object.assign(process.env, configuration)")
    expect(releaseBuilder).toContain("envFile: false")
    expect(releaseBuilder).toContain("CANONICAL_ACCOUNT_HOLD_REQUIRED")
  })

  it("validates the reconstructed public configuration before building Pages", () => {
    const deploy = workflow.slice(workflow.indexOf("  deploy-pages:"))
    expect(deploy.indexOf("npm ci")).toBeGreaterThan(-1)
    expect(deploy.indexOf("node .tools/build-oracle-pages-release.mjs")).toBeGreaterThan(deploy.indexOf("npm ci"))
    const releaseCheck = releaseBuilder.indexOf("validateHostedReleaseEnvironment(configuration)")
    expect(releaseCheck).toBeGreaterThan(releaseBuilder.indexOf("Object.assign(process.env, configuration)"))
    expect(releaseBuilder.indexOf("PUBLIC_CONFIGURATION_REJECTED")).toBeGreaterThan(releaseCheck)
    expect(releaseBuilder.indexOf("await build(")).toBeGreaterThan(releaseCheck)
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
