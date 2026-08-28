import React from "react"
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronRight, ExternalLink } from "lucide-react"
import {
  TRAINING_CONTENT_CATALOG,
  trainingContentById,
} from "../domain/training-content-catalog"
import type { TrainingContentId, TrainingContentSourceState } from "../domain/training-content-catalog"
import { loadSavedTrainingContent, setTrainingContentSaved } from "../domain/training-content-store"

const SOURCE_STATE_LABEL: Record<TrainingContentSourceState, string> = {
  DIRECT_SOURCE_REOPENED: "원문 확인 자료",
  DISCOVERY_SOURCE_ONLY: "추가 검토 중인 기사",
}

export function TrainingContent({ onBack }: { readonly onBack: () => void }) {
  const [selected, setSelected] = React.useState<TrainingContentId | null>(null)
  const [saved, setSaved] = React.useState<readonly TrainingContentId[]>(loadSavedTrainingContent)

  if (selected !== null) {
    const article = trainingContentById(selected)
    const isSaved = saved.includes(selected)
    return (
      <div className="training-content-screen">
        <ContentHeader title="훈련법 읽기" onBack={() => setSelected(null)} />
        <article className="training-content-article">
          <span className="training-content-article__category">{article.category}</span>
          <h1>{article.title}</h1>
          <p className="training-content-article__lead">{article.summary}</p>
          <button
            className="training-content-article__save"
            type="button"
            aria-pressed={isSaved}
            onClick={() => setSaved(setTrainingContentSaved(selected, !isSaved))}
          >
            {isSaved ? <BookmarkCheck aria-hidden="true" size={18} /> : <Bookmark aria-hidden="true" size={18} />}
            {isSaved ? "저장됨" : "나중에 읽기"}
          </button>

          <section>
            <h2>왜 주목받나요?</h2>
            <p>{article.whyNoticed}</p>
          </section>
          <section>
            <h2>무엇을 훈련하나요?</h2>
            <p>{article.whatItTrains}</p>
          </section>
          <section className="training-content-article__boundary">
            <h2>따라 하기 전에</h2>
            <p>{article.useBoundary}</p>
          </section>

          <div className="training-content-article__source">
            <span>{SOURCE_STATE_LABEL[article.sourceState]} · {article.sourceGrade}</span>
            <a href={article.sourceUrl} target="_blank" rel="noreferrer">
              {article.sourceLabel}<ExternalLink aria-hidden="true" size={14} />
            </a>
          </div>
          <p className="training-content-article__footnote">
            이 읽을거리는 훈련 계획이 아니며, 저장해도 계획·안전 판단·포인트가 바뀌지 않아요.
          </p>
        </article>
      </div>
    )
  }

  return (
    <div className="training-content-screen">
      <ContentHeader title="요즘 주목받는 훈련법" onBack={onBack} />
      <div className="training-content-intro">
        <span>읽고 비교하는 훈련 자료</span>
        <h1>유행 이름보다<br />어떻게 쓰이는지 봐요.</h1>
        <p>선수 사례와 훈련 개념을 소개합니다. 검토가 끝나기 전에는 어떤 글도 내 계획을 자동으로 바꾸지 않아요.</p>
      </div>
      <div className="training-content-list" aria-label="훈련법 콘텐츠 목록">
        {TRAINING_CONTENT_CATALOG.map((article, index) => (
          <button type="button" key={article.id} onClick={() => setSelected(article.id)}>
            <span className="training-content-list__number">0{index + 1}</span>
            <span>
              <small>{article.category} · {SOURCE_STATE_LABEL[article.sourceState]}</small>
              <strong>{article.title}</strong>
              <em>{article.summary}</em>
            </span>
            {saved.includes(article.id) ? <BookmarkCheck aria-label="저장됨" size={17} /> : <ChevronRight aria-hidden="true" size={17} />}
          </button>
        ))}
      </div>
      <p className="training-content-reward-note">콘텐츠 포인트는 기존 포인트와 합치는 규칙이 정해진 뒤에 열어요.</p>
    </div>
  )
}

function ContentHeader({ title, onBack }: { readonly title: string; readonly onBack: () => void }) {
  return (
    <header className="training-content-header">
      <button type="button" onClick={onBack} aria-label="이전 화면" title="뒤로"><ArrowLeft aria-hidden="true" size={19} /></button>
      <span>{title}</span>
    </header>
  )
}
