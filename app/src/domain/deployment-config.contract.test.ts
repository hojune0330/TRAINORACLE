import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const workflow = readFileSync(
  join(process.cwd(), "..", ".github", "workflows", "ci.yml"),
  "utf8",
)
const exampleEnvironment = readFileSync(join(process.cwd(), ".env.example"), "utf8")

const requiredFeatureVariables = [
  "ACCOUNT_PUBLIC_ENABLED",
  "FEATURE_SYNC",
  "FEATURE_SHARING",
  "FEATURE_PLAN_PROPOSALS",
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

  it("passes every release switch into the hosted build", () => {
    for (const suffix of [...requiredFeatureVariables, ...requiredKillVariables]) {
      expect(workflow).toContain(`VITE_${suffix}: \${{ vars.TRAINORACLE_${suffix} }}`)
    }
  })

  it("checks hosted release settings after secrets are available and before building Pages", () => {
    const hostedBuild = workflow.slice(
      workflow.indexOf("- name: Build hosted app"),
      workflow.indexOf("- name: Publish verified build to gh-pages"),
    )

    const install = hostedBuild.indexOf("npm ci")
    const releaseCheck = hostedBuild.indexOf("node scripts/validate-hosted-release-env.mjs")
    const build = hostedBuild.indexOf("npm run build")

    expect(install).toBeGreaterThan(-1)
    expect(releaseCheck).toBeGreaterThan(install)
    expect(build).toBeGreaterThan(releaseCheck)
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
