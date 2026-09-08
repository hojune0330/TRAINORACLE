import React from "react"
import { FormInputDraftBoundary, useFormInputDraft, useRecoveredFormInput } from "./useFormInputDraft"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { FormFinalizationRecovery, useFormFinalization } from "./useFormFinalization"
import { Stamp } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { explicitOrMissing } from "../../domain/field-provenance"
import { parseTargetPaceInput } from "../../domain/journal-schema"
import {
  newEntryId,
  nextJournalSavedAt,
  saveEntry,
  savePrivateEntry,
  todayISO,
  updateEntry,
  updatePrivateEntry,
} from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { RacePostMood, RacePreChecks } from "./RaceSelfChecks"
import { inputStyle } from "./input-style"
import { FormSec, TopBar } from "./shared"
import { FormInputSaveBar as StickyBar } from "./useFormInputDraft"
import type { EntryFormProps } from "./shared"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../../hooks/useOrderedStepMotion"

type RaceStage = "pre" | "post"

export function RaceForm(props: EntryFormProps) {
  return <FormInputDraftBoundary kind="race" date={props.initialEntry?.date ?? props.targetDate ?? todayISO()}
    hasInitialContext={props.initialEntry !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt])}>
    <RaceFormEditor {...props} />
  </FormInputDraftBoundary>
}

function RaceFormEditor({ onBack, onDone, targetDate, initialEntry }: EntryFormProps) {
  const recovered = useRecoveredFormInput("race")
  const input = recovered?.input
  const initial = initialEntry?.kind === "race" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const [entryId] = React.useState(() => recovered?.entryId ?? initial?.id ?? newEntryId())
  const lastSavedAt = React.useRef(recovered?.baseSavedAt ?? initial?.savedAt)
  const persistInFlight = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const accountEnabled = accountJournalRecordsEnabled()
  const finalization = useFormFinalization(entryId, accountEnabled, lastSavedAt)
  const entryDate = initial?.date ?? targetDate ?? todayISO()
  const initialPaceSeconds = initial?.goalPace?.secondsPerKm
  const [stage, setStage] = React.useState<RaceStage>(() => input?.stage ?? initial?.stage ?? "pre")
  const [record, setRecord] = React.useState(() => input?.record ?? initial?.record ?? "")
  const [rank, setRank] = React.useState(() => input?.rank ?? initial?.rank ?? "")
  const [result, setResult] = React.useState(() => input?.result ?? initial?.result ?? "")
  const [tension, setTension] = React.useState<number | null>(() => input ? input.tension : initial?.tension ?? null)
  const [condition, setCondition] = React.useState<number | null>(() => input ? input.condition : initial?.condition ?? null)
  const [mood, setMood] = React.useState<number | null>(() => input ? input.mood : initial?.mood ?? null)
  const [paceMinutes, setPaceMinutes] = React.useState(() => input?.paceMinutes ?? (initialPaceSeconds === undefined ? "" : String(Math.floor(initialPaceSeconds / 60))))
  const [paceSeconds, setPaceSeconds] = React.useState(() => input?.paceSeconds ?? (initialPaceSeconds === undefined ? "" : String(initialPaceSeconds % 60).padStart(2, "0")))
  const [paceError, setPaceError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState(false)
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null)
  const memo = usePurposeScopedMemo(input?.memo ?? initial?.memo ?? "", input ? input.purpose ?? undefined : initial?.memoPurpose)
  const draft = useFormInputDraft({ kind: "race", stage, record, rank, result, tension, condition,
    mood, paceMinutes, paceSeconds, memo: memo.text, purpose: memo.purpose ?? null }, entryId, true, lastSavedAt.current)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const stageMotion = useOrderedStepMotion(stage, ["pre", "post"])
  useActiveContentScroll(stage, stageRef, undefined, true)

  const persist = async () => {
    if (persistInFlight.current || !draft.current()) return
    const hasPaceInput = paceMinutes.trim() !== "" || paceSeconds.trim() !== ""
    const goalPace = parseTargetPaceInput(paceMinutes, paceSeconds)
    if (hasPaceInput && goalPace === null) {
      setPaceError("분과 초를 숫자로 적어 주세요. 초는 0부터 59까지예요.")
      return
    }
    setPaceError(null)
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) return

    let entry: JournalEntry = {
      id: entryId, kind: "race", date: entryDate,
      savedAt: nextJournalSavedAt(lastSavedAt.current), syncState: "local",
      stage, record, rank, result, memo: memo.text,
      fieldProvenance: {
        tension: explicitOrMissing(tension !== null),
        condition: explicitOrMissing(condition !== null),
        mood: explicitOrMissing(mood !== null),
        goalPace: explicitOrMissing(goalPace !== null),
      },
      ...(memo.text.trim() !== "" && memo.purpose !== undefined ? { memoPurpose: memo.purpose } : {}),
      ...(tension !== null ? { tension } : {}),
      ...(condition !== null ? { condition } : {}),
      ...(mood !== null ? { mood } : {}),
      ...(goalPace !== null ? { goalPace } : {}),
    }
    const isPrivateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.memo.trim() !== ""
    persistInFlight.current = true
    setSaving(true)
    setSaveError(false)
    setAccountNotice(null)
    try {
      const accountResult = accountEnabled ? await finalization.save(entry, lastSavedAt.current) : null
      if (accountResult?.ok) entry = accountResult.entry
      const saveResult = accountEnabled ? accountResult : (lastSavedAt.current === undefined
        ? isPrivateMemo ? await savePrivateEntry(entry) : saveEntry(entry)
        : isPrivateMemo ? await updatePrivateEntry(entry, lastSavedAt.current) : updateEntry(entry, lastSavedAt.current))
      if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=race ok=${saveResult?.ok === true}`)
      if (!saveResult?.ok) { setAccountNotice(accountResult?.notice ?? null); setSaveError(true); return }
      if (!draft.current()) return
      if (accountResult?.ok && accountResult.storage !== "ACCOUNT") {
        setAccountNotice(accountResult.storage === "CONFLICT" ? "수정 충돌 확인 필요 · 기기 보관됨 · 기록 미완료" : "계정 전송 대기 · 기기 보관됨 · 기록 미완료")
        setSaveError(true); return
      }
      if (accountEnabled) await draft.complete()
      if (!draft.current()) return
      lastSavedAt.current = entry.savedAt
      const saved = accountResult?.ok ? { ...entry, syncState: accountResult.storage === "ACCOUNT" ? "synced" as const : "local" as const } : entry
      const storageMessage = !accountResult?.ok ? null : accountResult.storage === "ACCOUNT"
        ? isPrivateMemo ? "비밀 일지를 계정에 저장했어요. 공유·분석에는 사용하지 않아요." : "일지를 계정에 저장했어요."
        : accountResult.storage === "CONFLICT"
          ? "수정 충돌을 확인해 주세요. 이 기기의 내용은 보관했지만 계정 저장은 완료되지 않았어요."
          : isPrivateMemo ? "비밀 일지를 이 기기에 보관했어요. 계정 전송 대기 중이며 공유·분석에는 사용하지 않아요."
            : "일지를 이 기기에 보관했어요. 계정 전송 대기 중이에요."
      const message = [memoPreparation.reviewMessage, storageMessage].filter(Boolean).join(" ")
      onDone?.("race", saved, message || undefined)
    } catch {
      setSaveError(true)
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }} aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={draft.back(onBack)}>경기 · 빠른 점검</TopBar>
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      <RaceHeader date={entryDate} isToday={entryDate === todayISO()} />
      <StageTabs stage={stage} onChange={setStage} />

      <div
        key={stage}
        ref={stageRef}
        className="journal-flow-stage active-stage-content active-content-scroll-target"
        data-flow-direction={stageMotion}
      >
        {stage === "pre" ? (
          <RacePreChecks
          tension={tension}
          condition={condition}
          paceMinutes={paceMinutes}
          paceSeconds={paceSeconds}
          paceError={paceError}
          onTension={setTension}
          onCondition={setCondition}
          onPaceMinutes={setPaceMinutes}
          onPaceSeconds={setPaceSeconds}
        />
        ) : (
          <>
          <FormSec lb="기록">
            <input aria-label="경기 기록" type="text" value={record} onChange={(event) => setRecord(event.target.value)} placeholder="16:42.18" style={{ ...inputStyle(), fontFamily: "var(--mono)", fontSize: 24, textAlign: "center", fontWeight: 500 }} />
            <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)" }}>
              분:초 형식으로 적어요 · PB<TermHelp term="pb" /> 비교는 기록이 쌓이면 보여줘요
            </div>
          </FormSec>
          <FormSec lb="순위 · 결과">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input aria-label="경기 순위" type="text" value={rank} onChange={(event) => setRank(event.target.value)} placeholder="예: 2위" style={inputStyle()} />
              <input aria-label="경기 결과" type="text" value={result} onChange={(event) => setResult(event.target.value)} placeholder="예: 결승 진출" style={inputStyle()} />
            </div>
          </FormSec>
          <RacePostMood selected={mood} onSelect={setMood} />
          </>
        )}
      </div>

      <FormSec lb="메모">
        <PurposeScopedMemoField
          controller={memo}
          fieldId="race-memo"
          label="경기 메모"
          placeholder={stage === "pre" ? "레이스 전에 자신에게..." : "경기를 마치고 남길 말..."}
        />
      </FormSec>
      {accountEnabled && saveError && <p role="alert">{accountNotice ?? "계정 저장을 완료하지 못했어요. 입력은 그대로 남아 있어요. 연결과 로그인 상태를 확인한 뒤 다시 저장해 주세요."}</p>}
      <StickyBar onSave={persist} error={saveError && !accountEnabled} label={saving ? "저장 중" : isEditing ? "수정 저장" : undefined} />
      </fieldset>
    </div>
  )
}

function RaceHeader({
  date,
  isToday,
}: {
  readonly date: string
  readonly isToday: boolean
}) {
  return (
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ border: "2px solid var(--ink-blue)", padding: "12px 14px", background: "var(--paper)", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-blue)" }}>RACE DAY</div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, marginTop: 4, color: "var(--ink)" }}>
            {isToday ? "오늘의 경기" : "이 날짜의 경기"}
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{compactDate(date)} {dowOf(date)} · {nowClock()}</div>
        </div>
        <Stamp kind="brand">D-0</Stamp>
      </div>
    </div>
  )
}

function StageTabs({ stage, onChange }: { readonly stage: RaceStage; readonly onChange: (stage: RaceStage) => void }) {
  return (
    <div style={{ padding: "18px 20px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--ink)" }}>
        {(["pre", "post"] as const).map((stageOption, index) => (
          <button key={stageOption} type="button" aria-pressed={stage === stageOption} onClick={() => onChange(stageOption)} style={{
            minHeight: 44, padding: "12px 0", background: stage === stageOption ? "var(--ink)" : "transparent",
            color: stage === stageOption ? "var(--bg)" : "var(--ink-2)", border: 0,
            borderRight: index === 0 ? "1px solid var(--ink)" : 0,
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}>{stageOption === "pre" ? "경기 직전" : "경기 직후"}</button>
        ))}
      </div>
    </div>
  )
}
