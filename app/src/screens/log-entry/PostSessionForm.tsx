import React from "react"
import { IndexCard } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { explicitOrMissing } from "../../domain/field-provenance"
import { newEntryId, saveEntry, todayISO, updateEntry } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { IntensityAssessmentField, useIntensityAssessment } from "./IntensityAssessmentField"
import { inputStyle } from "./input-style"
import { FormSec, TopBar, useSectionTouchOrder } from "./shared"
import { StickyBar } from "./StickyBar"
import type { EntryFormProps } from "./shared"

const ENERGY_SYSTEMS = [
  { id: "base", c: "BA", n: "BASE", color: "#4A8FC7" },
  { id: "lt", c: "LT", n: "LT", color: "#B8A024" },
  { id: "vo2", c: "V2", n: "VO2", color: "#C7761C" },
  { id: "gly", c: "GL", n: "GLY", color: "#B8332E" },
  { id: "atp", c: "AP", n: "ATP", color: "#7A3FB5" },
  { id: "rest", c: "RE", n: "REST", color: "#7A7A70" },
] as const

export function PostSessionForm({ onBack, onDone, targetDate, initialEntry }: EntryFormProps) {
  const initial = initialEntry?.kind === "post-session" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const entryDate = initial?.date ?? targetDate ?? todayISO()
  const [rpe, setRpe] = React.useState(() => initial?.rpe ?? 0)
  const [saveError, setSaveError] = React.useState(false)
  const [system, setSystem] = React.useState(() => initial?.system ?? "base")
  const [title, setTitle] = React.useState(() => initial?.title ?? "")
  const [distanceKm, setDistanceKm] = React.useState(() => initial?.distanceKm ?? "")
  const [durationMin, setDurationMin] = React.useState(() => initial?.durationMin ?? "")
  const [avgPace, setAvgPace] = React.useState(() => initial?.avgPace ?? "")
  const intensity = useIntensityAssessment(initial?.intensityAssessment)
  const memo = usePurposeScopedMemo(initial?.memo ?? "", initial?.memoPurpose)

  // "다음 구획을 건드렸다" 판정은 화면이 한다 (오너 결정 2026-07-28 "건드릴 때").
  // FormSec 안에 넣지 않는 이유: 무엇이 "다음" 인지는 화면 순서가 정하는
  // 것이고 화면마다 다르다. FormSec 은 신호만 받는다.
  //
  // 값이 아니라 순서로 재는 이유는 useSectionTouchOrder 주석에 있다.
  // 요약: 예상 강도를 먼저 채운 사람이 RPE 를 누르면 값 판정으로는 누른
  // 순간 접힌다. 그건 오너가 물리친 동작이다.
  const touchOrder = useSectionTouchOrder()

  const persist = () => {
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) return
    const entry: JournalEntry = {
      id: initial?.id ?? newEntryId(), kind: "post-session", date: entryDate,
      savedAt: initial?.savedAt ?? new Date().toISOString(), syncState: "local",
      system, title, distanceKm, durationMin, avgPace, rpe, memo: memo.text,
      ...(intensity.assessment === undefined ? {} : { intensityAssessment: intensity.assessment }),
      fieldProvenance: {
        distanceKm: explicitOrMissing(distanceKm.trim() !== ""),
        durationMin: explicitOrMissing(durationMin.trim() !== ""),
        avgPace: explicitOrMissing(avgPace.trim() !== ""),
        rpe: explicitOrMissing(rpe > 0),
        plannedRpe: explicitOrMissing(intensity.plannedRpe > 0),
        objectiveComponents: explicitOrMissing(intensity.objectiveComponents.length > 0),
      },
      ...(memo.text.trim() !== "" && memo.purpose !== undefined ? { memoPurpose: memo.purpose } : {}),
    }
    const result = isEditing ? updateEntry(entry) : saveEntry(entry)
    if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=post-session ok=${result.ok}`)
    if (!result.ok) { setSaveError(true); return }
    if (memoPreparation.reviewMessage === null) onDone?.("post-session", entry)
    else onDone?.("post-session", entry, memoPreparation.reviewMessage)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>훈련 후 · 기록</TopBar>
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={compactDate(entryDate)} dow={`${dowOf(entryDate)} · ${nowClock()}`} />
      </div>

      <FormSec lb="강도 시스템" help="energy-system">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ENERGY_SYSTEMS.map((energySystem) => (
            <button key={energySystem.id} aria-label={`${energySystem.c} ${energySystem.n}`} aria-pressed={system === energySystem.id} onClick={() => setSystem(energySystem.id)} style={{
              minHeight: 44, padding: "8px 12px", background: "var(--surface)",
              border: system === energySystem.id ? `1.5px solid ${energySystem.color}` : "1px solid var(--line)",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              borderRadius: 0,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: energySystem.color }}></span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{energySystem.c}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{energySystem.n}</span>
            </button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="세션 제목">
        <input aria-label="세션 제목" type="text" value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle()} />
      </FormSec>
      <FormSec lb="거리 · 시간 · 평균 페이스" help="pace">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input aria-label="거리 (km)" type="text" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="시간 (분)" type="text" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="평균 페이스 (/km)" type="text" value={avgPace} onChange={(event) => setAvgPace(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>km</span><span>min</span><span>/km</span>
        </div>
      </FormSec>

      {/*
        RPE 구획은 버튼 10개 + 눈금 글자로 175px 다. 답을 고른 뒤에는
        `7/10` 한 줄이면 충분하다. 접는 시점은 오너가 정했다 — 다음 구획을
        건드릴 때다 (shared.tsx FormSec 주석).
        summary 가 비면 FormSec 이 접기를 거부하므로, 아직 안 고른 상태에서는
        `미선택` 을 넣지 않고 undefined 를 준다. 판정 문구가 아니라 "값이 없다"
        는 뜻이고, 값이 없으면 접혀서는 안 된다.
      */}
      <FormSec
        lb="RPE · 주관 강도"
        help="rpe"
        collapsible
        summary={rpe > 0 ? `${rpe}/10` : undefined}
        collapseWhenLeft={touchOrder.leftBehind("rpe")}
        onTouch={() => touchOrder.touch("rpe")}
      >
        <div className="journal-ten-scale" style={{ display: "grid", gap: 0, border: "1px solid var(--ink)" }}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button key={value} aria-pressed={rpe === value} onClick={() => setRpe(value)} style={{
              minHeight: 44, padding: "12px 0", border: 0, cursor: "pointer",
              background: rpe === value ? "var(--ink)" : "transparent",
              color: rpe === value ? "var(--bg)" : "var(--ink)",
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500,
              borderRight: value < 10 ? "1px solid var(--line)" : 0,
            }}>{value}</button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>매우 쉬움</span><span>최대</span>
        </div>
      </FormSec>

      <IntensityAssessmentField
        controller={intensity}
        reportedRpe={rpe}
        onSectionTouch={touchOrder.touch}
      />

      <FormSec lb="메모 · 손글씨처럼" onTouch={() => touchOrder.touch("memo")}>
        <PurposeScopedMemoField
          controller={memo}
          fieldId="post-session-memo"
          label="훈련 메모 내용"
          placeholder="오늘 어땠는지 한 줄이라도..."
          rows={4}
        />
      </FormSec>

      <StickyBar onSave={persist} error={saveError} label={isEditing ? "수정 저장" : undefined} />
    </div>
  )
}
