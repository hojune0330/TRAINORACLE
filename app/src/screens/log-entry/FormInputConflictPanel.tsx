import type { AccountJournalConflictArchive, AccountJournalDraftView, ConflictChoice } from "../../domain/account/account-journal-draft-buffer"
import { decodeFormDraft, type FormDraftBody, type FormInput } from "./form-input-draft"
import type { FormEnvelope, FormRecoveryItem } from "./form-input-recovery"
import { JOURNAL_ENERGY_SYSTEM_OPTIONS } from "../../domain/energy-system-taxonomy"

export type FormConflictReview = {
  primary: AccountJournalDraftView<FormEnvelope> | null
  recoveries: FormRecoveryItem[]
  archive: AccountJournalConflictArchive<FormEnvelope>[]
}
const labels: Record<string, string> = {
  sleep: "수면 시간", quality: "수면 질", mood: "감정", painParts: "통증 부위", weight: "체중", hr: "안정시 심박",
  memo: "메모", purpose: "메모 용도", stage: "경기 단계", record: "경기 기록", rank: "순위", result: "결과",
  tension: "긴장도", condition: "컨디션", paceMinutes: "목표 페이스 분", paceSeconds: "목표 페이스 초",
  rpe: "RPE", effortAnswered: "RPE 응답 여부", step: "입력 단계", outcome: "운동 결과", slot: "시간대",
  activityOutcome: "운동 결과", activitySlot: "시간대", painStatus: "몸 상태 응답", painCheckStatus: "몸 상태 응답",
  system: "강도 시스템", title: "세션 제목", distanceKm: "거리", durationMin: "시간", avgPace: "평균 페이스",
  plannedRpe: "예상 강도", objectiveComponents: "추가한 객관 기록", objectiveEditor: "추가 전 객관 기록",
  kind: "종류", fields: "입력", workSeconds: "운동 시간 (초)", recoverySeconds: "회복 시간 (초)", repetitions: "반복 횟수",
  actualPace: "실제 페이스 (/km)", typicalDistanceKm: "평소 거리 (km)", referencePace: "개인 기준 페이스 (/km)",
  actualPaceSecondsPerKm: "실제 페이스 (초/km)", referencePaceSecondsPerKm: "개인 기준 페이스 (초/km)",
  exerciseType: "운동 종류", sets: "세트", loadPercent1Rm: "최대 1회 중량 대비 강도 (%)", repsInReserve: "남은 반복 횟수",
  contacts: "접지 수", typicalContacts: "평소 접지 수", gradePercent: "경사 (%)", modality: "운동 종류",
  heartRatePercent: "최대 심박 대비 평균 심박 (%)", averageHeartRatePercentMax: "최대 심박 대비 평균 심박 (%)",
}
const values: Record<string, string> = { PRIVATE_SELF_ONLY: "나만의 메모", ANALYZABLE_TRAINING_NOTE: "훈련 메모",
  COMPLETED: "운동 완료", PARTIAL: "일부 완료", LIGHT_ACTIVITY: "가벼운 운동", RESTED: "휴식", SKIPPED: "건너뜀",
  UNANSWERED: "미응답", NO_SIGNAL_REPORTED: "불편한 곳 없음", SIGNAL_REPORTED: "불편한 곳 있음",
  UNSPECIFIED: "시간 미지정", AM: "오전", PM: "오후", pre: "경기 직전", post: "경기 직후", activity: "운동 선택", effort: "몸의 느낌",
  RUNNING: "달리기", INTERVALS: "인터벌", STRENGTH: "근력", PLYOMETRIC: "플라이오", HILLS: "언덕", CROSS_TRAINING: "대체유산소" }
const enumFields = new Set(["purpose", "outcome", "activityOutcome", "slot", "activitySlot", "painStatus", "painCheckStatus", "stage", "step", "kind"])
const bodyParts: Record<string, string> = { rKnee: "오른 무릎", lKnee: "왼 무릎", rCalf: "오른 종아리", lCalf: "왼 종아리",
  rHam: "오른 햄스트링", lHam: "왼 햄스트링", lBack: "허리", rFoot: "오른 발", lFoot: "왼 발", rShin: "정강이" }
export function formatFormDraftValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "미입력"
  if (typeof value === "boolean") return key === "effortAnswered" ? value ? "응답함" : "미응답" : value ? "예" : "아니요"
  if (Array.isArray(value)) return value.length ? value.map(part => formatFormDraftValue(key, part)).join("; ") : "없음"
  if (typeof value === "object") return Object.entries(value).filter(([field]) => field !== "componentId")
    .map(([field, part]) => `${key === "painParts" ? bodyParts[field] ?? "기타 부위" : labels[field] ?? "추가 항목"}: ${formatFormDraftValue(key === "painParts" ? "painLevel" : field, part)}`).join(" / ") || "없음"
  if (key === "system") return JOURNAL_ENERGY_SYSTEM_OPTIONS.find(option =>
    option.journalValue === value || option.key === value || option.code === value)?.shortLabel ?? "기존 강도 분류 · 확인 필요"
  if (enumFields.has(key)) return values[String(value)] ?? "분류 확인 필요"
  return String(value)
}
export function FormDraftPreview({ body }: { body: FormDraftBody }) {
  return <dl style={{ margin: 0, display: "grid", gap: 4, overflowWrap: "anywhere", fontSize: "var(--fs-caption)" }}>
    {Object.entries(body.input).filter(([key]) => key !== "kind").map(([key, value]) => <div key={key}>
      <dt style={{ color: "var(--ink-3)" }}>{labels[key] ?? "추가 항목"}</dt>
      <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{formatFormInputValue(body.input, key, value)}</dd>
    </div>)}
  </dl>
}
export function formatFormInputValue(input: FormInput, key: string, value: unknown): string {
  if (input.kind === "quick" && key === "rpe") {
    if (!input.effortAnswered) return "미입력"
    if (input.rpe === 0) return "건너뜀"
  }
  if (value === 0 && (input.kind === "evening" && (key === "quality" || key === "mood")
    || input.kind === "post-session" && (key === "rpe" || key === "plannedRpe"))) return "미입력"
  return formatFormDraftValue(key, value)
}
const button = { minHeight: 44, padding: "8px 12px", border: "1px solid var(--line)", background: "transparent", color: "var(--ink)" }

export function FormInputConflictPanel({ review, busy, deleted = false, onRefresh, onChoose, onRecovery, onArchive }: {
  review: FormConflictReview; busy: boolean; deleted?: boolean; onRefresh: () => void
  onChoose: (choice: ConflictChoice) => void
  onRecovery: (item: FormRecoveryItem, choice: "RECOVERY" | "CURRENT") => void
  onArchive: (snapshot: FormEnvelope) => void
}) {
  const view = review.primary
  const open = review.recoveries.filter(item => item.draft.state === "OPEN")
  const archived = review.recoveries.filter(item => item.draft.state === "ARCHIVED")
  if (!view?.blocked && !open.length && !archived.length && !review.archive.length) return null
  return <section aria-label="입력 초안 충돌 및 복구" style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
    <h2 style={{ fontSize: "var(--fs-h3)", margin: "0 0 8px" }}>초안 확인·복구</h2>
    {deleted && <p>삭제를 반영한 초안의 보관본은 열람만 가능합니다. 계정으로 다시 전송하지 않습니다.</p>}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {(view?.blocked || open.length > 0) && <button type="button" style={button} onClick={onRefresh}>최신 내용 다시 확인</button>}
      {view?.blocked && <>
        <p role="status">서로 다른 수정본이 있어요. 선택하지 않은 입력도 이 기기에 보관합니다. 기록 완료와는 별개입니다.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
          <section aria-label="이 기기 수정본"><h3 style={{ fontSize: "var(--fs-body)" }}>이 기기 입력</h3><FormDraftPreview body={decodeFormDraft(view.draft)} /></section>
          <section aria-label="계정 수정본"><h3 style={{ fontSize: "var(--fs-body)" }}>계정 입력 · 수정 버전 {view.blocked.currentRevision}</h3>
            {view.remoteDeleted ? <p>계정에서 삭제됨</p> : view.remoteDraft ? <FormDraftPreview body={decodeFormDraft(view.remoteDraft)} /> : <p>계정 수정본 확인 필요</p>}
          </section>
        </div>
        {view.blocked.kind === "REMOTE" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {view.remoteDeleted ? <button type="button" style={button} onClick={() => onChoose("DELETE")}>계정 삭제 반영 · 입력은 보관</button> : <>
            <button type="button" style={button} onClick={() => onChoose("LOCAL")}>이 기기 입력 사용</button>
            <button type="button" style={button} onClick={() => onChoose("REMOTE")}>계정 입력 사용</button>
          </>}
        </div>}
      </>}
      {open.map((item, index) => <div key={item.documentId} style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 }}>
        <h3 style={{ fontSize: "var(--fs-body)" }}>다른 창에서 보호한 입력 {index + 1}</h3>
        <FormDraftPreview body={decodeFormDraft(item.draft.snapshot)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button type="button" style={button} disabled={deleted} onClick={() => onRecovery(item, "RECOVERY")}>이 복구본으로 계속</button>
          <button type="button" style={button} onClick={() => onRecovery(item, "CURRENT")}>현재 초안 사용 · 복구본은 보관</button>
        </div>
      </div>)}
      {(archived.length > 0 || review.archive.length > 0) && <details style={{ marginTop: 16 }}>
        <summary style={{ minHeight: 44 }}>보관한 수정본 {archived.length + review.archive.length}건</summary>
        {archived.map((item, index) => <details key={item.documentId}>
          <summary style={{ minHeight: 44 }}>기기 보관본 {index + 1}</summary>
          <FormDraftPreview body={decodeFormDraft(item.draft.snapshot)} />
          <button type="button" style={button} disabled={deleted} onClick={() => onRecovery(item, "RECOVERY")}>이 보관본으로 계속</button>
        </details>)}
        {review.archive.map((item, index) => <details key={index}>
          <summary style={{ minHeight: 44 }}>충돌 보관본 {index + 1} · 수정 버전 {item.remoteRevision}</summary>
          <h3 style={{ fontSize: "var(--fs-body)" }}>당시 기기 입력</h3>
          <FormDraftPreview body={decodeFormDraft(item.local)} />
          <button type="button" style={button} disabled={deleted} onClick={() => onArchive(item.local)}>당시 기기 입력으로 계속</button>
          {item.remote && <><h3 style={{ fontSize: "var(--fs-body)" }}>당시 계정 입력</h3>
            <FormDraftPreview body={decodeFormDraft(item.remote)} />
            <button type="button" style={button} disabled={deleted} onClick={() => onArchive(item.remote!)}>당시 계정 입력으로 계속</button></>}
        </details>)}
      </details>}
    </fieldset>
  </section>
}
