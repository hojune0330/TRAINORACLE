import { readAccountPlanHistorical } from "../../domain/account/account-plan-historical"
import type { AccountPlanPacket } from "../../domain/account/account-plan-document-schema"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { PROGRESS_LABELS } from "./labels"
import { isoShift } from "../../domain/dates"

export function AccountPlanHistoricalView({ packet, verificationPending = true }: {
  packet: AccountPlanPacket; verificationPending?: boolean;
}) {
  const read = readAccountPlanHistorical(packet)
  if (!read) return <p role="alert">보관한 계획의 형식을 확인하지 못했어요.</p>
  const plan = read.kind === "v2" || read.kind === "v3" ? read.state : read.state.selection
  const start = plan.intake.startDate ?? plan.generatedAt.slice(0, 10)
  return <section aria-label="계정 계획 원본">
    <h1>보관한 훈련 일정</h1>
    <p>{start}부터 · 저장 당시 원본</p>
    {verificationPending && <p role="alert">출처 검증 대기 · 저장한 훈련 내용과 진행 기록만 표시해요. 현재 훈련 실행이나 다음 계획 선택에 사용할 수 없어요.</p>}
    {plan.activePlan.sessions.map(session => <section key={`${session.day}:${session.slot}`}>
      <h2>{isoShift(start, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
      {read.kind === "v4" ? <AdjustedJournalOriginalPlan
        session={read.state.selection.activePlan.sessions.find(s => s.day === session.day && s.slot === session.slot)!}
        explanation={read.explanation} />
        : session.prescription.kind === "ADJUSTED_METHOD" ? null
          : <AdjustedPrescriptionV3 session={session as Parameters<typeof AdjustedPrescriptionV3>[0]["session"]}
            explanation={read.kind === "v5" ? read.explanation : read.kind === "v6"
              ? read.explanations.find(e => e.address.day === session.day && e.address.slot === session.slot)?.explanation : undefined} />}
      <p>{((progress) => progress ? PROGRESS_LABELS[progress.state] : "진행 기록 없음")(
        read.state.progress.find(p => p.sessionDay === session.day && p.sessionSlot === session.slot))}</p>
    </section>)}
  </section>
}
