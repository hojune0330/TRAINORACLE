import { CircleHelp } from "lucide-react"
import type { PaceTargetPlanPrescription } from "@impl/plan-generator/types"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { formatPaceSeconds, RECORD_PACE_VERSION } from "@impl/prescription/record-pace"

const NUMBER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 })
const RECORD_KIND = { PB: "개인 최고", SB: "시즌 최고", RECENT_RESULT: "최근 경기", GOAL: "목표 기록" } as const
const VERIFICATION = { VERIFIED: "검증된 기록", SELF_REPORTED: "직접 입력한 기록", UNVERIFIED: "검증되지 않은 기록" } as const

type RecommendationInput = Pick<PaceTargetPlanPrescription,
  "selectedAnchor" | "repetitionDistanceM" | "targetRepSeconds" | "templateId" | "templateVersion" | "displayRoundingPolicyVersion">

export function PaceRecommendation({ prescription }: { readonly prescription: RecommendationInput }) {
  const anchor = prescription.selectedAnchor
  return (
    <aside className="plan-pace-recommendation" aria-label="추천 페이스 기준">
      <p>기준: {anchor.eventDistanceM}m {RECORD_KIND[anchor.kind]} {formatRecordTime(anchor.performanceSeconds)}</p>
      <details>
        <summary><CircleHelp size={18} aria-hidden="true" /><span>추천 기준</span><span className="plan-pace-recommendation__badge">{anchor.kind === "GOAL" ? "목표 기록 기반 · 현재 실력 아님" : "개인 기록 기반"}</span></summary>
        <div>
          <dl>
            <dt>계산에 쓴 기록</dt>
            <dd>{RECORD_KIND[anchor.kind]} · {anchor.eventDistanceM}m {formatRecordTime(anchor.performanceSeconds)} · {anchor.achievedAt ?? "미달성 목표"}<br />{VERIFICATION[anchor.verificationState]} · {anchor.kind === "GOAL" ? "목표 기준으로 직접 선택 · 현재 실력 아님" : "현재 실력의 기준으로 직접 선택"}</dd>
            <dt>반복당 추천 시간</dt>
            <dd>{prescription.repetitionDistanceM}m당 약 {formatPaceSeconds(prescription.targetRepSeconds)}<br />같은 종목의 경기 평균 속도를 반복 거리에 적용했어요. 이 반복 거리의 최고기록을 예측한 값은 아니에요.</dd>
            <dt>계산식</dt>
            <dd><code>{NUMBER.format(anchor.performanceSeconds)}초 × {prescription.repetitionDistanceM}m ÷ {anchor.eventDistanceM}m</code><br />계산값 약 {NUMBER.format(prescription.targetRepSeconds)}초 · 구간 목표는 0.1초, km 페이스는 1초 단위로 표시해요.<br />저장된 계산값은 반올림하지 않아요.</dd>
            <dt>휴식 시간을 정한 기준</dt>
            <dd>휴식은 개인 기록에서 계산한 시간이 아니라 선택한 훈련 구성의 회복 기준이에요. 본운동 페이스가 달라져도 자동으로 줄이지 않아요.</dd>
            <dt>이 값에 포함되지 않은 것</dt>
            <dd>오늘의 피로·날씨·바람·경사에 따른 보정은 하지 않았어요. 계산이 정확해도 오늘 반드시 맞출 수 있는 시간이라는 뜻은 아니에요.</dd>
          </dl>
          <p>억지로 시간을 맞추지 마세요. 자세가 흐트러지거나 평소와 다른 통증·어지럼·호흡 곤란이 생기면 중단하고 몸 상태를 확인하세요.</p>
          <small>계산: 동일 종목 경기 페이스 · 훈련 구성 {prescription.templateId} v{prescription.templateVersion} · 현재 표시 {RECORD_PACE_VERSION} · 당시 정책 {prescription.displayRoundingPolicyVersion}</small>
        </div>
      </details>
      <p className="plan-pace-recommendation__notice">{anchor.kind === "GOAL" ? "목표 기록을 나눈 기준값이며, 현재 달성 가능한 실력을 뜻하지 않아요." : "추천 시간은 개인 기록을 나눈 기준값이에요."} 오늘 컨디션·날씨에 따라 조절하세요.</p>
    </aside>
  )
}
