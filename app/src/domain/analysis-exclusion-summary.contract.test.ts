// Q1 계약 — 추이 화면에서 빠지는 일지를 정확히 센다.
//
// 왜 이 파일이 있는가:
//  가져온 값(DERIVED)은 분석에서 빠진다. 그 판단은 옳다. 문제는 빠진다는
//  사실을 화면이 말하지 않아 사용자가 "가져오기가 실패했다"고 오해한다는
//  것이었다. 이 계약은 **알릴 개수가 정확한지**를 고정한다.
//
//  특히 중요한 것은 **원인을 뭉치지 않는 것**이다. 빠지는 원인이 두 갈래인데
//  (가져온 값 / 출처 정보 없음) 한 문장으로 뭉치면 안내가 거짓이 된다.
import { beforeEach, describe, expect, it } from "vitest"
import { analysisExclusionSummary, loadAnalysisEntries, saveEntry } from "./journal-store"
import type { JournalEntry } from "./journal-schema"
import type { FieldProvenance } from "./field-provenance"

const IMPORTED: FieldProvenance = {
  provenance: "DERIVED",
  derivedFrom: ["import:activity-file"],
  derivationRuleId: "import:activity-file",
}
const WRITTEN: FieldProvenance = { provenance: "EXPLICIT" }
const BLANK: FieldProvenance = { provenance: "MISSING" }

type SessionOverrides = {
  readonly distanceKm?: string
  readonly rpe?: number
  readonly fieldProvenance?: Record<string, FieldProvenance>
}

function session(id: string, overrides: SessionOverrides = {}): JournalEntry {
  const { fieldProvenance, ...values } = overrides
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: `2026-07-20T10:00:00.000Z`,
    syncState: "local",
    system: "base",
    title: "조깅",
    distanceKm: "10",
    durationMin: "60",
    avgPace: "6:00",
    rpe: 5,
    memo: "",
    ...values,
    ...(fieldProvenance === undefined ? {} : { fieldProvenance }),
  } as JournalEntry
}

/**
 * 픽스처가 스키마에 거부되면 **즉시 실패시킨다** (규칙 P-3).
 * `saveEntry`는 거부를 조용히 `ok:false`로만 알리므로, 확인하지 않으면
 * "저장된 게 없어서 0" 인데 "제외돼서 0" 이라고 착각하는 공허한 통과가 된다.
 * 이 프로젝트에서 실제로 두 번 겪은 함정이다.
 */
function store(entry: JournalEntry): void {
  const result = saveEntry(entry)
  if (!result.ok) throw new Error(`픽스처가 스키마에 거부됐다: ${entry.id}`)
}

const ALL_WRITTEN = {
  distanceKm: WRITTEN, durationMin: WRITTEN, avgPace: WRITTEN, rpe: WRITTEN,
}
const ALL_IMPORTED = {
  distanceKm: IMPORTED, durationMin: IMPORTED, avgPace: IMPORTED, rpe: BLANK,
}

describe("analysisExclusionSummary", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("일지가 없으면 모두 0이다", () => {
    expect(analysisExclusionSummary()).toEqual({
      total: 0, included: 0, excludedImported: 0, excludedNoProvenance: 0,
    })
  })

  it("손으로 쓴 일지는 반영되고, 빠진 것으로 세지 않는다", () => {
    store(session("written", { fieldProvenance: ALL_WRITTEN }))

    const summary = analysisExclusionSummary()
    expect(summary.included).toBe(1)
    expect(summary.excludedImported).toBe(0)
    expect(summary.excludedNoProvenance).toBe(0)
  })

  it("가져온 일지는 '가져와서 빠짐'으로 센다", () => {
    store(session("imported", { fieldProvenance: ALL_IMPORTED }))

    const summary = analysisExclusionSummary()
    expect(summary.total).toBe(1)
    expect(summary.included).toBe(0)
    expect(summary.excludedImported).toBe(1)
    expect(summary.excludedNoProvenance).toBe(0)
  })

  // 이 계약이 이 PR의 핵심이다. 세는 개수가 화면 문구의 근거이므로,
  // 뭉쳐 세면 사용자에게 틀린 이유를 말하게 된다.
  it("출처 정보가 없어 빠진 일지는 가져오기와 **따로** 센다", () => {
    // 출처 기록 도입 전에 저장된 일지 / 출처가 빠진 백업으로 복원한 일지
    store(session("legacy"))

    const summary = analysisExclusionSummary()
    expect(summary.included).toBe(0)
    expect(summary.excludedNoProvenance).toBe(1)
    // 가져온 것이 아니므로 가져오기 개수에 섞이면 안 된다
    expect(summary.excludedImported).toBe(0)
  })

  it("원인이 다른 일지가 섞여 있어도 각각 제 칸에 센다", () => {
    store(session("written", { fieldProvenance: ALL_WRITTEN }))
    store(session("imported-a", { fieldProvenance: ALL_IMPORTED }))
    store(session("imported-b", { fieldProvenance: ALL_IMPORTED }))
    store(session("legacy"))

    expect(analysisExclusionSummary()).toEqual({
      total: 4, included: 1, excludedImported: 2, excludedNoProvenance: 1,
    })
  })

  it("적지 않아서 비어 있는 칸이 있어도 나머지는 정상 반영된다", () => {
    store(session("partial", {
      distanceKm: "",
      rpe: 0,
      fieldProvenance: {
        distanceKm: BLANK, durationMin: WRITTEN, avgPace: WRITTEN, rpe: BLANK,
      },
    }))

    const summary = analysisExclusionSummary()
    expect(summary.included).toBe(1)
    expect(summary.excludedImported).toBe(0)
    expect(summary.excludedNoProvenance).toBe(0)
  })

  /**
   * "값이 있는 칸만 센다"는 규칙을 실제로 시험하는 계약.
   *
   * 이 테스트를 따로 두는 이유: 위의 `partial` 케이스는 값 유무 조건을 없애도
   * 그대로 통과한다(빈 칸이 세어져도 원인 분류에서 걸러지기 때문). 즉 규칙을
   * 지키는지 **검증하지 못하는 공허한 통과**였다. 값 유무를 무시하면 실제로
   * 개수가 틀리는 조합은 이것뿐이다 — 가져온 칸이 비어 있고 나머지는 손입력.
   *
   * 이걸 잘못 세면 화면이 "가져온 기록 1건이 빠졌어요"라고 말하는데 정작
   * 빠진 수치가 하나도 없는 상태가 된다. 없는 문제를 알리는 안내가 된다.
   */
  it("가져온 칸이 비어 있으면 빠진 것으로 세지 않는다", () => {
    store(session("imported-blank-field", {
      distanceKm: "",
      fieldProvenance: {
        distanceKm: IMPORTED, durationMin: WRITTEN, avgPace: WRITTEN, rpe: WRITTEN,
      },
    }))

    const summary = analysisExclusionSummary()
    expect(summary.included).toBe(1)
    // 빈 칸은 빠질 값 자체가 없다 — 알릴 것이 없다
    expect(summary.excludedImported).toBe(0)
    expect(summary.excludedNoProvenance).toBe(0)
  })

  // 한 일지 안에서 일부만 가져온 경우 — 반영도 되고 빠진 것도 있다.
  it("일부 칸만 가져온 일지는 반영되면서도 빠진 것으로 함께 센다", () => {
    store(session("mixed", {
      fieldProvenance: {
        distanceKm: IMPORTED, durationMin: IMPORTED, avgPace: IMPORTED, rpe: WRITTEN,
      },
    }))

    const summary = analysisExclusionSummary()
    // rpe는 손으로 적었으므로 이 일지 자체는 분석에 들어간다
    expect(summary.included).toBe(1)
    // 그러나 거리·시간·페이스는 빠졌다. 그래프가 비는 이유를 말해야 한다.
    expect(summary.excludedImported).toBe(1)
  })

  it("세는 것 말고는 아무것도 바꾸지 않는다 — 분석 결과가 그대로다", () => {
    store(session("imported", { fieldProvenance: ALL_IMPORTED }))

    const before = loadAnalysisEntries().length
    analysisExclusionSummary()
    expect(loadAnalysisEntries().length).toBe(before)
    expect(before).toBe(0)
  })
})
