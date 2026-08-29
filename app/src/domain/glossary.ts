/**
 * Athlete-facing training terminology. This is the runtime single source for
 * short help, the full lexicon, energy labels and future learning content.
 * Stored enum values and rule semantics must never be inferred from this copy.
 */

export type TermCategory =
  | "SCHEDULE_ROLE"
  | "TRAINING_INTENT"
  | "ENERGY_METABOLISM"
  | "FUEL_AND_RESPONSE"
  | "INTENSITY_AND_RECORD"
  | "TRAINING_STRUCTURE"
  | "PERIODIZATION"
  | "APP_AND_SAFETY"

export const TERM_CATEGORY_LABELS: Readonly<Record<TermCategory, string>> = {
  SCHEDULE_ROLE: "일정에서 맡는 역할",
  TRAINING_INTENT: "훈련 목적",
  ENERGY_METABOLISM: "몸이 에너지를 만드는 경로",
  FUEL_AND_RESPONSE: "연료와 몸의 반응",
  INTENSITY_AND_RECORD: "강도와 기록",
  TRAINING_STRUCTURE: "훈련 구성",
  PERIODIZATION: "훈련 주기",
  APP_AND_SAFETY: "앱 사용과 안전 표시",
}

export type TermId =
  | "rpe" | "pace" | "energy-system"
  | "main" | "base" | "rec" | "off" | "lt" | "vo2" | "gly" | "atp" | "mix"
  | "phosphagen" | "glycolytic" | "oxidative" | "fat-metabolism" | "carbohydrate-metabolism" | "lactate"
  | "pb" | "sb" | "drift" | "review" | "cycle-day" | "lap" | "zone2"
  | "interval" | "repetition" | "set" | "recovery-time"
  | "microcycle" | "mesocycle" | "macrocycle" | "taper"
  | "plan-goal" | "competition-division" | "plan-experience" | "training-days"
  | "plan-frame" | "two-a-day" | "plan-beta-basis" | "plan-option"
  | "quality-session" | "training-notation"

export function isTermId(value: string | null): value is TermId {
  return value !== null && Object.prototype.hasOwnProperty.call(GLOSSARY, value)
}

export interface GlossaryEntry {
  readonly label: string
  readonly code?: string
  readonly category: TermCategory
  readonly aliases?: readonly string[]
  readonly short: string
  readonly namingOrigin?: string
  readonly technicalDefinition?: string
  readonly pathwayContext?: string
  readonly lactateContext?: string
  readonly substrateContext?: string
  readonly notMeaning?: string
  readonly trainOracleUsage?: string
  readonly examples?: readonly string[]
  readonly relatedTerms?: readonly TermId[]
  readonly sourceRefs?: readonly { readonly label: string; readonly url: string }[]
  readonly reviewedAt?: string
  /** Legacy-compatible expanded text. Prefer the structured fields above. */
  readonly detail?: string
  readonly safety?: boolean
}

const SOURCES = {
  interaction: { label: "에너지 시스템 상호작용 개요", url: "https://pubmed.ncbi.nlm.nih.gov/21188163/" },
  review: { label: "운동 중 에너지 기여도 체계적 문헌고찰", url: "https://pubmed.ncbi.nlm.nih.gov/41965479/" },
  lactate: { label: "젖산 셔틀과 유산소 대사", url: "https://pubmed.ncbi.nlm.nih.gov/32444344/" },
  substrate: { label: "운동 중 탄수화물·지방 산화", url: "https://pubmed.ncbi.nlm.nih.gov/32747792/" },
  terminology: { label: "무산소성 대사 용어와 상호작용", url: "https://pubmed.ncbi.nlm.nih.gov/11547894/" },
} as const

export const GLOSSARY: Record<TermId, GlossaryEntry> = {
  rpe: {
    label: "운동 자각도", code: "RPE", category: "INTENSITY_AND_RECORD", aliases: ["주관 강도", "힘든 정도"],
    short: "운동이 얼마나 힘들었는지 내 몸의 느낌으로 매기는 1~10점이에요. 심박계 수치와는 다른 기록입니다.",
    namingOrigin: "Rate of Perceived Exertion의 머리글자를 따서 RPE라고 불러요.",
    technicalDefinition: "1~2는 회복 움직임, 3~4는 대화 가능한 쉬운 유산소, 5는 꾸준한 노력, 6은 짧은 문장만 가능한 수준, 7은 몇 마디만 가능한 고강도, 8은 매우 힘든 짧은 반복, 9는 거의 최대인 짧은 노력, 10은 최대 노력에 가까운 느낌으로 사용합니다.",
    notMeaning: "심박수 구간이나 의료 판정이 아니며, 같은 운동도 그날 상태에 따라 다르게 느낄 수 있어요.",
    trainOracleUsage: "선수가 직접 고른 값만 일지와 계획 진행 기록에 사용해요.",
    relatedTerms: ["zone2", "pace"], reviewedAt: "2026-08-29",
  },
  pace: {
    label: "페이스", category: "INTENSITY_AND_RECORD", aliases: ["분/km", "목표 페이스"],
    short: "일정한 거리를 달리는 데 걸리는 시간이에요. 예: 3분24초/km는 1km를 3분24초에 달린다는 뜻입니다.",
    namingOrigin: "달리기 속도를 거리당 시간으로 말하는 육상·러닝의 일반적인 표현이에요.",
    notMeaning: "모든 반복을 반드시 같은 시간에 통과해야 한다는 뜻은 아니며, 회복·RPE도 함께 봐야 해요.",
    relatedTerms: ["lap", "pb", "sb"], reviewedAt: "2026-08-29",
  },
  "energy-system": {
    label: "훈련 목적과 에너지 대사", category: "ENERGY_METABOLISM", aliases: ["에너지 시스템", "강도 시스템"],
    short: "훈련 목적을 구분하고 몸이 에너지를 만드는 방식을 이해하기 위한 설명이에요. 앱이 몸속 대사를 측정했다는 뜻은 아닙니다.",
    namingOrigin: "운동할 때 ATP를 다시 만드는 여러 대사 경로를 설명하려고 에너지 시스템이라는 이름을 사용해요.",
    technicalDefinition: "인원질, 해당과정, 산화 대사는 항상 함께 작동하며 운동 시간·강도·회복 상태에 따라 기여가 달라집니다.",
    notMeaning: "한 훈련이 오직 한 시스템만 사용하거나 화면의 이름이 생리학적 기여도를 측정했다는 뜻이 아니에요.",
    trainOracleUsage: "계획한 목적과 선수가 직접 기록한 목적을 분리해 누적해요.",
    relatedTerms: ["phosphagen", "glycolytic", "oxidative", "lactate"],
    sourceRefs: [SOURCES.interaction, SOURCES.review], reviewedAt: "2026-08-29",
  },

  main: {
    label: "주요 훈련", code: "MAIN", category: "SCHEDULE_ROLE", aliases: ["핵심 훈련"],
    short: "이번 훈련 주기에서 준비 목표를 가장 직접적으로 다루는 훈련이에요.",
    namingOrigin: "하루의 본운동 또는 한 주기의 중심 훈련을 구분하려고 MAIN이라고 표시해요.",
    notMeaning: "항상 전력질주하거나 가장 오래 달리는 날이라는 뜻은 아니에요.",
    trainOracleUsage: "LT·VO₂·GLY·ATP-PC·MIX 중 계획 목적을 함께 표시해요.", relatedTerms: ["lt", "vo2", "gly", "atp", "mix"], reviewedAt: "2026-08-29",
  },
  base: {
    label: "기초 지구력", code: "BASE", category: "TRAINING_INTENT", aliases: ["이지런", "쉬운 달리기", "기본 유산소"],
    short: "땀이 나도 친구와 대화하거나 전화 통화가 가능한 RPE 3~4 정도의 쉬운 유산소 달리기예요.",
    namingOrigin: "다른 훈련을 오래 이어 갈 수 있는 기초를 만든다는 뜻에서 BASE라고 불러요.",
    pathwayContext: "주로 산화 대사의 기여가 큰 강도지만 세 에너지 경로는 모두 함께 작동해요.",
    substrateContext: "탄수화물과 지방을 모두 사용하며 비율은 속도·시간·훈련 상태에 따라 달라져요.",
    notMeaning: "워치의 Zone 2와 완전히 같은 뜻이거나 지방만 사용하는 훈련은 아니에요.",
    relatedTerms: ["oxidative", "fat-metabolism", "zone2", "rpe"], sourceRefs: [SOURCES.interaction, SOURCES.substrate], reviewedAt: "2026-08-29",
  },
  rec: {
    label: "회복 운동", code: "REC", category: "SCHEDULE_ROLE", aliases: ["리커버리", "Recovery"],
    short: "빠른 걷기·아주 가벼운 조깅·느린 자전거처럼 RPE 1~2로 편하게 움직이는 운동이에요.",
    namingOrigin: "Recovery의 줄임말로, 다음 훈련을 위한 낮은 부담의 움직임을 뜻해요.",
    notMeaning: "놓친 고강도 훈련을 보충하거나 통증이 회복됐다고 판정하는 날이 아니에요.", relatedTerms: ["rpe", "off"], reviewedAt: "2026-08-29",
  },
  off: {
    label: "훈련 없음", code: "OFF", category: "SCHEDULE_ROLE", aliases: ["완전 휴식", "휴식일"],
    short: "계획표에 달리기나 회복 운동을 따로 배치하지 않은 날이에요.",
    namingOrigin: "훈련 일정에서 제외된 날을 짧게 OFF라고 표시해요.",
    notMeaning: "놓친 훈련을 몰아서 하는 날이 아니며 일상 움직임까지 금지한다는 뜻도 아니에요.", relatedTerms: ["rec"], reviewedAt: "2026-08-29",
  },
  lt: {
    label: "지속 페이스", code: "LT", category: "TRAINING_INTENT", aliases: ["젖산 역치", "Lactate Threshold", "유산소 젖산"],
    short: "조금 힘든 느낌을 비교적 일정하게 유지하는 훈련 목적이에요.",
    namingOrigin: "LT는 Lactate Threshold의 줄임말이에요. 운동 강도가 높아질 때 혈중 젖산 반응이 달라지는 지점을 연구할 때 쓰는 말입니다.",
    lactateContext: "유산소 상태에서도 젖산은 만들어지고 다시 연료로 사용돼요. 그래서 '유산소 젖산'을 별도 에너지 시스템으로 나누지 않아요.",
    notMeaning: "검사 없이 정확한 역치 속도를 측정했다는 뜻이 아니며 한 번의 고정 경계로 모든 선수를 설명하지 않아요.",
    trainOracleUsage: "검사값이 없으면 RPE와 말하기 정도로 안내하고 개인 페이스를 임의로 만들지 않아요.",
    relatedTerms: ["lactate", "oxidative", "rpe"], sourceRefs: [SOURCES.lactate], reviewedAt: "2026-08-29",
  },
  vo2: {
    label: "강한 유산소 반복", code: "VO₂", category: "TRAINING_INTENT", aliases: ["VO2", "최대산소섭취량", "고산소 시스템"],
    short: "숨이 많이 차는 구간과 회복 구간을 반복해 강한 유산소 능력을 준비하는 훈련 목적이에요.",
    namingOrigin: "VO₂는 몸이 사용하는 산소량을 뜻해요. 이 이름의 훈련은 높은 산소 이용이 필요한 강도를 다룹니다.",
    pathwayContext: "산화 대사의 기여가 매우 크지만 짧고 강한 구간에서는 인원질과 해당과정도 함께 작동해요.",
    notMeaning: "앱이 최대산소섭취량을 측정했거나 매번 최대 노력으로 달리라는 뜻이 아니에요. '고산소 시스템'은 표준 시스템 이름으로 쓰지 않아요.",
    relatedTerms: ["oxidative", "interval", "rpe"], sourceRefs: [SOURCES.review], reviewedAt: "2026-08-29",
  },
  gly: {
    label: "짧은 고강도 반복", code: "GLY", category: "TRAINING_INTENT", aliases: ["해당계", "무산소 젖산", "Glycolytic"],
    short: "짧고 강한 구간을 충분한 회복과 함께 반복해 해당과정의 부담을 다루는 훈련 목적이에요.",
    namingOrigin: "GLY는 Glycolytic의 줄임말로, 포도당을 분해해 ATP를 만드는 해당과정에서 가져온 이름이에요.",
    pathwayContext: "해당과정의 기여가 커질 수 있지만 인원질과 산화 대사도 동시에 작동해요.",
    lactateContext: "젖산은 단순한 노폐물이 아니며 다른 조직에서 다시 연료로 쓰일 수 있어요. '무산소 젖산'은 익숙한 옛 표현으로만 함께 검색됩니다.",
    substrateContext: "주요 출발 연료는 탄수화물 계열이지만 화면만으로 실제 사용 비율을 측정할 수 없어요.",
    notMeaning: "스피드 자체를 뜻하지 않으며 모든 빠른 달리기를 GLY로 분류하지 않아요.",
    relatedTerms: ["glycolytic", "lactate", "carbohydrate-metabolism"], sourceRefs: [SOURCES.lactate, SOURCES.terminology], reviewedAt: "2026-08-29",
  },
  atp: {
    label: "스피드·가속", code: "ATP-PC", category: "TRAINING_INTENT", aliases: ["인원질", "ATP", "무산소 비젖산", "Phosphagen"],
    short: "매우 짧은 스피드·가속 구간과 충분한 회복을 다루는 훈련 목적이에요.",
    namingOrigin: "근육에 저장된 ATP와 인산크레아틴(PCr)을 빠르게 사용하는 경로에서 ATP-PC라는 이름이 왔어요.",
    pathwayContext: "인원질 경로의 기여가 큰 짧은 동작이지만 다른 대사 경로도 바로 함께 작동해요.",
    lactateContext: "'무산소 비젖산'은 익숙한 옛 표현이지만 젖산이 전혀 없다는 뜻으로 사용하지 않아요.",
    notMeaning: "현재 베타가 100m·200m·400m 전용 스프린트 처방이나 전력질주 횟수를 자동으로 정한다는 뜻이 아니에요.",
    relatedTerms: ["phosphagen", "recovery-time", "rpe"], sourceRefs: [SOURCES.interaction, SOURCES.terminology], reviewedAt: "2026-08-29",
  },
  mix: {
    label: "여러 강도 조합", code: "MIX", category: "TRAINING_INTENT", aliases: ["Mixed", "복합 훈련", "미배분"],
    short: "한 가지 훈련 목적만 고정하지 않고 여러 강도 구간을 함께 다루는 주요 훈련이에요.",
    namingOrigin: "여러 목적을 함께 다루거나 아직 한 목적에 정확히 배분하지 않은 경우 MIX라고 표시해요.",
    notMeaning: "무작위로 강도를 섞거나 에너지 기여 비율을 추측했다는 뜻이 아니에요.", relatedTerms: ["energy-system", "main"], reviewedAt: "2026-08-29",
  },

  phosphagen: {
    label: "인원질 경로", code: "ATP-PCr", category: "ENERGY_METABOLISM", aliases: ["포스파겐", "Phosphagen", "무산소 비젖산"],
    short: "근육에 저장된 ATP와 인산크레아틴을 이용해 매우 빠르게 에너지를 공급하는 경로예요.",
    namingOrigin: "고에너지 인산 결합을 가진 물질을 이용해 ATP를 빠르게 다시 만든다는 뜻이에요.",
    technicalDefinition: "시작과 매우 짧고 강한 동작에서 기여가 크며 회복 중에 저장량이 다시 채워집니다.",
    notMeaning: "단독으로 켜졌다 꺼지는 시스템이거나 젖산이 전혀 생기지 않는다는 뜻은 아니에요.", relatedTerms: ["atp", "glycolytic", "oxidative"], sourceRefs: [SOURCES.interaction], reviewedAt: "2026-08-29",
  },
  glycolytic: {
    label: "해당과정", category: "ENERGY_METABOLISM", aliases: ["해당계", "Glycolytic pathway", "무산소 젖산"],
    short: "포도당이나 글리코겐을 분해해 비교적 빠르게 ATP를 만드는 대사 경로예요.",
    namingOrigin: "Glycolysis는 포도당을 쪼갠다는 뜻에서 나온 이름이에요.",
    technicalDefinition: "산소 공급과 무관하게 세포질에서 진행되며 강한 운동에서 에너지 공급 기여가 커질 수 있어요.",
    notMeaning: "산소가 있는 동안 멈추거나 젖산을 노폐물로만 만든다는 뜻은 아니에요.", relatedTerms: ["gly", "lactate", "carbohydrate-metabolism"], sourceRefs: [SOURCES.lactate, SOURCES.terminology], reviewedAt: "2026-08-29",
  },
  oxidative: {
    label: "산화 대사", category: "ENERGY_METABOLISM", aliases: ["유산소 시스템", "Oxidative", "고산소 시스템"],
    short: "산소를 이용해 탄수화물과 지방 등에서 ATP를 만드는 지속적인 대사 경로예요.",
    namingOrigin: "미토콘드리아에서 연료를 산화하고 산소를 사용해 ATP를 만든다는 뜻이에요.",
    technicalDefinition: "쉬운 운동부터 고강도 운동까지 계속 작동하며 운동 시간이 길수록 중요한 기여를 합니다.",
    notMeaning: "느린 운동에만 쓰이거나 지방만 태우는 별도 시스템은 아니에요.", relatedTerms: ["base", "vo2", "fat-metabolism", "carbohydrate-metabolism"], sourceRefs: [SOURCES.interaction, SOURCES.substrate], reviewedAt: "2026-08-29",
  },
  "fat-metabolism": {
    label: "지방 대사", category: "FUEL_AND_RESPONSE", aliases: ["지질대사", "지방 산화"],
    short: "지방산을 연료로 사용해 산화 대사에서 ATP를 만드는 과정이에요.",
    namingOrigin: "지질에서 나온 지방산을 분해하고 산화한다는 뜻이에요.",
    substrateContext: "운동 중 탄수화물과 함께 사용되며 강도·시간·영양·훈련 상태에 따라 비율이 달라져요.",
    notMeaning: "BASE와 같은 별도 에너지 시스템이거나 특정 강도에서 지방만 사용한다는 뜻은 아니에요.", relatedTerms: ["oxidative", "carbohydrate-metabolism", "base"], sourceRefs: [SOURCES.substrate], reviewedAt: "2026-08-29",
  },
  "carbohydrate-metabolism": {
    label: "탄수화물 대사", category: "FUEL_AND_RESPONSE", aliases: ["당질대사", "글리코겐", "탄수화물 산화"],
    short: "포도당과 글리코겐을 연료로 사용해 ATP를 만드는 여러 과정을 함께 부르는 말이에요.",
    substrateContext: "해당과정과 산화 대사 모두에서 사용되며 운동 강도가 높을수록 기여가 커지는 경향이 있어요.",
    notMeaning: "GLY 하나와 같은 뜻이 아니며 화면만으로 실제 사용량을 측정할 수 없어요.", relatedTerms: ["glycolytic", "oxidative", "fat-metabolism"], sourceRefs: [SOURCES.substrate], reviewedAt: "2026-08-29",
  },
  lactate: {
    label: "젖산", category: "FUEL_AND_RESPONSE", aliases: ["Lactate", "젖산 셔틀"],
    short: "운동 중 만들어지고 다른 조직에서 다시 연료로 쓰일 수 있는 대사 물질이에요.",
    namingOrigin: "젖산염(lactate)은 해당과정과 연결되어 생성·이동·사용되는 물질의 이름이에요.",
    lactateContext: "산소가 충분한 상황에서도 생성되며 혈액과 조직 사이를 이동해 에너지원으로 사용될 수 있어요.",
    notMeaning: "피로를 만드는 단순 노폐물이거나 별도의 에너지 시스템이라는 뜻은 아니에요.", relatedTerms: ["lt", "glycolytic", "gly"], sourceRefs: [SOURCES.lactate], reviewedAt: "2026-08-29",
  },

  pb: { label: "개인 최고 기록", code: "PB", category: "INTENSITY_AND_RECORD", aliases: ["Personal Best"], short: "그 종목에서 지금까지 세운 내 최고 기록이에요.", namingOrigin: "Personal Best의 머리글자를 따서 PB라고 불러요.", relatedTerms: ["sb", "pace"], reviewedAt: "2026-08-29" },
  sb: { label: "시즌 최고 기록", code: "SB", category: "INTENSITY_AND_RECORD", aliases: ["Season Best"], short: "이번 시즌에 세운 그 종목의 최고 기록이에요.", namingOrigin: "Season Best의 머리글자를 따서 SB라고 불러요.", relatedTerms: ["pb", "pace"], reviewedAt: "2026-08-29" },
  drift: { label: "구간 기록 저하", code: "DRIFT", category: "INTENSITY_AND_RECORD", aliases: ["드리프트", "페이스 드리프트"], short: "비슷한 힘으로 달리는데 뒤 구간으로 갈수록 기록이 느려지는 변화예요.", notMeaning: "한 번의 변화만으로 피로 원인이나 부상을 진단하지 않아요.", relatedTerms: ["lap", "pace"], reviewedAt: "2026-08-29" },
  lap: { label: "구간 기록", code: "LAP", category: "INTENSITY_AND_RECORD", aliases: ["랩", "split"], short: "전체 운동을 나눈 한 구간의 기록이에요. 1000m를 6번 뛰면 각 1000m가 한 구간입니다.", relatedTerms: ["pace", "repetition"], reviewedAt: "2026-08-29" },
  zone2: { label: "존 2", code: "Z2", category: "INTENSITY_AND_RECORD", aliases: ["Zone 2", "저강도 유산소"], short: "개인 심박 구간 체계에서 비교적 편하게 오래 움직이는 유산소 강도 구간을 가리켜요.", notMeaning: "기초 지구력이나 RPE 3~4와 항상 정확히 같은 범위는 아니에요.", relatedTerms: ["base", "rpe"], reviewedAt: "2026-08-29" },

  interval: { label: "인터벌 훈련", category: "TRAINING_STRUCTURE", aliases: ["Interval"], short: "운동 구간과 회복 구간을 번갈아 반복하는 훈련 구성이에요.", namingOrigin: "운동 사이에 회복 간격(interval)을 둔다는 뜻에서 나온 이름이에요.", notMeaning: "무조건 전력질주하거나 한 가지 에너지 시스템만 훈련한다는 뜻은 아니에요.", relatedTerms: ["repetition", "recovery-time", "set"], reviewedAt: "2026-08-29" },
  repetition: { label: "반복", code: "REP", category: "TRAINING_STRUCTURE", aliases: ["rep", "횟수"], short: "같은 목적의 운동 구간을 한 번 수행하는 단위예요.", namingOrigin: "같은 구조를 되풀이한다는 뜻의 repetition을 줄여 rep라고도 해요.", relatedTerms: ["set", "recovery-time", "training-notation"], reviewedAt: "2026-08-29" },
  set: { label: "세트", code: "SET", category: "TRAINING_STRUCTURE", aliases: ["묶음"], short: "여러 반복을 한 묶음으로 모은 단위예요.", notMeaning: "세트 사이 회복과 반복 사이 회복은 서로 다를 수 있어요.", relatedTerms: ["repetition", "recovery-time", "training-notation"], reviewedAt: "2026-08-29" },
  "recovery-time": { label: "회복 시간", category: "TRAINING_STRUCTURE", aliases: ["휴식 시간", "r", "R"], short: "다음 반복이나 세트를 수행하기 전에 쉬거나 가볍게 움직이는 시간이에요.", notMeaning: "의학적으로 회복됐다는 판정이나 놓친 훈련을 보충하는 시간은 아니에요.", relatedTerms: ["interval", "repetition", "set"], reviewedAt: "2026-08-29" },

  microcycle: { label: "소주기", category: "PERIODIZATION", aliases: ["마이크로사이클", "microcycle"], short: "며칠에서 약 2주 안에 주요 훈련과 회복을 한 묶음으로 배치한 짧은 훈련 주기예요.", trainOracleUsage: "TrainOracle의 기본 계획 틀은 9.5일이지만 사용자가 7일 보기를 선택할 수 있어요.", notMeaning: "9.5일이 모든 선수에게 과학적으로 우월하다는 뜻은 아니에요.", relatedTerms: ["mesocycle", "plan-frame"], reviewedAt: "2026-08-29" },
  mesocycle: { label: "중주기", category: "PERIODIZATION", aliases: ["메조사이클", "mesocycle"], short: "여러 소주기를 묶어 4~8주 정도의 적응 목표와 에너지 목적 분포를 살피는 기간이에요.", notMeaning: "기간만 채우면 특정 효과가 보장된다는 뜻은 아니에요.", relatedTerms: ["microcycle", "macrocycle", "taper"], reviewedAt: "2026-08-29" },
  macrocycle: { label: "대주기", category: "PERIODIZATION", aliases: ["매크로사이클", "macrocycle"], short: "시즌이나 주요 경기를 향해 여러 중주기를 연결한 긴 훈련 계획 범위예요.", notMeaning: "일지를 쓰지 않았거나 결과가 불확실한 기간의 적응을 자동으로 확정하지 않아요.", relatedTerms: ["mesocycle", "taper"], reviewedAt: "2026-08-29" },
  taper: { label: "테이퍼", category: "PERIODIZATION", aliases: ["taper", "경기 전 감량"], short: "중요한 경기 전 피로를 줄이면서 준비한 능력을 유지하도록 훈련 부담을 조절하는 기간이에요.", notMeaning: "강도·양·빈도를 무조건 모두 줄이거나 안전 상태를 해제한다는 뜻은 아니에요.", relatedTerms: ["macrocycle", "rpe"], reviewedAt: "2026-08-29" },

  review: { label: "사람이 확인할 기록", code: "REVIEW", category: "APP_AND_SAFETY", aliases: ["통증 확인"], short: "통증 신호가 있어 계획을 더 진행하기 전에 사람이 확인해야 한다는 안전 표시예요.", notMeaning: "앱이 부상을 진단하거나 의료적으로 운동을 허가·금지한 판정이 아니에요.", detail: "코치·보호자 또는 본인이 기록을 확인하도록 표시하며 안전 차단을 자동으로 해제하지 않아요.", safety: true, reviewedAt: "2026-08-29" },
  "cycle-day": { label: "주기 일차", code: "DAY", category: "PERIODIZATION", aliases: ["사이클 일차", "D-"], short: "현재 훈련 주기에서 몇 번째 날인지 나타내는 달력 위치예요.", notMeaning: "안전 규칙 번호나 경기일까지 남은 날짜와 같은 뜻이 아니에요.", detail: "예: DAY 6은 현재 계획의 여섯 번째 날이에요.", safety: true, relatedTerms: ["microcycle", "plan-frame"], reviewedAt: "2026-08-29" },

  "plan-goal": { label: "준비 목표", category: "APP_AND_SAFETY", short: "이번 계획에서 준비하고 싶은 종목이나 달리기 목적이에요.", trainOracleUsage: "지원 종목과 검토된 기록이 있으면 주요 훈련의 반복·거리·회복·페이스를 계산할 수 있어요.", notMeaning: "선택만으로 경기 성적을 보장하지 않아요.", reviewedAt: "2026-08-29" },
  "competition-division": { label: "현재 참가 부문", category: "APP_AND_SAFETY", short: "대회에서 사용하는 초등부·중등부·고등부·대학부·일반부 같은 구분이에요.", notMeaning: "나이·성숙도·훈련 강도·안전 상태를 자동으로 추정하는 값이 아니며 실제 자격은 대회 요강을 확인해야 해요.", reviewedAt: "2026-08-29" },
  "plan-experience": { label: "훈련 경험", category: "APP_AND_SAFETY", short: "계획에 맞춘 구조화 훈련을 해 본 정도를 묻는 질문이에요.", notMeaning: "실력·재능·경기력을 평가하는 점수가 아니에요.", reviewedAt: "2026-08-29" },
  "training-days": { label: "이번 계획에서 운동할 날", category: "APP_AND_SAFETY", aliases: ["훈련 가능일"], short: "학교·일·다른 운동을 고려해 이번 계획 기간에 실제로 운동할 수 있는 날 수예요.", notMeaning: "반드시 채워야 하는 목표 횟수가 아니며 회복 운동일도 포함할 수 있어요.", relatedTerms: ["rec", "off", "plan-frame"], reviewedAt: "2026-08-29" },
  "plan-frame": { label: "계획 길이", category: "PERIODIZATION", aliases: ["프레임"], short: "한 번에 만들고 달력에 표시할 훈련 계획의 기간이에요.", trainOracleUsage: "9.5일을 기본 틀로 쓰고 7일 보기도 이전·다음 주기와 연결해 해석해요.", notMeaning: "기간이 길수록 더 우수하거나 강한 계획이라는 뜻이 아니에요.", relatedTerms: ["microcycle", "cycle-day"], reviewedAt: "2026-08-29" },
  "two-a-day": { label: "하루 두 번 운동", category: "TRAINING_STRUCTURE", aliases: ["오전·오후 훈련", "double day"], short: "한 날의 훈련을 오전과 오후 두 번으로 나누어 진행하는 방식이에요.", notMeaning: "놓친 운동을 보충하거나 모든 선수에게 필요한 방식이라는 뜻이 아니에요.", reviewedAt: "2026-08-29" },
  "plan-beta-basis": { label: "베타 계획에 사용한 정보", category: "APP_AND_SAFETY", short: "목표·경험·훈련 목적·운동일·시간대·안전 확인 중 실제 계획 계산에 사용한 정보를 알려줘요.", notMeaning: "연결되지 않은 일지·메모·참가 부문을 개인 처방에 사용했다는 뜻이 아니에요.", reviewedAt: "2026-08-29" },
  "plan-option": { label: "계획안", category: "APP_AND_SAFETY", aliases: ["계획 후보"], short: "같은 주요 훈련을 유지하면서 쉬운 훈련 시간을 다르게 구성한 선택안이에요.", notMeaning: "한 계획안이 자동으로 더 안전하거나 더 우수하다는 뜻은 아니에요.", reviewedAt: "2026-08-29" },
  "quality-session": { label: "상세 훈련 수치", category: "TRAINING_STRUCTURE", aliases: ["품질 훈련", "상세 처방"], short: "조건이 맞으면 한 번의 주요 훈련에 반복 수·거리·회복 시간·개인 기록 기준 페이스를 표시해요.", notMeaning: "지원 근거가 없을 때 수치를 추측하거나 모든 종목에 같은 세션을 주지 않아요.", relatedTerms: ["main", "training-notation", "pace"], reviewedAt: "2026-08-29" },
  "training-notation": { label: "훈련표 읽는 법", category: "TRAINING_STRUCTURE", aliases: ["훈련 표기", "workout notation"], short: "세트·반복·거리·회복 시간을 짧게 적는 약속이에요. 2×(10×400m)는 400m 10회를 두 세트 한다는 뜻입니다.", notMeaning: "표기 자체가 개인 페이스나 안전 상태를 정하지 않아요.", examples: ["2×(10×400m) @5000m RP r60초 R3분", "반복 사이 60초, 세트 사이 3분"], relatedTerms: ["set", "repetition", "recovery-time", "pace"], reviewedAt: "2026-08-29" },
}

export const GLOSSARY_ENTRIES = (Object.entries(GLOSSARY) as [TermId, GlossaryEntry][])
  .map(([id, entry]) => ({ id, ...entry }))

export function glossarySearchText(id: TermId, entry: GlossaryEntry): string {
  return [id, entry.label, entry.code, entry.short, ...(entry.aliases ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ko-KR")
}
