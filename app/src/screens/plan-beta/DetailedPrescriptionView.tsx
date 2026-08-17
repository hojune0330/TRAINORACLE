import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { formatRecordTime } from "../../domain/athlete-record-display"

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
          1000m를 {formatDuration(prescription.targetRepSeconds)} 목표로 5회 · 총 5000m
        </span>
      </p>
      <p>
        <strong>반복 사이 회복</strong>
        <span>4번 · 매번 150초 조깅(JOG) · 총 600초</span>
      </p>
      <p>
        <strong>준비</strong>
        <span>
          {warmup.easyDurationMinutes}분 RPE {warmup.rpeMin}-{warmup.rpeMax} 쉬운 움직임 ·
          20초 점진 가속 {warmup.strides.repetitions}회, 사이 <span className="plan-session-term">40초</span> 걷기/조깅
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
          <p>낮춤 · 숫자 반복을 줄여 계산하지 않고 기존 RPE 후보로 되돌아갑니다.</p>
          <ul>
            {prescription.stopCodes.map((code) => <li key={code}>{stopLabel(code)}</li>)}
          </ul>
          <small>처방 지문 · {shortFingerprint(prescription.prescriptionFingerprint)}</small>
        </div>
      </details>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}분 ${String(rounded % 60).padStart(2, "0")}초`
}

function shortFingerprint(value: string): string {
  return value.length <= 28 ? value : `${value.slice(0, 14)}…${value.slice(-10)}`
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
