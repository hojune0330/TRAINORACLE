import React from "react"
import { ArrowLeft, CalendarDays, Gauge, Sparkles, Trophy } from "lucide-react"
import { loadPublicProfile } from "../domain/account/public-profile"
import type { PublicProfilePageData } from "../domain/account/public-profile"
import { PUBLIC_PROFILE_TAG_LABELS } from "../domain/account/public-profile"
import { loadEntries } from "../domain/journal-store"
import { todayISO } from "../domain/journal-store"
import { projectStructuredJournalObservations } from "../domain/journal-observation"
import { loadAthleteRecords } from "../domain/athlete-records"
import {
  buildOracleComparisonSnapshot,
  deriveFriendRunningOracle,
} from "../domain/friend-running-oracle"

export function PublicProfilePage({ handle }: { readonly handle: string }) {
  const [data, setData] = React.useState<PublicProfilePageData | null | undefined>(undefined)
  const [showComparison, setShowComparison] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void loadPublicProfile(handle).then(result => {
      if (!cancelled) setData(result)
    })
    return () => { cancelled = true }
  }, [handle])

  const goHome = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("profile")
    window.location.assign(url)
  }

  if (data === undefined) return <main style={pageStyle}><p role="status">공개 프로필을 불러오고 있어요.</p></main>
  if (data === null) return (
    <main style={pageStyle}>
      <button type="button" onClick={goHome} style={backStyle}><ArrowLeft aria-hidden="true" size={17} /> TrainOracle로 돌아가기</button>
      <h1 style={headingStyle}>이 프로필은 공개되어 있지 않아요</h1>
      <p style={bodyStyle}>주소가 바뀌었거나 사용자가 공개를 껐을 수 있어요.</p>
    </main>
  )

  const publicSnapshot = data.oracleSnapshot ?? null
  const ownSnapshot = buildOracleComparisonSnapshot({
    observations: projectStructuredJournalObservations(loadEntries()),
    records: loadAthleteRecords(),
    selection: {
      recordId: bestComparableRecordId(publicSnapshot?.record?.eventDistanceM ?? null),
      shareRecord: true,
      shareDistance: true,
      shareEnergy: true,
    },
    today: todayISO(),
  })
  const comparison = publicSnapshot !== null && ownSnapshot !== null
    ? deriveFriendRunningOracle(ownSnapshot, publicSnapshot)
    : null

  return (
    <main style={pageStyle}>
      <button type="button" onClick={goHome} style={backStyle}><ArrowLeft aria-hidden="true" size={17} /> TrainOracle</button>
      <header style={{ borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>@{data.profile.handle}</div>
        <h1 style={headingStyle}>{data.profile.displayName}</h1>
        <p style={bodyStyle}>{PUBLIC_PROFILE_TAG_LABELS[data.profile.profileTag]}</p>
      </header>
      <section aria-labelledby="shared-plans-title" style={{ marginTop: 24 }}>
        <h2 id="shared-plans-title" style={{ fontFamily: "var(--sans)", fontSize: 17, letterSpacing: 0 }}>공유한 훈련 계획</h2>
        {data.cards.length === 0 ? (
          <p style={bodyStyle}>아직 공개한 계획 요약이 없어요.</p>
        ) : data.cards.map(card => (
          <article key={card.shareSlug} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{card.eventLabel}</div>
                <h3 style={{ fontFamily: "var(--sans)", fontSize: 16, margin: "5px 0 0", letterSpacing: 0 }}>{card.title}</h3>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, border: "1px solid var(--line)", padding: "5px 7px" }}>{card.badgeLabel}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 }}>
              <Metric icon={CalendarDays} value={`${card.frameLengthDays}일`} label="한 주기" />
              <Metric icon={Gauge} value={`${card.qualitySessionCount}회`} label="고강도" />
              <Metric icon={Trophy} value={`${card.completedSessionCount}/${card.totalSessionCount}`} label="완료" />
            </div>
            <p style={{ ...bodyStyle, fontSize: 11.5, marginTop: 14 }}>상세 처방과 개인 기록은 공개되지 않습니다.</p>
          </article>
        ))}
      </section>
      <section aria-labelledby="friend-oracle-title" style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 22 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <Sparkles aria-hidden="true" size={18} />
          <h2 id="friend-oracle-title" style={{ fontFamily: "var(--sans)", fontSize: 17, margin: 0, letterSpacing: 0 }}>함께 달리기 오라클</h2>
        </div>
        {publicSnapshot === null ? (
          <p style={bodyStyle}>이 사용자는 친구 비교용 기록을 공개하지 않았어요.</p>
        ) : comparison === null ? (
          <p style={bodyStyle}>내 기기에 경기 기록이나 구조화 일지를 남기면, 공개된 항목만 나란히 비교할 수 있어요.</p>
        ) : (
          <>
            <p style={bodyStyle}>{comparison.headline}</p>
            <button type="button" style={oracleButtonStyle} onClick={() => setShowComparison(value => !value)}>
              {showComparison ? "비교 결과 접기" : "내 기록과 비교하기"}
            </button>
            {showComparison && (
              <div style={oraclePanelStyle} role="region" aria-label="친구와 함께 달리기 비교 결과">
                <h3 style={oracleHeadingStyle}>확인된 사실</h3>
                {comparison.facts.length === 0 ? <p style={bodyStyle}>나란히 비교할 공개 항목이 아직 없어요.</p> : <FactList items={comparison.facts} />}
                <h3 style={oracleHeadingStyle}>함께 달릴 때</h3>
                <FactList items={comparison.togetherPlan} />
                {comparison.unknowns.length > 0 && <><h3 style={oracleHeadingStyle}>지금은 모르는 것</h3><FactList items={comparison.unknowns} /></>}
                <p style={{ ...bodyStyle, fontSize: 11.5 }}>친구 기록은 이 화면에서만 비교하며, 내 기록을 친구 서버에 보내거나 두 사람의 훈련 계획을 자동으로 바꾸지 않아요.</p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )

  function bestComparableRecordId(friendEventDistanceM: number | null): string | null {
    const achieved = loadAthleteRecords().filter(record => record.purpose !== "RACE_GOAL")
    const sameEvent = friendEventDistanceM === null
      ? achieved
      : achieved.filter(record => record.eventDistanceM === friendEventDistanceM)
    const pool = sameEvent.length > 0 ? sameEvent : achieved
    const candidate = pool.sort((left, right) => {
      const purposeOrder = (value: typeof left.purpose) => value === "PERSONAL_BEST" ? 0 : value === "SEASON_BEST" ? 1 : 2
      return purposeOrder(left.purpose) - purposeOrder(right.purpose)
        || left.performanceSeconds - right.performanceSeconds
    })[0]
    return candidate?.id ?? null
  }
}

function FactList({ items }: { readonly items: readonly string[] }) {
  return <ul style={{ margin: "8px 0 0", paddingLeft: 19 }}>{items.map(item => <li key={item} style={{ ...bodyStyle, margin: "6px 0" }}>{item}</li>)}</ul>
}

function Metric({ icon: Icon, value, label }: { readonly icon: typeof CalendarDays; readonly value: string; readonly label: string }) {
  return <div style={{ borderTop: "1px solid var(--line)", paddingTop: 9 }}><Icon aria-hidden="true" size={15} /><strong style={{ display: "block", fontFamily: "var(--sans)", marginTop: 6 }}>{value}</strong><span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>{label}</span></div>
}

const pageStyle: React.CSSProperties = { maxWidth: 640, minHeight: "100vh", margin: "0 auto", padding: "24px 20px 64px", background: "var(--paper)", color: "var(--ink)" }
const headingStyle: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 28, lineHeight: 1.2, letterSpacing: 0, margin: "10px 0 0" }
const bodyStyle: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", margin: "8px 0 0" }
const backStyle: React.CSSProperties = { border: 0, background: "transparent", padding: "8px 0", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 24 }
const cardStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 16, marginTop: 12 }
const oracleButtonStyle: React.CSSProperties = { minHeight: 44, width: "100%", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--sans)", fontWeight: 600, cursor: "pointer" }
const oraclePanelStyle: React.CSSProperties = { marginTop: 12, border: "1px solid var(--line)", padding: 16 }
const oracleHeadingStyle: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 14, margin: "14px 0 0", letterSpacing: 0 }
