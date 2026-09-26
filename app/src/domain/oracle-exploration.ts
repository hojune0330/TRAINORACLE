export type OracleTopicId = "level" | "focus" | "compare" | "mix" | "priority" | "change"

export interface OracleTopic {
  id: OracleTopicId
  title: string
  question: string
  teaser: string
  example: {
    headline: string
    summary: string
    source: string
    rows: readonly { label: string; value: number; valueLabel: string }[]
    unit: string
    detail: string
  }
  nextId: OracleTopicId
  nextLabel: string
  personalAction: "records" | "journal" | "trends" | "plan"
  personalLabel: string
}

// Authored, fictional examples only. This catalog never reads athlete records,
// journals or storage, and its values are not inputs to analysis or prescriptions.
const TOPICS_BY_ID: Record<OracleTopicId, OracleTopic> = {
  level: {
    id: "level",
    title: "현재 수준",
    question: "지금 내 기록은 어디쯤일까?",
    teaser: "같은 종목의 기록을 나란히",
    example: {
      headline: "최근 5km 기록은 24분 10초",
      summary: "앞선 기록 24분 40초보다 30초 짧아요.",
      source: "가상 기록 · 5km 기록 2회",
      rows: [
        { label: "앞선 기록", value: 1480, valueLabel: "24분 40초" },
        { label: "최근 기록", value: 1450, valueLabel: "24분 10초" },
      ],
      unit: "초",
      detail: "설명을 위해 만든 수치입니다. 같은 종목의 두 기록을 비교한 예시이며, 다른 선수와의 순위나 현재 체력을 판정하지 않아요.",
    },
    nextId: "focus",
    nextLabel: "계획 강도와 실제 느낌은 어땠을까?",
    personalAction: "records",
    personalLabel: "내 기록 보기",
  },
  focus: {
    id: "focus",
    title: "강점·보완점",
    question: "계획보다 더 힘들게 느껴진 훈련은?",
    teaser: "계획 강도와 실제 느낌을 나란히",
    example: {
      headline: "계획 RPE 5, 실제 느낌은 7",
      summary: "계획에 연결한 일지의 체감강도를 비교한 예시예요.",
      source: "가상 기록 · 계획과 연결 일지",
      rows: [
        { label: "계획", value: 5, valueLabel: "RPE 5" },
        { label: "실제", value: 7, valueLabel: "RPE 7" },
      ],
      unit: "RPE",
      detail: "설명용 가상 수치입니다. 계획과 실제 느낌의 차이만 비교하며 강점·약점이나 차이의 원인을 진단하지 않아요. 개인 화면도 현재 계획과 연결 일지를 사용해요.",
    },
    nextId: "priority",
    nextLabel: "다음 훈련에서는 무엇을 살펴볼까?",
    personalAction: "journal",
    personalLabel: "내 훈련 일지 보기",
  },
  compare: {
    id: "compare",
    title: "훈련 비교",
    question: "최근 두 달, 한 번에 달린 거리는?",
    teaser: "월별 훈련 거리의 중간값 비교",
    example: {
      headline: "한 번에 달린 거리, 중간값은 5km와 6km",
      summary: "지난달과 이번 달의 훈련 거리 중앙값을 비교한 예시예요.",
      source: "가상 기록 · 두 달의 훈련 거리",
      rows: [
        { label: "지난달", value: 5, valueLabel: "5 km" },
        { label: "이번 달", value: 6, valueLabel: "6 km" },
      ],
      unit: "km",
      detail: "설명용 가상 수치입니다. 한 달의 각 훈련 거리를 순서대로 놓았을 때 중간값이며 월간 총거리나 같은 거리 세션끼리의 속도 비교가 아니에요. 개인 화면에서도 이 기준을 사용해요.",
    },
    nextId: "change",
    nextLabel: "체감강도도 달라졌을까?",
    personalAction: "journal",
    personalLabel: "내 훈련 일지 보기",
  },
  mix: {
    id: "mix",
    title: "훈련 구성",
    question: "최근에는 어떤 훈련을 많이 했을까?",
    teaser: "기록한 훈련 종류를 한눈에",
    example: {
      headline: "직접 표시한 훈련은 BASE가 가장 많아요",
      summary: "계열을 직접 표시한 일지 6건 중 BASE 4건, LT와 VO2가 각각 1건인 예시예요.",
      source: "가상 기록 · 직접 표시한 계열 6건",
      rows: [
        { label: "기초 지구력 · BASE", value: 4, valueLabel: "4건" },
        { label: "지속 페이스 · LT", value: 1, valueLabel: "1건" },
        { label: "강한 유산소 반복 · VO2", value: 1, valueLabel: "1건" },
      ],
      unit: "건",
      detail: "설명용 가상 기록입니다. 직접 표시한 훈련 분류별 일지 수를 세었고 제외한 기록은 없어요. 운동 시간이나 생리학적 기여율은 아니며, 건수만으로 적정 비율이나 부족한 능력을 판단하지 않아요.",
    },
    nextId: "compare",
    nextLabel: "각 훈련은 어떻게 달랐을까?",
    personalAction: "trends",
    personalLabel: "내 훈련 분석 보기",
  },
  priority: {
    id: "priority",
    title: "우선 훈련",
    question: "다음 훈련의 초점은 무엇으로 잡을까?",
    teaser: "살펴본 기록에서 연습 목표로",
    example: {
      headline: "다음 계획 전에 실제 느낌을 확인해요",
      summary: "현재 계획과 연결 일지의 체감강도를 살펴보는 예시예요. 기록만으로 다음 훈련을 자동 변경하지 않아요.",
      source: "가상 상황 · 현재 계획 검토",
      rows: [],
      unit: "",
      detail: "개인 화면은 현재 계획에 연결된 일지의 비교 상태를 보여줘요. 개인에게 정해진 우선순위나 처방이 아니며, 거리·속도·반복 횟수를 새로 제안하지 않아요.",
    },
    nextId: "mix",
    nextLabel: "최근 훈련 구성도 살펴볼까?",
    personalAction: "plan",
    personalLabel: "내 훈련 계획 보기",
  },
  change: {
    id: "change",
    title: "훈련 후 변화",
    question: "최근 두 달의 체감강도는 어땠을까?",
    teaser: "월별 RPE의 중간값 비교",
    example: {
      headline: "월별 체감강도 중간값은 7과 5",
      summary: "지난달과 이번 달의 RPE 중앙값을 비교한 가상 기록이에요. 같은 훈련끼리의 비교는 아니에요.",
      source: "가상 기록 · 두 달의 RPE",
      rows: [
        { label: "지난달", value: 7, valueLabel: "7 / 10" },
        { label: "이번 달", value: 5, valueLabel: "5 / 10" },
      ],
      unit: "체감강도(RPE)",
      detail: "설명용 가상 수치입니다. 각 달에 직접 적은 체감강도(RPE)의 중간값을 비교해요. 두 달에 한 운동의 종류나 양은 다를 수 있으므로 이 차이만으로 훈련 효과나 변화의 원인을 확정하지 않아요.",
    },
    nextId: "level",
    nextLabel: "종목 기록에도 변화가 있을까?",
    personalAction: "trends",
    personalLabel: "내 훈련 분석 보기",
  },
}

export const ORACLE_TOPICS: readonly OracleTopic[] = [
  TOPICS_BY_ID.level,
  TOPICS_BY_ID.focus,
  TOPICS_BY_ID.compare,
  TOPICS_BY_ID.mix,
  TOPICS_BY_ID.priority,
  TOPICS_BY_ID.change,
]

export function isOracleTopicId(value: unknown): value is OracleTopicId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TOPICS_BY_ID, value)
}

export function getOracleTopic(id: OracleTopicId): OracleTopic {
  return TOPICS_BY_ID[id]
}
