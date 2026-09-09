import React from "react"
import { RefreshCw, Save } from "lucide-react"
import { accountJournalPreviewEnabled, requestAccountJournal } from "../../domain/account/account-journal-api"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { flushAccountJournalDraft } from "../../domain/account/account-journal-sync"
import { registerUnsavedDraftGuard, runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { createFormDraftBuffer, decodeFormDraft, encodeFormDraft, formDraftDocumentId,
  type FormDraftBody, type FormInput, type FormKind } from "./form-input-draft"
import type { AccountJournalDraftView, ConflictChoice } from "../../domain/account/account-journal-draft-buffer"
import { createFormRecoveryCoordinator, type FormEnvelope, type FormRecoveryItem } from "./form-input-recovery"
import { FormInputConflictPanel, type FormConflictReview } from "./FormInputConflictPanel"
import { isAccountJournalWriteRejection } from "../../domain/account/account-write-rejection"
import { StickyBar } from "./StickyBar"

type Session = {
  recovered: FormDraftBody | null
  change: (input: FormInput, entryId: string, baseSavedAt?: string) => void
  complete: () => Promise<void>
  current: () => boolean
}
const DraftContext = React.createContext<Session | null>(null)
const ReviewContext = React.createContext({ visible: false, required: false })

export function FormInputSaveBar(props: React.ComponentProps<typeof StickyBar>) {
  const review = React.useContext(ReviewContext)
  if (!review.visible) return <StickyBar {...props} />
  return <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
    <button type="button" disabled={review.required} onClick={props.onSave}
      style={{ minHeight: 44, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        border: 0, background: "var(--ink)", color: "var(--bg)", opacity: review.required ? 0.5 : 1 }}>
      <Save size={16} aria-hidden="true" />{props.label ?? "저장"}
    </button>
  </div>
}

export function useRecoveredFormInput<K extends FormKind>(kind: K) {
  const session = React.useContext(DraftContext)
  const body = session?.recovered
  return body && body.input.kind === kind ? {
    entryId: body.entryId, baseSavedAt: body.baseSavedAt ?? undefined, input: body.input as Extract<FormInput, { kind: K }>,
  } : null
}

export function useFormInputDraft(input: FormInput, entryId: string, capture = true, baseSavedAt?: string) {
  const session = React.useContext(DraftContext)
  const owner = React.useRef(activeLocalAccount())
  const alive = React.useRef(true)
  React.useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const serialized = JSON.stringify(input)
  React.useLayoutEffect(() => { if (capture) session?.change(input, entryId, baseSavedAt) }, [session, serialized, entryId, capture, baseSavedAt])
  return {
    current: () => alive.current && activeLocalAccount() === owner.current && (session?.current() ?? true),
    complete: async () => { await session?.complete() },
    back: (callback?: () => void) => () => runDraftSafeNavigation(() => callback?.()),
  }
}

export function FormInputDraftBoundary({ kind, date, identity, hasInitialContext = false, children }: {
  kind: FormKind; date: string; identity: string; hasInitialContext?: boolean; children: React.ReactNode
}) {
  const [owner, setOwner] = React.useState(activeLocalAccount)
  const initialOwner = React.useRef(owner)
  React.useLayoutEffect(() => onLocalJournalScopeChange(() => setOwner(activeLocalAccount())), [])
  const context = JSON.stringify([kind, date, identity])
  // A parent may still hold an old account's entry/plan props during a scope change.
  // Remounting state alone must never transfer that inherited content to the new owner.
  if (hasInitialContext && owner !== initialOwner.current) return <p role="status">계정이 변경됐어요. 기록 목록에서 다시 열어 주세요.</p>
  // Remount even when the feature is disabled: no volatile plaintext crosses accounts.
  return <ScopedFormInputDraft key={JSON.stringify([owner, context])} owner={owner}
    enabled={accountJournalPreviewEnabled()} context={context} date={date} kind={kind}>
    {children}
  </ScopedFormInputDraft>
}

function ScopedFormInputDraft({ owner, enabled, context, date, kind, children }: {
  owner: string | null; enabled: boolean; context: string; date: string; kind: FormKind; children: React.ReactNode
}) {
  const active = enabled && owner !== null
  const [session, setSession] = React.useState<Session | null>(null)
  const [loaded, setLoaded] = React.useState(!active)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [loadAttempt, setLoadAttempt] = React.useState(0)
  const [notice, setNotice] = React.useState("초안 불러오는 중")
  const [review, setReview] = React.useState<FormConflictReview>({ primary: null, recoveries: [], archive: [] })
  const [resolving, setResolving] = React.useState(false)
  const [deleted, setDeleted] = React.useState(false)
  const [editorVersion, setEditorVersion] = React.useState(0)
  const retry = React.useRef<() => void>(() => {})
  const actions = React.useRef({ refresh: () => {},
    choose: (_choice: ConflictChoice, _review: FormConflictReview) => {},
    recovery: (_item: FormRecoveryItem, _choice: "RECOVERY" | "CURRENT", _review: FormConflictReview) => {},
    archive: (_snapshot: FormEnvelope, _review: FormConflictReview) => {},
  })

  React.useEffect(() => {
    if (!active || !owner) return
    setLoadFailed(false)
    const userId = owner
    let alive = true
    let buffer: ReturnType<typeof createFormDraftBuffer> | undefined
    let recovery: ReturnType<typeof createFormRecoveryCoordinator> | undefined
    let ownRecovery: FormRecoveryItem | undefined
    let conflictActive = false
    let recoveryPending = false
    let actionBusy = false
    let remoteDeleted = false
    let doc = ""
    let sequence = 0
    let pending = 0
    let failed = false
    let sending = false
    let sendingDone = Promise.resolve()
    let lastEdit = 0
    let version = 0
    let baseline: string | undefined
    let latest: FormDraftBody | null = null
    let writes = Promise.resolve()
    let timer: ReturnType<typeof setTimeout> | undefined
    const current = () => alive && activeLocalAccount() === userId && accountJournalPreviewEnabled()
    const show = (message: string) => { if (current()) setNotice(message) }
    const unsafe = () => current() && (pending > 0 || failed || actionBusy)
    const blocked = () => show("초안을 이 기기에 보관하지 못했어요. 화면을 유지하고 저장을 다시 시도해 주세요.")
    const unregister = registerUnsavedDraftGuard({ isUnsafe: unsafe, onBlocked: blocked })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsafe()) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", beforeUnload)
    let authRequired = false
    const send = async (request: Parameters<typeof requestAccountJournal>[1]) => {
      const result = await requestAccountJournal(userId, request, current)
      if (current()) authRequired = !result.ok && result.code === "AUTH_REQUIRED"
      return result
    }
    const validate = (envelope: FormEnvelope) => {
      const body = decodeFormDraft(envelope)
      if (body.context !== context || body.input.kind !== kind || envelope.date !== date) throw new Error("Form context mismatch")
      return body
    }

    async function inspectConflict(fetchRemote = false): Promise<FormConflictReview> {
      if (!buffer || !recovery || !current()) throw new Error("Form unavailable")
      let view = await buffer.read(userId, doc)
      if (!current()) throw new Error("Form scope changed")
      if (fetchRemote && view?.blocked) {
        const result = await send({ action: "read", documentId: doc })
        if (!current() || !result.ok) throw new Error("Conflict read unavailable")
        if (result.data.kind === "document") {
          validate(result.data.document)
          await buffer.captureConflict(userId, doc, result.data.document, result.data.revision, view.localSequence, current)
        } else if (result.data.kind === "deleted") {
          await buffer.captureConflict(userId, doc, null, result.data.revision, view.localSequence, current)
        } else throw new Error("Conflict read unavailable")
        view = await buffer.read(userId, doc)
      }
      const recoveries = await recovery.list()
      const archive = view?.recoverableVersions ? await buffer.readConflictArchive(userId, doc, current) : []
      if (!current()) throw new Error("Form scope changed")
      if (view) validate(view.draft)
      conflictActive = !!view?.blocked
      recoveryPending = recoveries.some(item => item.draft.state === "OPEN")
      const value = { primary: view, recoveries, archive }
      setReview(value)
      return value
    }

    function install(view: AccountJournalDraftView<FormEnvelope> | null) {
      if (!current()) return
      const body = view ? validate(view.draft) : null
      sequence = view?.localSequence ?? 0
      remoteDeleted = !!view?.resolvedDeletion
      setDeleted(remoteDeleted)
      const recovered = body?.completed || remoteDeleted ? null : body
      latest = recovered
      baseline = undefined
      ownRecovery = undefined
      const controller: Session = {
        recovered,
        current: () => current() && !conflictActive && !recoveryPending && !actionBusy && !remoteDeleted,
        change(input, entryId, baseSavedAt) {
          if (!current() || remoteDeleted) return
          const value = JSON.stringify(input)
          if (baseline === undefined) { baseline = value; return }
          if (actionBusy) return
          if (baseline === value) return
          baseline = value
          write({ format: "TRAINORACLE_FORM_INPUT_V1", context, entryId, baseSavedAt: baseSavedAt ?? null, completed: false, input })
        },
        async complete() {
          if (!controller.current()) return
          await writes
          if (!controller.current() || failed) return
          if (latest) { write({ ...latest, completed: true }); await writes; await flush(true) }
        },
      }
      setSession(controller)
      setEditorVersion(value => value + 1)
      setLoaded(true)
    }

    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { void flush() }, Math.max(0, 800 - (Date.now() - lastEdit)))
    }
    async function flush(explicit = false): Promise<void> {
      if (!current() || !buffer || !doc || ownRecovery || recoveryPending || remoteDeleted) return
      if (sending) {
        if (explicit) { await sendingDone; return flush(true) }
        return
      }
      if (!explicit && Date.now() - lastEdit < 800) { schedule(); return }
      sending = true
      let finish!: () => void
      sendingDone = new Promise(resolve => { finish = resolve })
      const sentVersion = version
      try {
        await writes
        if (!current() || failed) return
        if (!navigator.onLine) { show("연결 대기 · 초안은 이 기기에 보관됨"); return }
        const result = await flushAccountJournalDraft(buffer, userId, doc, request => {
          if (!explicit && Date.now() - lastEdit < 800) return Promise.resolve({ ok: false as const, code: "UNAVAILABLE" as const })
          return send(request)
        }, current)
        if (current() && isAccountJournalWriteRejection(result)) {
          show("서버가 초안 저장을 거절했어요. 자동 재전송은 중지했으며 입력은 이 기기에 보관했어요. 계정 저장 조건을 확인해 주세요.")
          return
        }
        if (current() && result === "CONFLICT") {
          await inspectConflict(true)
          show("충돌 확인 · 두 수정본은 이 기기에 보관됨")
          return
        }
        if (!current() || version !== sentVersion) return
        const view = await buffer.read(userId, doc)
        if (!current() || version !== sentVersion || pending || failed) return
        show(result === "SAVED" && view?.acknowledgedSequence === sequence
          ? "초안이 계정에 저장됨 · 기록 미완료"
          : result === "CONFLICT" ? "충돌 확인 · 이 기기의 초안도 보관됨"
          : authRequired ? "로그인 필요 · 초안은 이 기기에 보관됨"
          : "연결 대기 · 초안은 이 기기에 보관됨")
      } catch { show("계정 저장 확인 실패 · 이 기기의 초안은 유지됨") }
      finally { sending = false; finish(); if (current() && version !== sentVersion) schedule() }
    }

    function write(body: FormDraftBody) {
      latest = body
      const edit = ++version
      lastEdit = Date.now()
      pending += 1
      show("초안 저장 중")
      writes = writes.then(async () => {
        if (!current() || !buffer || !recovery) return
        const envelope = encodeFormDraft(date, body)
        if (ownRecovery) {
          ownRecovery = await recovery.preserve(envelope, "LOCAL_CAS", "OPEN", ownRecovery)
        } else {
          try {
            await buffer.saveDraft(userId, doc, envelope, sequence)
            sequence += 1
          } catch {
            if (!current()) return
            const competing = await buffer.read(userId, doc)
            if ((competing?.localSequence ?? 0) === sequence && !competing?.resolvedDeletion) throw new Error("Local draft write failed")
            ownRecovery = await recovery.preserve(envelope, "LOCAL_CAS")
          }
        }
        failed = false
        await inspectConflict()
        if (edit === version) show(ownRecovery ? "다른 창의 수정과 겹쳐 입력을 암호화 복구본으로 보관했어요."
          : "초안은 이 기기에 보관됨 · 계정 확인 대기")
      }).catch(() => { failed = true; blocked() }).finally(() => { pending -= 1 })
      schedule()
    }

    retry.current = () => {
      if (actionBusy) return
      if (failed && latest) write(latest)
      else { lastEdit = 0; void flush() }
    }
    const online = () => { void flush() }
    window.addEventListener("online", online)
    const unsubscribe = onLocalJournalScopeChange(() => {
      if (activeLocalAccount() !== userId) { alive = false; buffer?.logout(userId); recovery?.logout(); clearTimeout(timer) }
    })

    async function actOnConflict(operation: () => Promise<void>) {
      if (!current() || actionBusy) return
      actionBusy = true; setResolving(true); clearTimeout(timer)
      try {
        await writes; await sendingDone
        if (!current() || failed) throw new Error("Unprotected form input")
        await operation()
      } catch {
        show("내용이 바뀌었거나 처리를 완료하지 못했어요. 입력은 보관했어요. 최신 내용을 다시 확인해 주세요.")
        if (current()) { try { await inspectConflict() } catch { blocked() } }
      } finally { actionBusy = false; if (current()) setResolving(false) }
    }
    actions.current.refresh = () => { void actOnConflict(async () => {
      await inspectConflict(true)
      show("최신 수정본을 확인했어요. 사용할 입력을 선택해 주세요.")
    }) }
    actions.current.choose = (choice, seen) => { void actOnConflict(async () => {
      const fresh = await inspectConflict(true)
      const before = seen.primary, now = fresh.primary
      if (!before?.blocked || !now?.blocked || before.localSequence !== now.localSequence
        || before.blocked.currentRevision !== now.blocked.currentRevision
        || before.remoteDeleted !== now.remoteDeleted || JSON.stringify(before.remoteDraft) !== JSON.stringify(now.remoteDraft)) {
        throw new Error("Conflict changed; review again")
      }
      await buffer!.resolveConflict(userId, doc, choice, now.blocked.currentRevision, now.localSequence, current)
      const updated = await inspectConflict()
      install(updated.primary)
      show(choice === "DELETE" ? "계정 삭제를 반영했어요. 이전 입력은 보관한 수정본에서 확인할 수 있어요."
        : "선택한 초안을 열었어요. 반대쪽 입력도 보관했으며 기록 완료는 아직이에요.")
      if (choice === "LOCAL") await flush(true)
    }) }
    async function chooseRecovery(item: FormRecoveryItem, choice: "RECOVERY" | "CURRENT", seen: FormConflictReview) {
      const next = await recovery!.choose(item, seen.primary?.localSequence ?? 0, choice)
      await inspectConflict()
      install(next)
      show("선택한 초안을 열었어요. 다른 입력은 보관한 수정본에 남아 있어요.")
      await flush(true)
    }
    actions.current.recovery = (item, choice, seen) => { void actOnConflict(() => chooseRecovery(item, choice, seen)) }
    actions.current.archive = (snapshot, seen) => { void actOnConflict(async () => {
      const body = validate(snapshot)
      const item = await recovery!.preserve(encodeFormDraft(date, { ...body, completed: false }), "CONFLICT_ARCHIVE")
      await chooseRecovery(item, "RECOVERY", seen)
    }) }

    void (async () => {
      try {
        buffer = createFormDraftBuffer()
        doc = await formDraftDocumentId(userId, context)
        if (!current()) return
        recovery = createFormRecoveryCoordinator(buffer, userId, doc, context, current)
        let view = await buffer.read(userId, doc)
        if (!current()) return
        let remoteUnavailable = false
        if ((!view || view.state === "DRAFT_ACKNOWLEDGED") && navigator.onLine) {
          const result = await send({ action: "read", documentId: doc })
          if (!current()) return
          if (result.ok && result.data.kind === "deleted") {
            if (view) {
              await recovery.preserve(view.draft, "BEFORE_REPLACEMENT", "ARCHIVED")
              await buffer.acceptCleanDeletion(userId, doc, result.data.revision, view.localSequence)
            }
            await inspectConflict()
            remoteDeleted = true; setDeleted(true); setLoaded(true)
            show("계정에서 삭제된 초안이에요. 보관한 입력은 자동으로 다시 전송하지 않아요.")
            return
          }
          if (result.ok && result.data.kind === "document") {
            const item = result.data
            const body = decodeFormDraft(item.document)
            if (body.context !== context || body.input.kind !== kind || item.document.date !== date) throw new Error()
            await buffer.importRemote(userId, doc, item.document, item.revision)
            view = await buffer.read(userId, doc)
          } else if (!result.ok && result.code !== "NOT_FOUND") remoteUnavailable = true
        }
        if (!current()) return
        install(view)
        await inspectConflict()
        show(view?.state === "CONFLICT" ? "충돌 확인 · 이 기기의 초안을 복원함"
          : recoveryPending ? "다른 창에서 보호한 입력이 있어요. 복구본을 확인해 주세요."
          : latest ? "초안을 복원했어요 · 기록 미완료"
          : remoteUnavailable ? "계정 초안 조회 실패 · 새 입력은 이 기기에 보호됨"
          : "작성 중 초안 · 기록 미완료")
        if (view && view.state !== "DRAFT_ACKNOWLEDGED") schedule()
      } catch {
        show("초안 조회 실패 또는 형식 확인 필요 · 기존 초안은 유지됨")
        if (current()) setLoadFailed(true)
      }
    })()
    return () => {
      alive = false
      clearTimeout(timer)
      unregister(); unsubscribe()
      window.removeEventListener("beforeunload", beforeUnload)
      window.removeEventListener("online", online)
      void writes.finally(() => { buffer?.close(); recovery?.close() })
    }
  }, [active, owner, context, date, kind, loadAttempt])

  if (!active) return <>{enabled && <p role="status">로그인 필요 · 입력 초안 자동 보관은 로그인 후 사용할 수 있어요.</p>}{children}</>
  const reviewRequired = resolving || !!review.primary?.blocked || review.recoveries.some(item => item.draft.state === "OPEN")
  return <DraftContext.Provider value={session}><ReviewContext.Provider value={{
    visible: reviewRequired || review.recoveries.length > 0 || review.archive.length > 0, required: reviewRequired,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--line)" }}>
      <div role="status" style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-caption)", overflowWrap: "anywhere" }}>{notice}</div>
      {loaded && <button type="button" aria-label="초안 저장 재시도" title="초안 저장 재시도"
        style={{ width: 44, height: 44, flexShrink: 0, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)" }}
        onClick={() => retry.current()}><RefreshCw size={16} aria-hidden="true" /></button>}
      {!loaded && loadFailed && <button type="button" onClick={() => setLoadAttempt(value => value + 1)}
        aria-label="초안 조회 재시도" title="초안 조회 재시도"
        style={{ width: 44, height: 44, flexShrink: 0, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)" }}>
        <RefreshCw size={16} aria-hidden="true" />
      </button>}
    </div>
    {loaded && <FormInputConflictPanel review={review} busy={resolving} deleted={deleted}
      onRefresh={() => actions.current.refresh()} onChoose={choice => actions.current.choose(choice, review)}
      onRecovery={(item, choice) => actions.current.recovery(item, choice, review)}
      onArchive={snapshot => actions.current.archive(snapshot, review)} />}
    {loaded && !deleted && <fieldset key={editorVersion} disabled={resolving}
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>{children}</fieldset>}
  </ReviewContext.Provider></DraftContext.Provider>
}
