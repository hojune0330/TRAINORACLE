import React from "react"
import { parseActivityFile } from "../domain/import/activity-file"
import type { ActivityParseResult } from "../domain/import/activity-file"
import { buildImportDrafts, confirmImportDrafts } from "../domain/import/import-draft"
import type { ImportDraft, ImportDraftSelection, ImportFormat, ImportSaveIntent, ImportSaveResult } from "../domain/import/import-draft"
import { PickStage, ReviewStage, SavedStage } from "./import-activities/ImportStages"
import type { ReadFailure } from "./import-activities/ImportStages"
import { mono, secondaryBtn } from "./import-activities/styles"
import { ActivityFileReadError, MAX_IMPORT_FILE_BYTES, readActivityFileText } from "./import-activities/read-file"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../hooks/useOrderedStepMotion"
import { accountJournalRecordsEnabled } from "../domain/account/account-journal-record-service"
import { buildAccountImportDrafts, createAccountImportConfirmation } from "../domain/import/account-import"
import { useImportOwnerScope } from "./import-activities/useImportOwnerScope"

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
  const [intents, setIntents] = React.useState<ReadonlyMap<number, ImportSaveIntent>>(new Map())
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const confirmation = React.useRef<ReturnType<typeof createAccountImportConfirmation> | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const readControllerRef = React.useRef<AbortController | null>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const stageMotion = useOrderedStepMotion(stage.step, ["pick", "review", "saved"])
  useActiveContentScroll(stage.step, stageRef, undefined, true)
  const captureScope = useImportOwnerScope(() => {
    readControllerRef.current?.abort(); readControllerRef.current = null
    confirmation.current?.dispose(); confirmation.current = null
    busyRef.current = false; setBusy(false); setStage({ step: "pick" })
    setSelected(new Set()); setIntents(new Map()); setFailure(null)
  })

  React.useEffect(() => () => { readControllerRef.current?.abort(); confirmation.current?.dispose() }, [])

  const handleFile = async (file: File) => {
    if (busyRef.current) return
    const current = captureScope()
    busyRef.current = true
    confirmation.current?.dispose(); confirmation.current = null
    setBusy(true)
    setFailure(null)
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      busyRef.current = false
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
      if (!current() || readControllerRef.current !== controller) return
      if (readControllerRef.current === controller) readControllerRef.current = null
      setBusy(false)
      busyRef.current = false
      setFailure(error instanceof ActivityFileReadError ? error.kind : "unreadable")
      return
    }
    if (!current() || controller.signal.aborted) return

    const result = parseActivityFile(text)
    const drafts = accountJournalRecordsEnabled()
      ? await buildAccountImportDrafts(result.activities) : buildImportDrafts(result.activities)
    if (!current() || controller.signal.aborted) return
    if (readControllerRef.current === controller) readControllerRef.current = null
    busyRef.current = false
    setBusy(false)
    if (drafts === null) { setFailure("account-unavailable"); return }
    if (result.activities.length === 0) {
      setFailure(result.skipped > 0 ? "empty" : "unreadable")
      setStage({ step: "pick" })
      return
    }

    const separate = drafts.flatMap((draft, index) => (
      draft.duplicateOf === null && draft.reconciliationCandidates.length === 0 ? [index] : []
    ))
    setSelected(new Set(separate))
    setIntents(new Map(separate.map((index) => [index, { kind: "SAVE_SEPARATE" }])))
    setStage({ step: "review", drafts, result })
  }

  const cancelRead = () => {
    readControllerRef.current?.abort()
    readControllerRef.current = null
    setBusy(false)
    busyRef.current = false
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

  const handleSave = async () => {
    if (busyRef.current || stage.step !== "review") return
    const chosen: ImportDraftSelection[] = []
    for (const [index, draft] of stage.drafts.entries()) {
      if (!selected.has(index)) continue
      const intent = intents.get(index)
      if (intent === undefined) return
      chosen.push({ draft, intent })
    }
    if (chosen.length === 0) return

    const format = importFormat(stage.result.format)
    const current = captureScope()
    busyRef.current = true; setBusy(true)
    const account = accountJournalRecordsEnabled()
    if (account) confirmation.current ??= createAccountImportConfirmation(chosen, format)
    const outcome = account ? await confirmation.current!.confirm() : confirmImportDrafts(chosen, format)
    if (!current()) return
    busyRef.current = false; setBusy(false)
    if (!outcome) return
    setStage({ step: "saved", outcome })
  }

  return (
    <div style={{ padding: "18px 20px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            type="button" onClick={onBack} disabled={busy} aria-label="뒤로"
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
            busy={busy}
            drafts={stage.drafts}
            result={stage.result}
            selected={selected}
            intents={intents}
            onIntent={(index, intent) => setIntents((current) => {
              const next = new Map(current)
              if (intent === undefined) next.delete(index)
              else next.set(index, intent)
              return next
            })}
            onToggle={toggle}
            onSave={handleSave}
            onRestart={() => { setStage({ step: "pick" }); setSelected(new Set()) }}
          />
        )}

        {stage.step === "saved" && (
          <SavedStage
            busy={busy}
            onRetry={confirmation.current ? async () => {
              if (busyRef.current) return
              const current = captureScope()
              busyRef.current = true; setBusy(true)
              const outcome = await confirmation.current!.confirm()
              if (!current()) return
              busyRef.current = false; setBusy(false)
              if (outcome) setStage({ step: "saved", outcome })
            } : undefined}
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
