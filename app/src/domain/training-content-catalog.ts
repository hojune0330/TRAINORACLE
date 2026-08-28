export type TrainingContentId =
  | "NORWEGIAN_DOUBLE_THRESHOLD"
  | "CRUISE_INTERVALS"
  | "ELITE_MARATHON_WEEK"

export type TrainingContentSourceState = "DIRECT_SOURCE_REOPENED" | "DISCOVERY_SOURCE_ONLY"

export type TrainingContentArticle = {
  readonly id: TrainingContentId
  readonly category: "요즘 해외 훈련법" | "훈련 개념" | "선수 사례"
  readonly title: string
  readonly shortTitle: string
  readonly summary: string
  readonly whyNoticed: string
  readonly whatItTrains: string
  readonly useBoundary: string
  readonly sourceLabel: string
  readonly sourceUrl: string
  readonly sourceGrade: "A_OBSERVED" | "B_TECHNICAL" | "C_MEDIA"
  readonly sourceState: TrainingContentSourceState
  readonly planEligibility: "NOT_PLAN_ELIGIBLE"
}

export const TRAINING_CONTENT_CATALOG = [
  {
    id: "NORWEGIAN_DOUBLE_THRESHOLD",
    category: "요즘 해외 훈련법",
    title: "노르웨이식 더블 스레숄드, 왜 자주 들릴까요?",
    shortTitle: "더블 스레숄드",
    summary: "하루 두 번 문턱 부근 훈련을 배치하는 엘리트 사례가 알려지며 주목받은 방식이에요.",
    whyNoticed: "유명 중장거리 선수들의 사례와 함께 ‘강한 날을 어떻게 통제하는가’라는 질문을 만들었어요. 이름만 보면 두 번 세게 달리는 방법처럼 보이지만, 실제 논의의 핵심은 강도를 제한하고 회복과 측정을 함께 관리하는 데 있어요.",
    whatItTrains: "주로 지속 페이스와 유산소 능력에 관한 사례로 소개돼요. 그러나 하루 두 세션의 간격, 선수의 훈련 연수, 전체 주간 부하가 빠지면 같은 이름이어도 완전히 다른 훈련이 됩니다.",
    useBoundary: "현재 TrainOracle에서는 읽고 저장만 할 수 있어요. 혼자 하는 선수나 청소년에게 하루 두 번 문턱 훈련을 기본 계획으로 넣지 않으며, 이 기사만으로 반복 수·페이스·회복을 만들지 않아요.",
    sourceLabel: "LetsRun Norwegian method 기사",
    sourceUrl: "https://www.letsrun.com/news/2023/06/from-norway-to-flagstaff-how-double-threshold-training-is-taking-over-the-world/",
    sourceGrade: "C_MEDIA",
    sourceState: "DISCOVERY_SOURCE_ONLY",
    planEligibility: "NOT_PLAN_ELIGIBLE",
  },
  {
    id: "CRUISE_INTERVALS",
    category: "훈련 개념",
    title: "크루즈 인터벌은 지속주와 무엇이 다를까요?",
    shortTitle: "크루즈 인터벌",
    summary: "지속 페이스 훈련을 여러 구간으로 나눠, 짧은 회복을 사이에 두는 구성으로 설명돼요.",
    whyNoticed: "한 번에 길게 유지하기 어려운 지속 페이스를 여러 구간으로 나누어 다루기 때문에 러너와 코치가 자주 비교하는 형태예요.",
    whatItTrains: "VDOT 자료는 문턱 강도와 크루즈 인터벌의 예시를 설명하지만, 그 숫자가 모든 선수의 처방은 아니에요. TrainOracle은 지속 페이스 목적과 짧게 나눈 구성을 이해하는 자료로만 사용합니다.",
    useBoundary: "현재는 훈련 개념 설명이에요. 개인 기록·경험·종목·주기 위치를 통과한 별도 템플릿이 승인되기 전에는 이 콘텐츠가 계획의 페이스나 반복 수를 정하지 않아요.",
    sourceLabel: "VDOT Threshold / Cruise 자료",
    sourceUrl: "https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/",
    sourceGrade: "B_TECHNICAL",
    sourceState: "DIRECT_SOURCE_REOPENED",
    planEligibility: "NOT_PLAN_ELIGIBLE",
  },
  {
    id: "ELITE_MARATHON_WEEK",
    category: "선수 사례",
    title: "엘리트 마라톤 한 주를 그대로 따라 하면 안 되는 이유",
    shortTitle: "엘리트 마라톤 한 주",
    summary: "공개된 엘리트 훈련 주간은 배울 자료이지만, 다른 선수의 다음 주 계획은 아니에요.",
    whyNoticed: "유명 선수의 거리·횟수·훈련 배치는 구체적이어서 따라 하고 싶은 마음을 만들어요. 동시에 고지대, 훈련 집단, 오랜 적응, 회복 환경처럼 표에 보이지 않는 조건이 많습니다.",
    whatItTrains: "공개 사례는 한 선수의 마라톤 준비에서 쉬운 달리기, 긴 달리기, 주요 훈련이 어떻게 함께 놓였는지 비교하는 데 도움이 됩니다.",
    useBoundary: "TrainOracle은 사례의 맥락을 소개할 수 있지만 거리·더블 세션·페이스를 복사하지 않아요. 개인 계획에는 별도로 승인된 템플릿과 선수 자신의 근거만 들어갑니다.",
    sourceLabel: "Sweat Elite Kipchoge 공개 사례",
    sourceUrl: "https://articles.sweatelite.co/eliud-kipchoge-a-typical-week-of-training-preparing-for-a-sub-2-hour-marathon/",
    sourceGrade: "A_OBSERVED",
    sourceState: "DIRECT_SOURCE_REOPENED",
    planEligibility: "NOT_PLAN_ELIGIBLE",
  },
] as const satisfies readonly TrainingContentArticle[]

export function trainingContentById(id: TrainingContentId): TrainingContentArticle {
  const article = TRAINING_CONTENT_CATALOG.find((candidate) => candidate.id === id)
  if (article === undefined) throw new RangeError(`Unknown training content: ${id}`)
  return article
}
