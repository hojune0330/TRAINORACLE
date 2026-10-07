import React from "react"
import { AppHeading } from "../components/AppHeading"
import { ArrowLeft, ArrowRight, Check, ExternalLink, RotateCcw } from "lucide-react"
import { ORACLE_EVIDENCE_PAGES, ORACLE_EXAMPLE_PAGES, ORACLE_GLOSSARY_PAGES, ORACLE_LEARNING_QUIZ,
  ORACLE_LEARNING_TITLES, ORACLE_SOURCE_GRADE_LABELS, ORACLE_SOURCE_STATE_LABELS, ORACLE_SYNTHETIC_NOTICE,
  type OracleLearningDestination, type OracleLearningPage } from "../domain/oracle-learning-content"
import "./oracle-learning-reader.css"

export type { OracleLearningDestination } from "../domain/oracle-learning-content"
export type OracleLearningReaderProps = Readonly<{ destination: OracleLearningDestination; onBack: () => void }>

/** Content only: OracleProfileReader owns the dialog, Escape, focus trap and close lifecycle. */
export function OracleLearningReader(props: OracleLearningReaderProps) {
  return <LearningContent key={props.destination} {...props} />
}

function PageContent({ page }: { page: OracleLearningPage }) {
  return <>
    {page.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {page.table && <table><caption>{page.table.caption}</caption><thead><tr>{page.table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{page.table.rows.map((row, index) => <tr key={index}>{row.map((cell, i) => i === 0 ? <th scope="row" key={i}>{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody></table>}
    {page.limitation && <p className="oracle-learning__boundary">{page.limitation}</p>}
    {page.reviewedAt && <p className="oracle-learning__meta">자료 기준일 · {page.reviewedAt}</p>}
    {page.sources && <ul className="oracle-learning__sources" aria-label="기존 자료 출처">{page.sources.map(source => <li key={source.url}>
      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={14} aria-hidden="true" /><span className="oracle-learning__meta">새 창</span></a>
      <p className="oracle-learning__meta">{source.grade ? `${source.grade} · ${ORACLE_SOURCE_GRADE_LABELS[source.grade]}` : "출처 등급 미지정"}
        {source.state && ` · ${ORACLE_SOURCE_STATE_LABELS[source.state]}`}</p>
      {source.scope && <p className="oracle-learning__meta">{source.scope}</p>}
    </li>)}</ul>}
  </>
}

function LearningContent({ destination, onBack }: OracleLearningReaderProps) {
  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, { selected: number; checked: boolean }>>({})
  const heading = React.useRef<HTMLHeadingElement>(null)
  const pageChanged = React.useRef(false)
  const radioName = React.useId()
  const isQuiz = destination === "QUIZ"
  const pages = destination === "GLOSSARY" ? ORACLE_GLOSSARY_PAGES : destination === "EVIDENCE" ? ORACLE_EVIDENCE_PAGES : ORACLE_EXAMPLE_PAGES
  const length = isQuiz ? ORACLE_LEARNING_QUIZ.length : pages.length
  const complete = isQuiz && index === length
  const quiz = isQuiz ? ORACLE_LEARNING_QUIZ[index] : undefined
  const answer = quiz ? answers[quiz.id] : undefined
  const page = pages[index]
  // Leave initial dialog focus to the parent; move focus only after internal paging.
  React.useLayoutEffect(() => {
    if (pageChanged.current) { heading.current?.focus(); pageChanged.current = false }
  }, [index])
  const go = (next: number) => { pageChanged.current = true; setIndex(next) }
  return <article className="oracle-learning" aria-label={ORACLE_LEARNING_TITLES[destination]}>
    <header><p className="oracle-learning__meta">{complete ? "퀴즈 마침" : `${index + 1} / ${length} · ${isQuiz ? "학습 퀴즈" : page?.category}`}</p>
      <AppHeading as="h2" variant="screen" accent ref={heading} tabIndex={-1}>{complete ? "문제 풀이를 마쳤어요" : quiz?.question ?? page?.title}</AppHeading></header>
    {(isQuiz || destination === "EXAMPLE") && <p className="oracle-learning__notice">{ORACLE_SYNTHETIC_NOTICE}</p>}
    {isQuiz ? complete ? <><p>답과 정답 수는 저장하지 않아요. 퀴즈 결과는 신체 능력이나 훈련 수준 평가가 아니에요.</p>
      <button type="button" onClick={() => { setAnswers({}); go(0) }}><RotateCcw size={16} aria-hidden="true" />다시 풀기</button></> : quiz && <>
      <fieldset disabled={answer?.checked}><legend>답 선택</legend>{quiz.choices.map((choice, choiceIndex) => <label key={choice}>
        <input type="radio" name={radioName} value={choiceIndex} checked={answer?.selected === choiceIndex}
          onChange={() => setAnswers(current => ({ ...current, [quiz.id]: { selected: choiceIndex, checked: false } }))} /><span>{choice}</span>
      </label>)}</fieldset>
      <button type="button" disabled={!answer || answer.checked} onClick={() => { if (answer) setAnswers(current => ({ ...current, [quiz.id]: { ...answer, checked: true } })) }}><Check size={16} aria-hidden="true" />답 확인</button>
      <div role="status" aria-live="polite" aria-atomic="true" className="oracle-learning__feedback">{answer?.checked && <>
        <p><strong>{answer.selected === quiz.correctIndex ? "맞아요." : "다시 살펴볼까요?"}</strong> 정답: {quiz.choices[quiz.correctIndex]}</p><p>{quiz.explanation}</p><p className="oracle-learning__meta">근거 · {quiz.basis}</p>
      </>}</div>
      <p className="oracle-learning__meta">답은 이 화면에서만 유지하며 능력 점수로 저장하지 않아요.</p>
    </> : page && <PageContent page={page} />}
    <footer className="oracle-learning__navigation">
      <button type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />돌아가기</button>
      <div role="group" aria-label="학습 페이지 이동">
        <button type="button" aria-label="이전 학습 페이지" title="이전 학습 페이지" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={18} aria-hidden="true" /></button>
        <button type="button" aria-label={isQuiz && index === length - 1 ? "퀴즈 마치기" : "다음 학습 페이지"} title={isQuiz && index === length - 1 ? "퀴즈 마치기" : "다음 학습 페이지"}
          disabled={complete || !isQuiz && index === length - 1} onClick={() => go(index + 1)}><ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </footer>
  </article>
}
