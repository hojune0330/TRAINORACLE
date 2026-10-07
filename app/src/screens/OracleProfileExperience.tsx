import React from "react"
import { AppHeading } from "../components/AppHeading"
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Pencil, RotateCcw, Trash2, UserRound, X } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { useReaderDialog } from "../hooks/useReaderDialog"
import { ORACLE_AXES, ORACLE_QUESTIONS, buildOracleProfile, describeOracleAxis, type OracleAxisId, type OracleResponses, type OracleResponse } from "../domain/oracle-profile-v2"
import { answerOracleQuestion, currentOracleQuestion, editOracleAxis, previousOracleQuestion, startOracleQuestionFlow, type OracleQuestionFlow } from "../domain/oracle-profile-flow"
import { ORACLE_CONTENT_CATALOG, oracleContentTopic, type OracleDestination } from "../domain/oracle-content-catalog"
import { readOracleProfileReading, type OracleProfileReading } from "../domain/oracle-profile-snapshot"
import "./oracle-profile-v2.css"
import { ORACLE_MARI_ASSETS } from "../domain/oracle-character-assets"
import { buildOracleProfileStory } from "../domain/oracle-profile-story"
import { OracleLearningReader, type OracleLearningDestination } from "./OracleLearningReader"
import { OracleReadingEvidence } from "./OracleReadingEvidence"
import type { OracleContentReading } from "../domain/oracle-content-reader"

export type OracleReadingDisplay = {
  state: "READY" | "PARTIAL" | "MISSING" | "UNAVAILABLE" | "REVOKED" | "EDUCATION"
  facts: readonly { label: string; value: string; source: string }[]
  paragraphs: readonly string[]
  limitations: readonly string[]
  evidence?: OracleContentReading
}
export type OracleProfileExperienceProps = {
  initialView?: "result" | "library"
  backLabel?: string
  answers: OracleResponses
  draftAnswers?: OracleResponses
  selectedCharacter: OracleAxisId | null
  revision: number
  readings: readonly OracleProfileReading[]
  account: boolean
  status: "LOADING" | "READY" | "PENDING" | "CONFLICT" | "FAILED" | "DELETED"
  message?: string
  readTopic: (id: string, answers: OracleResponses) => OracleReadingDisplay
  renderTopicControls?: (id: string) => React.ReactNode
  onDraft: (answers: OracleResponses) => void
  onCommit: (answers: OracleResponses, character: OracleAxisId | null) => Promise<boolean>
  onRemember: () => Promise<boolean>
  onDelete: () => Promise<boolean>
  onRetry: () => void
  onBack: () => void
  onNavigate: (destination: OracleDestination) => void
  onContext?: () => void
  responsesDisabled?: boolean
  hasPendingScore?: boolean
  draftState?: "EDITING" | "SUBMITTING" | null
}
const groups = [{ id: "A", label: "취향" }, { id: "B", label: "경기 기록" }, { id: "C", label: "훈련" },
  { id: "D", label: "훈련법" }, { id: "E", label: "함께" }, { id: "F", label: "대회" },
  { id: "G", label: "돌아보기" }, { id: "H", label: "배우기" }] as const
const responseLabels: readonly [OracleResponse, string][] = [[1, "전혀 그렇지 않아요"], [2, "그렇지 않은 편이에요"],
  [3, "보통이에요"], [4, "그런 편이에요"], [5, "매우 그래요"]]
const nonNumeric: readonly [OracleResponse, string][] = [["UNKNOWN", "아직 모르겠어요"], ["VARIES", "상황마다 달라요"], ["INEXPERIENCED", "경험이 없어요"]]

export function OracleProfileReader({ title, onClose, children, action, closeLabel = "돌아가기" }: { title: string; onClose: () => void; children: React.ReactNode | ((close: () => void) => React.ReactNode); action?: { label: string; run: () => void; closeFirst?: boolean }; closeLabel?: string | null }) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const body = React.useRef<HTMLDivElement>(null)
  const pending = React.useRef<(() => void) | null>(null)
  const close = useReaderDialog(ref, () => { onClose(); const run = pending.current; pending.current = null; run?.() })
  React.useEffect(() => { if (body.current) body.current.scrollTop = 0 }, [title])
  return <dialog ref={ref} className="oracle-v2 oracle-v2__dialog" aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <header className="oracle-v2__chrome"><span className="app-chrome-title">{title}</span><button type="button" aria-label="닫기" title="닫기" onClick={close}><X size={18} /></button></header>
    <div ref={body} className="oracle-v2__reader-body">{typeof children === "function" ? children(close) : children}{action && <button type="button" onClick={() => { if (action.closeFirst === false) { action.run(); return }; pending.current = action.run; close() }}>{action.label}<ArrowRight size={16} /></button>}{closeLabel && <button type="button" className="oracle-v2__reader-close" onClick={close}>{closeLabel}<ArrowLeft size={16} /></button>}</div>
  </dialog>
}
const Reader = OracleProfileReader

function restoredFlow(answers: OracleResponses, draft?: OracleResponses): OracleQuestionFlow {
  const axis = draft ? ORACLE_AXES.find(item => item.questions.some((_text, index) => draft[`${item.id}_${index + 1}` as keyof OracleResponses] !== answers[`${item.id}_${index + 1}` as keyof OracleResponses])) : undefined
  const flow = startOracleQuestionFlow(draft ?? answers, axis?.id ?? "STRUCTURE")
  return { ...flow, completed: answers, position: draft && axis && flow.position === 3 ? 0 : flow.position }
}

export function OracleProfileExperience(props: OracleProfileExperienceProps) {
  const [flow, setFlow] = React.useState(() => restoredFlow(props.answers, props.draftAnswers))
  const flowRef = React.useRef(flow)
  const dirty = React.useRef(false)
  const [character, setCharacter] = React.useState<OracleAxisId | null>(props.selectedCharacter)
  const [questionOpen, setQuestionOpen] = React.useState(false)
  const [topicId, setTopicId] = React.useState<string | null>(null)
  const [savedReading, setSavedReading] = React.useState<OracleProfileReading | null>(null)
  const [storyAxis, setStoryAxis] = React.useState<OracleAxisId | null>(null)
  const [learning, setLearning] = React.useState<OracleLearningDestination | null>(null)
  const [group, setGroup] = React.useState("A")
  const [view, setView] = React.useState<"result" | "library" | "saved">(() => props.initialView ?? "result")
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [localMessage, setLocalMessage] = React.useState("")
  const touch = React.useRef<{ x: number; y: number } | null>(null)
  const questionHeading = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (props.status === "DELETED") {
      dirty.current = false; const empty = startOracleQuestionFlow(); flowRef.current = empty; setFlow(empty)
      setCharacter(null); setQuestionOpen(false); setSavedReading(null); setStoryAxis(null); setTopicId(null); setLearning(null); return
    }
    if (dirty.current) return
    const next = restoredFlow(props.answers, props.draftAnswers)
    flowRef.current = next; setFlow(next); setCharacter(props.selectedCharacter)
  }, [props.answers, props.draftAnswers, props.selectedCharacter, props.status])
  const profile = buildOracleProfile(flow.completed, character)
  const story = storyAxis ? buildOracleProfileStory(profile.scores.find(score => score.axisId === storyAxis)!) : null
  const visibleScores = profile.scores.filter(score => score.state !== "UNANSWERED")
  const managerScore = visibleScores.find(score => score.axisId === profile.representative.id)
    ?? (visibleScores.length === 1 ? visibleScores[0] : undefined)
  const managerPortrait = visibleScores.length ? ORACLE_MARI_ASSETS.analysis : ORACLE_MARI_ASSETS.wave
  const question = currentOracleQuestion(flow)
  React.useEffect(() => { if (questionOpen) questionHeading.current?.focus({ preventScroll: true }) }, [question?.id, questionOpen])
  const accountBlocked = props.account && ["LOADING", "CONFLICT", "DELETED"].includes(props.status)
  const managerDescription = accountBlocked ? "계정의 응답을 확인하는 중이에요." : managerScore ? describeOracleAxis(managerScore)
    : visibleScores.length ? `답한 ${visibleScores.length}개 항목을 정리했어요. 취향과 실제 훈련은 따로 살펴봐요.`
      : "응답은 취향을, 실제 훈련은 기록으로 나눠 살펴봐요."
  const blocked = busy || accountBlocked || props.responsesDisabled === true
  const commit = async (answers: OracleResponses, selection: OracleAxisId | null) => {
    setBusy(true); setLocalMessage("")
    try {
      const ok = await props.onCommit(answers, selection)
      if (ok) dirty.current = false
      else setLocalMessage("save")
      return ok
    } catch { setLocalMessage("save"); return false }
    finally { setBusy(false) }
  }
  const openQuestions = (axis: OracleAxisId) => {
    if (dirty.current || props.hasPendingScore) { setQuestionOpen(true); return }
    const next = editOracleAxis(flowRef.current, axis)
    flowRef.current = next; setFlow(next); setQuestionOpen(true)
  }
  const answer = (response: OracleResponse) => {
    if (!question || blocked) return
    const next = answerOracleQuestion(flowRef.current, question.id, response)
    if (next === flowRef.current) return
    dirty.current = true; flowRef.current = next; setFlow(next); props.onDraft(next.draft)
    if (next.position === 3) {
      const candidate = buildOracleProfile(next.completed, Object.keys(flow.completed).length === 0 ? undefined : character)
      const selected = candidate.representative.id === "NEUTRAL" ? null : candidate.representative.id
      setCharacter(selected); void commit(next.completed, selected)
    }
  }
  const topic = topicId ? oracleContentTopic(topicId) : null
  const learningDestination = topic && ["GLOSSARY", "EVIDENCE", "QUIZ", "EXAMPLE"].includes(topic.destination) ? topic.destination as OracleLearningDestination : null
  const reading = topic ? props.readTopic(topic.id, flow.completed) : null
  const navigateTopic = (direction: number) => {
    if (!topic) return
    const peers = ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group)
    const next = peers[peers.findIndex(item => item.id === topic.id) + direction]
    if (next) setTopicId(next.id)
  }
  const sourceMessage = props.message || (props.account ? props.draftState === "EDITING" && props.status === "PENDING" ? "작성 중 · 이 기기에 임시 보관했어요. 응답을 마치면 계정에 저장해요." : ({ LOADING: "계정에서 불러오는 중", READY: "계정에 저장됨", PENDING: "계정으로 보내는 중", CONFLICT: "다른 곳에서 바뀐 응답을 확인해 주세요", FAILED: "계정 저장을 확인하지 못했어요", DELETED: "삭제된 프로필이에요" }[props.status]) : "게스트 · 임시 응답은 새로고침하면 사라져요.")
  return <section className="oracle-v2">
    <header className="oracle-v2__chrome"><button type="button" aria-label={props.backLabel ?? "오라클로 돌아가기"} title={props.backLabel ?? "오라클로 돌아가기"} onClick={props.onBack}><ArrowLeft size={18} /></button><strong className="app-chrome-title">{view === "library" ? "오라클 읽을거리" : view === "saved" ? "풀이 보관함" : "내 러닝 프로필"}</strong><span>오라클</span></header>
    <div className="oracle-v2__body">
      <nav className="oracle-v2__tabs" aria-label="러닝 프로필 보기">{([["result", "내 결과"], ["library", "읽을거리"], ["saved", "보관함"]] as const).map(([id, label]) => <button type="button" key={id} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
      <p className="oracle-v2__status" role="status">{sourceMessage}</p>
      {props.onContext && props.responsesDisabled && <button type="button" disabled={busy || accountBlocked} onClick={props.onContext}>작성하던 추가 맥락 이어가기<ChevronRight size={16} /></button>}
      {(dirty.current || props.hasPendingScore || props.draftAnswers && JSON.stringify(props.draftAnswers) !== JSON.stringify(props.answers)) && <button type="button" disabled={blocked} onClick={() => {
        if (dirty.current) { setQuestionOpen(true); return }
        const axis = ORACLE_AXES.find(item => item.questions.some((_text, index) => props.draftAnswers?.[`${item.id}_${index + 1}` as keyof OracleResponses] !== props.answers[`${item.id}_${index + 1}` as keyof OracleResponses]))
        const restored = startOracleQuestionFlow(props.draftAnswers, axis?.id ?? "STRUCTURE")
        const next: OracleQuestionFlow = { ...restored, position: restored.position === 3 ? 0 : restored.position, completed: props.answers }
        flowRef.current = next; setFlow(next); setQuestionOpen(true)
      }}>작성하던 답 이어가기<ArrowRight size={16} /></button>}
      {localMessage && <p role="alert">계정 저장을 확인하지 못했어요. 입력한 답은 이 화면에 남아 있어요.</p>}
      {props.account && props.draftState !== "EDITING" && ["FAILED", "PENDING"].includes(props.status) && <button type="button" onClick={props.onRetry}><RotateCcw size={16} />다시 확인</button>}
      {view === "result" && <>
        <section className="oracle-v2__self" aria-label="나의 러닝 프로필">
        <div className="oracle-v2__identity"><UserRound size={24} aria-hidden="true" /><div><p className="oracle-v2__eyebrow">{profile.completedAxes.length ? `${profile.completedAxes.length}개 항목 · 내 응답 기준` : "내가 좋아하는 달리기"}</p><AppHeading variant="screen" accent>{profile.representative.label}</AppHeading></div></div>
        {visibleScores.length === 0 ? <>
          <button type="button" className="oracle-v2__primary" disabled={blocked} onClick={() => openQuestions("STRUCTURE")}>계획 선호 3문항 시작<ArrowRight size={18} /></button>
          <p className="oracle-v2__status">선택 사항이에요. 해설만 봐도 괜찮아요.</p>
        </> : <>
          <dl className="oracle-v2__scores">{visibleScores.map(score => <div key={score.axisId}><dt><button type="button" onClick={() => setStoryAxis(score.axisId)}>{score.label}<ChevronRight size={16} /></button></dt><dd><strong>{score.display ?? "—"}</strong>{score.mixed && <span>답이 엇갈림</span>}<button type="button" title={`${score.label} 수정`} aria-label={`${score.label} 수정`} disabled={blocked} onClick={() => openQuestions(score.axisId)}><Pencil size={16} /></button></dd>{score.display !== null && <div className="oracle-v2__meter" role="meter" aria-label={score.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.display} aria-valuetext={`${score.display}점 · 내 응답 기준`}><span style={{ width: `${score.display}%` }} /></div>}</div>)}</dl>
          <InfoDisclosure title="점수와 별명은 어떻게 정하나요?"><p>{profile.limitation}</p><p>세 답을 0~100으로 정리하고 5점 단위로 표시해요. 75점 이상인 핵심 항목은 별명 후보가 될 수 있어요. 이 기준은 과학적 유형 경계가 아니에요.</p>{visibleScores.map(score => <div key={score.axisId}><AppHeading as="h2" variant="section">{score.label}</AppHeading><p>{describeOracleAxis(score)}</p><ul>{score.evidence.map(item => <li key={item.questionId}>{ORACLE_QUESTIONS.find(q => q.id === item.questionId)?.text} · {typeof item.response === "number" ? `${item.response}/5` : item.response === null ? "미응답" : item.response === "SKIPPED" ? "건너뜀" : nonNumeric.find(([value]) => value === item.response)?.[1]}</li>)}</ul></div>)}</InfoDisclosure>
          {profile.candidates.length > 0 && <InfoDisclosure title="대표 별명 선택"><div className="oracle-v2__choices">{profile.candidates.map(candidate => <button type="button" key={candidate.id} aria-pressed={character === candidate.id} disabled={blocked} onClick={() => { setCharacter(candidate.id); dirty.current = true; void commit(flow.completed, candidate.id) }}>{candidate.label}{character === candidate.id && <Check size={16} />}</button>)}<button type="button" aria-pressed={character === null} disabled={blocked} onClick={() => { setCharacter(null); dirty.current = true; void commit(flow.completed, null) }}>별명 없이 보기{character === null && <Check size={16} />}</button></div></InfoDisclosure>}
          <button type="button" disabled={blocked || !props.account || props.status !== "READY" || dirty.current} onClick={async () => { setBusy(true); setLocalMessage(""); try { if (!await props.onRemember()) setLocalMessage("save") } catch { setLocalMessage("save") } finally { setBusy(false) } }}><Bookmark size={16} />이 결과 보관</button>
        </>}
        </section>
        <aside className="oracle-v2__manager" aria-label="마리 매니저">
          <div className="oracle-v2__manager-portrait"><img src={`${import.meta.env.BASE_URL}${managerPortrait.src.slice(1)}`} alt={managerPortrait.alt} width={managerPortrait.width} height={managerPortrait.height} /></div>
          <div className="oracle-v2__manager-copy"><AppHeading as="h2" variant="section">마리 매니저</AppHeading><p className="oracle-v2__eyebrow">{visibleScores.length ? "내 응답 해설" : "오라클 안내"}</p>
          </div>
          <InfoDisclosure className="oracle-v2__manager-details" title="마리의 안내">
            <p>{managerDescription}</p>
          </InfoDisclosure>
            <div className="oracle-v2__manager-actions oracle-v2__manager-details">
              <button type="button" onClick={() => setTopicId("C02")}>내 훈련 해설<ChevronRight size={16} /></button>
              <button type="button" onClick={() => setTopicId("B02")}>내 기록 해설<ChevronRight size={16} /></button>
              <button type="button" onClick={() => setTopicId("C07")}>계획·수행 비교<ChevronRight size={16} /></button>
            </div>
        </aside>
        <button type="button" onClick={() => props.onNavigate("FRIENDS")}>친구와 취향 비교<ChevronRight size={16} /></button>
        {props.onContext && !props.responsesDisabled && <button className="oracle-v2__context-action" type="button" disabled={busy || accountBlocked} onClick={props.onContext}>
          <span>훈련·대회 정보 추가<small>달릴 시간 · 장소 · 보조 운동 · 대회</small></span><ChevronRight size={16} />
        </button>}
        <InfoDisclosure purpose="actions" title="다른 러닝 취향 알아보기" preview="기록 도전 · 함께 달리기 · 웨이트 등 8가지"><div className="oracle-v2__axis-list">{ORACLE_AXES.map(axis => <button type="button" key={axis.id} disabled={blocked} onClick={() => openQuestions(axis.id)}><span>{axis.label}</span><ChevronRight size={16} /></button>)}</div></InfoDisclosure>
        <InfoDisclosure title="내 응답 관리"><p>응답을 바꿔도 훈련 강도나 양이 자동으로 늘어나지 않아요.</p>{confirmDelete ? <><p>응답과 보관한 프로필 풀이를 삭제할까요?</p><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { if (await props.onDelete()) { dirty.current = false; const empty = startOracleQuestionFlow(); flowRef.current = empty; setFlow(empty); setCharacter(null); setConfirmDelete(false) } else setLocalMessage("delete") } catch { setLocalMessage("delete") } finally { setBusy(false) } }}>삭제하기</button><button type="button" onClick={() => setConfirmDelete(false)}>취소</button></> : <button type="button" disabled={blocked} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />응답 삭제</button>}</InfoDisclosure>
      </>}
      {view === "library" && <><AppHeading variant="screen" accent>궁금한 것부터</AppHeading><div className="oracle-v2__groups" role="group" aria-label="읽을거리 주제">{groups.map(item => <button type="button" key={item.id} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}</div><div className="oracle-v2__topics">{ORACLE_CONTENT_CATALOG.filter(item => item.group === group).map(item => <button type="button" key={item.id} onClick={() => setTopicId(item.id)}><span>{item.title}</span><ChevronRight size={16} /></button>)}</div></>}
      {view === "saved" && <><AppHeading variant="screen" accent>보관한 풀이</AppHeading>{props.readings.length === 0 ? <p>마음에 드는 결과를 보관하면 여기서 다시 읽을 수 있어요.</p> : props.readings.map(item => <button className="oracle-v2__saved" type="button" key={item.source.revision} onClick={() => setSavedReading(item)}><span>{item.source.answeredAt.slice(0, 10)} · 당시 응답</span><ChevronRight size={16} /></button>)}</>}
    </div>
    {story && <Reader title="마리의 응답 해설" onClose={() => setStoryAxis(null)}><p className="oracle-v2__eyebrow">마리 매니저 · 내 응답 기준</p><AppHeading variant="screen" accent>{story.title}</AppHeading><p>{story.reading}</p><p>{story.example}</p><InfoDisclosure title="함께 생각할 점"><p>{story.watchFor}</p></InfoDisclosure><AppHeading as="h2" variant="section">이렇게 활용해 볼 수 있어요</AppHeading><p>{story.use}</p><InfoDisclosure title="내가 답한 내용">{story.facts.map((fact, i) => <p key={i}>{fact.question}<br />{typeof fact.response === "number" ? `${fact.response}/5` : fact.response === "SKIPPED" ? "건너뜀" : nonNumeric.find(([value]) => value === fact.response)?.[1]}</p>)}</InfoDisclosure><InfoDisclosure title="아직 알 수 없는 것"><p>{story.boundary}</p><p>{story.scope}</p></InfoDisclosure></Reader>}
    {questionOpen && <Reader title={ORACLE_AXES.find(axis => axis.id === flow.axisId)!.label} onClose={() => setQuestionOpen(false)} closeLabel={question ? null : "결과로"}>
      {!question && <><img className="oracle-v2__guide" src={`${import.meta.env.BASE_URL}${ORACLE_MARI_ASSETS.complete.src.slice(1)}`} alt={ORACLE_MARI_ASSETS.complete.alt} width={ORACLE_MARI_ASSETS.complete.width} height={ORACLE_MARI_ASSETS.complete.height} /><p className="oracle-v2__eyebrow">마리 매니저 · 내 응답 정리</p></>}
      {question ? <div className="oracle-v2__question" key={question.id}><p className="oracle-v2__eyebrow">{flow.position + 1} / 3</p><AppHeading variant="screen" accent ref={questionHeading} tabIndex={-1}>{question.text}</AppHeading><div className="oracle-v2__choices">{responseLabels.map(([value, label]) => <button type="button" key={value} disabled={blocked} aria-pressed={flow.draft[question.id] === value} onClick={() => answer(value)}>{label}<ChevronRight size={16} /></button>)}</div><InfoDisclosure title="답하기 어려워요"><div className="oracle-v2__choices">{nonNumeric.map(([value, label]) => <button type="button" key={value} disabled={blocked} aria-pressed={flow.draft[question.id] === value} onClick={() => answer(value)}>{label}</button>)}</div></InfoDisclosure><footer className="oracle-v2__pager"><button type="button" disabled={flow.position === 0 || blocked} aria-label="이전 질문" title="이전 질문" onClick={() => { const next = previousOracleQuestion(flowRef.current); flowRef.current = next; setFlow(next) }}><ArrowLeft size={18} /></button><button type="button" disabled={blocked} aria-pressed={flow.draft[question.id] === "SKIPPED"} onClick={() => answer("SKIPPED")}>건너뛰기</button></footer></div> : <><AppHeading variant="screen" accent ref={questionHeading} tabIndex={-1}>내 답을 정리했어요</AppHeading><p>{profile.scores.find(score => score.axisId === flow.axisId)?.display ?? "아직 점수로 정리하지 않은 응답"}</p><p>{describeOracleAxis(profile.scores.find(score => score.axisId === flow.axisId)!)}</p><p role="status">{sourceMessage}</p>{localMessage === "save" && <button type="button" disabled={busy} onClick={() => { void commit(flow.completed, character) }}>다시 저장<RotateCcw size={16} /></button>}</>}
    </Reader>}
{topic && reading && <Reader title={topic.title} onClose={() => setTopicId(null)} action={learningDestination ? { label: ({ GLOSSARY: "용어 읽기", EVIDENCE: "근거 살펴보기", QUIZ: "문제 풀기", EXAMPLE: "예시 읽기" })[learningDestination], closeFirst: false, run: () => setLearning(learningDestination) } : ["RECORDS", "JOURNAL", "CALENDAR", "PLAN_REVIEW", "METHODS", "FRIENDS", "SHARE_PREVIEW"].includes(topic.destination) ? { label: topic.destination === "SHARE_PREVIEW" ? "친구 비교·공유 설정 열기" : topic.destination === "FRIENDS" ? "친구와 비교하기" : topic.destination === "RECORDS" ? "경기 기록 보기" : topic.destination === "JOURNAL" ? "일지 보기" : topic.destination === "METHODS" ? "훈련법 보기" : topic.destination === "CALENDAR" ? "달력 보기" : "계획 보기", closeFirst: false, run: () => props.onNavigate(topic.destination) } : topic.destination === "PROFILE" ? { label: "내 응답 보기", run: () => setView("result") } : undefined}>{props.renderTopicControls?.(topic.id)}<article key={topic.id} className="oracle-v2__article" onTouchStart={event => { const point = event.touches[0]; if (point) touch.current = { x: point.clientX, y: point.clientY } }} onTouchEnd={event => { const point = event.changedTouches[0], start = touch.current; touch.current = null; if (point && start && Math.abs(point.clientX - start.x) > 60 && Math.abs(point.clientY - start.y) < 35) navigateTopic(point.clientX < start.x ? 1 : -1) }}><p className="oracle-v2__eyebrow">{reading.state === "EDUCATION" ? "훈련 읽을거리" : reading.state === "READY" ? "확인한 자료 기준" : reading.state === "PARTIAL" ? "확인한 부분부터" : reading.state === "UNAVAILABLE" ? "자료를 확인하지 못했어요" : reading.state === "REVOKED" ? "공유가 종료됐어요" : "일반 해설"}</p><AppHeading variant="screen" accent>{topic.title}</AppHeading><dl className="oracle-v2__facts">{reading.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value}<small>{fact.source}</small></dd></div>)}</dl>{reading.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<InfoDisclosure title="이 풀이의 기준과 한계">{reading.limitations.map((line, index) => <p key={index}>{line}</p>)}</InfoDisclosure>{reading.evidence && <OracleReadingEvidence reading={reading.evidence} />}<footer className="oracle-v2__pager"><button type="button" aria-label="이전 읽을거리" title="이전 읽을거리" disabled={ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group)[0]?.id === topic.id} onClick={() => navigateTopic(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="다음 읽을거리" title="다음 읽을거리" disabled={ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group).at(-1)?.id === topic.id} onClick={() => navigateTopic(1)}><ArrowRight size={18} /></button></footer></article></Reader>}
    {learning && <Reader title="오라클 배움" onClose={() => setLearning(null)} closeLabel={null}>{close => <OracleLearningReader destination={learning} onBack={close} />}</Reader>}
    {savedReading && <Reader title="당시의 내 응답" onClose={() => setSavedReading(null)}>{(() => { const result = readOracleProfileReading(savedReading, props.status === "DELETED" ? { state: "DELETED" } : props.status === "READY" ? { state: "READY", currentRevision: props.revision } : { state: "LOADING" }); return result.result ? <><AppHeading variant="screen" accent>{result.result.representative.label}</AppHeading><p>{savedReading.source.answeredAt.slice(0, 10)} · 당시 응답 기준</p><dl className="oracle-v2__facts">{result.result.scores.filter(score => score.display !== null).map(score => <div key={score.axisId}><dt>{score.label}</dt><dd>{score.display}</dd></div>)}</dl></> : <p>보관한 풀이를 지금 확인할 수 없어요.</p> })()}</Reader>}
  </section>
}
