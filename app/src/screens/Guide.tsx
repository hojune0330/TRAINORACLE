// Guide — 예시·안내 화면 (실서비스와 분리된 유일한 데모 표면).
// 목적: "일지가 차곡차곡 쌓이면 어떤 모습이 되고, 왜 소중해지는가"를
//        중학생도 이해할 수 있게 이야기로 보여주고 흥미를 만든다.
// 원칙:
//  - 여기의 모든 수치·인물(가상의 러너 "예시")은 명시적으로 "예시" 배지가 붙는다.
//  - 실데이터 화면(홈·일지·추이)에는 이 내용이 절대 섞이지 않는다.
//  - 훈련량을 부추기는 문구 금지 — "많이 뛰라"가 아니라 "꾸준히 적으라"로만 유도.
//    (ORDER_006 Task A 안전 원칙과 정렬: 쉬는 날 기록도 똑같이 값진 기록)
import React from "react"
import type { ReactNode } from "react"
import { SectionLb, MoodStrip, Stamp } from "../components/JournalPrimitives"

export function Guide({ onWriteLog }: { onWriteLog?: () => void }) {
  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log("[GUIDE] rendered=true")
    }
  }, [])

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          GUIDE · 일지는 이렇게 쌓여요
        </div>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: "8px 0 0", lineHeight: 1.3 }}>
          하루 1분이<br />1년 뒤의 보물이 되는 과정
        </h1>
        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          아래는 가상의 러너 이야기예요. 모든 숫자에 <ExampleBadge /> 표시가 있어요.<br />
          당신의 화면에는 당신이 쓴 것만 나타나요.
        </div>
      </div>

      {/* STEP 1 — 하루 */}
      <Step n={1} title="첫날 — 딱 한 줄이면 돼요">
        <p style={pStyle}>
          훈련이 끝나면 앱을 열고 <b>얼마나 뛰었는지, 얼마나 힘들었는지(RPE), 한 줄 메모</b>만 적어요.
          다 합쳐도 1분. 시험 끝나고 답 맞춰보는 것보다 짧아요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>어느 화요일 <ExampleBadge /></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>40 min · 8 km</span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, marginTop: 6 }}>가볍게 조깅</div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35, borderTop: "1px dashed var(--paper-edge)", paddingTop: 8 }}>
            오늘 바람 많이 붐. 그래도 다리는 가벼웠다.
          </div>
        </DemoCard>
        <p style={pSub}>이게 전부예요. 잘 쓰려고 하지 않아도 돼요 — 대충 쓴 한 줄도 나중엔 다 이야기가 돼요.</p>
      </Step>

      {/* STEP 2 — 일주일 */}
      <Step n={2} title="일주일 — 첫 그래프가 생겨요">
        <p style={pStyle}>
          며칠만 쌓이면 홈에 <b>이번 주 요약</b>이 나타나요. 내가 이번 주에 얼마나 뛰었는지,
          몸이 얼마나 힘들었는지 숫자로 보이기 시작해요.
        </p>
        <DemoCard>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>THIS WEEK <ExampleBadge /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 8, borderTop: "1px solid var(--ink)" }}>
            {[["거리", "32.4", "km"], ["세션", "4", "회"], ["RPE 평균", "5.2", "/10"]].map(([l, v, u], i) => (
              <div key={i} style={{ padding: "10px 8px 4px 0" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 500, marginTop: 2 }}>{v}<span style={{ fontSize: 9, color: "var(--ink-3)", marginLeft: 2 }}>{u}</span></div>
              </div>
            ))}
          </div>
        </DemoCard>
        <p style={pSub}>쉬는 날 "쉬었다"고 적는 것도 훌륭한 기록이에요. 많이 뛴 주가 아니라 <b>꾸준히 적은 주</b>가 이기는 거예요.</p>
      </Step>

      {/* STEP 3 — 한 달 */}
      <Step n={3} title="한 달 — 나만 아는 패턴이 보여요">
        <p style={pStyle}>
          감정과 통증을 색으로 쌓아 보면 재미있는 게 보여요.
          "아, 나는 <b>잠을 못 잔 다음 날 훈련이 유독 힘들구나</b>" 같은,
          코치님도 부모님도 모르는 <b>나만의 패턴</b>이요.
        </p>
        <DemoCard>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>MOOD · 28 DAYS <ExampleBadge /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(28, 1fr)", gap: 1, padding: "10px 0 4px" }}>
            {[3, 4, 4, 3, 2, 3, 4, 4, 5, 4, 3, 3, 4, 3, 2, 2, 3, 4, 4, 4, 5, 4, 3, 4, 4, 3, 4, 3].map((lvl, i) => (
              <div key={i} style={{ height: 24, position: "relative", background: "var(--surface-2)" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${lvl * 20}%`, background: `var(--mood-${lvl})` }}></div>
              </div>
            ))}
          </div>
        </DemoCard>
        <p style={pSub}>이 색 띠는 예시지만, 한 달 뒤 당신의 추이 탭에는 진짜 당신의 색이 칠해져 있을 거예요.</p>
      </Step>

      {/* STEP 4 — 1년 */}
      <Step n={4} title="1년 — 과거의 내가 말을 걸어요">
        <p style={pStyle}>
          1년이 지나면 홈에 <b>"1년 전 오늘"</b>이 떠요.
          작년의 내가 뭘 고민했는지, 어떤 날 처음 기록을 깼는지 —
          그날의 내 글씨로 다시 만나요.
        </p>
        <DemoCard dashed>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>1 YEAR AGO TODAY <ExampleBadge /></div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            처음으로 안 걷고 5km 완주. 마지막 400m는 날아갔다.
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Stamp kind="pb">첫 완주</Stamp>
            <MoodStrip level={5} showLabel />
          </div>
        </DemoCard>
        <p style={pSub}>
          이건 어디서도 살 수 없어요. 오직 <b>그날그날 적은 사람</b>만 가질 수 있는 기록이에요.
        </p>
      </Step>

      {/* FAQ */}
      <div style={{ padding: "30px 20px 0" }}>
        <SectionLb>— 자주 묻는 질문</SectionLb>
        <Faq q="회원가입 해야 하나요?" a="아니요. 지금 바로 쓸 수 있어요. 일지는 이 기기(브라우저)에 저장돼요. 나중에 계정을 연동하면 온라인 보관과 기기 이동이 열려요." />
        <Faq q="일지를 매일 써야 하나요?" a="아니요. 빼먹어도 아무 일도 일어나지 않아요. 다시 돌아온 날부터 이어서 쌓이면 돼요. 쉰 날을 '쉬었다'고 적는 것도 좋은 기록이에요." />
        <Faq q="메모는 누가 보나요?" a="아무도 못 봐요. 자유 입력(메모·혼잣말)은 이 기기에만 저장되고, 어떤 판정이나 분석에도 쓰이지 않아요." />
        <Faq q="기록이 느린데 써도 되나요?" a="이 일지는 남과 비교하지 않아요. 어제의 나와 오늘의 나만 있어요. 시작이 어디든, 쌓이는 건 똑같이 소중해요." />
        <Faq q="아프면 어떻게 하나요?" a="하루 마무리에서 통증 부위를 표시할 수 있어요. 통증이 심하면(4~5) 무리하지 말라는 안내가 떠요. 이 앱은 절대 아픈 몸으로 훈련을 부추기지 않아요." />
      </div>

      {/* CTA */}
      <div style={{ padding: "28px 20px 0" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "17px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0,
          fontFamily: "var(--sans)", fontSize: 15.5, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}>
          <span>오늘부터 1페이지 시작하기</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: "0.14em" }}>~ 1분</span>
        </button>
        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.05em", textAlign: "center" }}>
          회원가입 없이 · 이 기기에 저장
        </div>
      </div>
    </div>
  )
}

const pStyle: React.CSSProperties = {
  fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7, letterSpacing: "-0.005em", margin: "10px 0 0",
}
const pSub: React.CSSProperties = {
  fontSize: 12, color: "var(--ink-3)", lineHeight: 1.65, margin: "10px 0 0",
}

function ExampleBadge() {
  return (
    <span style={{
      display: "inline-block", padding: "1px 5px", marginLeft: 2,
      border: "1px dashed var(--ink-4)",
      fontFamily: "var(--mono)", fontSize: 8, fontWeight: 500,
      color: "var(--ink-4)", letterSpacing: "0.08em", verticalAlign: "middle",
    }}>예시</span>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div style={{ padding: "28px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--bg)",
          background: "var(--brand)", padding: "2px 8px", letterSpacing: "0.08em",
        }}>STEP {n}</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function DemoCard({ children, dashed }: { children: ReactNode; dashed?: boolean }) {
  return (
    <div className="paper-grid" style={{
      marginTop: 12, padding: "13px 15px",
      border: dashed ? "1px dashed var(--line-2)" : "1px solid var(--line)",
      background: dashed ? "var(--paper-2)" : undefined,
    }}>
      {children}
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div style={{ borderBottom: "1px dashed var(--hair)" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "13px 2px", background: "transparent", border: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>{q}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 2px 14px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65 }}>{a}</div>
      )}
    </div>
  )
}
