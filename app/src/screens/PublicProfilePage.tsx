import React from "react"
import { ArrowLeft, CalendarDays, Gauge, Trophy } from "lucide-react"
import { loadPublicProfile } from "../domain/account/public-profile"
import type { PublicProfilePageData } from "../domain/account/public-profile"
import { PUBLIC_PROFILE_TAG_LABELS } from "../domain/account/public-profile"

export function PublicProfilePage({ handle }: { readonly handle: string }) {
  const [data, setData] = React.useState<PublicProfilePageData | null | undefined>(undefined)

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
    </main>
  )
}

function Metric({ icon: Icon, value, label }: { readonly icon: typeof CalendarDays; readonly value: string; readonly label: string }) {
  return <div style={{ borderTop: "1px solid var(--line)", paddingTop: 9 }}><Icon aria-hidden="true" size={15} /><strong style={{ display: "block", fontFamily: "var(--sans)", marginTop: 6 }}>{value}</strong><span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>{label}</span></div>
}

const pageStyle: React.CSSProperties = { maxWidth: 640, minHeight: "100vh", margin: "0 auto", padding: "24px 20px 64px", background: "var(--paper)", color: "var(--ink)" }
const headingStyle: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 28, lineHeight: 1.2, letterSpacing: 0, margin: "10px 0 0" }
const bodyStyle: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", margin: "8px 0 0" }
const backStyle: React.CSSProperties = { border: 0, background: "transparent", padding: "8px 0", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 24 }
const cardStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 4, padding: 16, marginTop: 12 }
