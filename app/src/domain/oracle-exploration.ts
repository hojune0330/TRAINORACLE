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
    nextLabel: "어느 구간에서 차이가 났을까?",
    personalAction: "records",
    personalLabel: "내 기록 보기",
  },
  focus: {
    id: "focus",
    title: "강점·보완점",
    question: "잘 이어간 구간, 달라진 구간은?",
    teaser: "구간별 페이스에서 실마리 찾기",
    example: {
      headline: "전반은 일정했고, 후반에 느려졌어요",
      summary: "앞 두 구간은 4분 45초/km. 마지막 구간은 5분 10초/km였어요.",
      source: "가상 기록 · 5km 구간 페이스",
      rows: [
        { label: "1km", value: 285, valueLabel: "4:45/km" },
        { label: "2km", value: 285, valueLabel: "4:45/km" },
        { label: "3km", value: 290, valueLabel: "4:50/km" },
        { label: "4km", value: 300, valueLabel: "5:00/km" },
        { label: "5km", value: 310, valueLabel: "5:10/km" },
      ],
      unit: "초/km",
      detail: "설명을 위해 만든 1km 구간별 수치입니다. 페이스가 달라진 원인은 경사·날씨·체감강도 등을 함께 살펴야 하며, 이 기록만으로 지구력이나 근력을 판단하지 않아요.",
    },
    nextId: "priority",
    nextLabel: "다음 훈련에서는 무엇을 살펴볼까?",
    personalAction: "journal",
    personalLabel: "내 훈련 일지 보기",
  },
  compare: {
    id: "compare",
    title: "훈련 비교",
    question: "같은 거리를 달려도 무엇이 달랐을까?",
    teaser: "거리·시간·체감강도를 함께",
    example: {
      headline: "같은 5km, 달린 시간은 1분 차이",
      summary: "첫 훈련은 26분, 다음 훈련은 25분. 체감강도는 둘 다 5로 기록했어요.",
      source: "가상 기록 · 5km 훈련 2회",
      rows: [
        { label: "첫 훈련", value: 1560, valueLabel: "26분" },
        { label: "다음 훈련", value: 1500, valueLabel: "25분" },
      ],
      unit: "초",
      detail: "시간과 체감강도는 설명을 위해 만든 수치입니다. 같은 거리의 기록 차이이며, 코스·날씨·휴식 조건까지 같았다는 뜻은 아니에요.",
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
      headline: "기록한 훈련은 조깅이 가장 많아요",
      summary: "훈련 6회 중 조깅 4회, 인터벌과 근력운동은 각각 1회예요.",
      source: "가상 기록 · 한 주의 훈련 6회",
      rows: [
        { label: "조깅", value: 4, valueLabel: "4회" },
        { label: "인터벌", value: 1, valueLabel: "1회" },
        { label: "근력운동", value: 1, valueLabel: "1회" },
      ],
      unit: "회",
      detail: "설명을 위해 만든 훈련 종류와 횟수입니다. 직접 표시한 종류별 기록을 세었고 제외한 기록은 없어요. 횟수만으로 적정 비율이나 훈련 부족을 판단하지 않아요.",
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
      headline: "연습 목표 예시: 페이스 조절",
      summary: "초반과 후반의 페이스 차이를 살펴보는 목표예요. 다음 기록에서는 구간별 페이스와 체감강도를 함께 비교해요.",
      source: "가상 상황 · 연습 목표 예시",
      rows: [],
      unit: "",
      detail: "앞선 가상 구간 기록에서 이어지는 목표 선택 예시입니다. 개인에게 정해진 우선순위나 처방이 아니며, 거리·속도·반복 횟수는 제안하지 않아요.",
    },
    nextId: "mix",
    nextLabel: "최근 훈련 구성도 살펴볼까?",
    personalAction: "plan",
    personalLabel: "내 훈련 계획 보기",
  },
  change: {
    id: "change",
    title: "훈련 후 변화",
    question: "비슷한 훈련이 이번에는 어떻게 느껴졌을까?",
    teaser: "이전과 이후의 기록을 따라",
    example: {
      headline: "같은 거리·페이스, 체감강도는 7에서 5",
      summary: "두 훈련 모두 5km를 5분/km로 달린 가상 기록이에요.",
      source: "가상 기록 · 5km 훈련 2회",
      rows: [
        { label: "이전 훈련", value: 7, valueLabel: "7 / 10" },
        { label: "이후 훈련", value: 5, valueLabel: "5 / 10" },
      ],
      unit: "체감강도(RPE)",
      detail: "거리·페이스·체감강도는 설명을 위해 만든 수치입니다. 체감강도는 훈련 후 직접 기록하는 1~10의 값이에요. 그 차이만으로 훈련 효과나 변화의 원인을 확정하지 않아요.",
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
