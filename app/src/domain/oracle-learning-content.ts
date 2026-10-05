import { GLOSSARY, TERM_CATEGORY_LABELS, type TermId } from "./glossary"
import type { OracleDestination } from "./oracle-content-catalog"
import { TRAINING_CONTENT_CATALOG, type TrainingContentArticle, type TrainingContentSourceState } from "./training-content-catalog"

export type OracleLearningDestination = Extract<OracleDestination, "GLOSSARY" | "EVIDENCE" | "QUIZ" | "EXAMPLE">
export const ORACLE_LEARNING_TITLES: Readonly<Record<OracleLearningDestination, string>> = {
  GLOSSARY: "훈련 용어 읽기", EVIDENCE: "근거와 워치 숫자 읽기", QUIZ: "한 문제로 배우기", EXAMPLE: "합성 일지 읽기",
}
export function isOracleLearningDestination(value: OracleDestination): value is OracleLearningDestination {
  return Object.prototype.hasOwnProperty.call(ORACLE_LEARNING_TITLES, value)
}

export type OracleLearningSource = Readonly<{ label: string; url: string; grade?: TrainingContentArticle["sourceGrade"]; state?: TrainingContentSourceState; scope?: string }>
export type OracleLearningPage = Readonly<{
  id: string; title: string; category: string; paragraphs: readonly string[]
  limitation?: string; sources?: readonly OracleLearningSource[]; reviewedAt?: string
  table?: Readonly<{ caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] }>
}>

// Same labels as TrainingContent; these describe source kinds, not effect certainty.
export const ORACLE_SOURCE_GRADE_LABELS: Readonly<Record<TrainingContentArticle["sourceGrade"], string>> = {
  A_OBSERVED: "공개된 선수 훈련 사례", B_TECHNICAL: "훈련 이론·기술 자료", C_MEDIA: "언론·커뮤니티 기사",
}
export const ORACLE_SOURCE_STATE_LABELS: Readonly<Record<TrainingContentSourceState, string>> = {
  DIRECT_SOURCE_REOPENED: "원문 확인 자료", DISCOVERY_SOURCE_ONLY: "추가 검토 중인 기사",
}
export const ORACLE_LEARNING_TERM_IDS = ["main", "lt", "phosphagen", "energy-system", "training-notation", "rpe"] as const satisfies readonly TermId[]
export const ORACLE_GLOSSARY_PAGES: readonly OracleLearningPage[] = ORACLE_LEARNING_TERM_IDS.map(id => {
  const entry = GLOSSARY[id]
  return { id, title: entry.code ? `${entry.label} · ${entry.code}` : entry.label,
    category: TERM_CATEGORY_LABELS[entry.category], paragraphs: [entry.short, ...(entry.detail ? [entry.detail] : [])],
    limitation: entry.notMeaning, sources: entry.sourceRefs, reviewedAt: entry.reviewedAt }
})

export const ORACLE_EVIDENCE_PAGES: readonly OracleLearningPage[] = [
  { id: "evidence-kinds", title: "무엇을 확인한 근거일까요?", category: "근거 읽기",
    paragraphs: ["기전 연구는 작동 방식을, 효과 연구는 정해진 대상과 개입 뒤 결과를 다룹니다. 코칭 판단과 선수 사례는 또 다른 종류의 근거예요.",
      "출처의 대상, 방법, 확인한 본문 범위를 주장과 함께 읽어요. 논문 링크나 계산 테스트만으로 개인 효과나 자체 질문의 타당성이 검증되지는 않아요."],
    limitation: "아래 등급은 기존 훈련 자료의 출처 구분이며, 개인 효과의 순위나 확실성 점수가 아니에요.",
    sources: GLOSSARY["energy-system"].sourceRefs },
  { id: "watch", title: "워치 예상과 실제 경기", category: "기기 자료의 출처",
    paragraphs: ["경기에서 실제 측정한 시간과 워치 모델이 예상한 경기 시간은 다른 자료예요. 기기 이름과 모델 버전, 입력 조건, 산출 날짜를 함께 확인해요.",
      "공식 기능 설명과 독립적인 정확도 검증도 구분해요. 공개되지 않은 계산식이나 두 값의 차이를 줄이는 개인 보정식을 만들어 내지 않아요."],
    limitation: "예상값을 실제 PB로 저장하거나 개인 보정식으로 사용하지 않아요. 이 자료는 개인 기기의 정확도 검증이 아니에요.",
    sources: [{ label: "Garmin Training Status 공식 지원", url: "https://support.garmin.com/en-GB/?faq=VxKazDQ2mkAmDoQbJriEBA",
      // reports/research/2026-10-04-oracle-content/12-measurement-and-interpretation.md, P13.
      scope: "검색 색인에서 입력 자료·기기별 조건 확인. 직접 HTML 재열기는 본문 없이 푸터만 표시" }] },
  ...TRAINING_CONTENT_CATALOG.map(article => ({ id: article.id, title: article.title, category: article.category,
    paragraphs: [article.summary, article.whatItTrains, ...(article.correctionNotice ? [article.correctionNotice] : [])],
    limitation: article.useBoundary, sources: [{ label: article.sourceLabel, url: article.sourceUrl,
      grade: article.sourceGrade, state: article.sourceState }], reviewedAt: article.publishedOn })),
]

// Editorial fixtures from oracle-content-reader H04-H06. Never personal records or prescriptions.
export const ORACLE_SYNTHETIC_NOTICE = "학습용 합성 예시예요. 실제 사용자 기록이나 개인 훈련 처방이 아니에요."
export const ORACLE_EXAMPLE_PAGES: readonly OracleLearningPage[] = [
  { id: "sessions", title: "같은 날, 서로 다른 두 세션", category: "합성 예시",
    paragraphs: ["같은 날 오전 5km, 오후 3km를 서로 다른 실제 세션으로 기록한 가상 사례예요.",
      "날짜 1일, 세션 2회, 기록된 거리 8km예요. 같은 기록을 두 번 받은 것이라면 중복을 먼저 제외해요."],
    limitation: "횟수나 거리만으로 신체 능력이나 훈련 효과를 평가하지 않아요.",
    table: { caption: "가상 일지의 두 세션", columns: ["시간대", "기록 거리"], rows: [["오전", "5km"], ["오후", "3km"]] } },
  { id: "repetitions", title: "목표 범위 안은 몇 회일까요?", category: "합성 예시",
    paragraphs: ["400m 6회의 목표가 90~94초였고 실제 시간이 92·91·93·94·92·95초인 가상 사례예요.",
      "경계를 포함하면 목표 범위 안은 6회 중 5회예요."],
    limitation: "회복 기록은 제시되지 않았으므로 회복 준수 여부는 미확인입니다. 마지막 반복이 늦어진 이유나 훈련 효과도 이 숫자만으로 알 수 없어요.",
    table: { caption: "가상 반복 기록 · 목표 90~94초", columns: ["반복", "실제", "범위 확인"],
      rows: [92, 91, 93, 94, 92, 95].map((seconds, index) => [`${index + 1}회`, `${seconds}초`, seconds <= 94 ? "범위 안" : "범위 밖"]) } },
  { id: "recovery", title: "같은 거리, 다른 회복 구성", category: "합성 예시",
    paragraphs: ["400m 4회 사이에 회복 60초를 둔 구성과, 400m 2회씩 두 세트로 나누고 세트 사이 별도 회복을 둔 구성은 구조가 달라요.",
      "두 예시의 운동 거리는 모두 1600m지만 회복이 같다는 뜻은 아니에요."],
    limitation: "구조 설명용 합성 예시이며 개인 처방이 아니에요. 전체 시간과 효과는 제시되지 않은 회복 정보만으로 계산하지 않아요.",
    table: { caption: "두 합성 구성 비교", columns: ["구성", "운동 거리", "회복 정보"], rows: [
      ["400m × 4회", "1600m", "반복 사이 60초"], ["400m × 2회 × 2세트", "1600m", "세트 사이 별도 회복 · 시간 미제시"],
    ] } },
]

export type OracleLearningQuiz = Readonly<{
  id: string; question: string; choices: readonly string[]; correctIndex: number; explanation: string; basis: string
}>
export const ORACLE_LEARNING_QUIZ: readonly OracleLearningQuiz[] = [
  { id: "sessions", question: "같은 날 오전 5km, 오후 3km를 서로 다른 세션으로 기록했어요. 어떻게 셀까요?",
    choices: ["날짜 2일 · 세션 2회 · 8km", "날짜 1일 · 세션 2회 · 8km", "날짜 1일 · 세션 1회 · 5km"], correctIndex: 1,
    explanation: ORACLE_EXAMPLE_PAGES[0]!.paragraphs[1]!, basis: "합성 일지 · 날짜와 세션 구분" },
  { id: "range", question: "목표 90~94초, 실제 92·91·93·94·92·95초예요. 경계를 포함해 범위 안은 몇 회일까요?",
    choices: ["4회", "5회", "6회"], correctIndex: 1,
    explanation: "94초도 범위에 포함하므로 6회 중 5회예요. 회복 기록이 없으므로 회복 준수 여부는 알 수 없어요.", basis: "합성 반복 기록 · 범위의 양 끝 포함" },
  { id: "role", question: "MAIN은 어떤 뜻일까요?",
    choices: ["일정에서 맡는 주요 훈련 역할", "측정된 에너지 공급 비율", "항상 전력질주하는 날"], correctIndex: 0,
    explanation: `${GLOSSARY.main.short} ${GLOSSARY.main.notMeaning}`, basis: `${TERM_CATEGORY_LABELS[GLOSSARY.main.category]} · ${GLOSSARY.main.label}` },
]
