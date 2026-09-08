import React from "react"
import { loadAccountDecorationConflict, resolveAccountDecorationConflict, type AccountDecorationConflict,
  accountDecorationStatus, ACCOUNT_DECORATION_EVENT, readAccountDecorationConflictArchive,
  reviewAccountDecorationMigration, migrateAccountDecorations } from "../domain/account/account-decoration-service"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import type { DecorationState } from "../domain/decoration-schema"

const actionStyle: React.CSSProperties = { minHeight: 44, padding: "8px 12px", whiteSpace: "normal" }
function VersionSummary({ title, state }: { title: string; state: DecorationState | null }) {
  return <section aria-label={title} style={{ minWidth: 0, padding: "12px 0", borderTop: "1px solid var(--line)", overflowWrap: "anywhere" }}>
    <h3 style={{ fontSize: "var(--fs-body)" }}>{title}</h3>
    {state === null ? <p>계정에서 삭제했거나 저장된 꾸미기가 없어요.</p> : <>
      <p>꾸민 날짜 {state.pages.length}일 · 장식 {state.pages.reduce((sum, page) => sum + page.items.length, 0)}개 · 사용 포인트 {state.spentPoints}P</p>
      <p>테마 {state.equipped.themeId} · 잉크 {state.equipped.inkId} · 아바타 {state.equipped.avatarId ?? "없음"}</p>
      {state.pages.map(page => <details key={page.date} open>
        <summary style={{ minHeight: 44 }}>{page.date}</summary>
        <ul>{page.items.map((item, index) => <li key={index}>
          {"text" in item ? item.text : item.itemId} · 위치 {item.transform.xPercent}%, {item.transform.yPercent}%
          · 배율 {item.transform.scale} · 회전 {item.transform.rotationDeg}° {"inkId" in item ? item.inkId : ""}
        </li>)}</ul>
      </details>)}
      <details><summary style={{ minHeight: 44 }}>전체 보유·즐겨찾기·배치 정보</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{JSON.stringify(state, null, 2)}</pre>
      </details>
    </>}
  </section>
}
export function AccountDecorationConflictPanel() {
  const owner = React.useSyncExternalStore(onLocalJournalScopeChange, activeLocalAccount, () => null)
  return owner ? <OwnerPanel key={owner} owner={owner} /> : null
}
function OwnerPanel({ owner }: { owner: string }) {
  const status = React.useSyncExternalStore(callback => {
    window.addEventListener(ACCOUNT_DECORATION_EVENT, callback)
    return () => window.removeEventListener(ACCOUNT_DECORATION_EVENT, callback)
  }, accountDecorationStatus, () => "IDLE")
  const [review, setReview] = React.useState<AccountDecorationConflict | null>(null)
  const [archive, setArchive] = React.useState<Awaited<ReturnType<typeof readAccountDecorationConflictArchive>>>(null)
  const [migration, setMigration] = React.useState<Awaited<ReturnType<typeof reviewAccountDecorationMigration>>>(null)
  const [choice, setChoice] = React.useState<"LOCAL" | "REMOTE" | null>(null)
  const [message, setMessage] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const alive = React.useRef(true), running = React.useRef(false)
  React.useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const current = () => alive.current && activeLocalAccount() === owner
  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true; setBusy(true); setMessage("")
    try { await action() }
    catch { if (current()) setMessage("요청을 확인하지 못했어요. 보관한 내용은 삭제하지 않았어요.") }
    finally { running.current = false; if (current()) setBusy(false) }
  }
  return <div style={{ fontSize: "var(--fs-body)", overflowWrap: "anywhere" }} aria-busy={busy}>
    {status === "CONFLICT" && <button type="button" style={actionStyle} disabled={busy} onClick={() => void run(async () => {
      setArchive(null); setMigration(null); setReview(null); setChoice(null)
      const result = await loadAccountDecorationConflict()
      if (!current()) return
      setReview(result)
      if (!result) setMessage("최신 내용을 가져오지 못했어요. 연결과 계정 상태를 확인해 주세요.")
    })}>두 꾸미기 비교하기</button>}
    <button type="button" style={actionStyle} disabled={busy} onClick={() => void run(async () => {
      setReview(null); setMigration(null)
      const result = await readAccountDecorationConflictArchive(owner)
      if (!current()) return
      setArchive(result)
      if (!result?.length) setMessage(result ? "이 기기에 보존된 충돌본이 없어요." : "보존본을 읽지 못했어요.")
    })}>꾸미기 보존본 보기</button>
    <button type="button" style={actionStyle} disabled={busy} onClick={() => void run(async () => {
      setReview(null); setArchive(null)
      const result = await reviewAccountDecorationMigration()
      if (!current()) return
      setMigration(result)
      if (!result) setMessage(accountDecorationStatus() === "FAILED" ? "기기 꾸미기를 읽지 못했어요." : "이 계정에 연결된 기존 기기 꾸미기가 없어요.")
    })}>이 계정의 기기 꾸미기 확인</button>
    {(busy || message) && <p role="status">{busy ? "꾸미기 내용을 확인하고 있어요." : message}</p>}
    {review && <>
      <p>기기 수정본 {review.localSequence} · 계정 수정본 {review.remoteRevision}</p>
      <VersionSummary title="이 기기에서 바꾼 내용" state={review.local} />
      <VersionSummary title="계정에 저장된 내용" state={review.remote} />
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>반영할 꾸미기</legend>
        <label style={{ display: "block", minHeight: 44 }}><input type="radio" name="decoration-choice" disabled={review.remote === null} checked={choice === "LOCAL"} onChange={() => setChoice("LOCAL")} /> 이 기기 내용 사용</label>
        <label style={{ display: "block", minHeight: 44 }}><input type="radio" name="decoration-choice" checked={choice === "REMOTE"} onChange={() => setChoice("REMOTE")} /> {review.remote ? "계정 내용 사용" : "계정의 삭제 유지"}</label>
        <button type="button" style={actionStyle} disabled={!choice} onClick={() => void run(async () => {
          if (!choice) return
          const accepted = await resolveAccountDecorationConflict(review, choice)
          if (!current()) return
          setReview(null); setChoice(null)
          setMessage(accepted ? accountDecorationStatus() === "PENDING" ? "선택을 기기에 보관했어요. 계정 저장은 연결 대기 중이에요." : "선택한 꾸미기를 반영했어요. 두 버전은 보존본에서 확인할 수 있어요."
            : "선택을 반영하지 못했어요. 내용이나 보유 상태가 바뀌었을 수 있어요. 두 내용을 다시 확인해 주세요.")
        })}>선택한 꾸미기 반영</button>
      </fieldset>
    </>}
    {archive?.map((version, index) => <details key={index}>
      <summary style={{ minHeight: 44 }}>기기 {version.localSequence} · 서버 {version.remoteRevision} · {version.createdAt ? new Date(version.createdAt).toLocaleString("ko-KR") : "보관 시각 미확인"}</summary>
      <VersionSummary title="보존된 기기 꾸미기" state={version.local.data} />
      <VersionSummary title="보존된 계정 꾸미기" state={version.remote?.data ?? null} />
      {version.pending && <VersionSummary title="전송 당시 꾸미기" state={version.pending.draft.data} />}
    </details>)}
    {migration && <section aria-label="기기 꾸미기 이전">
      <p>현재 로그인한 계정의 기기 보관본입니다. 이전 후에도 기기 원본은 유지됩니다.</p>
      {!migration.state ? <p>원본 형식을 확인해야 해요. 일부 항목을 버리고 이전하지 않습니다.</p> : <>
        <VersionSummary title="이전할 기기 꾸미기" state={migration.state} />
        <VersionSummary title="현재 계정 꾸미기" state={migration.current} />
        <p>최초 이전의 기존 기기 재료는 구매 증빙 미검증 보존본(UNVERIFIED_LEGACY)으로 이전합니다. 새 포인트를 지급하거나 기존 사용액을 환급하지 않습니다. 최초 이전만 서버의 계정·기간·개수 조건 확인 후 반영됩니다.</p>
        <button type="button" style={actionStyle} disabled={busy || !migration.current} onClick={() => void run(async () => {
          const accepted = await migrateAccountDecorations(migration)
          if (current()) setMessage(accepted ? "기존 재료의 계정 보존을 확인했어요. 구매 증빙 검증이나 포인트 지급은 아니며 기기 원본도 유지했어요."
            : accountDecorationStatus() === "PENDING" ? "이전 요청을 기기에 보관했어요. 서버 확인 전이며 재료 소유권은 아직 반영하지 않았어요. 기기 원본은 유지했어요."
              : "이전을 확인하지 못했어요. 계정 최초 이전 여부와 서버 보존 조건을 확인해야 해요. 기기 원본과 미전송 내용은 보존했어요.")
        })}>기기 꾸미기를 이 계정에 이전</button>
      </>}
    </section>}
  </div>
}
