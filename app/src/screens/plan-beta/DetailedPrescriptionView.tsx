import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { formatTrainingSeconds } from "./labels"

type Detailed = Extract<PlanSession["prescription"], { readonly kind: "PACE_TARGET" }>

export function DetailedPrescriptionView({ prescription }: { readonly prescription: Detailed }) {
  const warmup = prescription.operationalComponents.warmup
  const cooldown = prescription.operationalComponents.cooldown
  const anchor = prescription.selectedAnchor

  return (
    <div className="plan-detailed-prescription">
      <p className="plan-detailed-prescription__notation">
        <code>{prescription.notation}</code>
        <TermHelp term="training-notation" />
      </p>
      <p>
        <strong>본운동</strong>
        <span>
          {prescription.setCount > 1 && `${prescription.setCount}세트 · 세트마다 `}
          {prescription.repetitionDistanceM}m를 {formatTrainingSeconds(prescription.targetRepSeconds)} 목표로
          {" "}{prescription.repetitionsPerSet}회
          {prescription.setCount > 1 && ` · 총 ${prescription.totals.totalRepetitions}회`}
          {" · "}주요 구간 거리 {prescription.totals.qualityDistanceM}m
        </span>
      </p>
      {prescription.repetitionRecoverySeconds !== null && (
        <p>
          <strong>반복 사이 회복</strong>
          <span>
            {prescription.totals.repetitionRecoveryOccurrences}번 · 매번
            {" "}{prescription.repetitionRecoverySeconds}초
            {" "}{recoveryModeLabel(prescription.repetitionRecoveryMode)}
            {" · "}총 {prescription.totals.repetitionRecoveryTotalSeconds}초
          </span>
        </p>
      )}
      {prescription.setRecoverySeconds !== null && (
        <p>
          <strong>세트 사이 회복</strong>
          <span>
            {prescription.totals.setRecoveryOccurrences}번 · 매번
            {" "}{prescription.setRecoverySeconds}초
            {" "}{recoveryModeLabel(prescription.setRecoveryMode)}
            {" · "}총 {prescription.totals.setRecoveryTotalSeconds}초
          </span>
        </p>
      )}
      <p>
        <strong>준비</strong>
        <span>
          {warmup.easyDurationMinutes}분 RPE {warmup.rpeMin}-{warmup.rpeMax} 쉬운 움직임 ·
          {" "}{warmup.strides.durationSeconds}초 점진 가속 {warmup.strides.repetitions}회, 사이 <span className="plan-session-term">{warmup.strides.recoverySeconds}초</span> 걷기/조깅
        </span>
      </p>
      <p>
        <strong>정리</strong>
        <span>{cooldown.easyDurationMinutes}분 RPE {cooldown.rpeMin}-{cooldown.rpeMax} 쉬운 움직임</span>
      </p>
      <details>
        <summary>기준 기록·중단·낮춤 규칙 보기</summary>
        <div>
          <p>
            기준 기록 · {anchor.eventDistanceM}m {formatRecordTime(anchor.performanceSeconds)} · {anchor.achievedAt}
          </p>
          <p>낮춤 · 숫자 반복을 임의로 줄이지 않고 기존 RPE 계획안으로 돌아갑니다.</p>
          <ul>
            {prescription.stopCodes.map((code) => <li key={code}>{stopLabel(code)}</li>)}
          </ul>
          <small>처방 무결성 · 확인됨</small>
        </div>
      </details>
    </div>
  )
}

function recoveryModeLabel(mode: Detailed["repetitionRecoveryMode"]): string {
  switch (mode) {
    case "WALK":
      return "걷기"
    case "JOG":
      return "조깅"
    case "STAND":
      return "서서 쉬기"
    case "NOT_APPLICABLE":
      return ""
  }
}

function stopLabel(code: Detailed["stopCodes"][number]): string {
  switch (code) {
    case "STOP_NEW_OR_WORSENING_PAIN":
      return "새 통증이나 심해지는 통증이 생기면 중단"
    case "STOP_DIZZINESS_OR_FAINTNESS":
      return "어지럽거나 쓰러질 것 같으면 중단"
    case "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING":
      return "가슴 통증이나 평소와 다른 호흡 곤란이 생기면 중단"
    case "STOP_LOSS_OF_CONTROLLED_FORM":
      return "통제된 자세를 유지할 수 없으면 중단"
  }
}
