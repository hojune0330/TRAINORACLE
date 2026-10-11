import React from "react"
import { JournalWritingDecorationPreview } from "../journal/JournalDecorationPreview"
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
import { TaskFlowStep } from "../../components/TaskFlowStep"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"

type RaceStage = "pre" | "post"
type RaceFlowStep = "info" | "memo" | "review"

export function RaceForm(props: EntryFormProps) {
  const date = props.initialEntry?.date ?? props.targetDate ?? todayISO()
  return <JournalWritingDecorationPreview date={date}><FormInputDraftBoundary kind="race" date={date}
    hasInitialContext={props.initialEntry !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt])}>
    <RaceFormEditor {...props} />
  </FormInputDraftBoundary></JournalWritingDecorationPreview>
}

function RaceFormEditor({ onBack, onDone, targetDate, initialEntry }: EntryFormProps) {
  const recovered = useRecoveredFormInput("race")
  const input = recovered?.input
  const initial = initialEntry?.kind === "race" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const isInputReview = isEditing || input !== undefined
  const initialFlowStep: RaceFlowStep = isInputReview ? "review" : "info"
  const [flowStep, setFlowStep] = React.useState<RaceFlowStep>(initialFlowStep)
  const flowStepRef = React.useRef<RaceFlowStep>(initialFlowStep)
  const flowHistory = React.useRef<RaceFlowStep[]>([])
  const navigateToStep = (next: RaceFlowStep) => {
    if (flowStepRef.current === next) return
    flowHistory.current.push(flowStepRef.current)
    flowStepRef.current = next
    setFlowStep(next)
  }
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
  const [emptyNotice, setEmptyNotice] = React.useState(false)
  const prepareMemoOnOpen = React.useRef(false)
  const [saveError, setSaveError] = React.useState(false)
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null)
  const memo = usePurposeScopedMemo(input?.memo ?? initial?.memo ?? "", input ? input.purpose ?? undefined : initial?.memoPurpose)
  const draft = useFormInputDraft({ kind: "race", stage, record, rank, result, tension, condition,
    mood, paceMinutes, paceSeconds, memo: memo.text, purpose: memo.purpose ?? null }, entryId, true, lastSavedAt.current)
  React.useEffect(() => {
    if (isInputReview) {
      flowHistory.current = []
      flowStepRef.current = "review"
      setFlowStep("review")
    }
  }, [isInputReview])
  React.useEffect(() => {
    if (flowStep !== "memo" || !prepareMemoOnOpen.current) return
    prepareMemoOnOpen.current = false
    memo.prepareForSave()
  }, [flowStep, memo])

  const isFirstStep = isInputReview ? flowStep === "review" : flowStep === "info"
  const goBackFlow = () => {
    const previous = flowHistory.current.pop()
    if (previous !== undefined) {
      flowStepRef.current = previous
      setFlowStep(previous)
      return
    }
    draft.back(onBack)?.()
  }
  const returnToReviewFromMemo = () => {
    memo.reviewIfNeeded()
    navigateToStep("review")
  }
  useTaskFlowBack({ enabled: !isFirstStep, busy: saving, onBack: goBackFlow })

  const persist = async () => {
    if (persistInFlight.current || !draft.current()) return
    if (!reviewItems.some(item => item.label !== "경기 시점" && item.answered)) { setEmptyNotice(true); return }
    setEmptyNotice(false)
    const hasPaceInput = paceMinutes.trim() !== "" || paceSeconds.trim() !== ""
    const goalPace = parseTargetPaceInput(paceMinutes, paceSeconds)
    if (hasPaceInput && goalPace === null) {
      setPaceError("분과 초를 숫자로 적어 주세요. 초는 0부터 59까지예요.")
      setStage("pre")
      navigateToStep("info")
      return
    }
    setPaceError(null)
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) {
      prepareMemoOnOpen.current = true
      navigateToStep("memo")
      return
    }

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
      else void draft.complete()
      if (!draft.current()) return
      lastSavedAt.current = entry.savedAt
      const saved = accountResult?.ok ? { ...entry, syncState: accountResult.storage === "ACCOUNT" ? "synced" as const : "local" as const } : entry
      const storageMessage = !accountResult?.ok ? null : accountResult.storage === "ACCOUNT"
        ? isPrivateMemo ? "비밀 일지를 계정에 저장했어요. 공유·분석에는 사용하지 않아요." : "일지를 계정에 저장했어요."
        : accountResult.storage === "CONFLICT"
          ? "수정 충돌을 확인해 주세요. 이 기기의 내용은 보관했지만 계정 저장은 완료되지 않았어요."
          : isPrivateMemo ? "비밀 일지를 이 기기에 보관했어요. 계정 전송 대기 중이며 공유·분석에는 사용하지 않아요."
            : "일지를 이 기기에 보관했어요. 계정 전송 대기 중이에요."
      if (storageMessage) onDone?.("race", saved, memoPreparation.reviewMessage ?? undefined, storageMessage)
      else onDone?.("race", saved, memoPreparation.reviewMessage ?? undefined)
    } catch {
      setSaveError(true)
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  const unfilled = "입력하지 않았어요"
  const preRaceValues = [
    tension !== null ? `긴장도 ${tension}/10` : null,
    condition !== null ? `컨디션 ${condition}/5` : null,
    paceMinutes.trim() !== "" || paceSeconds.trim() !== ""
      ? `목표 페이스 ${paceMinutes.trim() || "—"}분 ${paceSeconds.trim() || "—"}초/km`
      : null,
  ].filter((value): value is string => value !== null)
  const resultValues = [
    record.trim() !== "" ? `기록 ${record.trim()}` : null,
    rank.trim() !== "" ? `순위 ${rank.trim()}` : null,
    result.trim() !== "" ? `결과 ${result.trim()}` : null,
  ].filter((value): value is string => value !== null)
  const memoPreview = memo.text.trim().replace(/\s+/gu, " ")
  const memoPurposeLabel = memo.purpose === "PRIVATE_SELF_ONLY"
    ? "나만의 메모"
    : memo.purpose === "ANALYZABLE_TRAINING_NOTE" ? "훈련 메모" : "용도 선택 필요"
  const reviewItems = [
    { label: "경기 시점", value: stage === "pre" ? "경기 직전" : "경기 직후", answered: true },
    { label: "경기 전 점검", value: preRaceValues.join(" · ") || unfilled, answered: preRaceValues.length > 0 },
    { label: "경기 기록", value: resultValues.join(" · ") || unfilled, answered: resultValues.length > 0 },
    { label: "경기 후 감정", value: mood === null ? unfilled : `${mood}/5`, answered: mood !== null },
    { label: "메모", value: memoPreview ? `${memoPurposeLabel} · ${memoPreview.slice(0, 100)}${memoPreview.length > 100 ? "…" : ""}` : "메모 없음", answered: memoPreview.length > 0 },
  ]
  const reviewContext = input
    ? isEditing
      ? "저장되지 않은 수정 내용을 불러왔어요. 저장하면 이 기록을 교체해요."
      : "저장되지 않은 입력 내용을 불러왔어요. 기록으로 남기려면 저장해 주세요."
    : isEditing
      ? "기존 기록을 확인해요. 바꿀 항목만 고친 뒤 저장할 수 있어요."
      : "입력한 내용만 저장해요."

  return (
    <div style={{ paddingBottom: flowStep === "review" ? 100 : 24 }} aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={goBackFlow}>경기 · 빠른 점검</TopBar>
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      <RaceHeader date={entryDate} isToday={entryDate === todayISO()} />

      <TaskFlowStep stepKey={flowStep}
        title={flowStep === "info" ? "경기 정보를 적어요" : flowStep === "memo" ? "경기 메모" : "입력 확인"}
        busy={saving} onBack={isFirstStep ? undefined : goBackFlow}
        actions={flowStep === "review" ? <StickyBar onSave={persist} error={saveError && !accountEnabled}
          label={saving ? "저장 중" : isEditing ? "수정 저장" : undefined} /> : (
          <div className="task-flow__actions">
            {flowStep === "info" && <>
              <button type="button" className="quick-log__secondary" onClick={() => navigateToStep("memo")}>
                {memo.text.trim() === "" ? "메모 추가" : "메모 수정"}
              </button>
              <button type="button" className="quick-log__primary" onClick={() => navigateToStep("review")}>
                {isInputReview ? "입력 확인으로" : "지금 입력 확인"}
              </button>
            </>}
            {flowStep === "memo" && <button type="button" className="quick-log__primary" onClick={returnToReviewFromMemo}>입력 확인으로</button>}
          </div>
        )}>
        {flowStep === "review" && <div className="race-review" role="region" aria-label="저장 전 입력 확인">
          {emptyNotice && !reviewItems.some(item => item.label !== "경기 시점" && item.answered) && <p role="alert">아직 입력한 내용이 없어요. 남길 항목 하나를 골라 주세요.</p>}
          <p>{reviewContext}</p>
          <dl style={{ display: "grid", gap: 8, margin: 0 }}>
            {reviewItems.filter(item => item.answered).map((item) => (
              <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2, borderBottom: "1px solid var(--line)", paddingBlock: 8 }}>
                <dt style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.label}</dt>
                <dd style={{ margin: 0, fontSize: 14, color: "var(--ink)", overflowWrap: "anywhere" }}>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="task-flow__actions" style={{ paddingInline: 0 }}>
            <button type="button" className="quick-log__secondary" onClick={() => navigateToStep("info")}>경기 정보 수정</button>
            <button type="button" className="quick-log__secondary" onClick={() => navigateToStep("memo")}>메모 수정</button>
          </div>
          {memo.reviewMessage !== null && <p role="status" style={{ marginTop: 12 }}>{memo.reviewMessage}</p>}
          {accountEnabled && saveError && <p role="alert">{accountNotice ?? "계정 저장을 완료하지 못했어요. 입력은 그대로 남아 있어요. 연결과 로그인 상태를 확인한 뒤 다시 저장해 주세요."}</p>}
        </div>}

        {flowStep === "info" && <>
          <StageTabs stage={stage} onChange={setStage} />
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
        </>}

        {flowStep === "memo" && <FormSec lb="메모">
          <PurposeScopedMemoField
            controller={memo}
            fieldId="race-memo"
            label="경기 메모"
            placeholder={stage === "pre" ? "레이스 전에 자신에게..." : "경기를 마치고 남길 말..."}
          />
        </FormSec>}
      </TaskFlowStep>
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
      <div className="app-choice-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {(["pre", "post"] as const).map((stageOption) => (
          <button className="app-choice-control" key={stageOption} type="button" aria-pressed={stage === stageOption} onClick={() => onChange(stageOption)}>{stageOption === "pre" ? "경기 직전" : "경기 직후"}</button>
        ))}
      </div>
    </div>
  )
}
