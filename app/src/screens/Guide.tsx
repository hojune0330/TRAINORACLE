// Guide v2 — "민지의 14개월" (실서비스와 분리된 유일한 데모 표면).
// 스펙: SPEC_GUIDE_MINJI_STORY.md — 프롤로그 + 6챕터 + 에필로그.
// 목적: "일지가 차곡차곡 쌓이면 어떤 분석과 이야기가 되는가"를
//        민지(1500m, 디자인 정본 페르소나)의 실제 같은 14개월로 증명한다.
// 원칙:
//  - 모든 수치·인물에 "예시" 배지. 실데이터 화면(홈·일지·추이)과 절대 불혼합.
//  - 절대 연도(20XX) 표기 금지 — 상대 시점만 ("day 1", "2개월", "14개월").
//  - 훈련량 부추김 금지 — CH4의 결론은 "쉼 = 승리". CTA는 "적기"만 유도.
//  - 수치는 SPEC §4 픽스처 표 밖 생성 금지 (16:42.18 − 16:10.44 = 31.74).
import React from "react"
import type { ReactNode } from "react"
import { SectionLb, MoodStrip, Stamp, PainDot, Sparkline, Delta } from "../components/JournalPrimitives"

export function Guide({ onWriteLog }: { onWriteLog?: () => void }) {
  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log("[GUIDE] rendered=true")
    }
  }, [])

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ============ CH 0 · 프롤로그 ============ */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          GUIDE · 일지는 이렇게 쌓여요
        </div>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: "8px 0 0", lineHeight: 1.3 }}>
          민지의 14개월 —<br />하루 1분이 만든 기록
        </h1>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>민지</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em" }}>1500m 러너 · 가상의 인물</span>
          <ExampleBadge />
        </div>
        <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
          민지가 특별해서가 아니에요. 매일 1분씩 적었을 뿐이에요.<br />
          그 1분이 14개월 뒤 무엇이 됐는지 보여드릴게요.
        </div>
        <TimelineStrip />
      </div>

      {/* ============ CH 1 · 첫 줄 (day 1) ============ */}
      <Chapter n={1} when="day 1" title="첫 줄 — 잘 쓰지 않아도 돼요">
        <p style={pStyle}>
          민지의 첫 일지는 이게 전부였어요. <b>얼마나 뛰었는지, 얼마나 힘들었는지(RPE), 한 줄 메모.</b>
          다 합쳐도 1분. 잘 쓰려고 하지 않아도 돼요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>민지의 첫날 <ExampleBadge /></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>40 min · 8 km · RPE 7</span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, marginTop: 6 }}>가볍게 조깅</div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35, borderTop: "1px dashed var(--paper-edge)", paddingTop: 8 }}>
            조깅 40분. 힘들었다.
          </div>
        </DemoCard>
        <p style={pSub}>이 정성 없는 한 줄도 — 14개월 뒤에는 이야기의 1페이지가 돼요.</p>
      </Chapter>

      {/* ============ CH 2 · 3주 — 첫 그래프 ============ */}
      <Chapter n={2} when="3주" title="첫 그래프가 생겼어요">
        <p style={pStyle}>
          며칠만 쌓이면 홈에 <b>이번 주 요약</b>이 나타나요. 민지가 이번 주에 얼마나 뛰었는지,
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
        <p style={pSub}>
          아직은 그냥 숫자예요. <b>재미는 지금부터예요.</b> 쉬는 날 "쉬었다"고 적는 것도 훌륭한 기록이에요 —
          많이 뛴 주가 아니라 <b>꾸준히 적은 주</b>가 이기는 거예요.
        </p>
      </Chapter>

      {/* ============ CH 3 · 2개월 — 수면×RPE 상관 ============ */}
      <Chapter n={3} when="2개월" title="민지도 몰랐던 패턴">
        <p style={pStyle}>
          어느 밤, 민지는 이렇게 적었어요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>어느 목요일 <ExampleBadge /></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>수면 5.2h · RPE 9</span>
          </div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            새벽까지 폰 봄. 오늘 인터벌 지옥이었다.
          </div>
        </DemoCard>
        <p style={pStyle}>
          이런 날이 몇 번 쌓이자, 추이 탭이 재미있는 걸 보여줬어요.
        </p>
        <InsightCard>
          <CompareRow
            left={{ label: "수면 6시간 미만 다음 날", value: "RPE 7.8", note: "훈련이 유독 힘든 날" }}
            right={{ label: "수면 7시간 이상 다음 날", value: "RPE 5.9", note: "같은 훈련이 수월한 날" }}
          />
          <div style={{ marginTop: 8, fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            코치님도 부모님도 몰라요. <b>민지의 몸이 민지에게만 알려준 숫자예요.</b>
          </div>
        </InsightCard>
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
        <p style={pSub}>이 색 띠는 민지의 예시지만, 두 달 뒤 당신의 추이 탭에는 진짜 당신의 색이 칠해져 있을 거예요.</p>
      </Chapter>

      {/* ============ CH 4 · 6개월 — 통증 조기 감지 (쉼 = 승리) ============ */}
      <Chapter n={4} when="6개월" title="몸의 경고를 듣다">
        <p style={pStyle}>
          어느 날부터 일지에 작은 신호가 찍히기 시작했어요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>첫째 날 <ExampleBadge /></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}><PainDot level={1} /> 오른 무릎 1/5</span>
          </div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            오른 무릎 살짝 신경 쓰임.
          </div>
        </DemoCard>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>사흘 뒤 <ExampleBadge /></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}><PainDot level={3} /> 오른 무릎 3/5</span>
          </div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            무릎 3/5. 계단이 싫다.
          </div>
        </DemoCard>
        <InsightCard>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <Sparkline data={[1, 1, 2, 3]} width={90} height={26} color="var(--brand)" showLast />
            <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
              무릎 통증 1 → 1 → 2 → 3<br />이틀 연속 상승 → <b>3일 휴식 선택</b>
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <Stamp kind="done">잘 쉼</Stamp>
            <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-3)" }}>쉼도 훈장이에요</span>
          </div>
        </InsightCard>
        <p style={pSub}>
          민지는 3일을 쉬었고, 시즌을 잃지 않았어요. 일지의 가장 큰 선물은 기록 단축이 아니라
          — <b>달리는 몸을 지켜주는 거예요.</b>
        </p>
      </Chapter>

      {/* ============ CH 5 · 10개월 — 같은 훈련이 쉬워졌다 ============ */}
      <Chapter n={5} when="10개월" title="같은 훈련이 쉬워졌다">
        <p style={pStyle}>
          민지의 대표 훈련은 <b>6×1000m @3'20"</b>예요. 3개월 차와 10개월 차,
          <b>완전히 똑같은 훈련</b>을 두 장의 일지가 이렇게 기억해요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>3개월 차 <ExampleBadge /></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>6×1000m @3'20" · RPE 9</span>
          </div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            죽는 줄. 5개째부터 팔이 안 흔들림.
          </div>
        </DemoCard>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>10개월 차 <ExampleBadge /></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>6×1000m @3'20" · RPE 6</span>
          </div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            마지막 개는 여유 있었다. 이게 되네?
          </div>
        </DemoCard>
        <InsightCard>
          <CompareRow
            left={{ label: "3개월 차 · 같은 세션", value: "RPE 9", note: "다음 날 컨디션 3/5" }}
            right={{ label: "10개월 차 · 같은 세션", value: "RPE 6", note: "다음 날 컨디션 4/5" }}
          />
          <div style={{ marginTop: 8, fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            기록이 아니라 <b>느낌이 좋아진 걸 증명할 수 있는 건 일지뿐이에요.</b><br />
            같은 훈련이 쉬워졌다면 — 몸이 강해진 거예요.
          </div>
        </InsightCard>
      </Chapter>

      {/* ============ CH 6 · 14개월 — 레이스 전날의 나 ============ */}
      <Chapter n={6} when="14개월" title="레이스, 그리고 과거의 나">
        <p style={pStyle}>
          그리고 14개월째의 5000m. 민지의 일지에 이런 페이지가 남았어요.
        </p>
        <DemoCard>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>5000m 결승 <ExampleBadge /></span>
            <Delta value={-31.74} suffix="s" invert />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>16:10.44</span>
            <Stamp kind="pb">PB</Stamp>
          </div>
          <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>이전 최고 16:42.18</div>
        </DemoCard>
        <InsightCard>
          <div style={{ marginTop: 8, fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.65 }}>
            <b>민지의 레이스 레시피</b> — 베스트 레이스 3번의 공통점:<br />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>레이스 전 2일 이지런 + 수면 7h 이상</span><br />
            민지는 이제 자기만의 준비법을 알아요. 남의 루틴이 아니라, <b>자기 데이터에서 나온 루틴이요.</b>
          </div>
        </InsightCard>
        <p style={pStyle}>
          그리고 그날 홈에는 <b>"1년 전 오늘"</b>이 떠 있었어요.
        </p>
        <DemoCard dashed>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>1 YEAR AGO TODAY <ExampleBadge /></div>
          <div className="hand" style={{ marginTop: 8, fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.35 }}>
            처음으로 3'20"을 6개 다 지켰다. 손이 떨린다.
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Stamp kind="brand">첫 완주</Stamp>
            <MoodStrip level={5} showLabel />
          </div>
        </DemoCard>
        <p style={pSub}>
          이 페이지는 어디서도 살 수 없어요. <b>그날그날 적은 민지만 가질 수 있어요.</b>
        </p>
      </Chapter>

      {/* ============ 에필로그 ============ */}
      <div style={{ padding: "30px 20px 0" }}>
        <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 14 }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.5 }}>
            여기까지는 민지의 이야기예요.
          </div>
          <div style={{ marginTop: 6, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.65 }}>
            당신의 패턴, 당신의 레시피, 당신의 "1년 전 오늘" —
            <b> 당신의 숫자는 당신만 만들 수 있어요.</b> 시작은 오늘의 한 줄이에요.
          </div>
        </div>
      </div>

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

// 14개월 타임라인 스트립 — 6개 챕터 점 위치 표시.
function TimelineStrip() {
  const marks = [
    { pct: 0, lb: "day 1" },
    { pct: 5, lb: "3주" },
    { pct: 14, lb: "2개월" },
    { pct: 43, lb: "6개월" },
    { pct: 71, lb: "10개월" },
    { pct: 100, lb: "14개월" },
  ]
  return (
    <div style={{ marginTop: 18, position: "relative", height: 30 }}>
      <div style={{ position: "absolute", top: 5, left: 0, right: 0, borderTop: "1px dashed var(--line-2)" }} />
      {marks.map((m, i) => (
        <div key={i} style={{ position: "absolute", top: 0, left: `${m.pct}%`, transform: i === 0 ? "none" : i === marks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: i === marks.length - 1 ? "var(--brand)" : "var(--ink-3)", marginTop: 2, marginLeft: i === 0 ? 0 : i === marks.length - 1 ? "auto" : undefined }} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4, whiteSpace: "nowrap" }}>{m.lb}</div>
        </div>
      ))}
    </div>
  )
}

function Chapter({ n, when, title, children }: { n: number; when: string; title: string; children: ReactNode }) {
  return (
    <div style={{ padding: "28px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--bg)",
          background: "var(--brand)", padding: "2px 8px", letterSpacing: "0.08em",
        }}>CH {n} · {when}</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// 인사이트 카드 — "일지 원문 → 데이터 → 발견" 3단 구조의 분석 슬롯.
function InsightCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 10, padding: "12px 15px", border: "1px dashed var(--line-2)", background: "var(--paper-2)" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600, color: "var(--brand)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        INSIGHT <ExampleBadge />
      </div>
      {children}
    </div>
  )
}

// 2열 before/after 비교 (CH3 수면×RPE · CH5 RPE 드리프트 공용).
function CompareRow({ left, right }: {
  left: { label: string; value: string; note?: string }
  right: { label: string; value: string; note?: string }
}) {
  const cell = (c: { label: string; value: string; note?: string }, accent: boolean) => (
    <div style={{ padding: "8px 10px 6px 0" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 19, fontWeight: 500, marginTop: 3, color: accent ? "var(--brand)" : "var(--ink)" }}>{c.value}</div>
      {c.note && <div style={{ fontFamily: "var(--sans)", fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>{c.note}</div>}
    </div>
  )
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 8, borderTop: "1px solid var(--ink)" }}>
      {cell(left, false)}
      {cell(right, true)}
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
