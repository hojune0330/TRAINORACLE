import React from "react"
import { ActivityParseCancelled, parseActivityFileAsync } from "../domain/import/parse-activity-file-async"
import type { ActivityParseResult, ImportedActivity } from "../domain/import/activity-file"
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
import { fileAnalysisFormats } from "../domain/import/file-analysis-policy"
import { AppHeading } from "../components/AppHeading"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { readCurrentConfirmedAccountJournalProjection } from "../domain/account/account-journal-projection"
import { buildFileAnalysisReport } from "../domain/import/file-analysis"
import type { FileObservationV1 } from "../domain/import/file-observation"

type ImportAnalysisCandidate = {
  readonly entryId: string | null
  readonly sourceObservationKey: string
  readonly contentRevisionFingerprint: string
  readonly sport: FileObservationV1["sport"] | null
  readonly durationMeaning: FileObservationV1["durationMeaning"] | null
}

type Stage =
  | { readonly step: "pick" }
  | { readonly step: "review"; readonly drafts: readonly ImportDraft[]; readonly result: ActivityParseResult }
  | { readonly step: "saved"; readonly outcome: ImportSaveResult; readonly format: ImportFormat; readonly analysisCandidates: readonly ImportAnalysisCandidate[] }

export function ImportActivities({ onBack, onOpenLog, onOpenAnalysis, onOpenSummary }: {
  readonly onBack?: () => void
  readonly onOpenLog?: () => void
  readonly onOpenAnalysis?: () => void
  readonly onOpenSummary?: () => void
}) {
  const [stage, setStage] = React.useState<Stage>({ step: "pick" })
  const [failure, setFailure] = React.useState<ReadFailure>(null)
  const [reviewError, setReviewError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<ReadonlySet<number>>(new Set())
  const [intents, setIntents] = React.useState<ReadonlyMap<number, ImportSaveIntent>>(new Map())
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const confirmation = React.useRef<ReturnType<typeof createAccountImportConfirmation> | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const readControllerRef = React.useRef<AbortController | null>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const stageMotion = useOrderedStepMotion(stage.step, ["pick", "review", "saved"])
  useTaskFlowBack({ enabled: onBack !== undefined, busy, onBack: () => {
    const current = captureScope()
    // The shell's POP listener invalidates old return frames. Restore only after it ran.
    queueMicrotask(() => { if (current()) onBack?.() })
  } })
  useActiveContentScroll(stage.step, stageRef, undefined, true)
  const captureScope = useImportOwnerScope(() => {
    readControllerRef.current?.abort(); readControllerRef.current = null
    confirmation.current?.dispose(); confirmation.current = null
    busyRef.current = false; setBusy(false); setStage({ step: "pick" })
    setSelected(new Set()); setIntents(new Map()); setFailure(null); setReviewError(null)
  })

  React.useEffect(() => () => { readControllerRef.current?.abort(); confirmation.current?.dispose() }, [])

  const handleFile = async (file: File) => {
    if (busyRef.current) return
    const current = captureScope()
    busyRef.current = true
    confirmation.current?.dispose(); confirmation.current = null
    setBusy(true)
    setFailure(null)
    setReviewError(null)
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      busyRef.current = false
      setBusy(false)
      setFailure("too-large")
      return
    }
    if (/\.(zip|fit)$/i.test(file.name)) {
      busyRef.current = false; setBusy(false); setFailure("unsupported-format"); return
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

    let parsed = false
    try {
      const formats = accountJournalRecordsEnabled() ? fileAnalysisFormats() : []
      const result = await parseActivityFileAsync(text, Intl.DateTimeFormat().resolvedOptions().timeZone, {
        observations: { csv: formats.includes("csv"), json: formats.includes("json"), gpx: formats.includes("gpx") },
      }, controller.signal)
      if (!current() || controller.signal.aborted || readControllerRef.current !== controller) return
      parsed = true
      if (result.activities.length === 0) {
        const codes = result.issues?.map(issue => issue.code) ?? []
        setFailure(codes.includes("FILE_TOO_LARGE") ? "too-large"
          : codes.includes("ACTIVITY_LIMIT_EXCEEDED") ? "too-many-records"
            : codes.includes("POINT_LIMIT_EXCEEDED") || codes.includes("LAP_LIMIT_EXCEEDED") ? "too-many-segments"
              : codes.includes("UNSUPPORTED_FORMAT") ? "unsupported-format"
              : result.skipped > 0 ? "empty" : "unreadable")
        setStage({ step: "pick" }); return
      }
      const drafts = accountJournalRecordsEnabled()
        ? await buildAccountImportDrafts(result.activities) : buildImportDrafts(result.activities)
      if (!current() || controller.signal.aborted) return
      if (drafts === null) { setFailure("account-unavailable"); return }
      const separate = drafts.flatMap((draft, index) => (
        draft.duplicateOf === null && draft.reconciliationCandidates.length === 0
          && !(formats.some(format => format === result.format)
            && (draft.requiresIdentityChoice || (draft.identityCandidates?.length ?? 0) > 0)) ? [index] : []
      ))
      setSelected(new Set(separate))
      setIntents(new Map(separate.map((index) => [index, { kind: "SAVE_SEPARATE" }])))
      setStage({ step: "review", drafts, result })
    } catch (error) {
      if (current() && readControllerRef.current === controller) {
        setFailure(error instanceof ActivityParseCancelled ? "cancelled" : parsed ? "account-unavailable" : "unreadable")
      }
    }
    finally {
      if (current() && readControllerRef.current === controller) {
        if (readControllerRef.current === controller) readControllerRef.current = null
        busyRef.current = false; setBusy(false)
      }
    }
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
      if (accountJournalRecordsEnabled() && fileAnalysisFormats().some(format => format === stage.result.format)
        && draft.requiresIdentityChoice && intent.kind === "SAVE_SEPARATE" && intent.confirmedSeparate !== true) return
      chosen.push({ draft, intent })
    }
    if (chosen.length === 0) return

    const format = importFormat(stage.result.format)
    const analysisCandidates = chosen.flatMap(({ draft, intent }): ImportAnalysisCandidate[] => {
      const observation = draft.activity.observation
      return intent.kind === "EXCLUDE" || observation?.format !== format ? [] : [{
        entryId: "entryId" in intent ? intent.entryId : null,
        sourceObservationKey: observation.sourceObservationKey,
        contentRevisionFingerprint: observation.contentRevisionFingerprint,
        sport: observation.confirmation?.sport ?? null,
        durationMeaning: observation.confirmation?.durationMeaning ?? null,
      }]
    })
    const current = captureScope()
    busyRef.current = true; setBusy(true)
    const account = accountJournalRecordsEnabled()
    try {
      if (account) confirmation.current ??= createAccountImportConfirmation(chosen, format)
      const outcome = account ? await confirmation.current!.confirm() : confirmImportDrafts(chosen, format)
      if (!current() || !outcome) return
      setStage({ step: "saved", outcome, format, analysisCandidates })
    } catch {
      if (current()) setStage({ step: "saved", format, analysisCandidates, outcome: {
        ...(account ? { account: 0, pending: 0 } : {}), saved: 0, failed: chosen.length,
        total: chosen.length, stopReason: "SAVE_REJECTED",
      } })
    } finally { if (current()) { busyRef.current = false; setBusy(false) } }
  }

  const changeActivity = async (index: number, activity: ImportedActivity) => {
    if (busyRef.current || stage.step !== "review") return
    const current = captureScope()
    busyRef.current = true; setBusy(true); setReviewError(null)
    try {
      const activities = stage.drafts.map((draft, row) => row === index ? activity : draft.activity)
      const drafts = accountJournalRecordsEnabled() ? await buildAccountImportDrafts(activities) : buildImportDrafts(activities)
      if (!current()) return
      if (!drafts) { setReviewError("계정 기록을 확인하지 못했어요. 앞서 고른 내용은 유지했어요. 다시 시도해 주세요."); return }
      setStage({ ...stage, drafts })
      setIntents(previous => new Map([...previous].filter(([row, intent]) => row !== index
        && intent.kind !== "USE_EXISTING" && intent.kind !== "ADD_TO_EXISTING")))
    } catch { if (current()) setReviewError("기록을 다시 확인하지 못했어요. 앞서 고른 내용은 유지했어요. 연결을 확인하고 다시 골라 주세요.") }
    finally { if (current()) { busyRef.current = false; setBusy(false) } }
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
          <AppHeading as="h1" variant="screen" accent className="import-activities__title">
            운동 기록 가져오기
          </AppHeading>
        </div>
      </div>

      <div
        key={stage.step}
        ref={stageRef}
        className="active-stage-content active-content-scroll-target"
        data-flow-direction={stageMotion}
      >
        {reviewError && <p role="alert">{reviewError}</p>}
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
            onActivityChange={(index, activity) => { void changeActivity(index, activity) }}
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
              try {
                const outcome = await confirmation.current!.confirm()
                if (current() && outcome) setStage({ ...stage, outcome })
              } catch { if (current()) setReviewError("저장 상태를 확인하지 못했어요. 기존 결과는 유지했어요. 다시 시도해 주세요.") }
              finally { if (current()) { busyRef.current = false; setBusy(false) } }
            } : undefined}
            outcome={stage.outcome}
            analysisAvailable={hasConfirmedImportAnalysis(stage)}
            onOpenLog={onOpenLog}
            onOpenAnalysis={onOpenAnalysis}
            onOpenSummary={onOpenSummary}
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

/** A different format's switch or a pending receipt cannot make this batch analysable. */
function hasConfirmedImportAnalysis({ outcome, format, analysisCandidates }: Extract<Stage, { step: "saved" }>): boolean {
  if ((outcome.account ?? 0) === 0 || !fileAnalysisFormats().includes(format)) return false
  const confirmed = readCurrentConfirmedAccountJournalProjection().filter(entry => entry.kind === "post-session"
    && entry.fileObservation?.format === format && analysisCandidates.some(candidate =>
      (candidate.entryId === null || candidate.entryId === entry.id)
      && candidate.sourceObservationKey === entry.fileObservation!.sourceObservationKey
      && candidate.contentRevisionFingerprint === entry.fileObservation!.contentRevisionFingerprint
      && candidate.sport === (entry.fileObservation!.confirmation?.sport ?? null)
      && candidate.durationMeaning === (entry.fileObservation!.confirmation?.durationMeaning ?? null)))
  const dates = confirmed.map(entry => entry.date).sort()
  const startDate = dates[0], endDate = dates.at(-1)
  if (startDate === undefined || endDate === undefined) return false
  return buildFileAnalysisReport(confirmed, { startDate, endDate, sourceContext: "ACCOUNT_CONFIRMED" }).includedSourceCount > 0
}
