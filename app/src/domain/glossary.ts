/**
 * glossary.ts — 용어 사전 (단일 소스)
 *
 * 목적: 중학생·비전문가도 화면의 전문 용어를 이해할 수 있도록,
 * 용어를 쉬운 말로 "바꾸지 않고" 원래 용어 옆에서 설명한다.
 * (용어를 바꾸면 훈련 기록의 정확성·전달력이 흐려질 수 있음 — 총책임자 결정)
 *
 * 안전 규칙:
 * - REVIEW/D9 계열 설명은 "진단·의료 판정이 아님"을 반드시 포함한다.
 * - CYCLE_DAY(D-*) 설명은 "규칙 번호가 아니라 달력 위치"임을 명시한다 (C5 namespace 규율).
 * - 설명 문구가 안전 차단을 완화·우회하는 인상을 주면 안 된다.
 */

export type TermId =
  | "rpe"
  | "pace"
  | "energy-system"
  | "base"
  | "lt"
  | "vo2"
  | "gly"
  | "atp"
  | "pb"
  | "sb"
  | "drift"
  | "review"
  | "cycle-day"
  | "lap"
  | "zone2"

export interface GlossaryEntry {
  /** 화면에 쓰는 원래 표기 */
  label: string
  /** 한 줄 풀이 (쉬운 말) */
  short: string
  /** 필요 시 추가 설명 (선택) */
  detail?: string
  /** 안전 관련 용어 여부 — 설명 카드에 안전 문구 스타일 적용 */
  safety?: boolean
}

export const GLOSSARY: Record<TermId, GlossaryEntry> = {
  rpe: {
    label: "RPE",
    short: "운동이 얼마나 힘들었는지 스스로 매기는 점수예요. 1은 아주 편함, 10은 한계까지 힘듦.",
    detail: "기계 측정이 아니라 내 몸의 느낌이 기준이에요. 같은 훈련도 컨디션에 따라 점수가 달라질 수 있어요.",
  },
  pace: {
    label: "페이스",
    short: "1km를 가는 데 걸리는 시간이에요. 예: 3'24\"는 1km를 3분 24초에 달렸다는 뜻.",
  },
  "energy-system": {
    label: "강도 시스템",
    short: "이 훈련이 몸의 어떤 능력을 단련하는지 고르는 분류예요.",
    detail:
      "BA(기초 지구력: 편하게 오래) · LT(역치: 숨이 가빠지기 시작하는 경계 속도) · V2(최대 산소: 아주 힘든 고강도) · GL(스피드 지구력: 짧고 빠르게) · AP(순간 파워: 몇 초 전력 질주) · RE(휴식)",
  },
  base: {
    label: "BASE",
    short: "기초 지구력 훈련. 대화할 수 있을 만큼 편한 속도로 오래 달리는 거예요.",
  },
  lt: {
    label: "LT",
    short: "젖산 역치(Lactate Threshold). 숨이 확 가빠지기 시작하는 경계 속도 근처에서 하는 훈련이에요.",
  },
  vo2: {
    label: "VO2",
    short: "심장과 폐를 최대 가까이 쓰는 아주 힘든 고강도 훈련이에요. (최대 산소 섭취량 자극)",
  },
  gly: {
    label: "GLY",
    short: "짧고 아주 빠른 스피드 훈련이에요. (해당계 에너지 사용)",
  },
  atp: {
    label: "ATP",
    short: "몇 초 안에 폭발적으로 힘을 쓰는 훈련이에요. 전력 질주, 점프 같은 것.",
  },
  pb: {
    label: "PB",
    short: "Personal Best — 그 종목에서 지금까지 내 인생 최고 기록이에요.",
  },
  sb: {
    label: "SB",
    short: "Season Best — 이번 시즌(올해) 최고 기록이에요.",
  },
  drift: {
    label: "드리프트",
    short: "같은 힘으로 달리는데 뒤로 갈수록 구간 기록이 조금씩 느려지는 현상이에요.",
    detail: "피로가 쌓이고 있다는 신호일 수 있어서, 앱이 정해진 폭을 넘으면 경고로 알려줘요.",
  },
  review: {
    label: "REVIEW",
    short: "통증 신호가 있으니 잠시 멈추고 확인하자는 안전 표시예요.",
    detail:
      "앱이 부상을 진단하는 것이 아니에요. 아픈 정도가 높게 기록되면 코치·본인이 직접 확인하도록 표시만 해주는 거예요. 이 표시는 훈련 계획 생성과는 별개로 사람이 판단해요.",
    safety: true,
  },
  "cycle-day": {
    label: "사이클 일차",
    short: "9.5일짜리 훈련 사이클에서 오늘이 몇 번째 날인지예요. 예: D-6은 6번째 날.",
    detail: "안전 규칙 번호(R-1~R-9)와는 전혀 달라요. 그냥 달력 위치라고 생각하면 돼요.",
    safety: true,
  },
  lap: {
    label: "랩",
    short: "구간 기록이에요. 예: 1000m를 6번 뛰면 1000m 하나하나가 랩이에요.",
  },
  zone2: {
    label: "Z2",
    short: "존2 — 편안하게 오래 갈 수 있는 유산소 강도 구간이에요.",
  },
}
