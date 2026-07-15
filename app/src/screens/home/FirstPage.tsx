import { SectionLb } from "../../components/JournalPrimitives"

type FirstPageProps = {
  readonly onWriteLog?: () => void
  readonly onOpenGuide?: () => void
}

const JOURNAL_TYPES = [
  { mark: "↻", title: "훈련 후", description: "방금 끝낸 세션 · 거리·페이스·한 줄 메모", duration: "~1분" },
  { mark: "☾", title: "하루 마무리", description: "수면·체중·기분·통증 체크", duration: "~2분" },
  { mark: "▲", title: "경기", description: "직전 긴장도 · 직후 기록과 감정", duration: "~30초" },
] as const

export function FirstPage({ onWriteLog, onOpenGuide }: FirstPageProps) {
  return (
    <>
      <div className="paper-lines" style={{ padding: "26px 20px 22px", margin: "6px 20px 0", border: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          PAGE 1 · 아직 아무것도 없는
        </div>
        <div className="hand" style={{ marginTop: 12, fontSize: 27, color: "var(--ink-blue)", lineHeight: 1.25 }}>
          여기는 당신의<br />첫 페이지예요.
        </div>
        <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65 }}>
          오늘 뛴 것, 잔 시간, 기분 한 줄 — 뭐든 1분이면 적혀요.
          하루하루는 짧은 메모지만, 계속 쌓이면 <b style={{ color: "var(--ink)" }}>나만 아는 나의 기록</b>이 됩니다.
        </div>
        <div className="hand-pencil" style={{ marginTop: 12, fontSize: 15, color: "var(--pencil)" }}>
          1년 뒤 오늘, 이 페이지를 다시 펼치게 될 거예요.
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <button type="button" onClick={onWriteLog} style={{
          width: "100%", padding: "18px 20px", background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0, fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        }}>
          <span>첫 일지 쓰기</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>~ 1분</span>
        </button>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <button type="button" onClick={onOpenGuide} style={{
          width: "100%", minHeight: 44, padding: "13px 16px", background: "transparent", color: "var(--ink-2)",
          border: "1px dashed var(--line-2)", borderRadius: 0, fontFamily: "var(--mono)", fontSize: 11,
          letterSpacing: "0.06em", cursor: "pointer", textAlign: "left",
        }}>
          일지가 쌓이면 어떤 모습이 되나요? → <b style={{ color: "var(--ink)" }}>예시 보기</b>
        </button>
      </div>

      <div style={{ padding: "26px 20px 0" }}>
        <SectionLb>— 세 가지 일지</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {JOURNAL_TYPES.map((journalType, index) => (
            <div key={journalType.title} style={{
              display: "grid", gridTemplateColumns: "30px 1fr auto", gap: 12, padding: "13px 4px", alignItems: "center",
              borderBottom: index < JOURNAL_TYPES.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 19, color: "var(--brand)", lineHeight: 1 }}>{journalType.mark}</span>
              <div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{journalType.title}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{journalType.description}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.1em" }}>{journalType.duration}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
          회원가입 없이 시작돼요. 일지는 이 기기에 저장됩니다.
        </div>
      </div>
    </>
  )
}
