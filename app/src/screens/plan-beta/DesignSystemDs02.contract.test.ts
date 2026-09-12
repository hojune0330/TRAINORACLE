import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const planCss = readFileSync("src/styles/plan-beta.css", "utf8")
const explanationCss = readFileSync("src/styles/session-explanation.css", "utf8")
const mainComparison = readFileSync("src/screens/plan-beta/MainWorkComparison.tsx", "utf8")
const schedulePreview = readFileSync("src/screens/plan-beta/PlanSchedulePreview.tsx", "utf8")
const prescriptionStructure = readFileSync("src/screens/plan-beta/PrescriptionStructure.tsx", "utf8")
const ownedRenderers = [
  readFileSync("src/screens/plan-beta/DetailedPrescriptionView.tsx", "utf8"),
  mainComparison,
  schedulePreview,
  prescriptionStructure,
].join("\n")

function atRuleContaining(source: string, header: string, selector: string): string {
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf(header, cursor)
    if (start === -1) return ""
    const openingBrace = source.indexOf("{", start)
    let depth = 0
    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1
      if (source[index] === "}") depth -= 1
      if (depth === 0) {
        const block = source.slice(start, index + 1)
        if (block.includes(selector)) return block
        cursor = index + 1
        break
      }
    }
  }
  return ""
}

describe("DS-02 plan presentation contract", () => {
  it("aligns A and B by the same five fields until zoom needs a single column", () => {
    const narrowComparison = atRuleContaining(
      planCss,
      "@media (max-width: 280px)",
      ".plan-main-comparison__pair",
    )

    expect(mainComparison).toContain("data-field={field}")
    expect(planCss).toMatch(/\.plan-main-comparison__pair\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u)
    expect(planCss).toMatch(/@supports \(grid-template-rows:\s*subgrid\)[\s\S]*?\.plan-main-comparison__pair > \.plan-main-comparison__values\s*\{[^}]*grid-template-rows:\s*subgrid/u)
    expect(narrowComparison).toMatch(/\.plan-main-comparison__pair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u)
    expect(narrowComparison).toMatch(/\.plan-main-comparison__pair > \.plan-main-comparison__values:first-child,\s*\.plan-main-comparison__pair > \.plan-main-comparison__values:last-child\s*\{[^}]*grid-column:\s*auto/u)
  })

  it("keeps AM and PM explicit while narrow double sessions wrap vertically", () => {
    expect(schedulePreview).toContain("data-session-slot={session.slot}")
    expect(schedulePreview).toContain("{sessionSlotLabel(session.slot)}")
    expect(planCss).toMatch(/\.plan-schedule-preview\[data-display-mode="swipe"\] \.plan-schedule-preview__sessions\[data-session-count="2"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u)
    expect(planCss).toMatch(/\.plan-day-card__session > header\s*\{[^}]*flex-wrap:\s*wrap/u)
  })

  it("separates the primary work from recovery and supporting phases without changing values", () => {
    expect(ownedRenderers).toContain('data-recovery-kind="repetition"')
    expect(ownedRenderers).toContain('data-recovery-kind="set"')
    expect(prescriptionStructure).toContain('["main", "본운동", sequence.main]')
    expect(planCss).toMatch(/\.plan-detailed-prescription > \.plan-detailed-prescription__primary,[\s\S]*?background:\s*var\(--surface-2\)/u)
    expect(planCss).not.toMatch(/\.plan-detailed-prescription__primary[^{]*\{[^}]*!important/u)
    expect(explanationCss).toMatch(/\.prescription-structure__section\[data-section="main"\]\s*\{[^}]*background:\s*var\(--surface-2\)/u)
    expect(explanationCss).toMatch(/\.prescription-structure__nodes small\s*\{[^}]*color:\s*var\(--ink-2\)/u)
  })

  it("uses a readable explanation measure and does not activate a V3 renderer", () => {
    expect(explanationCss).toMatch(/\.session-explanation__content > \*\s*\{[^}]*max-width:\s*42rem/u)
    expect(explanationCss).not.toMatch(/text-overflow:\s*ellipsis|line-clamp/u)
    expect(ownedRenderers).not.toMatch(/PrescriptionAdjustmentEditorV3|MultiAdjustedPlan|sequence-v3/u)
  })
})
