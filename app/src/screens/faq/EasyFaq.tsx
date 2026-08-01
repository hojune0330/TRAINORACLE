import React from "react"

type FaqItem = {
  readonly question: string
  readonly answer: React.ReactNode
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "지금 무료인가요?",
    answer: "네. 첫 200명 베타는 무료로 사용할 수 있어요.",
  },
  {
    question: "나중에도 계속 무료인가요?",
    answer: "기본 무료 기능을 이어 가는 방향이지만, 운영 상황에 따라 상품 구성이 바뀔 수 있어요. 바뀌기 전에는 앱에서 먼저 알려드려요.",
  },
  {
    question: "나중에 월 구독이나 광고가 생길 수 있나요?",
    answer: "TrainOracle 베타는 현재 무료입니다. 서비스 운영을 위해 나중에 월 구독이나 광고가 포함된 선택 상품이 생길 수 있습니다. 가격이나 무료 기능이 바뀌기 전에는 앱에서 먼저 알려드립니다.",
  },
  {
    question: "무료 기능이 갑자기 사라지나요?",
    answer: "갑자기 바꾸지 않아요. 중요한 변경은 적용 전에 앱에서 알려드려요.",
  },
  {
    question: "내 일지와 메모는 누가 볼 수 있나요?",
    answer: "기본은 사용자 본인만 봐요. 연결한 코치·지원자에게 보여 줄 범위는 사용자가 정하고, 나만의 메모는 공유하지 않아요.",
  },
  {
    question: "나만의 메모는 서비스 운영자도 볼 수 없나요?",
    answer: "네. 나만의 메모는 기기에서 암호화해 저장해요. 복구 코드를 가진 사용자만 다시 읽을 수 있고 서비스 운영자는 대신 복구할 수 없어요.",
  },
  {
    question: "코치는 무엇을 볼 수 있나요?",
    answer: "사용자가 연결한 동안 훈련 기록, 훈련 메모, 통증, 기분, 몸 상태를 볼 수 있어요. 나만의 메모는 볼 수 없어요.",
  },
  {
    question: "코치는 실제 자격을 확인한 사람인가요?",
    answer: "아닐 수 있어요. 누구나 사용자의 초대를 받아 코치·지원자가 될 수 있고, 확인되지 않은 사람은 자격 미확인으로 표시해요.",
  },
  {
    question: "훈련계획은 자동으로 바뀌나요?",
    answer: "아니요. 코치가 바꾸거나 달력에서 옮겨도 먼저 제안으로 남아요. 선수가 확인해야 새 계획이 시작돼요.",
  },
  {
    question: "위험 경고가 뜨면 운동하면 안 되나요?",
    answer: "경고는 의료 진단이 아니에요. 이유와 더 보수적인 선택을 확인한 뒤 사용자가 다시 선택할 수 있고, 확인 기록은 남아요.",
  },
  {
    question: "만 14세 미만은 왜 보호자 확인이 필요한가요?",
    answer: "어린 사용자의 개인정보와 공유 범위를 지키기 위한 법적 절차예요. 보호자 확인 전에는 계정 동기화와 다른 사람 공유를 열지 않아요.",
  },
  {
    question: "계정을 삭제하면 데이터도 없어지나요?",
    answer: "삭제를 요청하면 계정 접근을 바로 막고, 서버와 백업의 계정 데이터는 30일 안에 삭제해요. 기기에만 있는 기록은 기기에서 따로 지울 수 있어요.",
  },
  {
    question: "포인트를 돈으로 바꿀 수 있나요?",
    answer: "아니요. 베타 포인트는 테마, 스티커, 아바타처럼 일지를 꾸미는 데만 써요. 다른 사람에게 보내거나 현금으로 바꿀 수 없어요.",
  },
]

export function EasyFaq() {
  return (
    <section aria-labelledby="easy-faq-title" style={{ padding: "30px 20px 0" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
        FAQ · 쉬운 안내
      </div>
      <h2 id="easy-faq-title" style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 600, margin: "6px 0 0" }}>
        궁금한 점을 쉽게 풀어드려요
      </h2>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-3)", margin: "8px 0 16px" }}>
        이 페이지는 쉬운 설명이에요. 정확한 내용은 개인정보 처리방침과 이용 안내에서 확인할 수 있어요.
      </p>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} style={{ borderBottom: "1px solid var(--line)", padding: "2px 0" }}>
            <summary style={{ minHeight: 48, display: "flex", alignItems: "center", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600 }}>
              {item.question}
            </summary>
            <div style={{ padding: "0 0 14px", fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)" }}>
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
