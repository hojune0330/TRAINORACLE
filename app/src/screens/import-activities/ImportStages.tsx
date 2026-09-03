import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { compactDate } from "../../domain/dates"
import type { ActivityParseResult } from "../../domain/import/activity-file"
import type { ImportDraft, ImportSaveIntent, ImportSaveResult } from "../../domain/import/import-draft"
import { mono, primaryBtn, secondaryBtn } from "./styles"
import { TermHelp } from "../../components/TermHelp"

export type ReadFailure = "unreadable" | "empty" | "too-large" | "cancelled" | null

export function PickStage({ busy, failure, fileInputRef, onFile, onCancel }: {
  readonly busy: boolean
  readonly failure: ReadFailure
  readonly fileInputRef: React.RefObject<HTMLInputElement>
  readonly onFile: (file: File) => void | Promise<void>
  readonly onCancel: () => void
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        활동을 <b>CSV 또는 JSON 파일로 내보내면</b> 여기서 먼저 확인한 뒤
        일지로 옮길 수 있어요. TCX·GPX 파일도 읽을 수 있어요.
      </p>

      <div
        data-testid="import-privacy-notice"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: "10px 13px" }}
      >
        <div style={{ ...mono, fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
          파일은 이 기기에서만 읽어요
        </div>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-2)", lineHeight: 1.65, marginTop: 5 }}>
          고른 파일은 서버로 올라가지 않아요. 이 화면에서 내용을 읽어 일지 초안만
          만들고, <b>저장을 누른 것만</b> 이 기기의 일지에 들어가요.
        </div>
      </div>

      <label htmlFor="import-file" style={{ ...mono, fontSize: 11, color: "var(--ink-3)" }}>
        내보낸 활동 파일 (.csv / .json / .tcx / .gpx)
      </label>
      <input
        ref={fileInputRef}
        id="import-file"
        type="file"
        accept=".csv,.json,.tcx,.gpx,text/csv,application/json,application/xml,text/xml"
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file !== undefined) void onFile(file)
        }}
        style={{
          ...mono, fontSize: 12, width: "100%", boxSizing: "border-box",
          padding: "12px", minHeight: 48,
          border: "1px dashed var(--line)", background: "var(--surface)", color: "var(--ink)",
        }}
      />
      {busy && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-3)", margin: 0 }}>읽는 중…</p>
          <button type="button" onClick={onCancel} style={{ ...secondaryBtn, width: "auto", minHeight: 44 }}>
            가져오기 취소
          </button>
        </div>
      )}

      {failure !== null && (
        <div role="alert" data-testid="import-failure" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "10px 13px" }}>
          <div style={{ ...mono, fontSize: 10.5, color: "var(--ink)", lineHeight: 1.6 }}>
            {failure === "empty"
              ? "파일은 읽었지만 일지로 옮길 활동을 찾지 못했어요. 날짜·거리·시간이 비어 있는 파일일 수 있어요."
              : failure === "too-large"
                ? "파일이 너무 커요. 10MB 이하 파일로 나누어 다시 골라 주세요."
                : failure === "cancelled"
                  ? "가져오기를 취소했어요. 같은 파일도 다시 고를 수 있어요."
                  : "이 파일을 읽지 못했어요. .csv, .json, .tcx 또는 .gpx 파일인지 확인해 주세요."}
            <br />기존 일지는 그대로 있어요.
          </div>
        </div>
      )}

      <SectionLb>자동 연동은 준비 중</SectionLb>
      <div data-testid="oauth-status" style={{ border: "1px dashed var(--line)", padding: "12px 14px" }}>
        <div style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
          가민·WHOOP·스트라바 계정을 연결해 자동으로 받아오는 기능은 각 서비스의
          승인·계약 조건 때문에 <b>아직 시점을 약속할 수 없어요</b>. 되는 척하지
          않고, 준비되면 알려 드릴게요. 연동은 언제나 <b>읽기 전용</b>이에요.
        </div>
      </div>
    </div>
  )
}

export function ReviewStage({ drafts, result, selected, intents, onIntent, onToggle, onSave, onRestart }: {
  readonly drafts: readonly ImportDraft[]
  readonly result: ActivityParseResult
  readonly selected: ReadonlySet<number>
  readonly intents: ReadonlyMap<number, ImportSaveIntent>
  readonly onIntent: (index: number, intent: ImportSaveIntent | undefined) => void
  readonly onToggle: (index: number) => void
  readonly onSave: () => void
  readonly onRestart: () => void
}) {
  const chosenCount = drafts.filter((_, index) => selected.has(index)).length
  const missingIntent = drafts.some((_, index) => selected.has(index) && !intents.has(index))
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        활동 <b>{drafts.length}건</b>을 읽었어요. 저장할 것만 골라 주세요 — 고르지 않은 건 저장되지 않아요.
      </p>
      {result.skipped > 0 && (
        <div data-testid="import-skipped" style={{ ...mono, fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.6, border: "1px solid var(--line)", padding: "9px 12px" }}>
          날짜나 기록을 읽지 못한 활동 {result.skipped}건은 목록에서 빠졌어요. 없는 값을 채워 넣지 않으려고 일부러 건너뛰어요.
        </div>
      )}
      <SectionLb>가져올 활동</SectionLb>
      <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
        {drafts.map((draft, index) => {
          const { activity } = draft
          const intent = intents.get(index)
          return (
            <div key={`${activity.date}-${index}`} data-testid="import-draft-row" style={{
              display: "grid", gridTemplateColumns: "44px 1fr", gap: 10,
              alignItems: "start", padding: "12px 2px", minHeight: 44,
              borderBottom: index < drafts.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => onToggle(index)}
                  aria-label={`${compactDate(activity.date)} ${activity.name} 가져오기`}
                  style={{ width: 20, height: 20, margin: 0 }}
                />
              </label>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{compactDate(activity.date)}</span>
                  {draft.duplicateOf !== null && (
                    <span data-testid="import-duplicate-flag" style={{
                      ...mono, fontSize: 9, color: "var(--ink)", letterSpacing: "0.06em",
                      border: "1px solid var(--warn, var(--line))", padding: "1px 5px",
                    }}>이미 있는 것 같아요</span>
                  )}
                </span>
                <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, marginTop: 3 }}>{activity.name}</span>
                <span style={{ display: "block", ...mono, fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
                  {[
                    activity.distanceKm === "" ? null : `${activity.distanceKm}km`,
                    activity.durationMin === "" ? null : `${activity.durationMin}min`,
                    activity.avgPace === "" ? null : `${activity.avgPace}/km`,
                  ].filter((part) => part !== null).join(" · ") || "기록 값 없음"}
                </span>
                {selected.has(index) && <select
                  aria-label={`${activity.name} 저장 방식`}
                  value={intent?.kind === "SAVE_SEPARATE" ? "separate" : intent?.entryId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value
                    const target = draft.reconciliationCandidates.find((candidate) => candidate.id === value)
                    onIntent(index, value === "separate" ? { kind: "SAVE_SEPARATE" }
                      : target === undefined ? undefined
                        : { kind: "ADD_TO_EXISTING", entryId: target.id, expectedSavedAt: target.savedAt })
                  }}
                  style={{ width: "100%", minWidth: 0, minHeight: 44, marginTop: 8, fontFamily: "var(--sans)", fontSize: 13 }}
                >
                  <option value="">저장 방식 선택</option>
                  <option value="separate">새 일지로 저장</option>
                  {draft.reconciliationCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>
                    기존 일지 보완 · {candidate.activitySlot === "AM" ? "오전" : candidate.activitySlot === "PM" ? "오후" : "시간 미지정"} · {candidate.title}
                  </option>)}
                </select>}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65 }}>
        기존 일지를 보완하면 RPE<TermHelp term="rpe" />와 메모는 계속 수정할 수 있어요.
        새 일지로 가져온 활동은 현재 읽기 전용이에요.
        가져온 숫자는 <b>주간 통계·추이·훈련계획에는 들어가지 않아요</b> (직접 확인한 값만 분석에 쓰는 원칙).
      </div>
      <button type="button" style={primaryBtn} disabled={chosenCount === 0 || missingIntent} onClick={onSave}>
        {chosenCount === 0 ? "저장할 활동을 골라 주세요" : missingIntent ? "저장 방식을 골라 주세요" : `고른 ${chosenCount}건 일지에 저장`}
      </button>
      <button type="button" style={secondaryBtn} onClick={onRestart}>다른 파일 고르기</button>
    </div>
  )
}

export function SavedStage({ outcome, onOpenLog, onRestart }: {
  readonly outcome: ImportSaveResult
  readonly onOpenLog?: () => void
  readonly onRestart: () => void
}) {
  const completed = outcome.saved + (outcome.merged ?? 0)
  const resultLabel = completed === 0
    ? "가져오기 실패"
    : outcome.failed > 0 || (outcome.conflicts ?? 0) > 0
      ? "일부 완료"
      : "가져오기 완료"
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="import-saved" style={{ border: "1px solid var(--ink)", background: "var(--surface)", padding: "14px 16px" }}>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{resultLabel}</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, marginTop: 5 }}>
          새 일지 {outcome.saved}건 저장 · 기존 일지 {outcome.merged ?? 0}건 보완
        </div>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
          {outcome.saved + (outcome.merged ?? 0)}건을 일지에 저장했어요
        </div>
        {(outcome.conflicts ?? 0) > 0 && (
          <div style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 6 }}>
            {outcome.conflicts}건은 기존 일지가 변경됐거나 보완할 수 없는 상태라 합치지 않았어요. 기존 기록은 그대로예요.
          </div>
        )}
        {outcome.failed > 0 && (
          <div style={{ ...mono, fontSize: 10.5, color: "var(--pain-5)", lineHeight: 1.6, marginTop: 6 }}>
            {outcome.failed}건은 저장하지 못했어요 — 기기 저장 공간이 가득 찼을 수 있어요. 공간을 비운 뒤 다시 시도해 주세요.
          </div>
        )}
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65, marginTop: 8 }}>
          가져온 값에는 <b>가져옴</b> 표시가 붙어요. 기존 일지에 직접 입력한 RPE<TermHelp term="rpe" />는 분석에 쓸 수 있고, 가져온 값과 메모 원문은 분석에 포함되지 않아요.
          {outcome.saved > 0 && " 새 일지로 가져온 활동은 현재 읽기 전용이에요."}
        </div>
      </div>
      {onOpenLog && <button type="button" style={primaryBtn} onClick={onOpenLog}>일지에서 확인하기</button>}
      <button type="button" style={secondaryBtn} onClick={onRestart}>파일 더 가져오기</button>
    </div>
  )
}
