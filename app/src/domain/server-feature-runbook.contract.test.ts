import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const runbookPath = join(process.cwd(), "..", "reports", "operations", "BETA_FEATURE_INCIDENT_LOG.md")

const serverFeatures = [
  "ACCOUNT",
  "SYNC",
  "SHARING",
  "PLAN_PROPOSALS",
  "PRODUCT_ANALYTICS",
  "FEEDBACK_BOARD",
] as const

function assertRunbookCoversEveryServerFeature(runbook: string): void {
  for (const feature of serverFeatures) {
    if (!runbook.includes(`| \`${feature}\` |`)) {
      throw new Error(`missing server feature runbook row: ${feature}`)
    }
    if (!runbook.includes(`TRAINORACLE_KILL_${feature}=true`)) {
      throw new Error(`missing GitHub kill switch: ${feature}`)
    }
    if (!runbook.includes(`VITE_KILL_${feature}=true`)) {
      throw new Error(`missing app kill switch: ${feature}`)
    }
  }
}

describe("server feature incident runbook", () => {
  it("covers every server-backed product feature and both kill switches", () => {
    const runbook = readFileSync(runbookPath, "utf8")

    expect(() => assertRunbookCoversEveryServerFeature(runbook)).not.toThrow()
  })

  it("fails closed when a feature row is removed", () => {
    const runbook = readFileSync(runbookPath, "utf8")
    const mutated = runbook.replace("| `FEEDBACK_BOARD` |", "| `MISSING_FEATURE` |")

    expect(mutated).not.toBe(runbook)
    expect(() => assertRunbookCoversEveryServerFeature(mutated)).toThrow(
      "missing server feature runbook row: FEEDBACK_BOARD",
    )
  })
})
