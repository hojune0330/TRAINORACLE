import React from "react"
import { ArrowLeft, ChevronRight, MessageSquarePlus, RefreshCcw, Send } from "lucide-react"
import { feedbackConfig } from "../domain/feedback/feedback-config"
import { feedbackGateway } from "../domain/feedback/feedback-service"
import type { FeedbackCategory, FeedbackGateway, FeedbackThread } from "../domain/feedback/feedback-types"

type FeedbackBoardProps = {
  readonly available?: boolean
  readonly gateway?: FeedbackGateway
}

function categoryValue(value: string): FeedbackCategory {
  if (value === "IDEA" || value === "QUESTION") return value
  return "BUG"
}

export function FeedbackBoard({
  available = feedbackConfig() !== null,
  gateway = feedbackGateway,
}: FeedbackBoardProps) {
  const [writing, setWriting] = React.useState(false)
  const [threads, setThreads] = React.useState<readonly FeedbackThread[]>([])
  const [loading, setLoading] = React.useState(available)
  const [notice, setNotice] = React.useState("")

  const reload = React.useCallback(async () => {
    if (!available) return
    setLoading(true)
    try {
      setThreads(await gateway.list())
    } catch {
      setNotice("목록을 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.")
    } finally {
      setLoading(false)
    }
  }, [available, gateway])

  React.useEffect(() => { void reload() }, [reload])

  return (
    <main className="feedback-board">
      <header className="feedback-board__header">
        <a href={import.meta.env.BASE_URL} aria-label="TrainOracle 홈으로">
          <ArrowLeft aria-hidden="true" size={18} />
        </a>
        <div>
          <span>TRAINORACLE</span>
          <h1>문의 게시판</h1>
        </div>
      </header>

      {!available ? (
        <section className="feedback-board__closed">
          <h2>문의 게시판을 지금 사용할 수 없어요.</h2>
          <p>일지는 그대로 쓸 수 있어요. 게시판을 다시 열면 앱 안에서 알려드릴게요.</p>
        </section>
      ) : writing ? (
        <FeedbackComposer
          gateway={gateway}
          onCancel={() => { setNotice(""); setWriting(false) }}
          onSent={() => { setNotice("접수됐어요."); setWriting(false); void reload() }}
        />
      ) : (
        <>
          <section className="feedback-board__intro">
            <h2>댓글처럼 남기고 답변을 확인해요.</h2>
            <p>이 기기에서 남긴 문의만 보여요. 브라우저 데이터를 지우면 이전 문의와 답변을 다시 볼 수 없어요.</p>
            <p>일지·통증·메모·오류 정보는 자동으로 붙지 않으며, 문의는 마지막 활동 후 180일 동안 보관해요.</p>
            <button type="button" onClick={() => { setNotice(""); setWriting(true) }}>
              <MessageSquarePlus aria-hidden="true" size={18} />새 문의 쓰기
            </button>
          </section>
          {notice !== "" && <p className="feedback-board__notice" role="status">{notice}</p>}
          <section className="feedback-board__threads" aria-label="내 문의 목록">
            <div className="feedback-board__section-title">
              <h2>내 문의</h2>
              <button type="button" aria-label="문의 목록 새로고침" onClick={() => void reload()}>
                <RefreshCcw aria-hidden="true" size={17} />
              </button>
            </div>
            {loading ? <p>불러오는 중…</p> : threads.length === 0 ? <p>아직 남긴 문의가 없어요.</p> : (
              threads.map((thread) => (
                <FeedbackThreadItem
                  thread={thread}
                  gateway={gateway}
                  onChanged={reload}
                  onRemoved={(threadId) => setThreads((current) => current.filter((item) => item.id !== threadId))}
                  key={thread.id}
                />
              ))
            )}
          </section>
        </>
      )}
    </main>
  )
}

function FeedbackComposer({ gateway, onCancel, onSent }: {
  readonly gateway: FeedbackGateway
  readonly onCancel: () => void
  readonly onSent: () => void
}) {
  const [category, setCategory] = React.useState<FeedbackCategory>("BUG")
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState("")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setError("")
    try {
      await gateway.submit({ category, subject: subject.trim(), body: body.trim() })
      onSent()
    } catch {
      setError("전송되지 않았어요. 입력한 내용은 이 화면에 남아 있어요.")
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="feedback-composer" onSubmit={(event) => void submit(event)}>
      <button className="feedback-composer__back" type="button" onClick={onCancel}>
        <ArrowLeft aria-hidden="true" size={17} />내 문의로
      </button>
      <h2>무엇을 알려주실 건가요?</h2>
      <p>이름·연락처·일지 원문은 적지 마세요. 필요한 내용만 직접 적어 주세요.</p>
      <label>종류
        <select value={category} onChange={(event) => setCategory(categoryValue(event.target.value))}>
          <option value="BUG">잘 안 돼요</option>
          <option value="IDEA">이런 기능이 필요해요</option>
          <option value="QUESTION">궁금한 게 있어요</option>
        </select>
      </label>
      <label>제목
        <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={120} required />
      </label>
      <label>내용
        <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={2000} rows={7} required />
      </label>
      {error !== "" && <p className="feedback-board__error" role="alert">{error}</p>}
      <button className="feedback-composer__submit" type="submit" disabled={sending}>
        <Send aria-hidden="true" size={18} />{sending ? "전송 중…" : "문의 남기기"}
      </button>
    </form>
  )
}

function FeedbackThreadItem({ thread, gateway, onChanged, onRemoved }: {
  readonly thread: FeedbackThread
  readonly gateway: FeedbackGateway
  readonly onChanged: () => Promise<void>
  readonly onRemoved: (threadId: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [reply, setReply] = React.useState("")
  const [error, setError] = React.useState("")
  const [confirmingRemove, setConfirmingRemove] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)

  const append = async () => {
    if (reply.trim() === "") return
    try {
      await gateway.append(thread.id, reply.trim())
      setReply("")
      await onChanged()
    } catch {
      setError("댓글이 전송되지 않았어요. 입력한 내용은 남아 있어요.")
    }
  }

  const remove = async () => {
    setRemoving(true)
    setError("")
    try {
      await gateway.remove(thread.id)
      onRemoved(thread.id)
    } catch {
      setError("문의를 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
      setRemoving(false)
    }
  }

  return (
    <article className="feedback-thread">
      <button className="feedback-thread__summary" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span><small>{thread.status === "ANSWERED" ? "답변 있음" : thread.status === "RESOLVED" ? "종료" : "접수"}</small><strong>{thread.subject}</strong></span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      {open && <div className="feedback-thread__body">
        {thread.comments.map((comment) => (
          <div className="feedback-comment" data-author={comment.author} key={comment.id}>
            <strong>{comment.author === "OPERATOR" ? "TrainOracle 답변" : "내 글"}</strong>
            <p>{comment.body}</p>
          </div>
        ))}
        {thread.status !== "RESOLVED" && <>
          <label>댓글 추가<textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} rows={3} /></label>
          {error !== "" && <p className="feedback-board__error" role="alert">{error}</p>}
          <button type="button" onClick={() => void append()}>댓글 남기기</button>
        </>}
        <div className="feedback-thread__delete">
          {!confirmingRemove ? (
            <button type="button" onClick={() => setConfirmingRemove(true)}>문의 삭제</button>
          ) : (
            <>
              <span>이 문의와 댓글을 모두 지울까요?</span>
              <button type="button" onClick={() => setConfirmingRemove(false)} disabled={removing}>취소</button>
              <button type="button" onClick={() => void remove()} disabled={removing}>
                {removing ? "삭제 중…" : "정말 삭제"}
              </button>
            </>
          )}
        </div>
      </div>}
    </article>
  )
}
