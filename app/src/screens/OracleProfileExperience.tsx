import React from "react"
import { AppHeading } from "../components/AppHeading"
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Pencil, RotateCcw, Trash2, X } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { ProfileCompanion } from "../components/ProfileCompanion"
import { PreferenceRadar } from "../components/PreferenceRadar"
import { PreferenceCharacter } from "../components/PreferenceCharacter"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { useAutoAdvanceActivation } from "../hooks/useAutoAdvanceActivation"
import { useReaderDialog } from "../hooks/useReaderDialog"
import { ORACLE_AXES, ORACLE_QUESTIONS, buildOracleProfile, describeOracleAxis, type OracleAxisId, type OracleResponses, type OracleResponse } from "../domain/oracle-profile-v2"
import { answerOracleQuestion, currentOracleQuestion, editOracleAxis, previousOracleQuestion, startOracleQuestionFlow, type OracleQuestionFlow } from "../domain/oracle-profile-flow"
import { ORACLE_CONTENT_CATALOG, oracleContentTopic, type OracleDestination } from "../domain/oracle-content-catalog"
import { readOracleProfileReading, type OracleProfileReading } from "../domain/oracle-profile-snapshot"
import "./oracle-profile-v2.css"
import { ContextualIllustration } from "../components/ContextualIllustration"
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
const axisActionLabels: Record<OracleAxisId, string> = {
  STRUCTURE: "훈련 계획", CHALLENGE: "기록 도전", INTENSITY: "강한 달리기", SOCIAL: "함께 달리기",
  EXPLORE: "새로운 경험", REFRESH: "기분 전환", SU: "보조 운동", WE: "웨이트",
}
function responseLabel(response: OracleResponse | undefined) {
  if (response === "SKIPPED") return "건너뜀"
  return [...responseLabels, ...nonNumeric].find(([value]) => value === response)?.[1] ?? "아직 답하지 않음"
}

export function OracleProfileReader({ title, onClose, children, action, closeLabel = "돌아가기", initialFocusRef, contentKey = title }: { title: string; onClose: () => void; children: React.ReactNode | ((close: () => void, leave: (run: () => void) => void) => React.ReactNode); action?: { label: string; run: () => void; closeFirst?: boolean }; closeLabel?: string | null; initialFocusRef?: React.RefObject<HTMLElement | null>; contentKey?: string }) {
  const { reduced } = useCalendarMotion()
  const ref = React.useRef<HTMLDialogElement>(null)
  const body = React.useRef<HTMLDivElement>(null)
  const pending = React.useRef<(() => void) | null>(null)
  const close = useReaderDialog(ref, () => { onClose(); const run = pending.current; pending.current = null; run?.() })
  // Run inside the reader after showModal, including StrictMode's remount. A parent
  // update effect alone can lose focus when the reader restores its opener on cleanup.
  React.useEffect(() => { if (ref.current?.open) initialFocusRef?.current?.focus({ preventScroll: true }) }, [initialFocusRef])
  const leave = (run: () => void) => { pending.current = run; close() }
  React.useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0
    initialFocusRef?.current?.focus({ preventScroll: true })
  }, [contentKey, initialFocusRef])
  return <dialog ref={ref} className="oracle-v2 oracle-v2__dialog" data-reduced-motion={reduced ? "true" : undefined} aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <header className="oracle-v2__chrome"><span className="app-chrome-title">{title}</span><button type="button" aria-label="닫기" title="닫기" onClick={close}><X size={18} /></button></header>
    <div ref={body} className="oracle-v2__reader-body">{typeof children === "function" ? children(close, leave) : children}{action && <button type="button" onClick={() => { if (action.closeFirst === false) { action.run(); return }; leave(action.run) }}>{action.label}<ArrowRight size={16} /></button>}{closeLabel && <button type="button" className="oracle-v2__reader-close" onClick={close}>{closeLabel}<ArrowLeft size={16} /></button>}</div>
  </dialog>
}
const Reader = OracleProfileReader

function OracleArticleContent({ title, reading }: { title: string; reading: OracleReadingDisplay }) {
  return <>
    <p className="oracle-v2__eyebrow">{reading.state === "EDUCATION" ? "훈련 읽을거리" : reading.state === "READY" ? "확인한 자료 기준" : reading.state === "PARTIAL" ? "확인한 부분부터" : reading.state === "UNAVAILABLE" ? "자료를 확인하지 못했어요" : reading.state === "REVOKED" ? "공유가 종료됐어요" : "일반 해설"}</p>
    <AppHeading variant="screen" accent>{title}</AppHeading>
    <dl className="oracle-v2__facts">{reading.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value}<small>{fact.source}</small></dd></div>)}</dl>
    {reading.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    <InfoDisclosure title="이 풀이의 기준과 한계">{reading.limitations.map((line, index) => <p key={index}>{line}</p>)}</InfoDisclosure>
    {reading.evidence && <OracleReadingEvidence reading={reading.evidence} />}
  </>
}

function restoredFlow(answers: OracleResponses, draft?: OracleResponses): OracleQuestionFlow {
  const axis = draft ? ORACLE_AXES.find(item => item.questions.some((_text, index) => draft[`${item.id}_${index + 1}` as keyof OracleResponses] !== answers[`${item.id}_${index + 1}` as keyof OracleResponses])) : undefined
  const flow = startOracleQuestionFlow(draft ?? answers, axis?.id ?? "STRUCTURE")
  return { ...flow, completed: answers, position: draft && axis && flow.position === 3 ? 0 : flow.position }
}

export function OracleProfileExperience(props: OracleProfileExperienceProps) {
  const { reduced } = useCalendarMotion()
  const [flow, setFlow] = React.useState(() => restoredFlow(props.answers, props.draftAnswers))
  const flowRef = React.useRef(flow)
  const dirty = React.useRef(false)
  const [character, setCharacter] = React.useState<OracleAxisId | null>(props.selectedCharacter)
  const [questionOpen, setQuestionOpen] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState(false)
  const [topicId, setTopicId] = React.useState<string | null>(null)
  const [savedReading, setSavedReading] = React.useState<OracleProfileReading | null>(null)
  const [storyAxis, setStoryAxis] = React.useState<OracleAxisId | null>(null)
  const [learning, setLearning] = React.useState<OracleLearningDestination | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [featuredTopicId, setFeaturedTopicId] = React.useState("D02")
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
      setCharacter(null); setQuestionOpen(false); setEditingQuestion(false); setSavedReading(null); setStoryAxis(null); setTopicId(null); setLearning(null); setSettingsOpen(false); setFeaturedTopicId("D02"); return
    }
    if (dirty.current) return
    const next = restoredFlow(props.answers, props.draftAnswers)
    flowRef.current = next; setFlow(next); setCharacter(props.selectedCharacter)
  }, [props.answers, props.draftAnswers, props.selectedCharacter, props.status])
  const profile = buildOracleProfile(flow.completed, character)
  const story = storyAxis ? buildOracleProfileStory(profile.scores.find(score => score.axisId === storyAxis)!) : null
  const visibleScores = profile.scores.filter(score => score.state !== "UNANSWERED")
  const basicScores = profile.scores.filter(score => score.axisId !== "SU" && score.axisId !== "WE")
  const extraScores = visibleScores.filter(score => score.axisId === "SU" || score.axisId === "WE")
  const hasChartScores = basicScores.some(score => score.display !== null)
  const managerScore = visibleScores.find(score => score.axisId === profile.representative.id)
    ?? (visibleScores.length === 1 ? visibleScores[0] : undefined)
  const question = currentOracleQuestion(flow)
  const answerActivation = useAutoAdvanceActivation(question?.id ?? `${flow.axisId}-result`)
  const currentScore = profile.scores.find(score => score.axisId === flow.axisId)!
  const nextAxis = ORACLE_AXES.find(axis => profile.scores.find(score => score.axisId === axis.id)?.state === "UNANSWERED")
  const previousQuestion = flow.position > 0 ? ORACLE_QUESTIONS.find(item => item.id === `${flow.axisId}_${flow.position}`) : undefined
  // The reader opens in an effect; focus after showModal rather than while the dialog is hidden.
  React.useEffect(() => { if (questionOpen) questionHeading.current?.focus({ preventScroll: true }) }, [question?.id, questionOpen])
  const accountBlocked = props.account && ["LOADING", "CONFLICT", "DELETED"].includes(props.status)
  const managerDescription = accountBlocked ? "계정의 응답을 확인하는 중이에요." : managerScore ? describeOracleAxis(managerScore)
    : visibleScores.length ? `답한 ${visibleScores.length}개 항목을 정리했어요. 취향과 실제 훈련은 따로 살펴봐요.`
      : "응답은 취향을, 실제 훈련은 기록으로 나눠 살펴봐요."
  const blocked = busy || accountBlocked || props.responsesDisabled === true
  const illustrationAllowed = !busy && !localMessage && props.status === "READY" && !props.hasPendingScore
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
    setEditingQuestion(false)
    const next = editOracleAxis(flowRef.current, axis)
    flowRef.current = next; setFlow(next); setQuestionOpen(true)
  }
  const reviewAnswers = (axis: OracleAxisId) => {
    if (dirty.current || props.hasPendingScore) { setQuestionOpen(true); return }
    const next = startOracleQuestionFlow(flowRef.current.completed, axis)
    setEditingQuestion(false); flowRef.current = next; setFlow(next); setQuestionOpen(true)
  }
  const answer = (response: OracleResponse) => {
    if (!question || blocked) return
    const accepted = answerOracleQuestion(flowRef.current, question.id, response)
    if (accepted === flowRef.current) return
    // A result-review edit changes only this answer; a normal first pass still needs three answers.
    const next: OracleQuestionFlow = editingQuestion
      ? { ...accepted, position: 3, completed: { ...flowRef.current.completed, [question.id]: response } }
      : accepted
    setEditingQuestion(false)
    dirty.current = true; flowRef.current = next; setFlow(next); props.onDraft(next.draft)
    if (next.position === 3) {
      const candidate = buildOracleProfile(next.completed, Object.keys(flow.completed).length === 0 ? undefined : character)
      const selected = candidate.representative.id === "NEUTRAL" ? null : candidate.representative.id
      setCharacter(selected); void commit(next.completed, selected)
    }
  }
  const previous = () => {
    const next = previousOracleQuestion(flowRef.current)
    flowRef.current = next; setFlow(next)
  }
  const topic = topicId ? oracleContentTopic(topicId) : null
  const featuredTopic = oracleContentTopic(featuredTopicId)!
  const featuredReading = view === "library" ? props.readTopic(featuredTopic.id, flow.completed) : null
  const learningDestination = topic && ["GLOSSARY", "EVIDENCE", "QUIZ", "EXAMPLE"].includes(topic.destination) ? topic.destination as OracleLearningDestination : null
  const reading = topic ? props.readTopic(topic.id, flow.completed) : null
  const navigateTopic = (direction: number) => {
    if (!topic) return
    const peers = ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group)
    const next = peers[peers.findIndex(item => item.id === topic.id) + direction]
    if (next) setTopicId(next.id)
  }
  const sourceMessage = props.message || (props.account ? props.draftState === "EDITING" && props.status === "PENDING" ? "작성 중 · 이 기기에 임시 보관했어요. 응답을 마치면 계정에 저장해요." : ({ LOADING: "계정에서 불러오는 중", READY: "계정에 저장됨", PENDING: "계정으로 보내는 중", CONFLICT: "다른 곳에서 바뀐 응답을 확인해 주세요", FAILED: "계정 저장을 확인하지 못했어요", DELETED: "삭제된 프로필이에요" }[props.status]) : "게스트 · 임시 응답은 새로고침하면 사라져요.")
  return <section className="oracle-v2" data-reduced-motion={reduced ? "true" : undefined}>
    <header className="oracle-v2__chrome"><button type="button" aria-label={props.backLabel ?? "오라클로 돌아가기"} title={props.backLabel ?? "오라클로 돌아가기"} onClick={props.onBack}><ArrowLeft size={18} /></button><strong className="app-chrome-title">{view === "library" ? "오라클 읽을거리" : view === "saved" ? "풀이 보관함" : "러닝 취향"}</strong><span>오라클</span></header>
    <div className={`oracle-v2__body${view === "result" && visibleScores.length > 0 ? " oracle-v2__body--results" : ""}`}>
      {(visibleScores.length > 0 || view !== "result") && <nav className="oracle-v2__tabs app-choice-group" aria-label="러닝 취향 보기">{([["result", "내 결과"], ["library", "읽을거리"], ["saved", "보관함"]] as const).map(([id, label]) => <button className="app-choice-control" type="button" key={id} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>}
      <p className="oracle-v2__status" role="status">{sourceMessage}</p>
      {props.onContext && props.responsesDisabled && <button type="button" disabled={busy || accountBlocked} onClick={props.onContext}>작성하던 추가 맥락 이어가기<ChevronRight size={16} /></button>}
      {(dirty.current || props.hasPendingScore || props.draftAnswers && JSON.stringify(props.draftAnswers) !== JSON.stringify(props.answers)) && <button type="button" disabled={blocked} onClick={() => {
        if (dirty.current) { setQuestionOpen(true); return }
        const axis = ORACLE_AXES.find(item => item.questions.some((_text, index) => props.draftAnswers?.[`${item.id}_${index + 1}` as keyof OracleResponses] !== props.answers[`${item.id}_${index + 1}` as keyof OracleResponses]))
        const restored = startOracleQuestionFlow(props.draftAnswers, axis?.id ?? "STRUCTURE")
        const next: OracleQuestionFlow = { ...restored, position: restored.position === 3 ? 0 : restored.position, completed: props.answers }
        flowRef.current = next; setFlow(next); setQuestionOpen(true)
      }}>작성하던 답 이어가기<ArrowRight size={16} /></button>}
      {localMessage && !questionOpen && <p role="alert">계정 저장을 확인하지 못했어요. 입력한 답은 이 화면에 남아 있어요.</p>}
      {props.account && props.draftState !== "EDITING" && ["FAILED", "PENDING"].includes(props.status) && <button type="button" onClick={props.onRetry}><RotateCcw size={16} />다시 확인</button>}
      {view === "result" && <>
        <section className={`oracle-v2__self${visibleScores.length > 0 ? " oracle-v2__self--results" : ""}`} aria-label="러닝 취향 결과">
        <div className="oracle-v2__identity"><div><p className="oracle-v2__eyebrow">{visibleScores.length ? `${visibleScores.length}개 항목 · 내 응답 기준` : "내 러닝 취향"}</p><AppHeading variant="screen" accent>{visibleScores.length ? profile.representative.id === "NEUTRAL" ? "내가 고른 달리기 취향" : profile.representative.label : "나는 어떤 달리기를 좋아할까요?"}</AppHeading></div></div>
        {visibleScores.length === 0 ? <>
          <p>질문 3개로 먼저 훈련 방식을 살펴봐요.</p>
          <p className="oracle-v2__status">6가지 취향을 점수와 육각 그래프로 볼 수 있어요.</p>
          {illustrationAllowed && !questionOpen && <ProfileCompanion mode="intro" />}
          <button type="button" className="oracle-v2__primary" aria-label="내 훈련 방식 알아보기 · 질문 3개" disabled={blocked} onClick={() => openQuestions("STRUCTURE")}>내 훈련 방식 알아보기<ArrowRight size={18} /></button>
          <p className="oracle-v2__status">선택 사항이에요. 체력이나 실력 평가는 아니에요.</p>
        </> : <>
          {illustrationAllowed && !questionOpen && (profile.representative.id === "NEUTRAL" ? <ProfileCompanion mode="result" /> : <PreferenceCharacter key={profile.representative.id} axis={profile.representative.id} label={profile.representative.label} />)}
          {hasChartScores ? <PreferenceRadar scores={profile.scores} disabled={blocked} onSelectAxis={axisId => {
            const score = profile.scores.find(item => item.axisId === axisId)!
            if (score.state === "UNANSWERED") openQuestions(axisId)
            else setStoryAxis(axisId)
          }} /> : <><p className="oracle-v2__result-reading">점수 없이도 내 응답을 볼 수 있어요.</p><div className="oracle-v2__entry-links">{basicScores.filter(score => score.state !== "UNANSWERED").map(score => <button type="button" key={score.axisId} onClick={() => setStoryAxis(score.axisId)}>{axisActionLabels[score.axisId]} 응답 보기<ChevronRight size={16} /></button>)}</div></>}
          <p className="oracle-v2__status">점수가 높을수록 그 항목에 동의했어요. 실력 점수는 아니에요.</p>
          {extraScores.length > 0 && <InfoDisclosure title="보조 운동·웨이트 취향"><dl className="oracle-v2__scores">{extraScores.map(score => <div key={score.axisId}><dt><button type="button" onClick={() => setStoryAxis(score.axisId)}>{score.label}<ChevronRight size={16} /></button></dt><dd><strong>{score.display ?? "—"}</strong>{score.mixed && <span>답이 엇갈림</span>}<button type="button" title={`${score.label} 수정`} aria-label={`${score.label} 수정`} disabled={blocked} onClick={() => openQuestions(score.axisId)}><Pencil size={16} /></button></dd></div>)}</dl></InfoDisclosure>}
          {nextAxis && <button type="button" className="oracle-v2__primary oracle-v2__next-interest" disabled={blocked || dirty.current || props.hasPendingScore} onClick={() => openQuestions(nextAxis.id)}>{axisActionLabels[nextAxis.id]}도 알아보기<ArrowRight size={18} /></button>}
          <InfoDisclosure title="점수와 별명은 어떻게 정하나요?"><p>{profile.limitation}</p><p>세 답을 0~100으로 정리하고 5점 단위로 표시해요. 75점 이상인 핵심 항목은 별명 후보가 될 수 있어요. 이 기준은 과학적 유형 경계가 아니에요.</p>{visibleScores.map(score => <div key={score.axisId}><AppHeading as="h2" variant="section">{score.label}</AppHeading><p>{describeOracleAxis(score)}</p><ul>{score.evidence.map(item => <li key={item.questionId}>{ORACLE_QUESTIONS.find(q => q.id === item.questionId)?.text} · {responseLabel(item.response ?? undefined)}</li>)}</ul></div>)}</InfoDisclosure>
          {profile.candidates.length > 0 && <InfoDisclosure title="대표 별명 선택"><div className="oracle-v2__choices app-choice-group">{profile.candidates.map(candidate => <button className="app-choice-control" type="button" key={candidate.id} aria-pressed={character === candidate.id} disabled={blocked} onClick={() => { setCharacter(candidate.id); dirty.current = true; void commit(flow.completed, candidate.id) }}>{candidate.label}{character === candidate.id && <Check size={16} />}</button>)}<button className="app-choice-control" type="button" aria-pressed={character === null} disabled={blocked} onClick={() => { setCharacter(null); dirty.current = true; void commit(flow.completed, null) }}>별명 없이 보기{character === null && <Check size={16} />}</button></div></InfoDisclosure>}
          <button type="button" disabled={blocked || !props.account || props.status !== "READY" || dirty.current} onClick={async () => { setBusy(true); setLocalMessage(""); try { if (!await props.onRemember()) setLocalMessage("save") } catch { setLocalMessage("save") } finally { setBusy(false) } }}><Bookmark size={16} />이 결과 보관</button>
        </>}
        </section>
        {visibleScores.length === 0 && <nav className="oracle-v2__entry-links" aria-label="프로필 읽을거리">
          <button type="button" onClick={() => setView("library")}>읽을거리<ChevronRight size={16} /></button>
          {props.readings.length > 0 && <button type="button" onClick={() => setView("saved")}>보관함<ChevronRight size={16} /></button>}
        </nav>}
        <button type="button" className="oracle-v2__settings-entry" onClick={() => props.onNavigate("FRIENDS")}>친구와 취향 비교<ChevronRight size={16} /></button>
        <button type="button" className="oracle-v2__settings-entry" onClick={() => setSettingsOpen(true)}>프로필 설정·추가 정보<ChevronRight size={16} /></button>
      </>}
      {view === "library" && featuredReading && <>
        <article className="oracle-v2__article" aria-label="먼저 읽을 글">
          <OracleArticleContent title={featuredTopic.title} reading={featuredReading} />
          <button type="button" onClick={() => setTopicId(featuredTopic.id)}>이 글 이어서 보기<ChevronRight size={16} /></button>
        </article>
        <InfoDisclosure purpose="actions" title="전체 주제·다른 글" preview={`${ORACLE_CONTENT_CATALOG.length}편`}>
          <div className="oracle-v2__groups app-choice-group" role="group" aria-label="읽을거리 주제">{groups.map(item => <button className="app-choice-control" type="button" key={item.id} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}</div>
          <div className="oracle-v2__topics">{ORACLE_CONTENT_CATALOG.filter(item => item.group === group).map(item => <button type="button" key={item.id} onClick={() => setTopicId(item.id)}><span>{item.title}</span><ChevronRight size={16} /></button>)}</div>
        </InfoDisclosure>
      </>}
      {view === "saved" && <><AppHeading variant="screen" accent>보관한 풀이</AppHeading>{props.readings.length === 0 ? <p>마음에 드는 결과를 보관하면 여기서 다시 읽을 수 있어요.</p> : props.readings.map(item => <button className="oracle-v2__saved" type="button" key={item.source.revision} onClick={() => setSavedReading(item)}><span>{item.source.answeredAt.slice(0, 10)} · 당시 응답</span><ChevronRight size={16} /></button>)}</>}
    </div>
    {settingsOpen && <Reader title="프로필 설정" onClose={() => setSettingsOpen(false)}>{(_close, leave) => <>
        <aside className="oracle-v2__manager" aria-label="마리 매니저">
          <div className="oracle-v2__manager-portrait">{illustrationAllowed && <ContextualIllustration image="mari-explain" />}</div>
          <div className="oracle-v2__manager-copy"><AppHeading as="h2" variant="section">마리 매니저</AppHeading><p className="oracle-v2__eyebrow">{visibleScores.length ? "내 응답 해설" : "오라클 안내"}</p>
          </div>
          <InfoDisclosure className="oracle-v2__manager-details" title="마리의 안내">
            <p>{managerDescription}</p>
          </InfoDisclosure>
            <div className="oracle-v2__manager-actions oracle-v2__manager-details">
              <button type="button" onClick={() => leave(() => setTopicId("C02"))}>내 훈련 해설<ChevronRight size={16} /></button>
            </div>
          <InfoDisclosure className="oracle-v2__manager-details" purpose="actions" title="기록·계획 해설">
            <div className="oracle-v2__manager-actions">
              <button type="button" onClick={() => leave(() => setTopicId("B02"))}>내 기록 해설<ChevronRight size={16} /></button>
              <button type="button" onClick={() => leave(() => setTopicId("C07"))}>계획·수행 비교<ChevronRight size={16} /></button>
            </div>
          </InfoDisclosure>
        </aside>
        {props.onContext && !props.responsesDisabled && <button className="oracle-v2__context-action" type="button" disabled={busy || accountBlocked} onClick={() => leave(() => props.onContext?.())}>
          <span>훈련·대회 정보 추가<small>달릴 시간 · 장소 · 보조 운동 · 대회</small></span><ChevronRight size={16} />
        </button>}
        <InfoDisclosure purpose="actions" title="다른 러닝 취향 알아보기" preview="기록 도전 · 함께 달리기 · 웨이트 등 8가지"><div className="oracle-v2__axis-list">{ORACLE_AXES.map(axis => <button type="button" key={axis.id} disabled={blocked} onClick={() => leave(() => openQuestions(axis.id))}><span>{axis.label}</span><ChevronRight size={16} /></button>)}</div></InfoDisclosure>
        <InfoDisclosure title="내 응답 관리"><p>응답을 바꿔도 훈련 강도나 양이 자동으로 늘어나지 않아요.</p>{confirmDelete ? <><p>응답과 보관한 프로필 풀이를 삭제할까요?</p><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { if (await props.onDelete()) { dirty.current = false; const empty = startOracleQuestionFlow(); flowRef.current = empty; setFlow(empty); setCharacter(null); setConfirmDelete(false) } else setLocalMessage("delete") } catch { setLocalMessage("delete") } finally { setBusy(false) } }}>삭제하기</button><button type="button" onClick={() => setConfirmDelete(false)}>취소</button></> : <button type="button" disabled={blocked} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />응답 삭제</button>}</InfoDisclosure>
        {localMessage && <p role="alert">변경을 저장하지 못했어요. 입력한 답은 그대로 남아 있어요.</p>}
    </>}</Reader>}
    {story && <Reader title="마리의 응답 해설" onClose={() => setStoryAxis(null)} action={!blocked && storyAxis ? { label: "내 답 수정", run: () => reviewAnswers(storyAxis) } : undefined}><p className="oracle-v2__eyebrow">마리 매니저 · 내 응답 기준</p><AppHeading variant="screen" accent>{story.title}</AppHeading><p>{story.reading}</p><p>{story.example}</p><InfoDisclosure title="함께 생각할 점"><p>{story.watchFor}</p></InfoDisclosure><AppHeading as="h2" variant="section">이렇게 활용해 볼 수 있어요</AppHeading><p>{story.use}</p><InfoDisclosure title="내가 답한 내용">{story.facts.map((fact, i) => <p key={i}>{fact.question}<br />{typeof fact.response === "number" ? `${fact.response}/5` : fact.response === "SKIPPED" ? "건너뜀" : nonNumeric.find(([value]) => value === fact.response)?.[1]}</p>)}</InfoDisclosure><InfoDisclosure title="아직 알 수 없는 것"><p>{story.boundary}</p><p>{story.scope}</p></InfoDisclosure></Reader>}
    {questionOpen && <Reader title={ORACLE_AXES.find(axis => axis.id === flow.axisId)!.label} contentKey={question?.id ?? `${flow.axisId}-result`} onClose={() => setQuestionOpen(false)} closeLabel={question ? null : "내 결과 보기"} initialFocusRef={questionHeading}>
      {question ? <div className="oracle-v2__question" key={question.id} {...answerActivation}>
        {editingQuestion ? <p className="oracle-v2__eyebrow">내 답 수정</p> : <div className="oracle-v2__question-progress"><p className="oracle-v2__eyebrow">{flow.position + 1} / 3</p><progress aria-label="현재 질문 순서" value={flow.position + 1} max={3} /></div>}
        <AppHeading variant="screen" accent ref={questionHeading} tabIndex={-1}>{question.text}</AppHeading>
        <p className="oracle-v2__question-hint">{editingQuestion ? "답을 고르면 이 항목의 결과에 반영돼요." : "지금 내 생각에 가까운 답을 골라요."}</p>
        <div className="oracle-v2__choices app-choice-group">{responseLabels.map(([value, label]) => <button data-auto-advance className="app-choice-control app-choice-control--answer" type="button" key={value} disabled={blocked} aria-pressed={flow.draft[question.id] === value} onClick={() => answer(value)}><span>{label}</span>{flow.draft[question.id] === value ? <Check size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}</button>)}</div>
        <InfoDisclosure title="답하기 어려워요"><div className="oracle-v2__choices app-choice-group">{nonNumeric.map(([value, label]) => <button data-auto-advance className="app-choice-control app-choice-control--answer" type="button" key={value} disabled={blocked} aria-pressed={flow.draft[question.id] === value} onClick={() => answer(value)}>{label}{flow.draft[question.id] === value && <Check size={18} aria-hidden="true" />}</button>)}</div></InfoDisclosure>
        {previousQuestion && !editingQuestion && <button type="button" className="oracle-v2__previous-answer" disabled={blocked} onClick={previous}><span><small>이전 답</small>{" "}{responseLabel(flow.draft[previousQuestion.id])}</span><Pencil size={16} aria-hidden="true" /></button>}
        <footer className="oracle-v2__pager">{editingQuestion ? <button type="button" disabled={blocked} onClick={() => { const next = { ...flowRef.current, position: 3 as const }; flowRef.current = next; setFlow(next); setEditingQuestion(false) }}>수정 취소</button> : <button type="button" disabled={flow.position === 0 || blocked} aria-label="이전 질문" title="이전 질문" onClick={previous}><ArrowLeft size={18} aria-hidden="true" />이전</button>}<button data-auto-advance type="button" disabled={blocked} aria-pressed={flow.draft[question.id] === "SKIPPED"} onClick={() => answer("SKIPPED")}>건너뛰기</button></footer>
      </div> : <div className="oracle-v2__question-result">
        <p className="oracle-v2__eyebrow">{currentScore.label} · 내 응답 기준</p>
        <AppHeading variant="screen" accent ref={questionHeading} tabIndex={-1}>내 답을 정리했어요</AppHeading>
        <p className="oracle-v2__result-reading">{describeOracleAxis(currentScore)}</p>
        {currentScore.display !== null ? <><p className="oracle-v2__result-number">{currentScore.display}<small> / 100</small></p><p className="oracle-v2__status">취향을 정리한 값이에요. 체력이나 실력 점수가 아니에요.</p></> : <p className="oracle-v2__status">점수 없이 답만 정리했어요.</p>}
        {illustrationAllowed && (profile.candidates.find(item => item.id === flow.axisId) ? <PreferenceCharacter key={flow.axisId} axis={flow.axisId} label={ORACLE_AXES.find(axis => axis.id === flow.axisId)!.character!} /> : <ProfileCompanion mode="result" />)}
        {localMessage ? <p role="alert">저장을 확인하지 못했어요. 입력한 답은 이 화면에 남아 있어요.</p> : <p role="status">{busy ? "답을 저장하는 중이에요." : sourceMessage}</p>}
        {localMessage === "save" && <button type="button" disabled={busy} onClick={() => { void commit(flow.completed, character) }}>다시 저장<RotateCcw size={16} /></button>}
        <InfoDisclosure title="내 답 확인·수정" purpose="actions"><div className="oracle-v2__answer-review">{currentScore.evidence.map((item, index) => <button type="button" key={item.questionId} disabled={blocked} onClick={() => { const next = { ...flowRef.current, position: index as 0 | 1 | 2 }; flowRef.current = next; setFlow(next); setEditingQuestion(true) }}><span><small>{ORACLE_QUESTIONS.find(q => q.id === item.questionId)?.text}</small>{" "}{responseLabel(item.response ?? undefined)}</span><Pencil size={16} aria-hidden="true" /></button>)}</div></InfoDisclosure>
        {nextAxis && <div className="oracle-v2__next-interest"><p className="oracle-v2__status">더 궁금하다면 · 다음 항목도 질문 3개</p><button type="button" className="oracle-v2__primary" disabled={blocked || dirty.current || props.hasPendingScore} onClick={() => openQuestions(nextAxis.id)}>{axisActionLabels[nextAxis.id]}도 알아보기<ArrowRight size={18} aria-hidden="true" /></button></div>}
      </div>}
    </Reader>}
{topic && reading && <Reader title={topic.title} onClose={() => { if (view === "library") setFeaturedTopicId(topic.id); setTopicId(null) }} action={learningDestination ? { label: ({ GLOSSARY: "용어 읽기", EVIDENCE: "근거 살펴보기", QUIZ: "문제 풀기", EXAMPLE: "예시 읽기" })[learningDestination], closeFirst: false, run: () => setLearning(learningDestination) } : ["RECORDS", "JOURNAL", "CALENDAR", "PLAN_REVIEW", "METHODS", "FRIENDS", "SHARE_PREVIEW"].includes(topic.destination) ? { label: topic.destination === "SHARE_PREVIEW" ? "친구 비교·공유 설정 열기" : topic.destination === "FRIENDS" ? "친구와 비교하기" : topic.destination === "RECORDS" ? "경기 기록 보기" : topic.destination === "JOURNAL" ? "일지 보기" : topic.destination === "METHODS" ? "훈련법 보기" : topic.destination === "CALENDAR" ? "달력 보기" : "계획 보기", closeFirst: false, run: () => props.onNavigate(topic.destination) } : topic.destination === "PROFILE" ? { label: "내 응답 보기", run: () => setView("result") } : undefined}>{props.renderTopicControls?.(topic.id)}<article key={topic.id} className="oracle-v2__article" onTouchStart={event => { const point = event.touches[0]; if (point) touch.current = { x: point.clientX, y: point.clientY } }} onTouchEnd={event => { const point = event.changedTouches[0], start = touch.current; touch.current = null; if (point && start && Math.abs(point.clientX - start.x) > 60 && Math.abs(point.clientY - start.y) < 35) navigateTopic(point.clientX < start.x ? 1 : -1) }}><OracleArticleContent title={topic.title} reading={reading} /><footer className="oracle-v2__pager"><button type="button" aria-label="이전 읽을거리" title="이전 읽을거리" disabled={ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group)[0]?.id === topic.id} onClick={() => navigateTopic(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="다음 읽을거리" title="다음 읽을거리" disabled={ORACLE_CONTENT_CATALOG.filter(item => item.group === topic.group).at(-1)?.id === topic.id} onClick={() => navigateTopic(1)}><ArrowRight size={18} /></button></footer></article></Reader>}
    {learning && <Reader title="오라클 배움" onClose={() => setLearning(null)} closeLabel={null}>{close => <OracleLearningReader destination={learning} onBack={close} />}</Reader>}
    {savedReading && <Reader title="당시의 내 응답" onClose={() => setSavedReading(null)}>{(() => { const result = readOracleProfileReading(savedReading, props.status === "DELETED" ? { state: "DELETED" } : props.status === "READY" ? { state: "READY", currentRevision: props.revision } : { state: "LOADING" }); return result.result ? <><AppHeading variant="screen" accent>{result.result.representative.label}</AppHeading><p>{savedReading.source.answeredAt.slice(0, 10)} · 당시 응답 기준</p><dl className="oracle-v2__facts">{result.result.scores.filter(score => score.display !== null).map(score => <div key={score.axisId}><dt>{score.label}</dt><dd>{score.display}</dd></div>)}</dl></> : <p>보관한 풀이를 지금 확인할 수 없어요.</p> })()}</Reader>}
  </section>
}
