import { InfoDisclosure } from "../components/InfoDisclosure"
import type { OracleContentReading, OracleReaderProvenance, OracleReaderRef, OracleReadingStatus } from "../domain/oracle-content-reader"

export type OracleReadingEvidenceProps = Readonly<{ reading: OracleContentReading }>

const sourceLabels: Readonly<Record<string, string>> = {
  profile: "현재 프로필 응답", previousProfile: "이전 프로필 응답", history: "응답 변화 비교",
  answers: "직접 고른 취향과 목표", conditions: "시간·장소·장비와 대회 여건",
  records: "경기 기록", goal: "목표 기록", laps: "구간 기록", "laps.observation": "가져온 파일의 구간 자료",
  training: "이번 기간 훈련 일지", previousTraining: "이전 기간 훈련 일지", planActual: "당시 계획과 실제 수행",
  plan: "당시 계획", method: "선택한 훈련법", "method.calculation": "선택한 훈련법의 계산 근거",
  device: "워치 예상 기록", friend: "친구와 비교할 자료", share: "외부 공유 동의", today: "풀이 기준 날짜",
  "file-lap": "가져온 파일의 구간", event: "대회 후보", race: "경기 조건", own: "내 추가 응답",
  currentMonth: "이번 달 훈련 일지", previousMonth: "지난달 훈련 일지",
  CHALLENGE: "기록 도전 선호", INTENSITY: "높은 강도 선호", STRUCTURE: "계획 선호",
  SOCIAL: "함께 달리기 선호", EXPLORE: "새 경험 선호", REFRESH: "기분 전환 동기",
  SU: "보조 운동 선호", WE: "웨이트 선호",
}
const fieldLabels: Readonly<Record<string, string>> = {
  motivations: "달리는 이유", movementForm: "좋아하는 달리기 형태", company: "혼자·함께 달리기 선택",
  conversation: "달리면서 대화하는 취향", familiarEnjoyment: "익숙한 방식의 즐거움",
  learningInterests: "배우고 싶은 운동", supplementaryExperience: "보조 운동 경험", supplementaryInterest: "보조 운동 관심",
  raceGoals: "대회 목표", raceOutcomes: "대회에서 얻은 경험", todayGoals: "당일 목표", phases: "함께하고 싶은 운동 구간",
  togetherPhases: "함께하고 싶은 운동 구간", context: "직접 선택한 변화 맥락", availableMinutes: "운동할 수 있는 시간",
  places: "이용 가능한 장소", equipment: "사용 가능한 장비", meetingWindows: "함께 운동할 수 있는 시간",
  course: "경기 코스", weather: "경기 날씨", round: "경기 라운드", goal: "경기 목표", fields: "공유할 항목",
}
const needLabels: Readonly<Record<string, string>> = {
  version: "자료 버전 확인", invalid: "자료 형식 확인", "invalid-answers": "응답 형식 확인",
  "version-or-date": "응답 버전과 날짜 확인", "partial-source": "아직 받지 못한 자료 범위",
  "three-numeric-answers": "세 문항의 숫자 응답", complete: "전체 자료 확인", "answered-axis": "응답한 항목",
  conflict: "서로 다른 내용으로 중복된 기록 확인", "date-or-verification": "기록 날짜와 확인 상태",
  "actual-record": "실제 경기 기록", period: "자료 기간 확인", "invalid-session": "훈련 기록 형식 확인",
  "complete-receipt": "전체 기간의 수신 여부", sessions: "기록된 훈련 세션", "running-distance": "달리기 거리",
  purpose: "직접 기록한 훈련 목적", "ordered-same-version": "같은 문항 버전의 이전·현재 응답",
  "paired-answers": "두 시점에 모두 답한 문항", "previous-same-event": "같은 종목의 이전 기록",
  "entered-PB": "입력한 개인 최고 기록", "within-12-months": "최근 12개월 경기 기록",
  "at-least-two": "비교할 구간 두 개 이상", measurements: "구간 거리와 시간", "time-meaning": "구간 시간의 기준",
  "running-sport": "달리기 활동 여부", "comparable-time-meaning": "서로 비교할 수 있는 시간 기준",
  date: "자료 날짜 확인", "explicit-race-link": "구간과 경기 기록의 명시적 연결",
  "segments-complete": "전체 반복 구간 기록", "recovery-boundary": "마지막 반복 뒤 회복 포함 여부",
  recovery: "실제 회복 기록", "original-snapshot": "당시 계획 원본", "linked-actual": "계획에 연결된 수행 기록",
  distanceKm: "실제 거리", durationMinutes: "실제 운동 시간", "actual-rpe": "직접 기록한 운동 자각도",
  "matching-duration-scope": "계획·수행 시간의 포함 범위", "target-conflict": "중복된 목표 구간 확인",
  "all-targets-observed": "전체 목표 구간의 수행 기록", "unique-point-targets": "중복 없는 구간 목표",
  actual: "해당 구간의 수행 기록", "unique-step-targets": "중복 없는 운동 단계 목표",
  comparable: "서로 비교할 수 있는 단계 기록", "numeric-comparison": "계획과 비교할 수행 수치",
  "running-form": "선택한 훈련법의 달리기 형태", "checkable-conditions": "훈련법과 비교할 여건",
  permission: "친구 비교 동의 확인", "same-event-record": "같은 종목의 두 사람 기록",
  "same-question-version": "동일한 질문 버전", "comparable-numeric-answers": "함께 비교할 숫자 응답",
  "same-period": "동일한 비교 기간", "known-race-facts": "직접 확인한 경기 조건",
  "multiple-events": "서로 다른 종목의 실제 기록", "same-event-actual": "같은 종목의 실제 경기 기록",
  forms: "기록한 운동 형태", "multiple-sessions-same-date": "같은 날의 서로 다른 훈련 세션",
  "non-running": "달리기 외 운동 기록", "matching-race": "해당 경기에 연결된 조건",
  "two-races": "비교할 경기 기록 두 개", "event-options": "비교할 대회 후보 두 개 이상",
  cost: "대회 비용", travel: "대회 이동 시간", "whole-month": "한 달 전체의 자료 범위",
  "cross-period-identity": "기간 사이 중복·충돌 기록 확인", "two-distinct-sessions": "서로 다른 세션 두 개",
  "comparable-structure": "서로 비교할 수 있는 훈련 구성", "valid-local-date": "유효한 풀이 기준 날짜",
  finite: "유효한 수치 확인",
}
const stateLabels: Readonly<Record<OracleReadingStatus, string>> = {
  SUFFICIENT: "확인한 자료 있음", PARTIAL: "일부 자료만 확인됨", MISSING: "입력된 자료 없음",
  UNAVAILABLE: "지금 자료를 확인할 수 없음", REVOKED: "자료 사용 동의가 철회됨",
}
const provenanceLabels: Readonly<Record<OracleReaderProvenance, string>> = {
  EXPLICIT: "직접 입력한 자료", CONFIRMED_FILE: "확인한 파일 자료", VERIFIED_RECORD: "확인된 경기 기록",
  SELF_REPORTED: "본인이 응답한 자료", ORIGINAL_PLAN: "당시 계획 원본", REVIEWED_CATALOG: "검토된 훈련 자료",
  DEVICE_ESTIMATE: "기기가 예상한 값",
}

function lookup(labels: Readonly<Record<string, string>>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : undefined
}

function sourceLabel(source: string): string {
  if (source.startsWith("friend.")) return `친구의 ${sourceLabel(source.slice(7))}`
  return lookup(sourceLabels, source) ?? lookup(fieldLabels, source) ?? "추가 자료"
}

function missingLabel(code: string): string {
  const parts = code.split(":")
  const prefix = parts[0] ?? ""
  if (parts.length === 1) return sourceLabel(prefix)
  // IDs can contain colons. Only recognized fields/reasons may reach the plain-language view.
  const suffix = parts.at(-1) ?? ""
  const reason = parts[1] === "conflict" ? needLabels.conflict : lookup(needLabels, suffix) ?? lookup(fieldLabels, suffix)
  return `${sourceLabel(prefix)} · ${reason ?? "필요한 내용 확인"}`
}

function uniqueRefs(refs: readonly OracleReaderRef[]): OracleReaderRef[] {
  return [...new Map(refs.map(ref => [JSON.stringify([ref.source, ref.sourceVersion, ref.itemId, ref.date, ref.provenance]), ref])).values()]
}

/** Supporting content only; parent retains essential errors, consent controls and dialog ownership. */
export function OracleReadingEvidence({ reading }: OracleReadingEvidenceProps) {
  const states = Object.entries(reading.inputStates)
  const revoked = reading.status === "REVOKED" || states.some(([, state]) => state === "REVOKED")
  const refs = revoked ? [] : uniqueRefs(reading.facts.flatMap(fact => fact.sourceRefs))
  const missing = [...new Set(reading.missingInputs.map(missingLabel))]
  return <InfoDisclosure title="이 풀이의 자료">
    <p>{stateLabels[revoked ? "REVOKED" : reading.status]}</p>
    {states.length > 0 ? <dl aria-label="자료별 확인 상태">{states.map(([source, state]) => <div key={source}>
      <dt>{sourceLabel(source)}</dt><dd>{stateLabels[state]}</dd>
    </div>)}</dl> : <p>개인 입력 자료의 확인 상태가 제공되지 않았어요.</p>}
    {missing.length > 0 && <><h3>더 확인할 자료</h3><ul>{missing.map(label => <li key={label}>{label}</li>)}</ul>
      <p>아직 받지 못했거나 확인할 수 없는 자료는 입력된 자료가 없는 경우와 달라요.</p></>}
    {revoked ? <p>철회된 풀이의 기록 출처와 식별자는 표시하지 않아요.</p> : <>
      <h3>확인한 출처</h3>
      {refs.length ? <ul aria-label="풀이에 사용한 출처">{refs.map((ref, index) => <li key={index}>
        {sourceLabel(ref.source)} · {ref.date ? <time dateTime={ref.date}>{ref.date}</time> : "날짜 미제공"} · {provenanceLabels[ref.provenance]}
      </li>)}</ul> : <p>{reading.kind === "EDUCATION" ? "이 일반 해설에는 개인 기록의 출처 참조가 제공되지 않았어요." : "이 풀이에 표시할 기록 출처가 제공되지 않았어요."}</p>}
    </>}
    <InfoDisclosure title="버전과 상세 출처">
      <dl><dt>풀이 계산 버전</dt><dd><code>{reading.readerVersion}</code></dd>
        <dt>설명 원고 버전</dt><dd><code>{reading.contentVersion}</code></dd></dl>
      {!revoked && <>
        {Object.keys(reading.sourceVersions).length > 0 && <><h3>입력 자료 버전</h3><dl>{Object.entries(reading.sourceVersions).map(([source, version]) => <div key={source}>
          <dt>{sourceLabel(source)} · <code>{source}</code></dt><dd><code>{version}</code></dd>
        </div>)}</dl></>}
        {reading.missingInputs.length > 0 && <InfoDisclosure title="확인 항목의 원본 표기"><ul>{[...new Set(reading.missingInputs)].map(code => <li key={code}><code>{code}</code></li>)}</ul></InfoDisclosure>}
        {reading.facts.map((fact, index) => <section key={`${fact.id}-${index}`} aria-label={`${fact.label}의 출처`}>
          <h3>{fact.label}</h3>
          {fact.sourceRefs.length === 0 ? <p>출처 참조 미제공</p> : uniqueRefs(fact.sourceRefs).map((ref, refIndex) => <dl key={refIndex}>
            <dt>자료</dt><dd>{sourceLabel(ref.source)} · <code>{ref.source}</code></dd>
            <dt>확인 방식</dt><dd>{provenanceLabels[ref.provenance]}</dd>
            <dt>기준 날짜</dt><dd>{ref.date ? <time dateTime={ref.date}>{ref.date}</time> : "날짜 미제공"}</dd>
            <dt>자료 버전</dt><dd><code>{ref.sourceVersion}</code></dd>
            <dt>기록 식별자</dt><dd>{ref.itemId ? <code>{ref.itemId}</code> : "미제공"}</dd>
          </dl>)}
        </section>)}
      </>}
    </InfoDisclosure>
  </InfoDisclosure>
}
