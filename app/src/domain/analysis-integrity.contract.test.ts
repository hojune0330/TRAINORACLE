import { describe, expect, it } from "vitest"
import { projectStructuredJournalObservation, selectStructuredJournalInput } from "./journal-observation"
import type { JournalEntry } from "./journal-schema"
import { buildEnergySystemLedger, energyLedgerWindow } from "./energy-system-ledger"
import { derivePersonalOracle } from "./personal-oracle"
import { parseActivityFile } from "./import/activity-file"
import { toImportedEntry } from "./import/import-draft"
import { cumulativeDistance } from "./cumulative-distance"

const today = "2026-09-04"
const window = energyLedgerWindow("RECENT_8_WEEKS", today)
function observation(id = "one", imported = false) {
  return projectStructuredJournalObservation({
    sourceKind: "SESSION_RESULT_RECORD", sourceId: id, loggedOn: today,
    observedAt: `${today}T10:00:00Z`, system: "base", distanceKm: "8",
    durationMin: "40", avgPace: "", rpe: 6,
    fieldProvenance: {
      system: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" },
      distanceKm: imported ? { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" } : { provenance: "EXPLICIT" },
      durationMin: imported ? { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" } : { provenance: "EXPLICIT" },
    },
  })
}
describe("analysis integrity owner adoption", () => {
  it("preserves explicit purpose and RPE without admitting imported distance", () => {
    const source = observation("mixed", true)
    const ledger = buildEnergySystemLedger([source], window)
    expect(source.sourceRef.trustState).toBe("SOURCE_NOT_VERIFIED")
    expect(ledger.rows.find(row => row.key === "BASE")).toMatchObject({
      journalSessionCount: 1, meanRpe: 6, distanceKm: null, durationMinutes: null,
    })
    expect(derivePersonalOracle({ observations: [source], today, planState: null }).structuredSourceCount).toBe(1)
  })
  it("does not filter conflicting provenance before identity comparison", () => {
    const first = observation()
    const legacy = { ...first, fieldProvenance: { ...first.fieldProvenance, system: "LEGACY_MISSING_PROVENANCE" as const } }
    for (const inputs of [[first, legacy], [legacy, first]]) {
      const ledger = buildEnergySystemLedger(inputs, window)
      expect(ledger.includedSourceCount).toBe(0)
      expect(ledger.reasonCodes).toContain("CONFLICTING_SOURCE_ID")
    }
  })
  it("counts only unique insight sources for Oracle maturity", () => {
    const source = observation()
    const oracle = derivePersonalOracle({ observations: [source, source, source, source], today, planState: null })
    expect(oracle.structuredSourceCount).toBe(1)
    expect(oracle.maturity).toBe("STARTING")
  })
  it("retains purpose-only structured input without inventing metrics", () => {
    const entry = {
      kind: "post-session", syncState: "local", id: "purpose-only", date: today, savedAt: `${today}T10:00:00Z`,
      system: "base", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      fieldProvenance: { system: { provenance: "EXPLICIT" } },
    } as JournalEntry
    const input = selectStructuredJournalInput(entry)
    expect(input).not.toBeNull()
    if (input === null) throw new Error("missing purpose-only projection")
    const row = buildEnergySystemLedger([projectStructuredJournalObservation(input)], window).rows.find(row => row.key === "BASE")
    expect(row).toMatchObject({ journalSessionCount: 1, distanceKm: null, durationMinutes: null, meanRpe: null })
  })
  it("does not rehabilitate a conflicting record using its explicit fields", () => {
    const source = observation("mixed", true)
    const ledger = buildEnergySystemLedger([{ ...source, sourceRef: { ...source.sourceRef, trustState: "CONFLICTING" } }], window)
    expect(ledger.includedSourceCount).toBe(0)
  })
  it("exposes independent denominators instead of implying every session has every metric", () => {
    const full = observation("full")
    const mixed = observation("mixed", true)
    const row = buildEnergySystemLedger([full, mixed], window).rows.find(row => row.key === "BASE")
    expect(row).toMatchObject({ journalSessionCount: 2, distanceSampleCount: 1, durationSampleCount: 1, rpeSampleCount: 2, distanceKm: 8, durationMinutes: 40, meanRpe: 6 })
  })
  it.each([0.4, 1.33])("preserves %s minutes through file parsing and entry creation", minutes => {
    const parsed = parseActivityFile(JSON.stringify([{ date: today, sport: "Running", distanceKm: 0.1, durationMin: minutes }]))
    const activity = parsed.activities[0]
    expect(activity).toBeDefined()
    if (!activity) throw new Error("missing parsed activity")
    expect(Number(toImportedEntry(activity, "json").durationMin) * 60).toBeCloseTo(minutes * 60, 8)
  })
  it("keeps direct distance eligible when only duration was imported", () => {
    const source = observation("mixed", true)
    const directDistance = { ...source, fieldProvenance: { ...source.fieldProvenance, distanceKm: "EXPLICIT" as const }, acceptedExplicitFields: ["system", "rpe", "distanceKm"] }
    expect(cumulativeDistance([directDistance], { kind: "RECENT_MONTH", ...window }).totalKm).toBe(8)
    expect(cumulativeDistance([source], { kind: "RECENT_MONTH", ...window }).totalKm).toBeNull()
  })
  it("does not expose unknown provenance fields as projected attestations", () => {
    const source = observation()
    expect(source.acceptedExplicitFields).toEqual(["system", "distanceKm", "durationMin", "rpe"])
  })
  it("rejects invalid explicit numbers without discarding the valid purpose", () => {
    const source = { ...observation(), distanceKm: Infinity, durationMin: -1, rpe: 99 }
    const row = buildEnergySystemLedger([source], window).rows.find(row => row.key === "BASE")
    expect(row).toMatchObject({ journalSessionCount: 1, distanceKm: null, durationMinutes: null, meanRpe: null })
  })
})
