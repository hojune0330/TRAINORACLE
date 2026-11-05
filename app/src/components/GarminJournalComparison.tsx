import { useEffect, useState } from "react"
import { activeLocalAccount, journalOwner } from "../domain/account/local-journal-ownership"
import { loadJournalEntriesSnapshot } from "../domain/journal-store"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"

/** Compare only this owner's already-loaded structured facts. Never infer duplicates. */
export function GarminJournalComparison({ ownerId, date }: { readonly ownerId: string; readonly date: string }) {
  const [, refresh] = useState(0)
  useEffect(() => {
    const changed = () => refresh(value => value + 1)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, changed)
    return () => window.removeEventListener(LOCAL_JOURNALS_CHANGED, changed)
  }, [])
  if (activeLocalAccount() !== ownerId) return null
  const snapshot = loadJournalEntriesSnapshot()
  const entries = snapshot.entries.filter(entry => entry.date === date && entry.kind === "post-session" && journalOwner(entry.id) === ownerId)
  return <details className="garmin-detail__raw">
    <summary>이날 일지와 비교 · {date}</summary>
    <p>현재 기기에 불러온 내 일지와 비교해요. 같은 날짜라는 이유만으로 중복 운동으로 판단하지 않아요.</p>
    {snapshot.readStatus !== "complete" && <p role="status">기존 일지를 모두 읽지 못했어요. 일지에서 확인해 주세요.</p>}
    {!entries.length && <p>현재 기기에 비교할 운동 일지가 없어요. 서버의 전체 기록이 없다는 뜻은 아니에요.</p>}
    {entries.map(entry => entry.kind === "post-session" && <article key={entry.id} className="garmin-panel__record">
      <h4>{entry.title || "훈련 기록"}</h4>
      <dl className="garmin-panel__facts">
        <div><dt>거리</dt><dd>{entry.distanceKm.trim() ? `${entry.distanceKm} km` : "미기록"}</dd></div>
        <div><dt>일지에 저장한 시간</dt><dd>{entry.durationMin.trim() ? `${entry.durationMin} 분` : "미기록"}</dd></div>
      </dl>
      <p>시작 시각과 시간 종류는 해당 일지의 운동 상세에서 확인해 주세요.</p>
    </article>)}
  </details>
}
