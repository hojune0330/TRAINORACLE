// 세션 강도 요약 계약 고정.
//
// 스펙 출처 (AGENTS.md §2 라우팅 표에 따라 착수 전 열람):
//   - specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md (ACTIVE_IMPLEMENTATION_CONTRACT)
//       · 헤더 불변식: universal_fatigue_score: FORBIDDEN
//                     plan_authority: false / safety_authority: false
//       · "Coverage State" 표, "Derived Objective Metrics" 규칙 ID 표, "Provenance"
//   - .omo/plans/trainoracle-session-intensity-assessment.md (Fixed Decisions)
//   - PRODUCT_NORTH_STAR.md §3 (폴백 원칙)
//
// 이 모듈이 안전 문제인 이유 — 두 가지다.
//
// 1) 없는 주관 값을 지어내면 안 된다. 스펙 User Contract 4: 주관 값이 둘 다
//    없고 객관 기록만 있으면 `객관 기록으로만 표시`이며 "주관 값을 날조하지
//    않는다". 특히 저장된 0은 legacy missing 표식이지 실제 RPE가 아니다(계약 2).
//    0을 진짜 RPE로 읽으면 "가장 편한 훈련"으로 기록돼 부하 판단이 뒤집힌다.
//
// 2) 계산된 값과 선수가 직접 넣은 값이 섞이면 안 된다. 스펙 Provenance:
//    계산 결과는 DERIVED로 표시하고 rule ID와 derivedFrom 원천 필드 목록을
//    끝까지 달고 다녀야 한다. 이 표시가 벗겨지면 파생값이 실측처럼 보인다.
//    (이 저장소의 상시 제약: 파생값이 조용히 분석에 들어가면 안 된다)
//
// 이 파일은 스펙에 없는 규칙을 발명하지 않는다. 규칙 ID와 공식은 스펙
// "Derived Objective Metrics" 표에 적힌 것을 그대로 검증한다.

import { describe, expect, it } from "vitest"

import type { ObjectiveLoadComponent, SessionIntensityAssessment } from "./intensity-assessment"
import type { ObjectiveFact } from "./intensity-summary"
import { summarizeIntensityAssessment } from "./intensity-summary"

function assessment(
  objectiveComponents: readonly ObjectiveLoadComponent[],
  plannedRpe?: number,
): SessionIntensityAssessment {
  return plannedRpe === undefined
    ? { schemaVersion: 1, objectiveComponents }
    : { schemaVersion: 1, plannedRpe, objectiveComponents }
}

const running: ObjectiveLoadComponent = {
  componentId: "c-run",
  kind: "RUNNING",
  distanceKm: 12,
  actualPaceSecondsPerKm: 300,
}

const strength: ObjectiveLoadComponent = {
  componentId: "c-str",
  kind: "STRENGTH",
  exerciseType: "스쿼트",
  sets: 4,
  repetitions: 6,
}

function factsOf(summary: { readonly objectiveComponents: readonly { readonly facts: readonly ObjectiveFact[] }[] }): readonly ObjectiveFact[] {
  return summary.objectiveComponents.flatMap((component) => component.facts)
}

describe("intensity-summary / 커버리지 상태 (스펙 Coverage State)", () => {
  // I-1. 스펙의 커버리지 표 네 줄을 그대로 고정한다.
  // 이 분류가 틀리면 화면이 "객관 기록으로만 표시"를 말해야 할 때
  // 주관 값이 있는 것처럼 굴게 된다.
  it("I-1 주관·객관 유무 네 조합이 스펙 표대로 분류된다", () => {
    expect(summarizeIntensityAssessment(assessment([running], 7), 8).coverage).toBe("COMBINED")
    expect(summarizeIntensityAssessment(assessment([], 7), 0).coverage).toBe("SUBJECTIVE_ONLY")
    expect(summarizeIntensityAssessment(assessment([running]), 0).coverage).toBe("OBJECTIVE_ONLY")
    expect(summarizeIntensityAssessment(assessment([]), 0).coverage).toBe("MISSING")
  })

  // I-2. 스펙 User Contract 2: "저장된 0은 legacy missing 표식이며 절대
  // 실제 RPE로 취급하지 않는다." 0이 진짜 RPE로 새면 커버리지가 거짓으로
  // 올라가고, 없는 주관 값을 있다고 말하게 된다.
  it("I-2 저장된 0은 실제 RPE가 아니라 legacy 결측으로 다룬다", () => {
    const summary = summarizeIntensityAssessment(assessment([running]), 0)

    expect(summary.coverage).toBe("OBJECTIVE_ONLY")
    expect(summary.reportedRpe).toBeUndefined()
    expect("reportedRpe" in summary).toBe(false)
  })

  // I-3. 계획 RPE만 있어도 주관 관측은 존재한다. 스펙 Coverage State:
  // "Planned-only and reported-only subjective states remain distinguishable."
  it("I-3 계획 RPE만 있어도 주관 관측으로 인정한다", () => {
    const plannedOnly = summarizeIntensityAssessment(assessment([], 6), 0)
    const reportedOnly = summarizeIntensityAssessment(assessment([]), 6)

    expect(plannedOnly.coverage).toBe("SUBJECTIVE_ONLY")
    expect(plannedOnly.plannedRpe).toBe(6)
    expect(plannedOnly.reportedRpe).toBeUndefined()

    expect(reportedOnly.coverage).toBe("SUBJECTIVE_ONLY")
    expect(reportedOnly.reportedRpe).toBe(6)
    expect(reportedOnly.plannedRpe).toBeUndefined()
  })

  // I-4. 스펙 Coverage State: "Disagreement between planned and reported RPE
  // is useful information and is never overwritten."
  // 둘을 평균 내거나 한쪽으로 덮으면 불일치 정보가 사라진다.
  it("I-4 계획과 실제 RPE가 다르면 둘 다 원래 값으로 남긴다", () => {
    const summary = summarizeIntensityAssessment(assessment([], 3), 9)

    expect(summary.plannedRpe).toBe(3)
    expect(summary.reportedRpe).toBe(9)
  })

  // I-5. 스펙 Persistence Shape: intensityAssessment는 하위 호환을 위해 선택적.
  // 레거시 기록(assessment 자체가 없음)이 크래시 없이 처리돼야 한다.
  it("I-5 강도 기록이 아예 없는 레거시 항목도 안전하게 요약된다", () => {
    const legacyBare = summarizeIntensityAssessment(undefined, 0)
    const legacyWithRpe = summarizeIntensityAssessment(undefined, 5)

    expect(legacyBare.coverage).toBe("MISSING")
    expect(legacyBare.objectiveComponents).toEqual([])
    expect(legacyWithRpe.coverage).toBe("SUBJECTIVE_ONLY")
    expect(legacyWithRpe.reportedRpe).toBe(5)
  })
})

describe("intensity-summary / 출처 표시 (스펙 Provenance)", () => {
  // I-6. 선수가 직접 넣은 값은 EXPLICIT이어야 한다. 계산 결과로 오인되면
  // 반대로 실측이 추정처럼 평가절하된다.
  it("I-6 입력값 그대로인 사실은 EXPLICIT으로 표시한다", () => {
    const summary = summarizeIntensityAssessment(assessment([running]), 0)
    const [component] = summary.objectiveComponents

    expect(component?.facts[0]).toEqual({ text: "거리 12km", provenance: "EXPLICIT" })
  })

  // I-7. 스펙 Provenance: "Display metrics are transient DERIVED values with
  // stable rule IDs" + "carry their complete derivedFrom source-field list".
  // 이게 벗겨지면 계산값이 실측처럼 보인다 — 이 저장소의 상시 금지사항.
  it("I-7 계산된 사실은 DERIVED이며 규칙 ID와 원천 필드를 모두 달고 있다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([{ ...running, referencePaceSecondsPerKm: 270, typicalDistanceKm: 10 }]),
      0,
    )
    const derivedFacts = factsOf(summary).filter((fact) => fact.provenance === "DERIVED")

    expect(derivedFacts).toHaveLength(2)
    for (const fact of derivedFacts) {
      expect(fact.provenance).toBe("DERIVED")
      if (fact.provenance !== "DERIVED") continue
      expect(fact.derivationRuleId).toMatch(/^INTENSITY_[A-Z_]+_V1$/u)
      expect(fact.derivedFrom.length).toBeGreaterThan(0)
    }
  })

  // I-8. 스펙 "Derived Objective Metrics" 표의 규칙 ID를 그대로 고정한다.
  // 규칙 ID는 안정적이어야 한다고 스펙이 명시했다. 조용히 바뀌면 나중에
  // 파생값 추적이 끊긴다.
  it("I-8 규칙 ID와 원천 필드가 스펙 표와 일치한다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        { ...running, referencePaceSecondsPerKm: 270, typicalDistanceKm: 10 },
        {
          componentId: "c-int",
          kind: "INTERVALS",
          repetitions: 6,
          workSeconds: 60,
          recoverySeconds: 90,
          actualPaceSecondsPerKm: 200,
          referencePaceSecondsPerKm: 210,
        },
        { componentId: "c-ply", kind: "PLYOMETRIC", exerciseType: "박스점프", contacts: 60, typicalContacts: 50 },
        { componentId: "c-hill", kind: "HILLS", repetitions: 8, workSeconds: 45, recoverySeconds: 135 },
      ]),
      0,
    )

    const rules = factsOf(summary)
      .filter((fact) => fact.provenance === "DERIVED")
      .map((fact) => (fact.provenance === "DERIVED" ? fact.derivationRuleId : ""))

    expect(rules).toEqual([
      "INTENSITY_RUNNING_PACE_RATIO_V1",
      "INTENSITY_RUNNING_DISTANCE_RATIO_V1",
      "INTENSITY_INTERVAL_WORK_DENSITY_V1",
      "INTENSITY_INTERVAL_PACE_RATIO_V1",
      "INTENSITY_PLYOMETRIC_CONTACT_RATIO_V1",
      "INTENSITY_HILL_WORK_DENSITY_V1",
    ])
  })

  // I-9. 스펙: 파생 규칙은 "named inputs이 존재할 때만" 계산된다.
  // 선택 입력이 없는데 기본값을 끼워 넣으면 없는 근거로 비율을 만들게 된다.
  it("I-9 선택 입력이 없으면 그 파생값을 만들지 않는다", () => {
    const summary = summarizeIntensityAssessment(assessment([running]), 0)
    const facts = factsOf(summary)

    expect(facts).toHaveLength(1)
    expect(facts.every((fact) => fact.provenance === "EXPLICIT")).toBe(true)
  })
})

describe("intensity-summary / 파생 공식 (스펙 Derived Objective Metrics 표)", () => {
  // I-10. 스펙: 페이스 비율은 reference / actual * 100 이며, 선수가 퍼센트만
  // 보고 방향을 해석하지 않도록 빠름/느림/같음 라벨을 붙인다.
  // 방향이 뒤집히면 느려진 훈련이 빨라진 것으로 읽힌다.
  it.each([
    { reference: 270, actual: 300, expected: "개인 기준 페이스 대비 10% 느림 (90%)" },
    { reference: 300, actual: 270, expected: "개인 기준 페이스 대비 11% 빠름 (111%)" },
    { reference: 300, actual: 300, expected: "개인 기준 페이스 대비 같음 (100%)" },
  ])("I-10 기준 $reference / 실제 $actual 은 방향 라벨을 붙인다", ({ reference, actual, expected }) => {
    const summary = summarizeIntensityAssessment(
      assessment([{ ...running, actualPaceSecondsPerKm: actual, referencePaceSecondsPerKm: reference }]),
      0,
    )

    expect(factsOf(summary).map((fact) => fact.text)).toContain(expected)
  })

  // I-11. 스펙: 운동 비중 = work / (work + recovery) * 100.
  // 분모를 work만으로 쓰면 항상 100%가 나와 무의미해진다.
  it("I-11 운동 비중은 한 사이클 전체를 분모로 쓴다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        { componentId: "c-int", kind: "INTERVALS", repetitions: 6, workSeconds: 60, recoverySeconds: 180 },
      ]),
      0,
    )

    // 60 / (60 + 180) = 25%
    expect(factsOf(summary).map((fact) => fact.text)).toContain("운동 비중 25%")
  })

  // I-12. 거리·접지 비율은 실제 / 평소 * 100.
  it("I-12 평소 대비 비율은 실제/평소 * 100 이다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        { ...running, distanceKm: 15, typicalDistanceKm: 10 },
        { componentId: "c-ply", kind: "PLYOMETRIC", exerciseType: "박스점프", contacts: 40, typicalContacts: 80 },
      ]),
      0,
    )
    const texts = factsOf(summary).map((fact) => fact.text)

    expect(texts).toContain("평소 거리 대비 150%")
    expect(texts).toContain("평소 접지 수 대비 50%")
  })
})

describe("intensity-summary / 금지선 (스펙 헤더 불변식)", () => {
  // I-13. 스펙 헤더: universal_fatigue_score: FORBIDDEN.
  // User Contract 6: 주관과 객관을 하나의 피로·준비도·안전·부상위험·처방
  // 점수로 평균 내면 안 된다. 요약 결과에 그런 스칼라 필드가 생기는 순간
  // 화면이 그걸 표시하게 되므로, 출력 형태 자체로 막는다.
  it("I-13 요약 결과에 통합 점수 필드를 만들지 않는다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([running, strength], 7),
      9,
    )

    expect(Object.keys(summary).sort()).toEqual([
      "coverage",
      "objectiveComponents",
      "plannedRpe",
      "reportedRpe",
    ])
    const forbidden = ["score", "fatigue", "readiness", "risk", "load", "severity", "level"]
    for (const key of Object.keys(summary)) {
      expect(forbidden).not.toContain(key.toLowerCase())
    }
  })

  // I-14. 스펙 Fixed Decisions: "A session may contain multiple objective
  // components so mixed sessions are not collapsed."
  // 종목이 다른 성분을 하나로 합치면 종목 간 환산이 되고, 그건 North Star §3
  // 금지사항(종목간_환산: 오너승인된_모델_없이_금지)이다.
  it("I-14 혼합 세션의 성분을 하나로 합치지 않고 순서대로 보존한다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        running,
        strength,
        { componentId: "c-xt", kind: "CROSS_TRAINING", modality: "사이클", durationMin: 45 },
      ]),
      0,
    )

    expect(summary.objectiveComponents.map((component) => component.componentId)).toEqual([
      "c-run",
      "c-str",
      "c-xt",
    ])
    expect(summary.objectiveComponents.map((component) => component.kind)).toEqual([
      "RUNNING",
      "STRENGTH",
      "CROSS_TRAINING",
    ])
  })

  // I-15. 스펙 "Derived Objective Metrics" 표: 근력·대체유산소는 파생 공식이
  // 없고 별도 사실로만 유지한다. 여기에 임의 파생값이 생기면 근거 없는
  // 강도 해석이 된다.
  it("I-15 근력·대체유산소에는 파생 계산을 붙이지 않는다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        { ...strength, loadPercent1Rm: 80, repsInReserve: 2 },
        {
          componentId: "c-xt",
          kind: "CROSS_TRAINING",
          modality: "사이클",
          durationMin: 45,
          averageHeartRatePercentMax: 72,
        },
      ]),
      0,
    )

    expect(factsOf(summary).every((fact) => fact.provenance === "EXPLICIT")).toBe(true)
    expect(factsOf(summary).map((fact) => fact.text)).toEqual([
      "스쿼트 · 4세트 × 6회",
      "80% 1RM",
      "RIR 2",
      "사이클 · 45분",
      "평균 심박 72% HRmax",
    ])
  })

  // I-16. 여섯 종목 모두 라벨과 componentId를 보존해야 한다. 라벨이 비면
  // 화면에서 어떤 훈련인지 사라지고, 서로 구별되지 않으면 종목이 뒤섞인다.
  it("I-16 여섯 종목 전부 고유 라벨을 갖고 componentId를 보존한다", () => {
    const summary = summarizeIntensityAssessment(
      assessment([
        running,
        { componentId: "c-int", kind: "INTERVALS", repetitions: 6, workSeconds: 60, recoverySeconds: 90 },
        strength,
        { componentId: "c-ply", kind: "PLYOMETRIC", exerciseType: "박스점프", contacts: 40 },
        { componentId: "c-hill", kind: "HILLS", repetitions: 8, workSeconds: 45, recoverySeconds: 135 },
        { componentId: "c-xt", kind: "CROSS_TRAINING", modality: "사이클", durationMin: 45 },
      ]),
      0,
    )
    const labels = summary.objectiveComponents.map((component) => component.label)

    expect(labels).toEqual(["달리기", "인터벌", "근력", "플라이오", "언덕", "대체유산소"])
    expect(new Set(labels).size).toBe(6)
    expect(summary.objectiveComponents.every((component) => component.facts.length > 0)).toBe(true)
  })
})
