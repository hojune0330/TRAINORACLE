import type { PaceTargetPlanPrescription } from "@impl/plan-generator/session-types"

type CompositionIdentity = Pick<PaceTargetPlanPrescription,
  "templateId" | "templateVersion" | "templateContentFingerprint" | "targetEventDistanceM"
  | "setCount" | "repetitionsPerSet" | "repetitionDistanceM"
  | "repetitionRecoverySeconds" | "repetitionRecoveryMode" | "setRecoverySeconds" | "setRecoveryMode">

type TemplateExplanation = {
  readonly version: string
  readonly identity: CompositionIdentity
  readonly work: string
  readonly recovery: string
  readonly limitation: string
  readonly decisionPath: string
  readonly sourceRecordPath: string
}

const middleDistanceDecision = "reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md"
const middleDistanceSources = "reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md"
const fiveKDecision = "reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md"
const singleSet = { templateVersion: "1.0.0", setCount: 1, setRecoverySeconds: null, setRecoveryMode: "NOT_APPLICABLE" } as const

// Explanations of existing exact adoptions only; this registry cannot activate a dose.
export const TRAINING_TEMPLATE_EXPLANATIONS: readonly TemplateExplanation[] = [
  {
    version: "1.0.0",
    identity: { ...singleSet, templateId: "MD-800-01", templateContentFingerprint: "sha256:8aa917947277883df94a9de665accd59a028b6753cec22d8fecf06795d28b149", targetEventDistanceM: 800, repetitionsPerSet: 10, repetitionDistanceM: 200, repetitionRecoverySeconds: 60, repetitionRecoveryMode: "STAND" },
    work: "800m 경기 페이스의 요구를 200m 단위로 나눠 반복하는 구성이에요. 빠른 에너지 공급이 필요한 노력을 반복해서 다루며, 단순한 발 움직임 연습으로 대체한 훈련은 아니에요. 채택 기록에 있는 원자료 범위 중 10회를 선택했고, 현재 본인의 800m 기록으로 목표 시간을 정해요.",
    recovery: "60초 동안 서서 쉬는 구간을 끼워 같은 목표의 다음 반복에 들어가요. 쉬는 동안 달리기를 추가하지 않는 구성이고, 60초가 모든 선수의 완전 회복 시간이라는 뜻은 아니에요. 서서 쉬기는 트레인오라클의 운영 선택이며 원자료가 증명한 최적 방식으로 제시하지 않아요.",
    limitation: "채택 문서는 원자료의 10~16회 범위에서 10회를 선택했다고 기록해요. 원자료의 엘리트 사례가 이 개인이나 모든 청소년에게 최적이라는 증거는 아니에요.",
    decisionPath: middleDistanceDecision, sourceRecordPath: middleDistanceSources,
  },
  {
    version: "1.0.0",
    identity: { ...singleSet, templateId: "MD-1500-01", templateContentFingerprint: "sha256:dd82bb01baa7b34e163f9148b76eae3956285dc5d1bd7e5217cd39373d966fab", targetEventDistanceM: 1500, repetitionsPerSet: 3, repetitionDistanceM: 500, repetitionRecoverySeconds: 180, repetitionRecoveryMode: "STAND" },
    work: "1500m 경기 페이스의 요구를 500m씩 나누고, 같은 구간을 세 번 반복하는 구성이에요. 산화 대사와 빠른 에너지 공급이 함께 필요한 경기 페이스를 다루지만, 저장된 MIX 표시는 서로 다른 구간을 섞었다는 뜻이 아니에요. 이 처방의 본운동은 동일한 500m 반복뿐이에요.",
    recovery: "반복 사이에 180초 동안 서서 쉬고 다음 500m를 시작해요. 달리기를 이어서 더하는 방식과 구분되는 회복이며, 다음 반복에서도 목표 페이스를 다루기 위한 간격이에요. 채택 기록에서 180초와 서서 쉬기를 운영 선택으로 정했으며 완전 회복 여부를 측정한 것은 아니에요.",
    limitation: "채택 문서는 코칭 자료의 3~4회·2~3분 범위에서 3회·180초를 선택하고 목표 기록 대신 현재 기록을 쓰도록 바꿨어요. 구간별 에너지 비율이나 서로 다른 세 가지 자극을 배분한 처방은 아니에요.",
    decisionPath: middleDistanceDecision, sourceRecordPath: middleDistanceSources,
  },
  {
    version: "1.0.0",
    identity: { ...singleSet, templateId: "MD-3000-01", templateContentFingerprint: "sha256:a69b24eccf72be076865b091d6a4ee408da6444512c09a788d717d99adc7a455", targetEventDistanceM: 3000, repetitionsPerSet: 4, repetitionDistanceM: 800, repetitionRecoverySeconds: 180, repetitionRecoveryMode: "WALK" },
    work: "현재 3000m 페이스를 800m 단위로 반복해 강한 유산소 노력을 나누어 수행하는 구성이에요. 빠른 구간과 회복을 구분해 같은 목표의 노력을 반복하며, 채택 기록의 여러 거리·횟수 범위에서 800m 네 번을 선택했어요. 모든 선수에게 같은 산소섭취 반응이 생긴다고 뜻하지는 않아요.",
    recovery: "각 800m 사이에 180초 걷기를 넣어 달리기 강도를 낮추면서 다음 반복을 준비해요. 조깅이나 정지 대신 걷기를 고른 것은 이 템플릿의 운영 선택이에요. 회복 방식과 시간이 달라지면 다음 반복의 부담도 달라질 수 있어요.",
    limitation: "채택 문서의 원자료는 여러 종목과 엘리트 사례를 포함해요. 4회·800m·180초 걷기를 개별 선수의 최적값이나 다른 회복과 동등한 효과로 확정하지 않아요.",
    decisionPath: middleDistanceDecision, sourceRecordPath: middleDistanceSources,
  },
  {
    version: "1.0.0",
    identity: { ...singleSet, templateId: "V2-SEED-05", templateContentFingerprint: "sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a", targetEventDistanceM: 5000, repetitionsPerSet: 5, repetitionDistanceM: 1000, repetitionRecoverySeconds: 150, repetitionRecoveryMode: "JOG" },
    work: "현재 5000m 페이스의 1000m 구간을 다섯 번 나누어 수행하며 강한 유산소 노력을 반복하는 구성이에요. 1000m 단위의 목표 시간을 확인할 수 있고, 다섯 구간 사이에는 회복이 있어 5000m를 연속으로 달리는 것과 같지 않아요. 반복 수와 거리는 개인 기록에서 계산한 값이 아니라 트레인오라클이 채택한 구성이에요.",
    recovery: "반복 사이 150초는 가벼운 조깅으로 강도를 낮추되 움직임은 이어가는 구간이에요. 같은 시간의 정지 회복과 동일한 조건이 아니에요. 정확히 150초라는 값은 운영 채택이며, 모든 선수에게 필요한 회복 시간이 같다는 연구 결론이 아니에요.",
    limitation: "원자료는 인터벌과 조깅 회복의 맥락을 제공하지만 정확히 5회·150초·현재 5000m 페이스인 이 조합이나 청소년별 훈련량을 직접 제시하지 않아요. 이 조합은 트레인오라클의 별도 채택이에요.",
    decisionPath: fiveKDecision, sourceRecordPath: fiveKDecision,
  },
]

export function templateExplanation(prescription: PaceTargetPlanPrescription): TemplateExplanation | null {
  return TRAINING_TEMPLATE_EXPLANATIONS.find((entry) => (
    (Object.keys(entry.identity) as (keyof CompositionIdentity)[]).every((key) => prescription[key] === entry.identity[key])
  )) ?? null
}
