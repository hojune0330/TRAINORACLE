// 백업 복원 화면 — 내보낸 JSON을 다시 일지로 되돌린다.
//
// 왜 필요한가:
//  앱은 백업 내려받기를 두 종류(안전/메모 포함) 제공하면서 "이 기기에만
//  저장돼요"라고 안내한다. 그런데 그 파일을 되돌릴 경로가 없었다. 백업을
//  권하면서 복원을 안 주는 것은 지키지 못할 약속이다.
//
// 안전 원칙:
//  - 원본 파일은 기기에서 읽고, 확인한 기록만 활성 계정의 암호화 보관 경로로 보낸다.
//  - 기본은 "지금 일지를 지킨다": 겹치는 항목은 건드리지 않는다. 덮어쓰기는
//    사용자가 명시적으로 골라야 한다.
//  - 지운 일지는 백업 파일로도 되살아나지 않는다.
//  - fail-visible: 읽지 못한 항목 수와 제외된 개수를 숨기지 않는다.
import React from "react"
import { SectionLb } from "../components/JournalPrimitives"
import {
  buildRestorePlan, readBackupFile, restoreBackupFile,
} from "../domain/restore/backup-file"
import type {
  BackupReadResult, DecorationRestoreMode, RestoreMode, RestoreOutcome, RestorePlan,
} from "../domain/restore/backup-file"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../hooks/useOrderedStepMotion"
import { accountJournalRecordsEnabled } from "../domain/account/account-journal-record-service"
import { createAccountBackupRestoration, type AccountRestoreOutcome } from "../domain/restore/account-restore"
import { useImportOwnerScope } from "./import-activities/useImportOwnerScope"

const mono: React.CSSProperties = { fontFamily: "var(--mono)" }

const primaryBtn: React.CSSProperties = {
  width: "100%", minHeight: 48, fontSize: 15, fontWeight: 600,
  fontFamily: "var(--sans)", border: "1px solid var(--ink)",
  background: "var(--ink)", color: "var(--bg)", cursor: "pointer",
}
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: "transparent", color: "var(--ink)",
  border: "1px solid var(--line)", fontWeight: 500,
}

type Stage =
  | { readonly step: "pick" }
  | { readonly step: "review"; readonly read: BackupReadResult; readonly plan: RestorePlan }
  | { readonly step: "done"; readonly outcome: RestoreOutcome }
  | { readonly step: "failed"; readonly outcome: RestoreOutcome }
  | { readonly step: "account-result"; readonly outcome: AccountRestoreOutcome }

export function RestoreBackup({ onBack, onOpenHome }: {
  readonly onBack?: () => void
  readonly onOpenHome?: () => void
}) {
  const [stage, setStage] = React.useState<Stage>({ step: "pick" })
  const [failure, setFailure] = React.useState<"unreadable" | "empty" | "account-unavailable" | null>(null)
  const [mode, setMode] = React.useState<RestoreMode>("keep-existing")
  const [decorationMode, setDecorationMode] = React.useState<DecorationRestoreMode>("keep-existing")
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const accountRestore = React.useRef<Awaited<ReturnType<typeof createAccountBackupRestoration>>>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const stageMotion = useOrderedStepMotion(stage.step, ["pick", "review", "done", "failed"])
  useActiveContentScroll(stage.step, stageRef, undefined, true)
  const captureScope = useImportOwnerScope(() => {
    accountRestore.current?.dispose(); accountRestore.current = null
    busyRef.current = false; setBusy(false); setStage({ step: "pick" }); setFailure(null)
  })
  React.useEffect(() => () => accountRestore.current?.dispose(), [])

  const handleFile = async (file: File) => {
    if (busyRef.current) return
    const current = captureScope()
    accountRestore.current?.dispose(); accountRestore.current = null
    busyRef.current = true
    setBusy(true)
    setFailure(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      if (!current()) return
      busyRef.current = false
      setBusy(false)
      setFailure("unreadable")
      return
    }

    if (!current()) return
    const read = readBackupFile(text)
    const account = accountJournalRecordsEnabled()
    const restoration = account && read.recognized ? await createAccountBackupRestoration(read) : null
    if (!current()) { restoration?.dispose(); return }
    accountRestore.current = restoration
    busyRef.current = false
    setBusy(false)
    if (!read.recognized) {
      setFailure("unreadable")
      setStage({ step: "pick" })
      return
    }
    if (account && !restoration) { setFailure("account-unavailable"); return }
    if (read.entries.length === 0 && read.decorationStatus !== "included") {
      setFailure("empty")
      setStage({ step: "pick" })
      return
    }
    setMode("keep-existing")
    setDecorationMode("keep-existing")
    setStage({ step: "review", read, plan: restoration?.plan ?? buildRestorePlan(read.entries) })
  }

  const handleRestore = async () => {
    if (busyRef.current || stage.step !== "review") return
    busyRef.current = true
    setBusy(true)
    const current = captureScope()
    if (accountJournalRecordsEnabled()) {
      const outcome = await accountRestore.current?.confirm(mode, decorationMode)
      if (!current()) return
      busyRef.current = false; setBusy(false)
      if (outcome) setStage({ step: "account-result", outcome })
      return
    }
    const outcome = await restoreBackupFile(stage.read, stage.plan, mode, decorationMode)
    if (!current()) return
    busyRef.current = false
    setBusy(false)
    setStage(outcome.commit === "COMMITTED" ? { step: "done", outcome } : { step: "failed", outcome })
  }

  const restart = () => {
    if (busyRef.current) return
    accountRestore.current?.dispose(); accountRestore.current = null
    setStage({ step: "pick" })
    setFailure(null)
  }

  const goBack = () => {
    if (!busyRef.current) onBack?.()
  }

  return (
    <div style={{ padding: "18px 20px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            type="button" onClick={goBack} disabled={busy} data-testid="restore-back" aria-label="뒤로"
            style={{ ...secondaryBtn, width: 44, minWidth: 44, minHeight: 44, fontSize: 18 }}
          >←</button>
        )}
        <div>
          <div style={{ ...mono, fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            RESTORE · 백업 되돌리기
          </div>
          <h1 style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 500, margin: "4px 0 0" }}>
            내려받은 백업 되돌리기
          </h1>
        </div>
      </div>

      <div
        key={stage.step}
        ref={stageRef}
        className="active-stage-content active-content-scroll-target"
        data-flow-direction={stageMotion}
      >
        {stage.step === "pick" && (
          <PickStage busy={busy} failure={failure} onFile={handleFile} />
        )}

        {stage.step === "review" && (
          <ReviewStage
            accountDecorationReady={accountRestore.current?.decorationReady ?? false}
            read={stage.read}
            plan={stage.plan}
            mode={mode}
            onModeChange={setMode}
            decorationMode={decorationMode}
            onDecorationModeChange={setDecorationMode}
            onRestore={handleRestore}
            onRestart={restart}
            busy={busy}
          />
        )}

        {stage.step === "done" && (
          <DoneStage
            outcome={stage.outcome}
            onOpenHome={onOpenHome}
            onRestart={restart}
            busy={busy}
          />
        )}

        {stage.step === "failed" && (
          <RestoreFailedStage outcome={stage.outcome} onRestart={restart} />
        )}
        {stage.step === "account-result" && <div data-testid="restore-account-result" role="status">
          <h2>계정 일지 복원 결과</h2>
          <p>{stage.outcome.commit === "COMPLETE" ? "선택한 항목 복원 완료" : stage.outcome.commit === "PARTIAL" ? "일부 복원 (PARTIAL)" : stage.outcome.commit === "PENDING" ? "계정 저장 확인 대기" : "복원을 완료하지 못했어요"}</p>
          <p>계정에 저장됨 {stage.outcome.account}건 · 연결 대기 {stage.outcome.pending}건 · 충돌 확인 {stage.outcome.conflicts}건 · 실패 {stage.outcome.failed}건</p>
          <p>기존 기록 유지 {stage.outcome.keptExisting}건 · 삭제 표식으로 제외 {stage.outcome.blockedByDeletion}건</p>
          {stage.outcome.decorationRestore === "ACCOUNT" && <p>꾸미기: 계정에 저장됨</p>}
          {stage.outcome.decorationRestore === "PENDING" && <p>꾸미기: 연결·서버 확인 대기. 소유권 확인과 계정 저장 완료는 아직 확인되지 않았어요.</p>}
          {stage.outcome.decorationRestore === "KEPT_EXISTING" && <p>꾸미기: 기존 상태 유지</p>}
          {stage.outcome.decorationRestore === "CONFLICT" && <p>꾸미기: 충돌 확인. 검토 이후 바뀐 계정 상태를 자동으로 덮어쓰지 않았어요.</p>}
          {stage.outcome.decorationRestore === "FAILED" && <p>{stage.outcome.decorationFailure === "READ_FAILED"
            ? "꾸미기: 계정 최신 상태를 조회하지 못해 복원을 확인하지 못했어요."
            : "꾸미기: 소유권 또는 저장 조건을 확인하지 못해 복원을 확인하지 못했어요. 백업 원본은 계속 보관해 주세요."}</p>}
          {stage.outcome.decorationRestore === "INVALID_SKIPPED" && <p>꾸미기는 형식이 맞지 않거나 지원하지 않는 항목이 있어 복원하지 않았어요. 기존 꾸미기와 백업 원본은 변경하지 않았어요.</p>}
          <p>이미 계정에 저장된 기록은 취소하지 않아요. 연결 대기는 저장 완료가 아니며 원본 파일을 보관해 주세요.</p>
          <button type="button" style={primaryBtn} disabled={busy} onClick={async () => {
            if (busyRef.current || !accountRestore.current) return
            const current = captureScope()
            busyRef.current = true; setBusy(true)
            const outcome = await accountRestore.current.confirm(mode, decorationMode)
            if (!current()) return
            busyRef.current = false; setBusy(false)
            if (outcome) setStage({ step: "account-result", outcome })
          }}>저장 상태 다시 확인</button>
          {onOpenHome && <button type="button" style={secondaryBtn} disabled={busy} onClick={onOpenHome}>일지에서 확인하기</button>}
          <button type="button" style={secondaryBtn} disabled={busy} onClick={restart}>다른 파일 고르기</button>
        </div>}
      </div>
    </div>
  )
}

function PickStage({ busy, failure, onFile }: {
  readonly busy: boolean
  readonly failure: "unreadable" | "empty" | "account-unavailable" | null
  readonly onFile: (file: File) => void | Promise<void>
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        전에 <b>내려받아 둔 일지 백업 파일(JSON)</b>을 고르면 {accountJournalRecordsEnabled() ? "현재 로그인한 계정의 일지로" : "이 기기의 일지로"}
        되돌려요. 브라우저 데이터를 지웠거나 기기를 바꿨을 때 쓰세요.
      </p>

      <div
        data-testid="restore-privacy-notice"
            style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: "10px 13px" }}
      >
        <div style={{ ...mono, fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
          지금 일지를 지운 뒤 넣는 게 아니에요
        </div>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-2)", lineHeight: 1.65, marginTop: 5 }}>
          이미 있는 일지는 <b>그대로 두고</b> 백업에 있는 것만 더해요. 같은 일지가
          양쪽에 있으면 기본적으로 <b>지금 것을 지켜요</b>. {accountJournalRecordsEnabled()
            ? "원본 파일은 이 기기에서만 읽어요. 복원을 눌러 확인한 기록과 메모만 현재 로그인한 계정의 암호화 보관 경로로 전송해요. 비밀 글은 공유·분석에서 제외해요."
            : "파일은 이 기기에서만 읽고 어디로도 올리지 않아요."}
        </div>
      </div>

      <label htmlFor="restore-file" style={{ ...mono, fontSize: 11, color: "var(--ink-3)" }}>
        백업 파일 (.json)
      </label>
      <input
        id="restore-file"
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) void onFile(file)
        }}
        style={{
          ...mono, fontSize: 12, width: "100%", boxSizing: "border-box",
          padding: "12px", minHeight: 48,
          border: "1px dashed var(--line)", background: "var(--surface)", color: "var(--ink)",
        }}
      />
      {busy && <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-3)", margin: 0 }}>읽는 중…</p>}

      {failure !== null && (
        <div role="alert" data-testid="restore-failure" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "10px 13px" }}>
          <div style={{ ...mono, fontSize: 10.5, color: "var(--ink)", lineHeight: 1.6 }}>
            {failure === "account-unavailable" ? "계정 기록을 조회하지 못했어요. 연결과 로그인을 확인한 뒤 다시 시도해 주세요." : failure === "empty"
              ? "백업 파일은 맞는데 되돌릴 일지를 찾지 못했어요. 빈 백업일 수 있어요."
              : "이 파일을 트레인오라클 백업으로 읽지 못했어요. 앱에서 내려받은 .json 파일인지 확인해 주세요."}
            <br />기존 일지는 그대로 있어요.
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewStage({ read, plan, mode, onModeChange, decorationMode, onDecorationModeChange, onRestore, onRestart, busy, accountDecorationReady = false }: {
  readonly accountDecorationReady?: boolean
  readonly read: BackupReadResult
  readonly plan: RestorePlan
  readonly mode: RestoreMode
  readonly onModeChange: (mode: RestoreMode) => void
  readonly decorationMode: DecorationRestoreMode
  readonly onDecorationModeChange: (mode: DecorationRestoreMode) => void
  readonly onRestore: () => void
  readonly onRestart: () => void
  readonly busy: boolean
}) {
  const willRestore = mode === "keep-existing" ? plan.fresh : plan.fresh + plan.conflicts

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="restore-summary" style={{ border: "1px solid var(--ink)", padding: "12px 14px" }}>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
          {read.kind === "full" ? "메모 포함 백업" : "메모 제외 백업"}
          {read.exportedAt !== null && ` · ${read.exportedAt.slice(0, 10)} 내려받음`}
        </div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, marginTop: 5 }}>
          일지 {plan.items.length}건을 읽었어요
        </div>
        <ul style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.8, margin: "8px 0 0", paddingLeft: 16 }}>
          <li>새로 들어올 것 <b>{plan.fresh}건</b></li>
          <li>이미 있는 것과 겹치는 것 <b>{plan.conflicts}건</b></li>
          {plan.blockedByDeletion > 0 && (
            <li data-testid="restore-blocked-deleted">
              전에 지운 일지 <b>{plan.blockedByDeletion}건</b> — 되돌리지 않아요
            </li>
          )}
        </ul>
      </div>

      {read.decorationStatus === "included" && (
        <div
          data-testid="restore-decoration-summary"
          style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.7, border: "1px solid var(--line)", padding: "10px 12px" }}
        >
          <b>꾸미기</b> · 꾸미기 항목 {read.decorationItemCount}개 · 날짜 배치 {read.decorationPlacementCount}개
          <br />{accountJournalRecordsEnabled()
            ? "꾸미기는 교체를 직접 선택한 경우에만 계정에 복원해요. 일지와 따로 저장되므로 일부만 완료될 수 있고, 서버에서 소유권이 확인되지 않으면 복원되지 않을 수 있어요. 백업 원본은 보관해 주세요."
            : "일지와 분리된 꾸미기 구획으로 되돌려요."}
          {accountJournalRecordsEnabled() && !accountDecorationReady && <p role="alert">계정 꾸미기를 조회하지 못했어요. 꾸미기 교체는 잠겨 있으며 일지는 따로 복원할 수 있어요.</p>}
        </div>
      )}

      {read.decorationStatus === "invalid" && (
        <div
          role="alert"
          data-testid="restore-decoration-invalid"
          style={{ ...mono, fontSize: 10.5, color: "var(--pain-5)", lineHeight: 1.65, border: "1px solid var(--pain-5)", padding: "10px 12px" }}
        >
          꾸미기는 형식이 맞지 않거나 지원하지 않는 항목이 있어 복원할 수 없어요. 백업 원본은 변경하지 않아요. 읽힌 일지는 따로 확인한 뒤 되돌릴 수 있어요.
        </div>
      )}

      {read.decorationStatus === "included" && (
        <div data-testid="restore-decoration-choice" style={{ ...mono, display: "grid", gap: 8 }}>
          <strong>꾸미기는 어떻게 할까요?</strong>
          <ModeChoice
            checked={decorationMode === "keep-existing"}
            onSelect={() => { if (!busy) onDecorationModeChange("keep-existing") }}
            title={accountJournalRecordsEnabled() ? "현재 계정 꾸미기를 지켜요" : "이 기기 꾸미기를 지켜요"}
            detail={accountJournalRecordsEnabled() ? "권장 · 현재 계정의 꾸미기는 그대로 둬요." : "권장 · 이 기기에 있는 스티커와 테마는 그대로 둬요."}
          />
          <ModeChoice
            disabled={busy || (accountJournalRecordsEnabled() && !accountDecorationReady)}
            checked={decorationMode === "replace"}
            onSelect={() => { if (!busy) onDecorationModeChange("replace") }}
            title="백업의 꾸미기로 바꿔요"
            detail={accountJournalRecordsEnabled()
              ? "현재 로그인한 계정의 꾸미기를 백업 내용으로 교체하는 데 동의해요. 소유권과 저장 조건은 서버에서 다시 확인해요."
              : "포인트, 가진 꾸미기, 즐겨찾기, 날짜별 배치를 백업 파일 내용으로 바꿔요."}
          />
        </div>
      )}

      {read.skipped > 0 && (
        <div data-testid="restore-skipped" style={{ ...mono, fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.6, border: "1px solid var(--line)", padding: "9px 12px" }}>
          형식이 맞지 않아 읽지 못한 항목 {read.skipped}건은 빠졌어요.
          없는 값을 채워 넣지 않으려고 일부러 건너뛰어요.
        </div>
      )}

      {read.kind === "safe" && (
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65 }}>
          {accountJournalRecordsEnabled()
            ? "이 백업에는 메모 원문이 없어요. 새 일지의 메모는 비어 있고, 겹치는 계정 일지의 기존 메모는 유지해요."
            : "이 백업에는 메모 원문이 들어 있지 않아요 — 되돌린 일지의 메모는 비어 있어요. 없는 내용을 만들어 채우지 않아요."}
        </div>
      )}

      {plan.conflicts > 0 && (
        <>
          <SectionLb>겹치는 일지는 어떻게 할까요?</SectionLb>
          <div role="radiogroup" aria-label="겹치는 일지 처리" style={{ display: "grid", gap: 8 }}>
            <ModeChoice
              checked={mode === "keep-existing"}
              onSelect={() => { if (!busy) onModeChange("keep-existing") }}
              title="지금 것을 지켜요"
              detail="이 기기에 있는 일지를 그대로 두고, 겹치지 않는 것만 더해요 (권장)"
            />
            <ModeChoice
              checked={mode === "overwrite-conflicts"}
              onSelect={() => { if (!busy) onModeChange("overwrite-conflicts") }}
              title="백업 파일 내용으로 바꿔요"
              detail={accountJournalRecordsEnabled()
                ? "서버 최신 상태를 다시 확인하고 바꿔요. 검토 후 바뀐 기록은 충돌로 남기며 자동으로 덮어쓰지 않아요."
                : "겹치는 일지를 백업에 있는 내용으로 덮어써요 — 지금 내용은 사라져요"}
            />
          </div>
        </>
      )}

      <button
        type="button"
        data-testid="restore-submit"
        style={primaryBtn}
        disabled={busy || (willRestore === 0 && (read.decorationStatus !== "included" || (accountJournalRecordsEnabled() && (decorationMode !== "replace" || !accountDecorationReady))))}
        onClick={onRestore}
      >
        {willRestore > 0
          ? `${willRestore}건 되돌리기`
          : read.decorationStatus === "included" ? "꾸미기 되돌리기" : "되돌릴 일지가 없어요"}
      </button>
      <button type="button" style={secondaryBtn} disabled={busy} onClick={onRestart}>다른 파일 고르기</button>
    </div>
  )
}

function ModeChoice({ checked, onSelect, title, detail, disabled = false }: {
  readonly disabled?: boolean
  readonly checked: boolean
  readonly onSelect: () => void
  readonly title: string
  readonly detail: string
}) {
  return (
    <button
      type="button" role="radio" aria-checked={checked} onClick={onSelect} disabled={disabled}
      style={{
        textAlign: "left", cursor: "pointer", minHeight: 44, padding: "10px 12px",
        background: checked ? "var(--surface)" : "transparent",
        border: `1px solid ${checked ? "var(--ink)" : "var(--line)"}`,
      }}
    >
      <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500 }}>
        {checked ? "● " : "○ "}{title}
      </span>
      <span style={{ display: "block", ...mono, fontSize: 10, color: "var(--ink-3)", lineHeight: 1.6, marginTop: 3 }}>
        {detail}
      </span>
    </button>
  )
}

function DoneStage({ outcome, onOpenHome, onRestart, busy }: {
  readonly outcome: RestoreOutcome
  readonly onOpenHome?: () => void
  readonly onRestart: () => void
  readonly busy: boolean
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="restore-done" style={{ border: "1px solid var(--ink)", background: "var(--surface)", padding: "14px 16px" }}>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>되돌리기 완료</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, marginTop: 5 }}>
          {outcome.restored}건을 일지에 되돌렸어요
        </div>
        <ul style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.8, margin: "8px 0 0", paddingLeft: 16 }}>
          {outcome.keptExisting > 0 && <li>겹쳐서 지금 것을 지킨 일지 {outcome.keptExisting}건</li>}
          {outcome.blockedByDeletion > 0 && <li>전에 지운 일지 {outcome.blockedByDeletion}건은 되돌리지 않았어요</li>}
          {outcome.failed > 0 && (
            <li data-testid="restore-failed" style={{ color: "var(--pain-5)" }}>
              {outcome.failed}건은 형식이 맞지 않아 되돌리지 못했어요
            </li>
          )}
          {outcome.decorationRestore === "RESTORED" && <li>꾸미기도 함께 되돌렸어요</li>}
          {outcome.decorationRestore === "KEPT_EXISTING" && <li>기존 꾸미기는 그대로 두었어요</li>}
          {outcome.decorationRestore === "INVALID_SKIPPED" && (
            <li style={{ color: "var(--pain-5)" }}>꾸미기는 형식이 맞지 않아 제외했어요</li>
          )}
          {outcome.decorationRestore === "SAVE_FAILED" && (
            <li style={{ color: "var(--pain-5)" }}>꾸미기를 저장하지 못해 일지도 바꾸지 않았어요</li>
          )}
        </ul>
      </div>

      {onOpenHome && (
        <button type="button" style={primaryBtn} disabled={busy} onClick={onOpenHome}>일지에서 확인하기</button>
      )}
      <button type="button" style={secondaryBtn} disabled={busy} onClick={onRestart}>다른 파일 되돌리기</button>
    </div>
  )
}

function RestoreFailedStage({ outcome, onRestart }: {
  readonly outcome: RestoreOutcome
  readonly onRestart: () => void
}) {
  const message = outcome.failureReason === "RECOVERY_CODE_REQUIRED"
    ? "비공개 메모를 되돌리려면 먼저 복구 코드를 준비해야 해요. 저장된 일지와 꾸미기는 바꾸지 않았어요."
    : "저장 공간 문제로 되돌리기를 완료하지 못했어요. 저장된 일지와 꾸미기는 바꾸지 않았어요."

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div role="alert" data-testid="restore-commit-failure" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "14px 16px" }}>
        <div style={{ ...mono, fontSize: 10, color: "var(--pain-5)", letterSpacing: "0.1em" }}>되돌리기 실패</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, marginTop: 5 }}>{message}</div>
      </div>
      <button type="button" style={secondaryBtn} onClick={onRestart}>다른 파일 고르기</button>
    </div>
  )
}
