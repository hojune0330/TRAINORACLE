import React from "react"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Users, X } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { ContextualIllustration } from "../components/ContextualIllustration"
import { TaskGuide } from "../components/TaskGuide"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { READING_EVENTS, parseReadingTime, readPersonalRecord, readTogetherRecords, readingTime, validReadingDate, type ReadingEventId, type ReadingRecord, type ReadingStage } from "../domain/record-reading-oracle"
import "./record-reading-oracle.css"

type Draft = { eventId: ReadingEventId | null; time: string; date: string }
const emptyDraft = (): Draft => ({ eventId: null, time: "", date: "" })

export function RecordReadingOracle({ stage, today, onStageChange, onBack, onClose, onOpenPlan }: {
  readonly stage: ReadingStage
  readonly today: string
  readonly onStageChange: (stage: ReadingStage) => void
  readonly onBack: () => void
  readonly onClose: () => void
  readonly onOpenPlan: () => void
}) {
  const [ownDraft, setOwnDraft] = React.useState<Draft>(emptyDraft)
  const [friendDraft, setFriendDraft] = React.useState<Draft>(emptyDraft)
  const [own, setOwn] = React.useState<ReadingRecord | null>(null)
  const [friend, setFriend] = React.useState<ReadingRecord | null>(null)
  const [consent, setConsent] = React.useState(false)
  const [subject, setSubject] = React.useState<"self" | "friend">("self")
  const [firstFriendConsent, setFirstFriendConsent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [chapter, setChapter] = React.useState(0)
  const { reduced } = useCalendarMotion()
  const heading = React.useRef<HTMLHeadingElement>(null)
  const ownResult = own ? readPersonalRecord(own) : null
  const pair = own && friend ? subject === "self" ? readTogetherRecords(own, friend, consent)
    : readTogetherRecords(friend, own, firstFriendConsent) : null
  const needsOwn = stage !== "own-event" && stage !== "own-time"
  const visibleStage = needsOwn && !ownResult ? ownDraft.eventId ? "own-time" : "own-event"
    : stage === "pair-result" && !pair ? "friend-time" : stage
  const isFriend = visibleStage === "friend-event" || visibleStage === "friend-time"
  const entryIsFriend = isFriend ? subject === "self" : subject === "friend"
  const consentRequired = entryIsFriend && !(isFriend ? consent : firstFriendConsent)
  const draft = isFriend ? friendDraft : ownDraft
  const event = READING_EVENTS.find(item => item.id === draft.eventId)
  const isResult = visibleStage === "self-result" || visibleStage === "pair-result"
  const isPair = visibleStage === "pair-result" && pair !== null

  React.useEffect(() => {
    setError(null)
    setChapter(0)
  }, [visibleStage])

  React.useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [visibleStage, chapter])

  const edit = (patch: Partial<Draft>) => {
    if (isFriend) {
      setFriendDraft(current => ({ ...current, ...patch }))
      setFriend(null)
      setConsent(false)
    } else {
      setOwnDraft(current => ({ ...current, ...patch }))
      setOwn(null)
      setFirstFriendConsent(false)
    }
    setError(null)
  }

  const read = (e: React.FormEvent) => {
    e.preventDefault()
    const seconds = parseReadingTime(draft.time)
    if (!draft.eventId) { setError("먼저 종목을 골라 주세요."); return }
    if (seconds === null) { setError("분:초로 적어 주세요. 예: 20:30, 2:02.5. 1시간 이상은 1:45:30처럼 적어요."); return }
    if (!validReadingDate(draft.date, today)) { setError("기록을 세운 날짜를 확인해 주세요. 미래 날짜는 넣을 수 없어요."); return }
    if (entryIsFriend && !(isFriend ? consent : firstFriendConsent)) { setError("친구가 기록 풀이와 비교에 동의했는지 확인해 주세요."); return }
    const record = { eventId: draft.eventId, seconds, achievedOn: draft.date || null }
    if (isFriend) { setFriend(record); onStageChange("pair-result") }
    else { setOwn(record); onStageChange("self-result") }
  }

  const startFriend = () => {
    if (own) setFriendDraft(current => ({ ...current, eventId: current.eventId ?? own.eventId }))
    onStageChange("friend-event")
  }
  const chapters = isPair ? ["두 기록 비교", "함께 달리기", "비교 기준"] : ["기록 요약", "400m 평균", "더 알아보기"]
  const pickChapter = (next: number) => {
    setChapter(next)
    heading.current?.scrollIntoView({ block: "start", behavior: "auto" })
  }

  return <div className="record-reading" data-reduced-motion={reduced}>
    <header className="record-reading__header">
      <button type="button" onClick={onBack} aria-label="이전 단계로"><ArrowLeft size={19} aria-hidden="true" /></button>
      <span>오라클 · {isPair ? "러닝 궁합" : "기록 풀이"}</span>
      <button type="button" onClick={onClose} aria-label="풀이 닫기"><X size={19} aria-hidden="true" /></button>
    </header>
    <div className="record-reading__body">
      {!isResult && <>
        <p className="record-reading__eyebrow">{entryIsFriend ? "친구의 최고기록" : "나의 최고기록"} · {visibleStage.endsWith("event") ? "1 / 2" : "2 / 2"}</p>
        <TaskGuide as="h1" ref={heading} tabIndex={-1}
          title={visibleStage.endsWith("event") ? isFriend ? entryIsFriend ? "친구는 어떤 종목인가요?" : "나는 어떤 종목인가요?" : "어떤 기록을 살펴볼까요?" : `${event?.label ?? "선택한 종목"} 최고기록은?`}
          description={visibleStage === "own-event" ? "최고기록을 1km·400m 평균 시간으로 살펴봐요." : undefined}
          illustration={visibleStage === "own-event" ? "record-stopwatch" : undefined} />
        {visibleStage === "own-event" && <div className="record-reading__subjects app-choice-group" role="group" aria-label="누구의 기록인가요?">
          {(["self", "friend"] as const).map(value => <button className="app-choice-control" key={value} type="button" aria-pressed={subject === value} onClick={() => {
            if (subject === value) return
            setSubject(value); setOwnDraft(emptyDraft()); setFriendDraft(emptyDraft()); setOwn(null); setFriend(null); setConsent(false); setFirstFriendConsent(false)
          }}>{value === "self" ? "내 기록" : "친구 기록"}</button>)}
        </div>}
        {visibleStage.endsWith("event") ? <>
          <div className="record-reading__events app-choice-group" role="group" aria-label={entryIsFriend ? "친구 종목" : "내 종목"}>
            {READING_EVENTS.map(item => <button className="app-choice-control app-choice-control--answer" type="button" key={item.id} onClick={() => {
              edit({ eventId: item.id })
              onStageChange(isFriend ? "friend-time" : "own-time")
            }}>{item.label}<ChevronRight size={17} aria-hidden="true" /></button>)}
          </div>
        </> : <form onSubmit={read} noValidate>
          <label className="record-reading__field">최고기록
            <input key={isFriend ? "friend" : "own"} name="recordTime" value={draft.time} onChange={e => edit({ time: e.target.value })} placeholder={event?.example ?? "20:30"} inputMode="text" autoComplete="off" maxLength={12} aria-invalid={error !== null} aria-describedby="reading-time-hint" />
          </label>
          <p id="reading-time-hint" className="record-reading__muted">분:초 · 1시간 이상은 시:분:초</p>
          <InfoDisclosure title="기록을 세운 날짜도 넣기">
            <label className="record-reading__field">달성일 · 선택
              <input type="date" value={draft.date} max={today} onChange={e => edit({ date: e.target.value })} />
            </label>
          </InfoDisclosure>
          {entryIsFriend && <label className="record-reading__consent"><input type="checkbox" checked={isFriend ? consent : firstFriendConsent} onChange={e => isFriend ? setConsent(e.target.checked) : setFirstFriendConsent(e.target.checked)} /><span>친구가 이 기록의 풀이와 비교에 동의했어요.</span></label>}
          {error && <p role="alert" className="record-reading__error">{error}</p>}
          <button type="submit" className="record-reading__primary" disabled={consentRequired} aria-describedby={consentRequired ? "reading-consent-hint" : undefined}>{isFriend ? "친구 기록과 비교하기" : subject === "self" ? "나의 러닝 풀이 보기" : "친구의 러닝 풀이 보기"}<ArrowRight size={18} aria-hidden="true" /></button>
          {consentRequired && <p id="reading-consent-hint" className="record-reading__muted">동의를 확인하면 풀이를 볼 수 있어요.</p>}
        </form>}
        <p className="record-reading__privacy">입력은 이 풀이에서만 사용해요. 닫거나 새로고침하면 사라지며, 계정이나 서버에 저장하지 않아요.</p>
      </>}

      {isResult && ownResult && <>
        <div className="record-reading__chapter-tabs app-choice-group" role="group" aria-label="풀이 내용">
          {chapters.map((label, index) => <button className="app-choice-control" type="button" key={label} aria-pressed={chapter === index} onClick={() => pickChapter(index)}>{label}</button>)}
        </div>
        <section key={`${visibleStage}-${chapter}`} className="record-reading__page">
          <p className="record-reading__eyebrow">{chapter + 1} / 3 · {isPair ? "친구와 나" : "직접 입력한 최고기록"}</p>
          <TaskGuide as="h1" ref={heading} tabIndex={-1}
            title={isPair ? chapter === 0 ? "나와 친구의 기록 비교" : chapter === 1 ? "함께 달리는 방법" : "비교에 사용한 기록" : chapter === 0 ? `${subject === "self" ? "내" : "친구의"} ${ownResult.event.label} 기록 요약` : chapter === 1 ? "400m 평균 시간" : "더 알 수 있는 기록"} />

          {!isPair && chapter === 0 && <>
            <div className="record-reading__signature">
              <ContextualIllustration image="record-stopwatch" />
              <div><span>{ownResult.event.label} · 최고기록</span><strong>{ownResult.recordTime}</strong><small>{ownResult.dateLabel}</small></div>
            </div>
            <dl className="record-reading__numbers"><div><dt>평균 1km</dt><dd>{ownResult.pace}</dd></div><div><dt>같은 속도의 400m</dt><dd>{ownResult.lap}</dd></div></dl>
            <p className="record-reading__muted">최고기록을 나눈 값이며, 오늘의 훈련 목표는 아니에요.</p>
            <p className="record-reading__story">{ownResult.story}</p>
          </>}
          {!isPair && chapter === 1 && <>
            <div className="record-reading__lap"><span>400m</span><strong>{ownResult.lap}</strong><small>최고기록의 평균 속도</small></div>
            <p className="record-reading__story">{ownResult.rhythm}</p>
            <p>{ownResult.event.label}는 400m 길이의 <strong>{ownResult.laps.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}배</strong>예요. 실제 랩마다 이 속도였다는 뜻은 아니에요.</p>
          </>}
          {!isPair && chapter === 2 && <>
            <p className="record-reading__story">{ownResult.perspective}</p>
            <ul className="record-reading__next-facts"><li><strong>구간 기록이 더해지면</strong><span>초반과 후반의 속도 차이를 읽을 수 있어요.</span></li><li><strong>다른 날의 같은 종목 기록이 있으면</strong><span>언제, 얼마나 달라졌는지 나란히 볼 수 있어요.</span></li><li><strong>훈련 일지가 더해지면</strong><span>계획한 강도와 실제 느낌을 함께 살펴볼 수 있어요.</span></li></ul>
          </>}
          {isPair && chapter === 0 && <>
            <div className="record-reading__pair" aria-label="두 사람의 입력 기록">
              {[{ label: "나", result: pair.own }, { label: "친구", result: pair.friend }].map(item => <div key={item.label}><span>{item.label} · {item.result.event.label}</span><strong>{item.result.recordTime}</strong><small>{item.result.dateLabel}</small></div>)}
            </div>
            {pair.sameEvent && <div className="record-reading__bars" role="img" aria-label={`같은 종목 기록의 시간 차이 ${readingTime(pair.gapSeconds!)}. 궁합 점수가 아닙니다.`}>
              {[{ label: "나", seconds: pair.own.recordSeconds }, { label: "친구", seconds: pair.friend.recordSeconds }].map(item => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.seconds / Math.max(pair.own.recordSeconds, pair.friend.recordSeconds) * 100}%` }} /></div><strong>{readingTime(item.seconds)}</strong></div>)}
            </div>}
            <p className="record-reading__story">{pair.story}</p>
            <p className="record-reading__muted">기록을 세운 시기·코스·날씨는 같지 않을 수 있어요. 현재 실력의 순위나 궁합 점수는 아니에요.</p>
          </>}
          {isPair && chapter === 1 && <ol className="record-reading__ways">{pair.ways.map((way, index) => <li key={way.title}><span>{index + 1}</span><div><h2>{way.title}</h2><p>{way.body}</p></div></li>)}</ol>}
          {isPair && chapter === 2 && <>
            <p className="record-reading__story">{pair.sameEvent ? `${pair.own.event.label}의 두 최고기록을 같은 거리 위에서 비교했어요. 총 시간의 차이는 ${readingTime(pair.gapSeconds!)}예요.` : "다른 종목은 거리가 달라 시간 차이를 비교하지 않았어요. 각자의 기록은 그대로 두었어요."}</p>
            <p>러닝 궁합은 누가 더 좋은 선수인지가 아니라, 두 사람이 어떻게 함께 달릴지에 관한 풀이예요. 타고난 재능·회복력·미래 기록은 이 입력만으로 알 수 없어요.</p>
          </>}
        </section>
        <div className="record-reading__pager">
          <button type="button" aria-label="이전 풀이" disabled={chapter === 0} onClick={() => pickChapter(chapter - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
          <span>{chapter + 1} / 3</span>
          <button type="button" disabled={chapter === 2} onClick={() => pickChapter(chapter + 1)}>{chapter < 2 ? "다음 풀이" : "마지막 장"}<ChevronRight size={20} aria-hidden="true" /></button>
        </div>
        {!isPair && <button type="button" className="record-reading__primary" onClick={startFriend}><Users size={18} aria-hidden="true" />{subject === "self" ? "친구와 러닝 궁합 보기" : "내 기록과 러닝 궁합 보기"}<ArrowRight size={18} aria-hidden="true" /></button>}
        {isPair && <button type="button" className="record-reading__primary" onClick={() => onStageChange("friend-time")}>{subject === "self" ? "친구 기록 바꿔보기" : "내 기록 바꿔보기"}<ArrowRight size={18} aria-hidden="true" /></button>}
        <InfoDisclosure title="무엇을 근거로 풀었나요?">
          <p>직접 입력한 종목·기록·달성일만 사용했어요. 일지 원문·비밀 메모·친구 계정은 읽지 않아요. 입력 기록의 진위는 확인하지 않았어요.</p>
          <p>1km 평균은 기록 초 × 1000 ÷ 경기 거리, 400m 값은 기록 초 × 400 ÷ 경기 거리예요. 반올림해 소수 둘째 자리까지 표시하며 다른 종목 예상 기록이나 훈련 페이스를 만들지 않아요.</p>
          <p>달성일을 적었더라도 오늘의 체력으로 단정하지 않아요. 풀이에는 현재 몸 상태나 경기 조건이 반영되지 않았어요.</p>
          <p>입력과 풀이는 이 화면에서만 유지해요. 계획·일지·경기 기록에 자동 저장하지 않으며 AI 서비스로 보내지 않아요.</p>
          <button type="button" className="record-reading__text-action" onClick={onOpenPlan}>훈련 계획은 따로 만들기<ArrowRight size={16} aria-hidden="true" /></button>
        </InfoDisclosure>
      </>}
    </div>
  </div>
}
