import React from "react"
import { ArrowLeft, Save } from "lucide-react"
import {
  achievedDateError,
  createSelfReportedAthleteRecord,
  loadAthleteRecords,
  saveAthleteRecord,
} from "../domain/athlete-records"
import type { RecordPurpose } from "../domain/athlete-records"
import { AthleteRecordRow } from "./athlete-records/AthleteRecordRow"

const DISTANCE_OPTIONS = [
  ["800", "800m"],
  ["1500", "1500m"],
  ["3000", "3000m"],
  ["5000", "5000m"],
  ["10000", "10000m"],
  ["21097", "하프마라톤 · 21097m"],
  ["42195", "마라톤 · 42195m"],
  ["CUSTOM", "직접 입력"],
] as const

const PURPOSE_OPTIONS: ReadonlyArray<readonly [RecordPurpose, string]> = [
  ["PERSONAL_BEST", "개인 최고"],
  ["SEASON_BEST", "시즌 최고"],
  ["RECENT_RESULT", "최근 경기"],
  ["RACE_GOAL", "경기 목표"],
]

export function AthleteRecords({ onBack, onSaved, backLabel = "계획으로" }: {
  readonly onBack: () => void
  readonly onSaved?: (() => void) | undefined
  readonly backLabel?: string | undefined
}) {
  const [records, setRecords] = React.useState(() => loadAthleteRecords(new Date()))
  const [purpose, setPurpose] = React.useState<RecordPurpose>("PERSONAL_BEST")
  const [distanceOption, setDistanceOption] = React.useState("5000")
  const [customDistance, setCustomDistance] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [seconds, setSeconds] = React.useState("")
  const [achievedOn, setAchievedOn] = React.useState("")
  const [seasonId, setSeasonId] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [errorField, setErrorField] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)
  const errorId = React.useId()
  const showError = (message: string, field: string | null = null) => {
    setError(message)
    setErrorField(field)
    if (field) {
      const input = formRef.current?.querySelector<HTMLInputElement>(`[data-record-field="${field}"]`)
      input?.focus({ preventScroll: true })
      input?.scrollIntoView?.({ block: "center", behavior: "auto" })
    }
  }
  const fieldProps = (name: string) => ({ "data-record-field": name,
    "aria-invalid": errorField === name || undefined,
    "aria-describedby": errorField === name ? errorId : undefined })
  const fieldError = (name: string) => errorField === name && <span id={errorId} className="athlete-record-error" role="alert">{error}</span>

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const now = new Date()
    const distance = Number(
      distanceOption === "CUSTOM" ? customDistance : distanceOption,
    )
    if (!Number.isFinite(distance) || distance < 60) {
      showError("종목 거리는 60m 이상으로 입력해 주세요.", "distance")
      return
    }
    const parsedMinutes = Number(minutes)
    const parsedSeconds = Number(seconds)
    if (
      !Number.isInteger(parsedMinutes)
      || parsedMinutes < 0
      || !Number.isFinite(parsedSeconds)
      || parsedSeconds < 0
      || parsedSeconds >= 60
      || parsedMinutes * 60 + parsedSeconds <= 0
    ) {
      showError("기록의 분과 초를 다시 확인해 주세요.",
        !Number.isFinite(parsedSeconds) || parsedSeconds < 0 || parsedSeconds >= 60 ? "seconds" : "minutes")
      return
    }
    if (purpose !== "RACE_GOAL") {
      const dateError = achievedDateError(achievedOn, now)
      if (dateError === "FUTURE_DATE") {
        showError("미래 달성일은 저장할 수 없어요.", "date")
        return
      }
      if (dateError === "INVALID_DATE") {
        showError("달성일을 YYYY-MM-DD로 입력해 주세요.", "date")
        return
      }
    }
    if (purpose === "SEASON_BEST" && seasonId.trim() === "") {
      showError("시즌 최고 기록에는 시즌 이름이 필요해요.", "season")
      return
    }
    const id = newLocalRecordId()
    const record = createSelfReportedAthleteRecord({
      id,
      purpose,
      eventDistanceM: distance,
      performanceSeconds: parsedMinutes * 60 + parsedSeconds,
      achievedOn: purpose === "RACE_GOAL" ? null : achievedOn,
      seasonId: purpose === "SEASON_BEST" ? seasonId.trim() : null,
    }, now)
    if (record === null) {
      showError("입력 내용을 다시 확인해 주세요.")
      return
    }
    const result = saveAthleteRecord(record, now)
    if (!result.ok) {
      showError("기록을 저장하지 못했어요. 저장 공간을 확인해 주세요.")
      return
    }
    setRecords(loadAthleteRecords(now))
    setMinutes("")
    setSeconds("")
    setAchievedOn("")
    setSeasonId("")
    setError(null)
    setErrorField(null)
    onSaved?.()
  }

  return (
    <section className="athlete-records" aria-labelledby="athlete-records-title">
      <header className="athlete-records-header">
        <button className="plan-back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={17} />
          {backLabel}
        </button>
        <div className="plan-eyebrow">내 경기 기록</div>
        <h1 id="athlete-records-title">내 경기 기록</h1>
        <p>실제 경기 기록과 앞으로의 목표를 서로 다른 역할로 보관해요.</p>
      </header>

      <form ref={formRef} className="athlete-record-form" onSubmit={handleSave}>
        <label>
          <span>기록 역할</span>
          <select
            aria-label="기록 역할"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as RecordPurpose)}
          >
            {PURPOSE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>종목 거리</span>
          <select
            aria-label="종목 거리"
            value={distanceOption}
            onChange={(event) => setDistanceOption(event.target.value)}
          >
            {DISTANCE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {distanceOption === "CUSTOM" && (
          <label>
            <span>직접 입력 거리 (m)</span>
            <input
              aria-label="직접 입력 거리 (m)"
              {...fieldProps("distance")}
              inputMode="decimal"
              value={customDistance}
              onChange={(event) => setCustomDistance(event.target.value)}
            />
            {fieldError("distance")}
          </label>
        )}
        <div className="athlete-record-time">
          <label>
            <span>기록 분</span>
            <input
              aria-label="기록 분"
              {...fieldProps("minutes")}
              inputMode="numeric"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
            {fieldError("minutes")}
          </label>
          <label>
            <span>기록 초</span>
            <input
              aria-label="기록 초"
              {...fieldProps("seconds")}
              inputMode="decimal"
              value={seconds}
              onChange={(event) => setSeconds(event.target.value)}
            />
            {fieldError("seconds")}
          </label>
        </div>
        {purpose !== "RACE_GOAL" && (
          <label>
            <span>달성일</span>
            <input
              aria-label="달성일"
              {...fieldProps("date")}
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={achievedOn}
              onChange={(event) => setAchievedOn(event.target.value)}
            />
            {fieldError("date")}
          </label>
        )}
        {purpose === "SEASON_BEST" && (
          <label>
            <span>시즌 이름</span>
            <input
              aria-label="시즌 이름"
              {...fieldProps("season")}
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
            />
            {fieldError("season")}
          </label>
        )}
        <p className="athlete-record-provenance">
          선수 직접 입력 · 아직 별도 검증되지 않음
        </p>
        {error !== null && errorField === null && <p className="athlete-record-error" role="alert">{error}</p>}
        <button className="athlete-record-save" type="submit">
          <Save aria-hidden="true" size={17} />
          기록 저장
        </button>
      </form>

      <section
        className="athlete-record-list"
        aria-label="저장한 경기 기록"
      >
        <div className="athlete-record-list-heading">
          <h2>저장한 기록</h2>
          <span>{records.length}개</span>
        </div>
        {records.length === 0 ? (
          <p className="athlete-record-empty">저장한 기록이 아직 없어요.</p>
        ) : (
          <ol>
            {records.map((record) => (
              <AthleteRecordRow key={record.id} record={record} />
            ))}
          </ol>
        )}
      </section>
    </section>
  )
}

function newLocalRecordId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
