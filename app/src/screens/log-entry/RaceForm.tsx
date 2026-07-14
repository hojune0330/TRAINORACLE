import React from "react"
import { Stamp } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { parseTargetPaceInput } from "../../domain/journal-schema"
import { newEntryId, saveEntry, todayISO } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { RacePostMood, RacePreChecks } from "./RaceSelfChecks"
import { FormSec, inputStyle, StickyBar, TopBar } from "./shared"
import type { EntryFormProps } from "./shared"

type RaceStage = "pre" | "post"

export function RaceForm({ onBack, onDone }: EntryFormProps) {
  const [stage, setStage] = React.useState<RaceStage>("pre")
  const [record, setRecord] = React.useState("")
  const [rank, setRank] = React.useState("")
  const [result, setResult] = React.useState("")
  const [tension, setTension] = React.useState<number | null>(null)
  const [condition, setCondition] = React.useState<number | null>(null)
  const [mood, setMood] = React.useState<number | null>(null)
  const [paceMinutes, setPaceMinutes] = React.useState("")
  const [paceSeconds, setPaceSeconds] = React.useState("")
  const [paceError, setPaceError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState(false)
  const memo = usePurposeScopedMemo()

  const persist = () => {
    const hasPaceInput = paceMinutes.trim() !== "" || paceSeconds.trim() !== ""
    const goalPace = parseTargetPaceInput(paceMinutes, paceSeconds)
    if (hasPaceInput && goalPace === null) {
      setPaceError("분과 초를 숫자로 적어 주세요. 초는 0부터 59까지예요.")
      return
    }
    setPaceError(null)
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) return

    const entry: JournalEntry = {
      id: newEntryId(), kind: "race", date: todayISO(),
      savedAt: new Date().toISOString(), syncState: "local",
      stage, record, rank, result, memo: memo.text,
      ...(memo.text.trim() !== "" && memo.purpose !== undefined ? { memoPurpose: memo.purpose } : {}),
      ...(tension !== null ? { tension } : {}),
      ...(condition !== null ? { condition } : {}),
      ...(mood !== null ? { mood } : {}),
      ...(goalPace !== null ? { goalPace } : {}),
    }
    const saveResult = saveEntry(entry)
    if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=race ok=${saveResult.ok}`)
    if (!saveResult.ok) { setSaveError(true); return }
    if (memoPreparation.reviewMessage === null) onDone?.("race")
    else onDone?.("race", memoPreparation.reviewMessage)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>경기 · 빠른 점검</TopBar>
      <RaceHeader />
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

      <FormSec lb="메모">
        <PurposeScopedMemoField
          controller={memo}
          fieldId="race-memo"
          label="경기 메모"
          placeholder={stage === "pre" ? "레이스 전에 자신에게..." : "경기를 마치고 남길 말..."}
        />
      </FormSec>
      <StickyBar onSave={persist} error={saveError} />
    </div>
  )
}

function RaceHeader() {
  return (
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ border: "2px solid var(--ink-blue)", padding: "12px 14px", background: "var(--paper)", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-blue)" }}>RACE DAY</div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, marginTop: 4, color: "var(--ink)" }}>오늘의 경기</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{compactDate(todayISO())} {dowOf(todayISO())} · {nowClock()}</div>
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
            padding: "12px 0", background: stage === stageOption ? "var(--ink)" : "transparent",
            color: stage === stageOption ? "var(--bg)" : "var(--ink-2)", border: 0,
            borderRight: index === 0 ? "1px solid var(--ink)" : 0,
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}>{stageOption === "pre" ? "경기 직전" : "경기 직후"}</button>
        ))}
      </div>
    </div>
  )
}
