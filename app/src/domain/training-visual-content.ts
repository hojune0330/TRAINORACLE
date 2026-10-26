import type { OracleContentReading, OracleReadingFact } from "./oracle-content-reader"
import { trainingContentById, type TrainingContentId } from "./training-content-catalog"
import type { VisualTrainingGuideData, VisualTrainingStep } from "./visual-training-guide"

export type TrainingVisualContentId = "CONTINUOUS_AND_CRUISE" | "SAME_REPEATS_DIFFERENT_RECOVERY"

const cruise = trainingContentById("CRUISE_INTERVALS")

const continuousAndCruise: VisualTrainingGuideData = {
  id: "continuous-and-cruise",
  title: "계속 달리기와 나누어 달리기",
  contextLabel: "훈련 개념도 · 개인 처방 아님",
  summary: cruise.summary,
  layout: "comparison",
  steps: [
    { id: "continuous-work", group: "지속주", label: "운동", amount: "이어서 달리기", kind: "work",
      instruction: "지속 페이스 구간을 한 번에 이어서 달리는 구성이에요." },
    { id: "cruise-work-1", group: "크루즈 인터벌", label: "운동 구간", amount: "나누어 달리기", kind: "work",
      instruction: "지속 페이스 훈련을 여러 운동 구간으로 나눠요." },
    { id: "cruise-recovery", group: "크루즈 인터벌", label: "구간 사이", amount: "짧은 회복", kind: "recovery",
      instruction: "운동 구간 사이에 짧은 회복을 두는 구성이에요.", explanation: "회복 방식과 시간은 실제 처방에서 따로 확인해요." },
    { id: "cruise-work-2", group: "크루즈 인터벌", label: "다음 운동 구간", amount: "다시 달리기", kind: "work",
      instruction: "회복 뒤 다음 운동 구간으로 이어져요." },
  ],
  notes: ["순서를 설명하는 개념도예요. 칸의 개수와 크기는 반복 수·시간·거리·강도를 뜻하지 않아요.",
    "두 구성이 같은 자극이나 효과를 낸다는 뜻은 아니에요.", cruise.useBoundary],
  sources: [{ label: cruise.sourceLabel, url: cruise.sourceUrl }],
}

function recoverySteps(group: string, splitSets: boolean): VisualTrainingStep[] {
  const result: VisualTrainingStep[] = []
  for (let index = 0; index < 4; index++) {
    result.push({ id: `${splitSets ? "sets" : "repeats"}-work-${index + 1}`, group,
      label: splitSets ? `${Math.floor(index / 2) + 1}세트 · ${index % 2 + 1}회` : `${index + 1}회`,
      amount: "400m", kind: "work", instruction: "기존 학습 사례의 운동 거리예요. 개인에게 정한 반복 목표가 아니에요." })
    if (index === 3) continue
    const betweenSets = splitSets && index === 1
    result.push({ id: `${splitSets ? "sets" : "repeats"}-recovery-${index + 1}`, group,
      label: betweenSets ? "세트 사이 회복" : "반복 사이 회복", amount: splitSets ? "시간 미제시" : "60초", kind: "recovery",
      instruction: splitSets ? "이 사례에 회복 시간이 제시되지 않았어요. 임의의 시간으로 채우지 않아요." : "첫 번째 사례에 제시된 반복 사이 회복이에요.",
      explanation: betweenSets ? "세트 사이의 별도 회복과 반복 사이 회복을 구분해서 읽어요." : undefined })
  }
  return result
}

const sameRepeatsDifferentRecovery: VisualTrainingGuideData = {
  id: "same-repeats-different-recovery",
  title: "같은 거리, 다른 회복 구성",
  contextLabel: "학습용 합성 예시 · 개인 처방 아님",
  summary: "두 구성의 운동 거리는 모두 1600m지만 회복과 세트 구성이 달라요.",
  layout: "comparison",
  steps: [...recoverySteps("400m × 4회", false), ...recoverySteps("400m × 2회 × 2세트", true)],
  notes: ["순서와 세트 구분을 보여주는 구조도예요. 칸의 폭은 시간 비례가 아니에요.",
    "두 번째 구성의 회복 시간과 마지막 운동 뒤 회복은 제시되지 않았어요. 전체 소요 시간은 계산하지 않아요.",
    "운동 거리가 같아도 회복·전체 시간·훈련 효과가 같다는 뜻은 아니에요."],
}

export function trainingVisualContent(id: TrainingVisualContentId): VisualTrainingGuideData {
  if (id === "CONTINUOUS_AND_CRUISE") return continuousAndCruise
  if (id === "SAME_REPEATS_DIFFERENT_RECOVERY") return sameRepeatsDifferentRecovery
  throw new RangeError("Unknown training visual content")
}

export function trainingVisualForArticle(id: TrainingContentId): VisualTrainingGuideData | null {
  return id === "CRUISE_INTERVALS" ? continuousAndCruise : null
}

const unitLabels: Readonly<Record<string, string>> = { count: "개", days: "일", s: "초", min: "분", m: "m", km: "km", RPE: "RPE", reps: "회", sets: "세트" }

function hasReadableTrainingSource(fact: OracleReadingFact, reading: OracleContentReading): boolean {
  return fact.owner === "SELF" && fact.sourceRefs.length > 0 && fact.sourceRefs.every(ref => (
    (ref.source === "training" || ref.source === "planActual")
    && ref.sourceVersion.length > 0 && Boolean(reading.sourceVersions[ref.source])
    && (ref.source === "training" ? ref.sourceVersion === reading.sourceVersions.training
      : ref.provenance === "ORIGINAL_PLAN" && Boolean(ref.itemId) && Boolean(ref.date))
    && (reading.inputStates[ref.source] === "SUFFICIENT" || reading.inputStates[ref.source] === "PARTIAL")
    && ["EXPLICIT", "CONFIRMED_FILE", "SELF_REPORTED", "ORIGINAL_PLAN"].includes(ref.provenance)
  ))
}

function displayFingerprint(value: unknown): string {
  const serialized = JSON.stringify(value) ?? ""
  let hash = 2166136261
  for (let index = 0; index < serialized.length; index++) {
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Reads the existing typed facts only. Display strings are never a numeric source. */
export function oracleTrainingVisual(reading: OracleContentReading): VisualTrainingGuideData | null {
  if (reading.kind === "EDUCATION") {
    if (reading.topicId === "D02") return continuousAndCruise
    if (reading.topicId === "D03" || reading.topicId === "H04") return sameRepeatsDifferentRecovery
    return null
  }
  if (!reading.personalized || !["SUFFICIENT", "PARTIAL"].includes(reading.status)
    || Object.values(reading.inputStates).includes("REVOKED")) return null
  const purpose = reading.topicId === "C02"
  if (!purpose && reading.topicId !== "C07" && reading.topicId !== "G03") return null
  const facts = reading.facts.filter(fact => typeof fact.value === "number" && Number.isFinite(fact.value)
    && Object.prototype.hasOwnProperty.call(unitLabels, fact.unit)
    && (purpose ? fact.metric === "M13" && fact.unit === "count" && fact.value >= 0 : fact.metric === "M15" || fact.metric === "M19")
    && hasReadableTrainingSource(fact, reading))
  if (!facts.length) return null
  // Record/account identities are excluded. Remount when displayed facts or their
  // source context change so a selected step and open explanation cannot go stale.
  const fingerprint = displayFingerprint({ status: reading.status, contentVersion: reading.contentVersion,
    readerVersion: reading.readerVersion, limitations: reading.limitations,
    sourceVersions: { training: reading.sourceVersions.training, planActual: reading.sourceVersions.planActual },
    facts: facts.map(fact => ({ label: fact.label, value: fact.value, unit: fact.unit,
      metric: fact.metric, period: fact.period, denominator: fact.denominator,
      sources: fact.sourceRefs.map(ref => ({ source: ref.source, sourceVersion: ref.sourceVersion, date: ref.date, provenance: ref.provenance })),
    })),
  })
  return {
    id: `oracle-${reading.topicId}-${fingerprint}`,
    title: purpose ? "기록한 훈련 목적 살펴보기" : "당시 계획과 수행 수치 살펴보기",
    contextLabel: reading.status === "PARTIAL" ? "내 기록 · 확인한 일부 자료" : "내 기록 · 확인한 자료 기준",
    layout: "facts",
    summary: purpose ? "항목을 고르면 횟수와 기록의 범위를 확인할 수 있어요. 에너지 공급 비율을 뜻하지 않아요." : "항목을 고르면 기존 풀이가 확인한 수치와 출처를 볼 수 있어요. 단위가 다른 값을 하나의 크기로 비교하지 않아요.",
    steps: facts.map(fact => ({ id: fact.id, label: fact.label,
      amount: `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(fact.value as number)} ${unitLabels[fact.unit]}`,
      kind: "record" as const,
      instruction: fact.label,
      explanation: fact.period ? `${fact.period.startDate} ~ ${fact.period.endDate}` : "풀이에 연결된 당시 자료 기준이에요.",
      details: [...new Set(fact.sourceRefs.map(ref => `${ref.provenance === "ORIGINAL_PLAN" ? "당시 계획 원본" : ref.provenance === "CONFIRMED_FILE" ? "확인한 파일 자료" : "직접 기록한 수행"} · ${ref.date ?? "날짜 미제공"}`)),
        ...(fact.denominator === undefined ? [] : [`확인한 ${fact.denominator}개 기준`])],
    })),
    notes: [...reading.limitations, "기록한 수치를 설명하는 보기예요. 계획·몸 상태·훈련 목표를 바꾸지 않아요."],
  }
}
