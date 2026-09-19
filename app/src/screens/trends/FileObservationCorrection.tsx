import React from "react"
import { Pencil, RefreshCw, Upload, X } from "lucide-react"
import { parseActivityFile, type ImportedActivity } from "../../domain/import/activity-file"
import { buildFileObservation, FILE_OBSERVATION_LIMITS, toFileObservationSummary, type FileObservationV1 } from "../../domain/import/file-observation"
import { fileAnalysisFormats } from "../../domain/import/file-analysis-policy"
import { FILE_OBSERVATION_CORRECTION_FIELDS } from "../../domain/account/account-journal-record-schema"
import { correctAccountJournalFileObservation, readAccountJournalWriteBase, retryAccountJournalFileObservation, type AccountJournalWriteBase } from "../../domain/account/account-journal-record-service"
import { FILE_WRITE_REJECTION_MESSAGES } from "../../domain/account/account-write-rejection"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { FileObservationReview } from "../import-activities/FileObservationReview"

const LABEL = { startedAt: "시작 시각", timeZone: "시간대", sport: "파일의 운동 종류", distanceMeters: "전체 거리",
  durationSeconds: "전체 시간", durationMeaning: "파일의 시간 종류", laps: "구간 기록", confirmation: "내가 확인한 시간·운동 종류" } as const
const json = (value: unknown) => JSON.stringify(value)
function activityOf(observation: FileObservationV1): ImportedActivity {
  return { name: "가져온 운동", sport: observation.sport, date: observation.date, observation, ...toFileObservationSummary(observation) }
}
function description(key: keyof typeof LABEL, observation: FileObservationV1): string {
  const value = observation[key]
  if (key === "distanceMeters") return value === null ? "미기록" : `${value}m`
  if (key === "durationSeconds") return value === null ? "미기록" : `${value}초`
  if (key === "laps") return `${observation.laps.length}개 구간`
  const meaning = { TIMER: "일시정지 제외", MOVING: "이동 시간", ELAPSED: "전체 경과", SOURCE_DEFINED: "뜻 미확인", UNKNOWN: "알 수 없음" } as const
  const sport = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "그 밖의 운동", UNKNOWN: "미확인" } as const
  if (key === "durationMeaning") return meaning[observation.durationMeaning]
  if (key === "sport") return sport[observation.sport]
  if (key === "confirmation") return `${observation.confirmation?.durationMeaning ? meaning[observation.confirmation.durationMeaning] : "시간 미확인"} · ${observation.confirmation?.sport ? sport[observation.confirmation.sport] : "운동 종류는 원본 유지"}`
  return value === null ? "미기록" : String(value)
}

export function FileObservationCorrection({ entryId }: { readonly entryId: string }) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [base, setBase] = React.useState<AccountJournalWriteBase | null>(null)
  const [original, setOriginal] = React.useState<FileObservationV1 | null>(null)
  const [draft, setDraft] = React.useState<ImportedActivity | null>(null)
  const [candidates, setCandidates] = React.useState<readonly FileObservationV1[]>([])
  const [confirmed, setConfirmed] = React.useState<readonly string[]>([])
  const [message, setMessage] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const epoch = React.useRef(0)
  React.useEffect(() => {
    const clear = () => { epoch.current++; setOpen(false); setBusy(false); setBase(null); setOriginal(null); setDraft(null); setCandidates([]); setConfirmed([]); setMessage(""); setPending(false) }
    const unsubscribe = onLocalJournalScopeChange(clear)
    return () => { epoch.current++; unsubscribe() }
  }, [])
  const start = async () => {
    if (pending && draft) { setOpen(true); return }
    const run = ++epoch.current, owner = activeLocalAccount()
    setOpen(true); setBusy(true); setMessage("")
    setBase(null); setOriginal(null); setDraft(null); setCandidates([]); setConfirmed([])
    try {
      const next = await readAccountJournalWriteBase(entryId)
      if (run !== epoch.current || owner !== activeLocalAccount()) return
      if (!next?.entry || next.entry.kind !== "post-session" || !next.entry.fileObservation || next.revision < 1) {
        setMessage("계정에 저장된 원본을 확인하지 못했어요. 연결 상태를 확인해 주세요."); return
      }
      setBase(next); setOriginal(next.entry.fileObservation); setDraft(activityOf(next.entry.fileObservation)); setConfirmed([])
    } catch { if (run === epoch.current) setMessage("원본을 불러오지 못했어요. 기존 기록은 바뀌지 않았어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  const change = (next: ImportedActivity) => { setDraft(next); setConfirmed([]); setMessage("") }
  const loadReplacement = async (file: File | undefined) => {
    if (!file || !original) return
    const run = ++epoch.current
    setBusy(true); setCandidates([]); setMessage("")
    try {
      if (file.size > FILE_OBSERVATION_LIMITS.bytes) { setMessage("10MB 이하의 운동 파일을 골라 주세요."); return }
      const text = await file.text()
      if (run !== epoch.current) return
      const formats = fileAnalysisFormats()
      const result = parseActivityFile(text, original.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        { observations: { csv: formats.includes("csv"), json: formats.includes("json"), gpx: formats.includes("gpx") } })
      const matches = result.activities.flatMap(activity => {
        const candidate = activity.observation
        return candidate && candidate.format === original.format && candidate.sourceProfile === original.sourceProfile
          && candidate.date === original.date && candidate.sourceActivityId === original.sourceActivityId ? [candidate] : []
      })
      setCandidates(matches)
      setMessage(matches.length ? "같은 운동의 수정본인지 확인하고 아래에서 골라 주세요." : "같은 날짜·형식·원본 ID의 기록을 찾지 못했어요. 날짜가 잘못됐다면 기존 기록을 확인한 뒤 별도로 가져와 주세요.")
    } catch { if (run === epoch.current) setMessage("파일을 읽지 못했어요. 기존 기록은 바뀌지 않았어요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  const selectReplacement = (candidate: FileObservationV1) => {
    if (!original) return
    try {
      const next = buildFileObservation({
        format: candidate.format, sourceProfile: candidate.sourceProfile, parserVersion: original.parserVersion,
        sourceActivityId: candidate.sourceActivityId, sourceIdentityFingerprint: original.sourceIdentityFingerprint,
        date: candidate.date, startedAt: candidate.startedAt, timeZone: candidate.timeZone, sport: candidate.sport,
        distanceMeters: candidate.distanceMeters, durationSeconds: candidate.durationSeconds,
        durationMeaning: candidate.durationMeaning, laps: candidate.laps,
        confirmation: { durationMeaning: null, sport: null },
      })
      change(activityOf(next)); setCandidates([])
    } catch { setMessage("수정본을 확인하지 못했어요. 기존 기록과 입력은 그대로 있어요. 파일 내용을 확인해 주세요.") }
  }
  const fields = original && draft?.observation
    ? FILE_OBSERVATION_CORRECTION_FIELDS.filter(key => json(original[key]) !== json(draft.observation![key])) : []
  const save = async (retry = false) => {
    if (!base || !draft?.observation || (!retry && (fields.length === 0 || fields.some(field => !confirmed.includes(field))))) return
    const run = ++epoch.current
    setBusy(true); setMessage("")
    try {
      const result = retry ? await retryAccountJournalFileObservation(entryId)
        : await correctAccountJournalFileObservation(entryId, draft.observation, base, fields)
      if (run !== epoch.current) return
      if (!result.ok) {
        setMessage("rejection" in result && result.rejection in FILE_WRITE_REJECTION_MESSAGES
          ? FILE_WRITE_REJECTION_MESSAGES[result.rejection as keyof typeof FILE_WRITE_REJECTION_MESSAGES]
          : "저장하지 못했어요. 기존 기록과 입력은 그대로 있어요. 원본을 다시 확인해 주세요.")
      } else if (result.storage === "ACCOUNT") {
        setMessage("정정한 기록을 계정에 저장했어요. 이전 구간 비교는 다시 확인해 주세요.")
        setPending(false); setDraft(null); setOriginal(null); setBase(null)
      } else if (result.storage === "CONFLICT") {
        setMessage("다른 곳에서 기록이 바뀌었어요. 덮어쓰지 않았어요. 계정의 충돌 확인에서 기록을 비교해 주세요.")
      } else { setPending(true); setMessage("정정 내용을 기기에 임시 보관했어요. 계정 연결을 확인한 뒤 다시 전송해 주세요.") }
    } catch { if (run === epoch.current) setMessage("저장 결과를 확인하지 못했어요. 다시 전송해도 같은 요청으로 확인해요.") }
    finally { if (run === epoch.current) setBusy(false) }
  }
  if (!open) return <button type="button" onClick={() => void start()}><Pencil size={16} aria-hidden="true" /> 시간·파일 기록 정정</button>
  return <div className="file-observation-review" role="group" aria-label="가져온 기록 정정">
    <div className="file-analysis-actions"><h3>가져온 기록 정정</h3><button type="button" aria-label="정정 닫기" disabled={busy} onClick={() => { epoch.current++; setOpen(false) }}><X size={18} /></button></div>
    {draft && original && <>
      <FileObservationReview activity={draft} disabled={busy || pending} onChange={change} allowDateChange={false} />
      <label className="file-analysis-upload"><Upload size={16} aria-hidden="true" /> 같은 운동의 수정 파일
        <input type="file" accept={`.${original.format}`} disabled={busy || pending} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void loadReplacement(file) }} />
      </label>
      {candidates.map((candidate, index) => <button key={index} type="button" disabled={busy || pending} onClick={() => selectReplacement(candidate)}>
        {candidate.date} · {candidate.distanceMeters === null ? "거리 없음" : `${candidate.distanceMeters}m`} · {candidate.durationSeconds === null ? "시간 없음" : `${candidate.durationSeconds}초`} · 이 수정본 선택
      </button>)}
      {fields.map(field => <label key={field} className="file-analysis-check">
        <input type="checkbox" checked={confirmed.includes(field)} disabled={busy || pending}
          onChange={event => setConfirmed(value => event.target.checked ? [...value, field] : value.filter(item => item !== field))} />
        <span>{LABEL[field]}: {description(field, original)} → {description(field, draft.observation!)} 확인</span>
      </label>)}
      {fields.includes("laps") && <details><summary>수정 전후 구간 수치 확인</summary><div className="file-analysis-table" tabIndex={0} role="region" aria-label="수정 전후 구간">
        <table><thead><tr><th>구간</th><th>이전 거리 / 시간</th><th>수정 거리 / 시간</th></tr></thead><tbody>
          {Array.from({ length: Math.max(original.laps.length, draft.observation!.laps.length) }, (_, index) => <tr key={index}><th>{index + 1}</th>
            {[original, draft.observation!].map((source, side) => <td key={side}>{source.laps[index]?.distanceMeters == null ? "미기록" : `${source.laps[index].distanceMeters}m`} / {source.laps[index]?.durationSeconds == null ? "미기록" : `${source.laps[index].durationSeconds}초`}</td>)}
          </tr>)}
        </tbody></table></div></details>}
      <p>날짜·메모·직접 입력한 RPE·훈련 완료 상태는 바꾸지 않아요.</p>
      <div className="file-analysis-actions">{pending ? <button type="button" disabled={busy} onClick={() => void save(true)}><RefreshCw size={16} aria-hidden="true" /> 같은 정정 다시 전송</button>
        : <button type="button" disabled={busy || fields.length === 0 || fields.some(field => !confirmed.includes(field))} onClick={() => void save()}>확인한 변경 저장</button>}</div>
    </>}
    <p role="status" aria-live="polite">{busy ? "계정 기록을 확인하고 있어요." : message}</p>
  </div>
}
