import React from "react"
import { parseActivityFile } from "../domain/import/activity-file"
import type { ActivityParseResult } from "../domain/import/activity-file"
import { buildImportDrafts, saveImportedActivities } from "../domain/import/import-draft"
import type { ImportDraft, ImportFormat, ImportSaveResult } from "../domain/import/import-draft"
import { PickStage, ReviewStage, SavedStage } from "./import-activities/ImportStages"
import type { ReadFailure } from "./import-activities/ImportStages"
import { mono, secondaryBtn } from "./import-activities/styles"
import { ActivityFileReadError, MAX_IMPORT_FILE_BYTES, readActivityFileText } from "./import-activities/read-file"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../hooks/useOrderedStepMotion"

type Stage =
  | { readonly step: "pick" }
  | { readonly step: "review"; readonly drafts: readonly ImportDraft[]; readonly result: ActivityParseResult }
  | { readonly step: "saved"; readonly outcome: ImportSaveResult }

export function ImportActivities({ onBack, onOpenLog }: {
  readonly onBack?: () => void
  readonly onOpenLog?: () => void
}) {
  const [stage, setStage] = React.useState<Stage>({ step: "pick" })
  const [failure, setFailure] = React.useState<ReadFailure>(null)
  const [selected, setSelected] = React.useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const readControllerRef = React.useRef<AbortController | null>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const stageMotion = useOrderedStepMotion(stage.step, ["pick", "review", "saved"])
  useActiveContentScroll(stage.step, stageRef, undefined, true)

  React.useEffect(() => () => readControllerRef.current?.abort(), [])

  const handleFile = async (file: File) => {
    setBusy(true)
    setFailure(null)
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setBusy(false)
      setFailure("too-large")
      return
    }

    readControllerRef.current?.abort()
    const controller = new AbortController()
    readControllerRef.current = controller
    let text: string
    try {
      text = await readActivityFileText(file, controller.signal)
    } catch (error) {
      if (readControllerRef.current === controller) readControllerRef.current = null
      if (!(error instanceof ActivityFileReadError)) throw error
      setBusy(false)
      setFailure(error.kind)
      return
    }
    if (readControllerRef.current === controller) readControllerRef.current = null

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

  const cancelRead = () => {
    readControllerRef.current?.abort()
    readControllerRef.current = null
    setBusy(false)
    setFailure("cancelled")
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

    const format = importFormat(stage.result.format)
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

      <div
        key={stage.step}
        ref={stageRef}
        className="active-stage-content active-content-scroll-target"
        data-flow-direction={stageMotion}
      >
        {stage.step === "pick" && (
          <PickStage
            busy={busy}
            failure={failure}
            fileInputRef={fileInputRef}
            onFile={handleFile}
            onCancel={cancelRead}
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
    </div>
  )
}

function importFormat(format: ActivityParseResult["format"]): ImportFormat {
  if (format === "csv" || format === "json" || format === "gpx") return format
  return "tcx"
}
