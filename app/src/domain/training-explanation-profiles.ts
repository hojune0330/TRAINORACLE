import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { TermId } from "./glossary"

export const EXPLANATION_VERSION = "1.0.0"

export type TrainingExplanationProfile = {
  id: string
  version: string
  termId: TermId
  purpose: string
  energyContext: string
  workRationale: string
  recoveryRationale: string
  expectedAdaptation: string
  limitations: readonly string[]
  observationGuide: string
  sourceIds: readonly string[]
}

export type TrainingExplanationKey = PlannedEnergyIntent
  | "REST" | "WARMUP" | "COOLDOWN" | "TECHNICAL" | "STRENGTH"

export type TrainingExplanationSource = {
  id: string
  title: string
  /** Public research URL or an existing repository-relative coaching contract path. */
  url?: string
  kind: "MECHANISM_STUDY" | "TRAINING_STUDY" | "COACHING_DESIGN"
  population: string
  applicability: string
  reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL"
}

// Original abstracts/publisher records checked on 2026-09-02, not human science review.
export const EXPLANATION_SOURCES: Record<string, TrainingExplanationSource> = {
  PMID_8226473: {
    id: "PMID_8226473",
    title: "Gaitanos et al. (1993), Human muscle metabolism during intermittent maximal exercise",
    url: "https://pubmed.ncbi.nlm.nih.gov/8226473/",
    kind: "MECHANISM_STUDY",
    population: "성인 남성의 사이클 에르고미터 최대 반복 운동과 근육 생검 연구.",
    applicability: "첫 짧은 운동부터 인산크레아틴 분해와 해당과정이 함께 기여한 관찰을 설명해요. 사이클 결과를 달리기나 청소년의 에너지 비율·훈련량으로 옮기지 않으며, 장기 훈련 효과를 입증한 연구가 아니에요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_9241025: {
    id: "PMID_9241025",
    title: "Dawson et al. (1997), Muscle phosphocreatine repletion following single and repeated short sprint efforts",
    url: "https://pubmed.ncbi.nlm.nih.gov/9241025/",
    kind: "MECHANISM_STUDY",
    population: "훈련된 성인 남성의 단일·반복 최대 사이클 운동 후 근육 생검 연구.",
    applicability: "앞선 운동의 인산크레아틴 소모 정도에 따라 재충전 경과가 달랐다는 근거예요. 사이클 실험의 회복 시간을 달리기·청소년에게 그대로 적용하거나 개인의 완전 회복 시점으로 확정할 수 없어요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_21777153: {
    id: "PMID_21777153",
    title: "Saraslanidis et al. (2011), Muscle metabolism and performance improvement after two training programmes of sprint running differing in rest interval duration",
    url: "https://pubmed.ncbi.nlm.nih.gov/21777153/",
    kind: "TRAINING_STUDY",
    population: "남성 반복 달리기 참가자 대상 훈련 비교. 확인한 초록은 나이와 훈련 경력의 범위를 제시하지 않아요.",
    applicability: "회복 간격이 다른 반복 달리기에서 대사 반응과 속도 유지의 변화가 달랐다는 근거예요. 청소년·여성·중장거리 선수의 개인 효과나 최적 회복 시간은 이 연구로 확정하지 않으며, 새 스프린트 처방을 허가하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_15387806: {
    id: "PMID_15387806",
    title: "Seiler and Sjursen (2004), Effect of work duration on physiological and rating scale of perceived exertion responses during self-paced interval training",
    url: "https://pubmed.ncbi.nlm.nih.gov/15387806/",
    kind: "MECHANISM_STUDY",
    population: "잘 훈련된 성인 남녀 달리기 선수의 자기조절 속도 인터벌 비교.",
    applicability: "운동 구간 길이에 따라 속도와 산소섭취 반응이 달라진 급성 관찰을 설명해요. 장기 적응 연구가 아니며, 청소년·초보자의 최적 구간 길이나 개인 최대산소섭취량 향상을 보장하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_10233114: {
    id: "PMID_10233114",
    title: "Paavolainen et al. (1999), Explosive-strength training improves 5-km running time by improving running economy and muscle power",
    url: "https://pubmed.ncbi.nlm.nih.gov/10233114/",
    kind: "TRAINING_STUDY",
    population: "잘 훈련된 성인 남성 지구력 선수의 폭발적 근력·지구력 병행 훈련 연구.",
    applicability: "연구 집단에서 달리기 경제성과 수행의 개선이 관찰되었어요. 모든 근력 운동의 효과를 뜻하지 않으며, 청소년·초보자에게 같은 결과나 훈련량을 보장하지 않아요. 이 연구는 앱의 개별 근력 처방을 승인하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_8214047: {
    id: "PMID_8214047",
    title: "Romijn et al. (1993), Regulation of endogenous fat and carbohydrate metabolism in relation to exercise intensity and duration",
    url: "https://pubmed.ncbi.nlm.nih.gov/8214047/",
    kind: "MECHANISM_STUDY",
    population: "훈련된 성인 대상 운동 강도·시간별 연료 대사 연구. 안정 동위원소와 간접 열량측정을 사용했어요.",
    applicability: "강도와 시간에 따라 탄수화물·지방 사용이 달라지는 일반 원리를 뒷받침해요. 청소년이나 개인 달리기의 연료 비율·체중 변화·최적 강도는 확정하지 않으며, BASE 훈련의 장기 효과를 직접 검증한 연구가 아니에요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  PMID_10562610: {
    id: "PMID_10562610",
    title: "Bergman et al. (1999), Active muscle and whole body lactate kinetics after endurance training in men",
    url: "https://pubmed.ncbi.nlm.nih.gov/10562610/",
    kind: "TRAINING_STUDY",
    population: "훈련되지 않은 건강한 성인 남성의 사이클 에르고미터 지구력 훈련 전후 연구.",
    applicability: "운동 중 젖산의 생성·섭취·산화와 훈련 후 반응 변화를 설명해요. 사이클 연구를 달리기 LT 처방의 직접 검증으로 보지 않으며, 청소년·훈련된 선수의 개인 역치나 향상 정도를 계산하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  COACHING_TERMINOLOGY: {
    id: "COACHING_TERMINOLOGY",
    title: "TrainOracle 훈련 용어·설명 계약: 목적 구분과 통합 설명 방향",
    url: "specs/reconstruct/TRAINING_TERMINOLOGY_AND_EXPLANATION_SPEC.md",
    kind: "COACHING_DESIGN",
    population: "연구 참가자 없음. 기존 계획의 훈련 목적과 구성요소를 읽는 사용자를 위한 제품 설계 계약이에요.",
    applicability: "훈련 목적과 대사 경로를 구분하고 휴식·기술·근력의 일반 코칭 의도를 설명하는 근거예요. 논문이나 개인 효과 검증, 사람의 과학 검토, 새 훈련량 승인을 대신하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
  COACHING_PRESCRIPTION: {
    id: "COACHING_PRESCRIPTION",
    title: "TrainOracle 구조화 훈련 처방 계약: 운동·회복·준비·정리 구성",
    url: "specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md",
    kind: "COACHING_DESIGN",
    population: "연구 참가자 없음. 별도로 채택된 템플릿과 기존 처방의 구성요소를 설명하는 계약이에요.",
    applicability: "운동과 회복을 함께 읽고 준비·정리를 본운동과 구분하는 운영 설계 근거예요. 특정 준비·정리 운동의 효과를 입증한 논문이 아니며, 개인의 효과·안전 또는 새 훈련량을 승인하지 않아요.",
    reviewStatus: "SOURCE_CHECKED_NOT_DOSE_APPROVAL",
  },
}

// General intent only. The parent session layer owns actual doses, selection evidence and cycle placement.
export const TRAINING_EXPLANATION_PROFILES: Readonly<Record<TrainingExplanationKey, TrainingExplanationProfile>> = {
  RECOVERY_INTENT: {
    id: "recovery-intent",
    version: EXPLANATION_VERSION,
    termId: "rec",
    purpose: "새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.",
    energyContext: "회복 운동은 에너지 경로 이름이 아니라 낮은 부담을 의도한 일정 역할이에요. 움직이는 동안 대사는 계속되지만 특정 경로의 훈련량으로 단정하지 않아요.",
    workRationale: "계획에 있는 가벼운 움직임은 주요 훈련과 부담을 구분하기 위한 구성이에요. 놓친 본운동이나 부족해 보이는 거리를 보충하는 구간이 아니에요.",
    recoveryRationale: "움직임을 포함한 회복일과 훈련 없는 휴식일은 달라요. 이 설명만으로 휴식을 회복 운동으로 바꾸거나 회복이 완료됐다고 판단하지 않아요.",
    expectedAdaptation: "일반 코칭 의도는 훈련 부담을 낮추면서 편안한 움직임을 유지하는 것이에요. 개인의 회복 속도가 빨라진다고 보장하지 않아요.",
    limitations: ["회복 운동이 휴식보다 항상 낫다는 근거로 사용하지 않아요.", "통증·피로의 원인이나 다음 훈련의 안전을 이 이름만으로 판정하지 않아요."],
    observationGuide: "계획 대비 실제 움직인 시간과 체감강도를 구분해 살펴봐요. 편안함의 변화는 관찰이지 회복 완료나 이 세션의 선택 근거가 아니에요.",
    sourceIds: ["COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  BASE_INTENT: {
    id: "base-intent",
    version: EXPLANATION_VERSION,
    termId: "base",
    purpose: "편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.",
    energyContext: "산화 대사가 지속적인 ATP 공급을 뒷받침하며 탄수화물과 지방을 함께 사용해요. 인원질과 해당과정도 작동하므로 지방만 쓰는 훈련은 아니에요.",
    workRationale: "쉬운 강도의 운동을 이어 가는 이유는 빠른 구간의 최고 출력보다 지속적으로 움직일 기회를 쌓기 위해서예요. 실제 시간·거리는 선택된 계획이 정하며 이 설명에서 늘리지 않아요.",
    recoveryRationale: "연속 운동이라면 반복 사이 회복은 해당하지 않아요. 나뉜 구성이면 계획의 회복을 함께 보며, 쉬운 훈련이라는 이유로 다음 훈련까지 회복이 필요 없다고 판단하지 않아요.",
    expectedAdaptation: "지속적인 유산소 활동을 이어 갈 능력을 준비하려는 일반 코칭 의도예요. 인용한 연료 대사 연구가 이 세션의 개인 지구력 향상을 보장하지는 않아요.",
    limitations: ["성인 실험의 연료 사용 결과로 청소년이나 개인의 지방 사용 비율을 계산하지 않아요.", "체중 감소나 워치의 특정 심박 구간과 같은 뜻이 아니에요."],
    observationGuide: "같은 계획 조건에서 실제 시간·거리와 체감강도가 어떻게 달랐는지 살펴봐요. 편해진 느낌만으로 대사 적응이나 훈련의 인과 효과를 확정하지 않아요.",
    sourceIds: ["PMID_8214047", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  LT_INTENT: {
    id: "lt-intent",
    version: EXPLANATION_VERSION,
    termId: "lt",
    purpose: "지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.",
    energyContext: "LT는 별도 에너지 시스템이 아니에요. 산화 대사와 해당과정 등이 함께 작동하고, 운동 중 젖산은 생성되는 동시에 연료로 이용될 수 있어요.",
    workRationale: "일정한 노력의 연속 구간이나 나뉜 구간은 지속 페이스의 부담을 다루려는 구성이에요. 구간의 길이와 목표가 달라지면 같은 LT 이름이어도 같은 자극으로 볼 수 없어요.",
    recoveryRationale: "반복형이면 회복 구간이 다음 운동의 지속 가능성과 전체 부담에 영향을 줘요. 연속형에는 반복 사이 회복이 없으며, LT 이름만으로 특정 회복 시간이나 방식을 정하지 않아요.",
    expectedAdaptation: "지속 페이스를 견디는 능력을 준비하는 것이 설계 의도예요. 지구력 훈련 후 젖산 반응 변화는 연구 집단에서 관찰됐지만 이 세션으로 개인 역치가 높아진다고 보장하지 않아요.",
    limitations: ["성인 남성 사이클 연구는 달리기 LT 처방이나 청소년의 효과를 직접 검증하지 않았어요.", "계획의 페이스나 체감강도로 개인의 혈중 젖산·정확한 역치를 측정할 수 없어요."],
    observationGuide: "계획한 노력과 실제 구간 기록·체감강도, 뒤 구간의 변화를 함께 살펴봐요. 관찰을 젖산 검사값이나 과거 처방 선택 이유로 바꾸지 않아요.",
    sourceIds: ["PMID_10562610", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  VO2_INTENT: {
    id: "vo2-intent",
    version: EXPLANATION_VERSION,
    termId: "vo2",
    purpose: "높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.",
    energyContext: "산화 대사의 높은 에너지 공급 요구를 다루지만 인원질과 해당과정도 함께 기여해요. 산소섭취량은 반응 지표이며 별도 에너지 시스템 이름이 아니에요.",
    workRationale: "강한 구간을 나누는 것은 회복을 사이에 두고 목표 노력을 반복하기 위한 설계예요. 구간 길이에 따라 산소섭취 반응이 달라질 수 있어, 같은 총 운동 시간만으로 자극이 같다고 보지 않아요.",
    recoveryRationale: "회복은 다음 반복의 수행과 연속되는 부담을 조절하는 구성요소예요. 실제 반복 사이·세트 사이의 시간과 방식을 함께 읽어야 하며, 항상 완전히 쉬거나 항상 덜 쉬는 방식으로 고정하지 않아요.",
    expectedAdaptation: "강한 유산소 운동을 감당하는 능력을 준비하려는 코칭 의도예요. 연구의 급성 산소섭취 반응이 개인 최대산소섭취량의 장기 향상을 보장하지 않아요.",
    limitations: ["잘 훈련된 성인 달리기 선수의 실험을 청소년·초보자에게 그대로 적용하지 않아요.", "숨이 많이 찬 느낌만으로 최대산소섭취량 도달이나 충분한 훈련 효과를 확정하지 않아요."],
    observationGuide: "실제 구간 기록, 회복 수행, 체감강도와 반복 후반의 변화를 함께 살펴봐요. 이는 수행 관찰이며 산소섭취량 측정이나 세션 선택 근거가 아니에요.",
    sourceIds: ["PMID_15387806", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  GLY_INTENT: {
    id: "gly-intent",
    version: EXPLANATION_VERSION,
    termId: "gly",
    purpose: "짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.",
    energyContext: "탄수화물을 분해하는 해당과정의 기여가 커질 수 있으며 인원질과 산화 대사도 함께 작동해요. 아주 짧은 운동에서도 해당과정이 기여할 수 있고, 젖산은 다시 연료로 이용될 수 있어요.",
    workRationale: "짧고 강한 구간을 반복하는 이유는 빠른 에너지 공급과 출력 유지의 부담을 다루기 위해서예요. 구간의 길이·목표·반복 구조와 회복을 함께 봐야 하며 단순히 빠르게 달리는 기술 연습과 같지 않아요.",
    recoveryRationale: "GLY가 언제나 완전 회복을 뜻하지는 않아요. 회복 간격에 따라 인산크레아틴 재충전과 다음 반복의 대사 부담이 달라질 수 있어요. 실제 처방의 반복 사이·세트 사이 회복 시간과 방식이 기준이며, 짧을수록 좋다는 뜻도 아니에요.",
    expectedAdaptation: "높은 에너지 공급 요구 속에서 반복 수행과 출력 유지를 준비하는 것이 코칭 의도예요. 회복 간격이 다른 달리기 훈련의 집단 차이는 개인의 해당 능력 향상을 보장하지 않아요.",
    limitations: ["성인 사이클의 급성 기전 연구와 남성 반복 달리기 훈련 연구는 대상·운동·관찰 기간이 달라요.", "청소년·여성·중장거리 선수에게 같은 효과나 회복 간격을 적용할 근거가 아니며, 젖산 수치나 에너지 비율을 추정하지 않아요."],
    observationGuide: "구간 기록의 변화, 실제 회복 시간·방식과 체감강도를 구분해 살펴봐요. 후반 기록 저하만으로 젖산 축적이나 특정 경로의 고갈을 진단하지 않아요.",
    sourceIds: ["PMID_8226473", "PMID_21777153", "PMID_10562610", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  ATP_PC_INTENT: {
    id: "atp-pc-intent",
    version: EXPLANATION_VERSION,
    termId: "atp",
    purpose: "매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.",
    energyContext: "저장된 ATP와 인산크레아틴이 빠른 에너지 공급에 관여해요. 첫 짧은 운동부터 해당과정도 기여할 수 있고 산화 대사도 작동하므로 인원질만 사용하는 구간으로 단정하지 않아요.",
    workRationale: "짧은 운동 구간은 높은 출력을 내는 동작을 다루기 위한 설계예요. 계속 이어 달리는 부담과 목적이 다르며, 빠른 에너지 공급과 수행의 질을 함께 살펴야 해요.",
    recoveryRationale: "회복은 인산크레아틴 재충전과 다음 반복의 출력 유지에 중요해요. 앞선 운동에 따라 회복 경과가 달라지므로 실제 처방의 시간·방식을 따로 확인하며, 고정된 시간이 모든 사람의 완전 회복을 보장하지 않아요.",
    expectedAdaptation: "빠르게 힘을 내고 가속하는 능력을 준비하는 것이 코칭 의도예요. 급성 기전 연구만으로 개인의 스피드 향상이나 저장 에너지 증가를 보장하지 않아요.",
    limitations: ["성인 남성 사이클 연구의 대사·회복 결과를 달리기나 청소년에게 그대로 옮기지 않아요.", "인원질만 작동하거나 젖산이 전혀 없다는 뜻이 아니며, 새 단거리 전문 처방을 허가하지 않아요."],
    observationGuide: "구간 기록과 회복 수행, 가속 동작이 유지됐는지를 살펴봐요. 기록 저하를 인산크레아틴 고갈의 측정값으로 해석하지 않아요.",
    sourceIds: ["PMID_8226473", "PMID_9241025", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  MIXED_INTENT: {
    id: "mixed-intent",
    version: EXPLANATION_VERSION,
    termId: "mix",
    purpose: "구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.",
    energyContext: "대사 경로는 각 구간에서 함께 작동하며 강도와 길이에 따라 요구가 달라져요. MIX는 별도 경로나 경로별 기여 비율이 아니라 여러 목적의 조합 또는 아직 배분하지 않은 계획 표시예요.",
    workRationale: "조합이 명시된 처방에서는 구간의 순서·목표·연결 방식이 무엇을 함께 다루려는지 설명해요. 구성 정보가 없으면 MIX 이름만으로 어떤 에너지 자극을 조합했는지 만들어 내지 않아요.",
    recoveryRationale: "구간 안의 반복 사이 회복과 서로 다른 구간 사이 회복은 역할이 다를 수 있어요. 실제 처방의 회복을 각각 보며 MIX 전체에 같은 회복 규칙을 덧씌우지 않아요.",
    expectedAdaptation: "확인된 구간들의 요구에 맞춰 수행을 이어 가는 능력이 설계 의도예요. 조합 자체의 우월성이나 개인에게 복합 효과가 생긴다는 보장은 없어요.",
    limitations: ["미배분 표시라면 구체적인 조합 목적과 적응은 확인되지 않은 상태예요.", "성인 단일 실험의 기전을 조합 전체나 청소년의 개인 효과 검증으로 확대하지 않아요."],
    observationGuide: "구간별 목표와 실제 기록·회복·체감강도를 따로 살펴봐요. 서로 다른 구간을 합쳐 하나의 대사 점수나 과거 선택 이유로 만들지 않아요.",
    sourceIds: ["PMID_8226473", "PMID_15387806", "COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  REST: {
    id: "rest",
    version: EXPLANATION_VERSION,
    termId: "off",
    purpose: "훈련을 배치하지 않아 추가 운동 부담을 두지 않는 일정이에요.",
    energyContext: "휴식은 훈련하지 않는 일정 역할이라 특정 에너지 경로 자극을 설명할 대상이 아니에요. 몸의 에너지 대사가 멈춘다는 뜻은 아니에요.",
    workRationale: "계획된 운동 구간이 없으므로 반복·거리·목표 페이스는 해당하지 않아요. 쉬는 자리에 놓친 훈련을 추가하는 의미가 아니에요.",
    recoveryRationale: "회복을 위한 일정상 여유를 두지만 시간이 지났다는 이유로 회복 완료를 판정하지 않아요. 일상 움직임을 금지하거나 회복 운동을 자동으로 배정하지 않아요.",
    expectedAdaptation: "새 자극을 주지 않고 훈련 사이 여유를 확보하는 코칭 의도예요. 개인의 피로 해소나 부상 회복을 보장하지 않아요.",
    limitations: ["휴식 표시는 의학적 회복 확인이나 다음 훈련의 안전 허가가 아니에요."],
    observationGuide: "훈련을 하지 않은 사실과 실제 컨디션 관찰을 구분해요. 휴식일을 완료했다는 사실만으로 다음 훈련의 강도를 올리지 않아요.",
    sourceIds: ["COACHING_TERMINOLOGY", "COACHING_PRESCRIPTION"],
  },
  // These components use an existing structure term, not an invented term or energy bucket.
  WARMUP: {
    id: "warmup",
    version: EXPLANATION_VERSION,
    termId: "training-notation",
    purpose: "본운동에 앞서 움직임과 노력 수준을 단계적으로 준비하는 구성요소예요.",
    energyContext: "준비운동은 본운동으로 넘어가는 역할이에요. 실제 동작과 강도가 다양하므로 하나의 에너지 경로 훈련으로 고정하지 않아요.",
    workRationale: "계획에 포함된 쉬운 움직임과 준비 동작은 본운동을 시작할 준비를 위한 운영 설계예요. 본운동 반복 수에 합치거나 별도 고강도 훈련을 추가하지 않아요.",
    recoveryRationale: "준비 동작 사이에 회복이 있으면 해당 구성요소의 시간·방식을 확인해요. 준비 단계의 회복을 본운동의 반복 사이 회복으로 대신하지 않아요.",
    expectedAdaptation: "당일 본운동에 맞춰 움직임을 준비하려는 코칭 의도예요. 준비운동만으로 개인의 수행 향상이나 부상 예방이 보장되지는 않아요.",
    limitations: ["출처는 기존 처방의 운영 구성 계약이며 특정 준비운동의 효과를 입증한 연구가 아니에요.", "준비운동을 마쳐도 통증이나 안전 차단이 해제되는 것은 아니에요."],
    observationGuide: "계획한 준비 구성과 실제 수행을 구분하고 움직임·체감강도의 변화를 살펴봐요. 준비가 편했다는 사실을 안전 허가로 해석하지 않아요.",
    sourceIds: ["COACHING_PRESCRIPTION", "COACHING_TERMINOLOGY"],
  },
  COOLDOWN: {
    id: "cooldown",
    version: EXPLANATION_VERSION,
    termId: "training-notation",
    purpose: "본운동 뒤 노력 수준을 낮추고 세션을 마무리하는 구성요소예요.",
    energyContext: "정리운동은 마무리 역할이지 별도 에너지 경로가 아니에요. 낮은 강도에서도 대사는 이어지지만 대사물질 제거율을 측정하는 과정은 아니에요.",
    workRationale: "계획된 가벼운 마무리를 본운동과 구분해 수행하는 운영 설계예요. 모자란 본운동 거리나 반복 수를 채우기 위한 구간이 아니에요.",
    recoveryRationale: "정리운동과 다음 세션까지의 회복은 달라요. 마무리를 했다는 이유로 다음 고강도 운동의 회복 시간을 줄이지 않아요.",
    expectedAdaptation: "당일 운동의 부담을 낮추며 마무리하려는 코칭 의도예요. 개인의 근육통 감소나 다음날 수행 회복을 보장하지 않아요.",
    limitations: ["출처는 기존 처방의 운영 구성 계약이며 정리운동의 개인 효과 검증이 아니에요.", "젖산을 없애야만 회복된다는 설명이나 부상 회복 판정으로 사용하지 않아요."],
    observationGuide: "실제 마무리 동작과 체감강도를 살펴보고 본운동 실적과 구분해요. 이후의 회복 상태를 이 구성요소의 효과로 단정하지 않아요.",
    sourceIds: ["COACHING_PRESCRIPTION", "COACHING_TERMINOLOGY"],
  },
  TECHNICAL: {
    id: "technical",
    version: EXPLANATION_VERSION,
    termId: "training-notation",
    purpose: "계획한 움직임의 순서·자세·협응을 익히고 일관되게 수행하는 연습이에요.",
    energyContext: "기술은 동작 학습의 목적이며 특정 에너지 경로 이름이 아니에요. 동작 강도에 따라 대사 부담이 달라지므로 기술 훈련을 자동으로 회복 운동으로 보지 않아요.",
    workRationale: "동작을 나누거나 반복하는 이유는 확인할 기술 요소를 분명히 하고 수행을 비교하기 위해서예요. 실제 동작 구성이 없으면 세부 기술이나 반복 수를 추정하지 않아요.",
    recoveryRationale: "동작 사이 회복은 피로와 기술 수행을 함께 고려하는 구성요소예요. 구체적인 휴식은 계획에 따르며 기술이라는 이름만으로 짧게 정하지 않아요.",
    expectedAdaptation: "동작 이해와 일관성을 준비하는 일반 코칭 의도예요. 이 설명은 개인 기술 향상이나 달리기 경제성 개선을 보장하지 않아요.",
    limitations: ["일반 설계 의도이며 개별 기술의 효과를 검증한 연구 근거는 포함하지 않아요.", "기술 연습의 이점을 에너지 목적 본운동의 대사 설명 대신 사용하지 않아요."],
    observationGuide: "실제로 연습한 동작과 확인한 수행의 차이를 살펴봐요. 반복 횟수만으로 기술 습득이나 개인의 약점 보완을 확정하지 않아요.",
    sourceIds: ["COACHING_TERMINOLOGY"],
  },
  STRENGTH: {
    id: "strength",
    version: EXPLANATION_VERSION,
    termId: "training-notation",
    purpose: "힘을 내고 전달하는 능력을 준비해 달리기의 움직임을 뒷받침하려는 훈련이에요.",
    energyContext: "근력은 근육·신경의 수행 목표이며 단일 에너지 경로가 아니에요. 동작·부하·반복·회복에 따라 대사 요구가 달라져 인원질 훈련으로 일괄 분류하지 않아요.",
    workRationale: "선택된 동작과 부하, 반복 구조가 어떤 힘 발휘를 다루는지 함께 봐야 해요. 연구에서 쓴 폭발적 동작과 모든 근력 운동이 같지는 않으며 이 설명에서 중량이나 반복 수를 정하지 않아요.",
    recoveryRationale: "세트 사이 회복은 다음 힘 발휘와 수행의 질에 영향을 주는 구성요소예요. 실제 처방을 기준으로 보며 달리기 반복의 휴식 규칙을 그대로 가져오지 않아요.",
    expectedAdaptation: "힘 발휘와 달리기 수행을 뒷받침하는 능력이 코칭 의도예요. 폭발적 근력·지구력 병행 연구의 경제성 개선은 집단 관찰이며 개인의 기록 향상을 보장하지 않아요.",
    limitations: ["잘 훈련된 성인 남성 지구력 선수의 특정 병행 훈련 결과를 청소년·초보자나 모든 근력 운동에 확대하지 않아요.", "이 프로필은 새 근력 처방이나 기존 달리기 훈련량의 변경을 승인하지 않아요."],
    observationGuide: "실제 동작·부하·반복과 체감강도를 구분해 살펴봐요. 중량이나 반복 수의 변화만으로 달리기 경제성 향상을 확정하지 않아요.",
    sourceIds: ["PMID_10233114", "COACHING_TERMINOLOGY"],
  },
}
