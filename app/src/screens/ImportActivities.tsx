// 기기 데이터 가져오기 화면 — 워치 내보내기 파일(TCX/GPX) 업로드 (IMP-2).
//
// 왜 파일 업로드가 1차인가:
//  - Garmin Activity API는 기업 전용 승인이 필요하고, Strava는 개발자 구독 +
//    10명 한도, WHOOP는 기기 멤버십이 필요하다. 자동 연동은 오너 결정 대기 중.
//  - 반면 Garmin Connect·대부분 워치 앱은 TCX/GPX 내보내기를 지금 제공한다.
//    승인·시크릿 없이 오늘 동작하는 유일한 경로다.
//  - 근거: reports/implementation/DEVICE_IMPORT_FEASIBILITY_2026-07-25.md
//
// 원칙:
//  - 파일은 이 기기에서만 읽는다. 어디로도 업로드하지 않는다.
//  - 무단 자동 저장 없음: 목록에서 사용자가 고른 것만 저장한다.
//  - 읽지 못한 활동 수를 숨기지 않는다 (fail-visible).
//  - RPE·메모는 파일에 없다 — 저장 후 사용자가 직접 채우도록 안내한다.
import React from "react"
import { SectionLb } from "../components/JournalPrimitives"
import { compactDate } from "../domain/dates"
import { parseActivityFile } from "../domain/import/activity-file"
import type { ActivityParseResult } from "../domain/import/activity-file"
import { buildImportDrafts, saveImportedActivities } from "../domain/import/import-draft"
import type { ImportDraft, ImportFormat, ImportSaveResult } from "../domain/import/import-draft"

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
  | { readonly step: "review"; readonly drafts: readonly ImportDraft[]; readonly result: ActivityParseResult }
  | { readonly step: "saved"; readonly outcome: ImportSaveResult }

type ReadFailure = "unreadable" | "empty" | null

export function ImportActivities({ onBack, onOpenLog }: {
  readonly onBack?: () => void
  readonly onOpenLog?: () => void
}) {
  const [stage, setStage] = React.useState<Stage>({ step: "pick" })
  const [failure, setFailure] = React.useState<ReadFailure>(null)
  const [selected, setSelected] = React.useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setFailure(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setBusy(false)
      setFailure("unreadable")
      return
    }

    const result = parseActivityFile(text)
    setBusy(false)
    if (result.activities.length === 0) {
      setFailure(result.skipped > 0 ? "empty" : "unreadable")
      setStage({ step: "pick" })
      return
    }

    const drafts = buildImportDrafts(result.activities)
    // 중복으로 보이는 항목은 기본 해제 — 사용자가 직접 켜야 저장된다.
    setSelected(new Set(
      drafts.flatMap((draft, index) => (draft.duplicateOf === null ? [index] : [])),
    ))
    setStage({ step: "review", drafts, result })
  }

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleSave = () => {
    if (stage.step !== "review") return
    const chosen = stage.drafts
      .filter((_, index) => selected.has(index))
      .map((draft) => draft.activity)
    if (chosen.length === 0) return

    const format: ImportFormat = stage.result.format === "gpx" ? "gpx" : "tcx"
    const outcome = saveImportedActivities(chosen, format)
    setStage({ step: "saved", outcome })
  }

  return (
    <div style={{ padding: "18px 20px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            type="button" onClick={onBack} aria-label="뒤로"
            style={{ ...secondaryBtn, width: 44, minWidth: 44, minHeight: 44, fontSize: 18 }}
          >←</button>
        )}
        <div>
          <div style={{ ...mono, fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            IMPORT · 기기 데이터 가져오기
          </div>
          <h1 style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 500, margin: "4px 0 0" }}>
            워치 기록 불러오기
          </h1>
        </div>
      </div>

      {stage.step === "pick" && (
        <PickStage
          busy={busy}
          failure={failure}
          fileInputRef={fileInputRef}
          onFile={handleFile}
        />
      )}

      {stage.step === "review" && (
        <ReviewStage
          drafts={stage.drafts}
          result={stage.result}
          selected={selected}
          onToggle={toggle}
          onSave={handleSave}
          onRestart={() => { setStage({ step: "pick" }); setSelected(new Set()) }}
        />
      )}

      {stage.step === "saved" && (
        <SavedStage
          outcome={stage.outcome}
          onOpenLog={onOpenLog}
          onRestart={() => { setStage({ step: "pick" }); setSelected(new Set()); setFailure(null) }}
        />
      )}
    </div>
  )
}

function PickStage({ busy, failure, fileInputRef, onFile }: {
  readonly busy: boolean
  readonly failure: ReadFailure
  readonly fileInputRef: React.RefObject<HTMLInputElement>
  readonly onFile: (file: File) => void | Promise<void>
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        가민 커넥트·스트라바 등에서 활동을 <b>TCX 또는 GPX 파일로 내보내면</b> 여기서
        바로 일지로 옮길 수 있어요. 거리·시간·평균 페이스를 자동으로 채워요.
      </p>

      <div
        data-testid="import-privacy-notice"
        style={{ border: "1px solid var(--line)", borderLeft: "3px solid var(--ink-3)", background: "var(--surface)", padding: "10px 13px" }}
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
        내보낸 활동 파일 (.tcx / .gpx)
      </label>
      <input
        ref={fileInputRef}
        id="import-file"
        type="file"
        accept=".tcx,.gpx,application/xml,text/xml"
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
        <div role="alert" data-testid="import-failure" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "10px 13px" }}>
          <div style={{ ...mono, fontSize: 10.5, color: "var(--ink)", lineHeight: 1.6 }}>
            {failure === "empty"
              ? "파일은 읽었지만 일지로 옮길 활동을 찾지 못했어요. 날짜·거리·시간이 비어 있는 파일일 수 있어요."
              : "이 파일을 읽지 못했어요. 가민 커넥트에서 내보낸 .tcx 또는 .gpx 파일인지 확인해 주세요."}
            <br />기존 일지는 그대로 있어요.
          </div>
        </div>
      )}

      <SectionLb>자동 연동은 준비 중</SectionLb>
      <div
        data-testid="oauth-status"
        style={{ border: "1px dashed var(--line)", padding: "12px 14px" }}
      >
        <div style={{ ...mono, fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
          가민·WHOOP·스트라바 계정을 연결해 자동으로 받아오는 기능은 각 서비스의
          승인·계약 조건 때문에 <b>아직 시점을 약속할 수 없어요</b>. 되는 척하지
          않고, 준비되면 알려 드릴게요. 연동은 언제나 <b>읽기 전용</b>이에요.
        </div>
      </div>
    </div>
  )
}

function ReviewStage({ drafts, result, selected, onToggle, onSave, onRestart }: {
  readonly drafts: readonly ImportDraft[]
  readonly result: ActivityParseResult
  readonly selected: ReadonlySet<number>
  readonly onToggle: (index: number) => void
  readonly onSave: () => void
  readonly onRestart: () => void
}) {
  const chosenCount = drafts.filter((_, index) => selected.has(index)).length

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        활동 <b>{drafts.length}건</b>을 읽었어요. 저장할 것만 골라 주세요 —
        고르지 않은 건 저장되지 않아요.
      </p>

      {result.skipped > 0 && (
        <div data-testid="import-skipped" style={{ ...mono, fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.6, border: "1px solid var(--line)", padding: "9px 12px" }}>
          날짜나 기록을 읽지 못한 활동 {result.skipped}건은 목록에서 빠졌어요.
          없는 값을 채워 넣지 않으려고 일부러 건너뛰어요.
        </div>
      )}

      <SectionLb>가져올 활동</SectionLb>
      <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
        {drafts.map((draft, index) => {
          const { activity } = draft
          const isDuplicate = draft.duplicateOf !== null
          return (
            <label
              key={`${activity.date}-${index}`}
              data-testid="import-draft-row"
              style={{
                display: "grid", gridTemplateColumns: "24px 1fr", gap: 10,
                alignItems: "start", padding: "12px 2px", minHeight: 44,
                borderBottom: index < drafts.length - 1 ? "1px dashed var(--hair)" : 0,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(index)}
                onChange={() => onToggle(index)}
                aria-label={`${compactDate(activity.date)} ${activity.name} 가져오기`}
                style={{ width: 20, height: 20, marginTop: 2 }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
                    {compactDate(activity.date)}
                  </span>
                  {isDuplicate && (
                    <span data-testid="import-duplicate-flag" style={{
                      ...mono, fontSize: 9, color: "var(--ink)", letterSpacing: "0.06em",
                      border: "1px solid var(--warn, var(--line))", padding: "1px 5px",
                    }}>이미 있는 것 같아요</span>
                  )}
                </span>
                <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, marginTop: 3 }}>
                  {activity.name}
                </span>
                <span style={{ display: "block", ...mono, fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
                  {[
                    activity.distanceKm === "" ? null : `${activity.distanceKm}km`,
                    activity.durationMin === "" ? null : `${activity.durationMin}min`,
                    activity.avgPace === "" ? null : `${activity.avgPace}/km`,
                  ].filter((part) => part !== null).join(" · ") || "기록 값 없음"}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65 }}>
        RPE와 메모는 파일에 없어요 — 저장한 뒤 일지에서 직접 채워 주세요.
        가져온 숫자는 <b>주간 통계·추이·훈련계획에는 들어가지 않아요</b>
        (직접 확인한 값만 분석에 쓰는 원칙).
      </div>

      <button type="button" style={primaryBtn} disabled={chosenCount === 0} onClick={onSave}>
        {chosenCount === 0 ? "저장할 활동을 골라 주세요" : `고른 ${chosenCount}건 일지에 저장`}
      </button>
      <button type="button" style={secondaryBtn} onClick={onRestart}>다른 파일 고르기</button>
    </div>
  )
}

function SavedStage({ outcome, onOpenLog, onRestart }: {
  readonly outcome: ImportSaveResult
  readonly onOpenLog?: () => void
  readonly onRestart: () => void
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="import-saved" style={{ border: "1px solid var(--ink)", background: "var(--surface)", padding: "14px 16px" }}>
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>가져오기 완료</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, marginTop: 5 }}>
          {outcome.saved}건을 일지에 저장했어요
        </div>
        {outcome.failed > 0 && (
          <div style={{ ...mono, fontSize: 10.5, color: "var(--pain-5)", lineHeight: 1.6, marginTop: 6 }}>
            {outcome.failed}건은 저장하지 못했어요 — 기기 저장 공간이 가득 찼을 수
            있어요. 공간을 비운 뒤 다시 시도해 주세요.
          </div>
        )}
        <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65, marginTop: 8 }}>
          가져온 일지에는 <b>가져옴</b> 표시가 붙어요. RPE·메모를 채우면 그 값은
          직접 입력한 기록으로 분석에 쓰여요.
        </div>
      </div>

      {onOpenLog && (
        <button type="button" style={primaryBtn} onClick={onOpenLog}>일지에서 확인하기</button>
      )}
      <button type="button" style={secondaryBtn} onClick={onRestart}>파일 더 가져오기</button>
    </div>
  )
}
