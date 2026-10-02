import React from "react"
import { decorationCatalogItem } from "../domain/decoration-catalog"
import {
  accountCalendarDecorationStatus,
  loadAccountCalendarDecorationConflict,
  resolveAccountCalendarDecorationConflict,
  type AccountCalendarDecorationConflict,
  ACCOUNT_CALENDAR_DECORATION_EVENT,
} from "../domain/account/account-calendar-decoration-service"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import type { CalendarDecorationState } from "../domain/calendar-decoration-schema"

const actionStyle: React.CSSProperties = { minHeight: 44, padding: "8px 12px", whiteSpace: "normal" }

function themeName(state: CalendarDecorationState | null): string {
  if (!state?.paperThemeId) return "기본 종이"
  return decorationCatalogItem(state.paperThemeId)?.name ?? "이름을 확인할 수 없는 테마"
}

function VersionSummary({ title, state }: { readonly title: string; readonly state: CalendarDecorationState | null }) {
  const header = state?.items.filter(item => item.region === "HEADER_MARGIN").length ?? 0
  const footer = state?.items.filter(item => item.region === "FOOTER_MARGIN").length ?? 0
  return <section aria-label={title} style={{ minWidth: 0, padding: "10px 0", borderTop: "1px solid var(--line)", overflowWrap: "anywhere" }}>
    <h3 style={{ fontSize: "var(--fs-body)", margin: "0 0 6px" }}>{title}</h3>
    <p style={{ margin: 0 }}>종이 테마 {themeName(state)} · 상단 여백 장식 {header}개 · 하단 여백 장식 {footer}개</p>
    {state && state.items.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {state.items.map(item => <li key={item.placementId}>
        {decorationCatalogItem(item.itemId)?.name ?? "확인할 수 없는 장식"} · {item.region === "HEADER_MARGIN" ? "상단 여백" : "하단 여백"}
      </li>)}
    </ul>}
  </section>
}

export function AccountCalendarDecorationConflictPanel({ onBeforeResolve, onResolved }: {
  /** Parent can first request an unsaved-edit decision, then invoke the supplied action. */
  readonly onBeforeResolve?: (action: () => void) => void
  readonly onResolved?: () => void
}) {
  const owner = React.useSyncExternalStore(onLocalJournalScopeChange, activeLocalAccount, () => null)
  return owner ? <OwnerPanel key={owner} owner={owner} onBeforeResolve={onBeforeResolve} onResolved={onResolved} /> : null
}

function OwnerPanel({ owner, onBeforeResolve, onResolved }: {
  readonly owner: string
  readonly onBeforeResolve?: (action: () => void) => void
  readonly onResolved?: () => void
}) {
  const status = React.useSyncExternalStore(callback => {
    window.addEventListener(ACCOUNT_CALENDAR_DECORATION_EVENT, callback)
    return () => window.removeEventListener(ACCOUNT_CALENDAR_DECORATION_EVENT, callback)
  }, accountCalendarDecorationStatus, () => "IDLE")
  const [review, setReview] = React.useState<AccountCalendarDecorationConflict | null>(null)
  const [message, setMessage] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const alive = React.useRef(true)
  const running = React.useRef(false)
  React.useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const current = () => alive.current && activeLocalAccount() === owner

  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setMessage("")
    try { await action() }
    catch { if (current()) setMessage("선택을 확인하지 못했어요. 두 보관 내용은 그대로 유지했어요.") }
    finally { running.current = false; if (current()) setBusy(false) }
  }

  const openReview = () => void run(async () => {
    setReview(null)
    const result = await loadAccountCalendarDecorationConflict()
    if (!current()) return
    setReview(result)
    if (!result) setMessage("계정의 최신 달력 꾸밈을 가져오지 못했어요. 연결과 계정 상태를 확인해 주세요.")
  })

  const resolve = (choice: "LOCAL" | "REMOTE") => {
    if (!review || busy) return
    const action = () => void run(async () => {
      const accepted = await resolveAccountCalendarDecorationConflict(review, choice)
      if (!current()) return
      setReview(null)
      if (!accepted) {
        setMessage(accountCalendarDecorationStatus() === "CONFLICT"
          ? "내용이나 보유 상태가 바뀌어 반영하지 않았어요. 최신 두 버전을 다시 확인해 주세요."
          : "선택을 반영하지 못했어요. 보관 내용은 유지했어요.")
        return
      }
      onResolved?.()
      setMessage(accountCalendarDecorationStatus() === "PENDING"
        ? "선택한 달력 꾸밈을 기기에 보관했어요. 계정 저장은 연결 대기 중이에요."
        : "선택한 달력 꾸밈을 반영했어요. 필요하면 다시 최신 내용을 확인해 주세요.")
    })
    if (onBeforeResolve) onBeforeResolve(action)
    else action()
  }

  return <section className="account-calendar-decoration-conflict" aria-busy={busy} aria-label="계정 달력 꾸밈 충돌 확인">
    {status === "CONFLICT" && !review && <button type="button" style={actionStyle} disabled={busy} onClick={openReview}>
      달력 꾸밈 두 버전 비교하기
    </button>}
    {(status === "PENDING" || status === "FAILED" || status === "UNSUPPORTED" || status === "OWNERSHIP_STATE_CHANGED") && !review && !message && (
      <p role="status">{status === "PENDING" ? "기기 달력 꾸밈은 보관했어요. 계정 저장 확인을 기다리고 있어요." : status === "OWNERSHIP_STATE_CHANGED"
        ? "달력 장식의 보유 상태가 바뀌었어요. 최신 꾸밈을 확인하기 전에는 계정에 덮어쓰지 않았어요."
        : status === "UNSUPPORTED" ? "이 계정의 달력 꾸밈 형식을 확인할 수 없어 기존 보관 내용을 유지했어요."
          : "계정 달력 꾸밈을 확인하지 못했어요. 현재 보관 내용은 삭제하지 않았어요."}</p>
    )}
    {(busy || message) && <p role="status">{busy ? "달력 꾸밈 내용을 확인하고 있어요." : message}</p>}
    {review && <>
      <p>기기 수정본 {review.localSequence} · 계정 수정본 {review.remoteRevision}. 날짜 배치나 일지 내용은 이 달력 꾸밈과 별도로 보관돼요.</p>
      <VersionSummary title="이 기기에 보관된 달력 꾸밈" state={review.local} />
      <VersionSummary title="계정에 저장된 달력 꾸밈" state={review.remote} />
      <p>한쪽을 선택하면 전역 달력 테마와 여백 장식 전체를 적용해요. 일부 장식만 합치거나 자동으로 최신 시각을 선택하지 않아요.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={actionStyle} disabled={busy || review.remote === null} onClick={() => resolve("LOCAL")}>
          기기 꾸밈 다시 적용
        </button>
        <button type="button" style={actionStyle} disabled={busy} onClick={() => resolve("REMOTE")}>
          계정 꾸밈 사용
        </button>
      </div>
    </>}
  </section>
}
