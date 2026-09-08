import React from "react"
import type { JournalEntry } from "../../domain/journal-schema"
import { persistAccountJournalRecord } from "../../domain/account/account-journal-record-service"
import { activeLocalAccount } from "../../domain/account/local-journal-ownership"
import { isAccountJournalWriteRejection, type AccountJournalWriteRejection } from "../../domain/account/account-write-rejection"
import { readFormFinalization } from "./form-finalization-reader"

type Result = Awaited<ReturnType<typeof persistAccountJournalRecord>>
type Attempt = { entry: JournalEntry; expectedSavedAt?: string; state: "PENDING" | "CONFLICT" | "ACK" | "REJECTED"; rejection?: AccountJournalWriteRejection }
const rejected: Record<AccountJournalWriteRejection, string> = {
  PLANNED_SESSION_ALREADY_RECORDED: "연결된 계획 세션이 이미 기록되어 저장이 거절됐어요. 계정의 기존 기록을 먼저 확인해 주세요.",
  INSUFFICIENT_POINTS: "포인트가 부족해 저장 요청이 거절됐어요. 계정의 포인트와 요청 내용을 확인해 주세요.",
  OPERATION_REPLAY_UNAVAILABLE: "이전 저장 요청의 결과를 다시 확인할 수 없어요. 계정 기록을 먼저 확인해 주세요.",
}
const editedPending = "이전 저장 요청이 남아 있어 변경한 내용을 전송하지 않았어요. 현재 입력은 유지합니다. 이전 요청부터 그대로 확인해 주세요."
const unavailable = "계정 저장을 완료하지 못했어요. 입력은 유지했어요. 이전 저장 상태를 확인한 뒤 다시 시도해 주세요."
const failed = { ok: false as const, storage: "FAILED" as const }

function sameContent(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const keys = Object.keys(a).filter(key => a[key] !== undefined).sort()
  const other = Object.keys(b).filter(key => b[key] !== undefined).sort()
  return keys.length === other.length && keys.every((key, index) => key === other[index] && sameContent(a[key], b[key]))
}
export function sameFinalizationInput(left: JournalEntry, right: JournalEntry) {
  const { savedAt: _a, syncState: _as, ...a } = left
  const { savedAt: _b, syncState: _bs, ...b } = right
  return sameContent(a, b)
}

export function useFormFinalization(entryId: string, enabled: boolean, savedAt: React.MutableRefObject<string | undefined>) {
  const owner = React.useRef(activeLocalAccount())
  const alive = React.useRef(true)
  const inFlight = React.useRef(false)
  const readVersion = React.useRef(0)
  const attempt = React.useRef<Attempt | null>(null)
  const [review, setReview] = React.useState<Attempt | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const current = () => alive.current && enabled && activeLocalAccount() === owner.current
  const show = (value: Attempt | null, message?: string) => {
    attempt.current = value
    if (current()) { setReview(value); if (message) setNotice(message) }
  }
  async function load(): Promise<Attempt | null> {
    const version = ++readVersion.current
    const view = await readFormFinalization(owner.current, entryId)
    if (!current()) throw new Error("Form scope changed")
    if (version !== readVersion.current) return attempt.current
    if (!view) return attempt.current
    const entry = view.pending?.draft.entry ?? view.draft.entry
    if (view.resolvedDeletion || view.pending && !sameFinalizationInput(entry, view.draft.entry)) {
      show({ entry, state: "CONFLICT" }, "다른 수정본 또는 삭제된 기록이 있어요. 계정 기록에서 먼저 확인해 주세요.")
      return attempt.current
    }
    const next: Attempt = { entry, expectedSavedAt: savedAt.current,
      state: view.pending?.rejection ? "REJECTED" : view.blocked ? "CONFLICT" : view.state === "DRAFT_ACKNOWLEDGED" ? "ACK" : "PENDING",
      ...(view.pending?.rejection ? { rejection: view.pending.rejection } : {}) }
    show(next, next.rejection ? rejected[next.rejection] : next.state === "PENDING" ? "이전 저장 요청의 계정 확인을 기다리고 있어요." : undefined)
    return next
  }
  React.useEffect(() => {
    alive.current = true
    if (enabled) void load().catch(() => { if (current()) setNotice(unavailable) })
    return () => { alive.current = false }
  }, [enabled, entryId])

  async function transmit(value: Attempt): Promise<Result> {
    show(value)
    const result = await persistAccountJournalRecord(value.entry, value.expectedSavedAt)
    if (!current()) return failed
    if (result.ok && result.storage === "ACCOUNT") {
      show({ ...value, state: "ACK" })
      savedAt.current = value.entry.savedAt
    } else if (!result.ok && "rejection" in result && isAccountJournalWriteRejection(result.rejection)) {
      show({ ...value, state: "REJECTED", rejection: result.rejection }, rejected[result.rejection])
    } else show({ ...value, state: result.ok && result.storage === "CONFLICT" ? "CONFLICT" : "PENDING" })
    return result
  }
  async function save<T extends JournalEntry>(candidate: T, expectedSavedAt?: string): Promise<Result & { entry: T; notice?: string }> {
    if (!current() || inFlight.current) return { ...failed, entry: candidate, notice: unavailable }
    inFlight.current = true; setBusy(true)
    try {
      const old = await load()
      if (old?.rejection) return { ...failed, rejection: old.rejection, entry: candidate, notice: rejected[old.rejection] }
      const same = old && sameFinalizationInput(old.entry, candidate)
      if (old && !same && (old.state !== "ACK" || old.entry.savedAt !== expectedSavedAt)) {
        show(old, editedPending)
        return { ...failed, entry: candidate, notice: editedPending }
      }
      const selected: Attempt = old && same ? old : { entry: structuredClone(candidate), expectedSavedAt, state: "PENDING" }
      const result = await transmit(selected)
      if (current() && result.ok && result.storage === "ACCOUNT") setNotice(null)
      return { ...result, entry: selected.entry as T, ...(!result.ok && "rejection" in result ? { notice: rejected[result.rejection] } : {}) }
    } catch {
      if (current()) setNotice(unavailable)
      return { ...failed, entry: candidate, notice: unavailable }
    } finally { inFlight.current = false; if (current()) setBusy(false) }
  }
  async function retryPrevious() {
    if (!current() || inFlight.current) return
    inFlight.current = true; setBusy(true)
    try {
      const old = await load()
      if (!old || old.rejection || old.state === "CONFLICT") return
      const result = await transmit(old)
      if (current() && (result.ok || !("rejection" in result))) setNotice(result.ok && result.storage === "ACCOUNT"
        ? "이전 요청의 계정 저장을 확인했어요. 현재 수정 내용은 아직 완료되지 않았어요. 내용을 확인한 뒤 저장해 주세요."
        : "이전 요청을 그대로 유지하고 있어요. 현재 수정 내용은 전송하지 않았어요.")
    } catch { if (current()) setNotice(unavailable) }
    finally { inFlight.current = false; if (current()) setBusy(false) }
  }
  async function refreshRejection() {
    if (inFlight.current || !current()) return
    inFlight.current = true; setBusy(true)
    try { await load() } catch { if (current()) setNotice(unavailable) }
    finally { inFlight.current = false; if (current()) setBusy(false) }
  }
  return { save, review, notice, busy, retryPrevious, refreshRejection }
}

export function FormFinalizationRecovery({ recovery, onBack }: {
  recovery: ReturnType<typeof useFormFinalization>; onBack: () => void
}) {
  if (!recovery.notice && (!recovery.review || recovery.review.state === "ACK")) return null
  const rejectedRequest = !!recovery.review?.rejection
  return <section aria-label="최종 저장 요청 확인" style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
    <h2 style={{ fontSize: "var(--fs-body)", margin: "0 0 8px" }}>이전 저장 요청 확인</h2>
    <p role="status">{recovery.notice ?? "이전 저장 요청을 보관하고 있어요. 기록 완료는 아직이에요."}</p>
    {rejectedRequest && <p>입력과 거절된 요청은 유지합니다. 새 요청을 자동으로 만들거나 다시 전송하지 않습니다.</p>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {recovery.review && !rejectedRequest && recovery.review.state !== "CONFLICT" && <button type="button" disabled={recovery.busy}
        style={{ minHeight: 44 }} onClick={() => void recovery.retryPrevious()}>이전 요청 그대로 확인</button>}
      {rejectedRequest && <button type="button" disabled={recovery.busy} style={{ minHeight: 44 }}
        onClick={() => void recovery.refreshRejection()}>보관된 거절 상태 확인</button>}
      <button type="button" disabled={recovery.busy} style={{ minHeight: 44 }} onClick={onBack}>입력을 유지하고 돌아가기</button>
    </div>
  </section>
}
