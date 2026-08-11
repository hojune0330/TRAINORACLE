import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const app = readFileSync("src/App.tsx", "utf8")
const appShell = readFileSync("src/AppShell.tsx", "utf8")
const deferredScreens = readFileSync("src/DeferredMobileScreens.ts", "utf8")

const deferredShellScreens = [
  "LogDetail",
  "JournalArchive",
  "JournalDayReader",
  "Trends",
  "Guide",
  "PlanBeta",
  "PlanProposalInbox",
  "AthleteRecords",
  "Account",
  "ImportActivities",
  "RestoreBackup",
  "More",
]

describe("mobile startup loading boundary", () => {
  it("keeps the desktop workspace out of the mobile entry module", () => {
    expect(app).not.toMatch(/from "\.\/screens\//u)
    expect(app).toContain('React.lazy(() => import("./DesktopWorkspace"))')
  })

  it("defers every non-home mobile screen until the athlete opens it", () => {
    for (const screen of deferredShellScreens) {
      expect(appShell).not.toContain(`import { ${screen} }`)
      expect(deferredScreens).toContain(`${screen}: React.lazy(`)
    }
  })

  it("keeps the offline record composer in the initial mobile bundle", () => {
    expect(appShell).toContain('import { LogEntry } from "./screens/LogEntry"')
    expect(appShell).not.toContain("const LogEntry = React.lazy(")
  })
})
