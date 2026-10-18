import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const checkinCss = readFileSync("src/screens/log-entry/EveningCheckin.css", "utf8")
const measurementCss = readFileSync("src/screens/log-entry/post-session-measurements.css", "utf8")
const archiveCss = readFileSync("src/styles/journal-calendar.css", "utf8")

describe("journal input layout", () => {
  it("keeps optional check-in choices adaptive and the memo entry on its own row", () => {
    const choiceGrid = checkinCss.match(/\.evening-checkin__choices\s*\{([^}]+)\}/u)?.[1] ?? ""
    const memoChoice = checkinCss.match(/button\.evening-checkin__choice--memo\.category-card\s*\{([^}]+)\}/u)?.[1] ?? ""

    expect(choiceGrid).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*9em\),\s*1fr\)\)/u)
    expect(memoChoice).toMatch(/grid-column:\s*1\s*\/\s*-1/u)
    expect(memoChoice).toMatch(/grid-template-columns:\s*32px\s+minmax\(0,\s*1fr\)\s+20px/u)
  })

  it("pairs every performance value with a readable unit in a responsive field grid", () => {
    expect(measurementCss).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*9em\),\s*1fr\)\)/u)
    expect(measurementCss).toContain(".post-session-measurements__unit")
  })

  it("lets the archive month toolbar reflow naturally when text needs more room", () => {
    const toolbar = archiveCss.match(/\.journal-calendar-browse \.month-calendar__toolbar\s*\{([^}]+)\}/u)?.[1] ?? ""

    expect(toolbar).toMatch(/display:\s*flex/u)
    expect(toolbar).toMatch(/flex-wrap:\s*wrap/u)
    expect(archiveCss).toMatch(/\.journal-calendar-browse \.month-calendar__toolbar h3\s*\{\s*min-width:\s*0/u)
  })
})
