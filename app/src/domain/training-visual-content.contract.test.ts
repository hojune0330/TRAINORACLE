import { describe, expect, it } from "vitest"
import { buildOracleContentReading, type OracleContentReading, type OracleReaderSession } from "./oracle-content-reader"
import { ORACLE_EVIDENCE_PAGES, ORACLE_EXAMPLE_PAGES } from "./oracle-learning-content"
import { trainingContentById } from "./training-content-catalog"
import { oracleTrainingVisual, trainingVisualContent, trainingVisualForArticle } from "./training-visual-content"

const sessions: OracleReaderSession[] = [
  { id: "first", date: "2026-10-20", provenance: "EXPLICIT", activity: "RUN", purpose: "BASE", distanceKm: 5, durationMinutes: 31 },
  { id: "second", date: "2026-10-21", provenance: "CONFIRMED_FILE", activity: "RUN" },
]
const training = { state: "READY" as const, sourceVersion: "training:1", data: {
  period: { startDate: "2026-10-01", endDate: "2026-10-25" }, coverage: "COMPLETE" as const, sessions,
} }
const purposeReading = () => buildOracleContentReading("C02", { today: "2026-10-26", training })

describe("shared training visual content", () => {
  it("connects the same source-bounded cruise definition in the article and learning page", () => {
    const article = trainingContentById("CRUISE_INTERVALS")
    const page = ORACLE_EVIDENCE_PAGES.find(item => item.id === article.id)!
    const guide = trainingVisualContent(page.visual!)
    expect(trainingVisualForArticle(article.id)).toBe(guide)
    expect(guide.summary).toBe(article.summary)
    expect(guide.sources).toEqual([{ label: article.sourceLabel, url: article.sourceUrl }])
    expect(guide.notes).toContain(article.useBoundary)
    expect(guide.steps.every(step => !/\d/.test(step.amount))).toBe(true)
    expect(trainingVisualForArticle("NORWEGIAN_DOUBLE_THRESHOLD")).toBeNull()
  })

  it("keeps the existing four repeats, set split and unknown recovery without inventing a total time", () => {
    const page = ORACLE_EXAMPLE_PAGES.find(item => item.id === "recovery")!
    const guide = trainingVisualContent(page.visual!)
    const first = guide.steps.filter(step => step.group === "400m × 4회")
    const second = guide.steps.filter(step => step.group === "400m × 2회 × 2세트")
    expect(first.filter(step => step.kind === "work").map(step => step.amount)).toEqual(["400m", "400m", "400m", "400m"])
    expect(second.filter(step => step.kind === "work")).toHaveLength(4)
    expect(first.filter(step => step.kind === "recovery").map(step => step.amount)).toEqual(["60초", "60초", "60초"])
    expect(second.filter(step => step.kind === "recovery").map(step => step.amount)).toEqual(["시간 미제시", "시간 미제시", "시간 미제시"])
    expect(first.at(-1)?.kind).toBe("work")
    expect(second.at(-1)?.kind).toBe("work")
    expect(guide.notes?.join(" ")).toContain("전체 소요 시간은 계산하지 않아요")
  })

  it("uses existing structured purpose counts, retaining missing classification and period", () => {
    const reading = purposeReading(), before = structuredClone(reading)
    const guide = oracleTrainingVisual(reading)!
    expect(guide.layout).toBe("facts")
    expect(guide.steps.map(step => step.amount)).toEqual(["1 개", "1 개"])
    expect(guide.steps[0]?.label).toBe("목적 미분류 세션")
    expect(guide.steps[0]?.explanation).toBe("2026-10-01 ~ 2026-10-25")
    expect(guide.summary).toContain("에너지 공급 비율을 뜻하지 않아요")
    expect(reading).toEqual(before)
  })

  it("changes the display identity for changed values, periods or source versions in the same topic", () => {
    const reading = purposeReading(), original = oracleTrainingVisual(reading)!
    const valueChanged = { ...reading, facts: reading.facts.map((fact, index) => index ? fact : { ...fact, value: 2 }) }
    const periodChanged = { ...reading, facts: reading.facts.map(fact => ({ ...fact, period: { startDate: "2026-10-02", endDate: "2026-10-25" } })) }
    const sourceChanged = { ...reading, sourceVersions: { training: "training:2" }, facts: reading.facts.map(fact => ({ ...fact,
      sourceRefs: fact.sourceRefs.map(ref => ({ ...ref, sourceVersion: "training:2" })),
    })) }
    for (const changed of [valueChanged, periodChanged, sourceChanged]) expect(oracleTrainingVisual(changed)?.id).not.toBe(original.id)
    expect(original.id).toMatch(/^oracle-C02-[a-f0-9]{8}$/)
    const identitiesChanged = { ...reading, facts: reading.facts.map(fact => ({ ...fact, id: "private-record-id",
      sourceRefs: fact.sourceRefs.map(ref => ({ ...ref, itemId: "private-account-or-record" })),
    })) }
    expect(oracleTrainingVisual(identitiesChanged)?.id).toBe(original.id)
  })

  it("preserves original-plan versions separately from source-envelope versions", () => {
    const reading = buildOracleContentReading("C07", { today: "2026-10-26", training,
      planActual: { state: "READY", sourceVersion: "plan-envelope:1", data: [{ id: "old-plan", date: "2026-10-20", sessionId: "first",
        originalPlanVersion: "original-plan:7", completion: "COMPLETED", plannedDurationMinutes: 30, durationComparison: "MATCHED_SCOPE" }] },
    })
    const guide = oracleTrainingVisual(reading)!
    expect(guide.steps.some(step => step.amount === "30 분")).toBe(true)
    expect(guide.steps.some(step => step.amount === "1 분")).toBe(true)
    expect(guide.steps.some(step => step.details?.some(detail => detail.includes("당시 계획 원본")))).toBe(true)
  })

  it.each(["MISSING", "UNAVAILABLE", "REVOKED"] as const)("does not replace %s personal data with a generic guide", status => {
    expect(oracleTrainingVisual({ ...purposeReading(), status })).toBeNull()
  })

  it.each([
    { value: "200" }, { value: Number.NaN }, { value: -1 }, { unit: "bpm" }, { owner: "FRIEND" },
    { sourceRefs: [] }, { sourceRefs: [{ source: "training", sourceVersion: "stale", provenance: "EXPLICIT" }] },
    { sourceRefs: [{ source: "training", sourceVersion: "training:1", provenance: "DEVICE_ESTIMATE" }] },
  ])("rejects a nonnumeric, wrong-unit or unverified visual fact: %j", patch => {
    const reading = purposeReading()
    const modified = { ...reading, facts: [{ ...reading.facts[0]!, ...patch }] } as OracleContentReading
    expect(oracleTrainingVisual(modified)).toBeNull()
  })

  it("keeps education labelled and does not imply a generic fallback for unsupported personal topics", () => {
    expect(oracleTrainingVisual(buildOracleContentReading("D02", { today: "2026-10-26" }))?.contextLabel).toContain("개인 처방 아님")
    expect(oracleTrainingVisual(buildOracleContentReading("H04", { today: "2026-10-26" }))?.contextLabel).toContain("학습용 합성 예시")
    expect(oracleTrainingVisual(buildOracleContentReading("B01", { today: "2026-10-26" }))).toBeNull()
  })
})
