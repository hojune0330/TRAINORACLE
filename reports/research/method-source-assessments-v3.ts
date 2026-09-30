import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"

type SourceAssessment = {
  title: string; url: string; level: "COACHING" | "ACUTE_STUDY" | "TRAINING_STUDY" | "LOCAL_REVIEW";
  checked: "BODY" | "ABSTRACT" | "PREVIOUS_LOCAL_REVIEW";
  supports: string; doesNotEstablish: string;
}

// Evidence scope, not a scientific approval or permission to execute a protocol.
export const METHOD_SOURCE_ASSESSMENTS: Readonly<Record<string, SourceAssessment>> = {
  LT_COACHING: {
    title: "V.O2: What's Your Threshold Pace? (2017)",
    url: "https://support.vdoto2.com/2017/12/whats-threshold-pace/", level: "COACHING", checked: "BODY",
    supports: "20분 템포와 5~15분 분할, 사이 1~2분 회복이라는 코칭 범위를 설명한다.",
    doesNotEstablish: "2회·3회라는 총량, RPE 6~7, 준비·정리, 입문·청소년·종목별 적용을 직접 입증하지 않는다.",
  },
  VO2_COACHING: {
    title: "V.O2: How To Effectively Improve Your VO2max (2025)",
    url: "https://news.vdoto2.com/2025/07/how-to-effectively-improve-your-vo2max/", level: "COACHING", checked: "BODY",
    supports: "6×2분/1분 회복, 5×3분/2분, 4×4분/3분의 예와 짧은 반복을 더 빠르게 하지 않는 안내가 있다.",
    doesNotEstablish: "원문의 I pace와 주간 거리 관련 조건을 무시한 RPE 치환, 개인 총량과 주기 배치는 별도 판단이다.",
  },
  INTERVAL_DURATION: {
    title: "Seiler and Sjursen (2004): self-paced interval work duration",
    url: "https://onlinelibrary.wiley.com/doi/10.1046/j.1600-0838.2003.00353.x", level: "ACUTE_STUDY", checked: "ABSTRACT",
    supports: "훈련된 성인 12명의 1·2·4·6분 반복 비교에서 구간 길이에 따른 속도·산소섭취 반응 차이를 관찰했다.",
    doesNotEstablish: "장기 효과나 청소년 최적 용량의 입증이 아니다. 연구의 RPE 약 17을 앱의 0~10 척도에 그대로 옮기지 않는다.",
  },
  SPRINT_RECOVERY: {
    title: "Saraslanidis et al. (2011): sprint running with different rest intervals",
    url: "https://pubmed.ncbi.nlm.nih.gov/21777153/", level: "TRAINING_STUDY", checked: "ABSTRACT",
    supports: "남성 16명의 8주 훈련에서 80m 반복 사이 10초와 60초 회복의 반응 차이를 보고했다.",
    doesNotEstablish: "현재 200m 반복·120초 회복의 직접 근거가 아니다. 초록으로 확인하지 못한 연령·경력, 청소년·여성 전이를 확정하지 않는다.",
  },
  SPRINT_ENERGY: {
    title: "Gaitanos et al. (1993): intermittent maximal exercise",
    url: "https://pubmed.ncbi.nlm.nih.gov/8226473/", level: "ACUTE_STUDY", checked: "PREVIOUS_LOCAL_REVIEW",
    supports: "기존 검토는 짧은 사이클 운동에서도 인산크레아틴과 해당과정이 함께 관여하는 기전을 다뤘다.",
    doesNotEstablish: "이번 조회에서 PubMed 본문은 재확보하지 못했다. 6초 달리기·20m 가속·정확한 회복초의 채택 근거로 격상하지 않는다.",
  },
  HILL_TRANSFER: {
    title: "Barnes et al. (2013): uphill interval-training programs",
    url: "https://pubmed.ncbi.nlm.nih.gov/23538293/", level: "TRAINING_STUDY", checked: "ABSTRACT",
    supports: "훈련된 러너 20명의 6주 비교에서 지표별 반응이 달랐고 5km 수행의 단일 최적 강도는 명확하지 않았다.",
    doesNotEstablish: "평지 처방을 언덕에 복사하거나 정확한 경사·거리·회복을 정할 근거는 아니다. 청소년·입문으로 자동 전이하지 않는다.",
  },
  EXISTING_REVIEW: {
    title: "기존 전체 구성·설명·적용 범위 검토 패킷",
    url: "reports/review/TRAINING_ADOPTION_READY_PACKET_2026-09-08.md", level: "LOCAL_REVIEW", checked: "PREVIOUS_LOCAL_REVIEW",
    supports: "기존 유한 구성의 운동·회복·지원 구간, 적용 범위, 수정·보류 쟁점을 보존한다.",
    doesNotEstablish: "자체 검토 자료는 외부 전문가 승인이나 실제 효과 측정이 아니며 운영 권한을 부여하지 않는다.",
  },
}

export function sourceAssessmentFor(protocol: PendingMethodProtocol) {
  const { family } = protocol
  const keys = family === "LT" ? ["LT_COACHING", "EXISTING_REVIEW"]
    : family === "VO2" ? ["VO2_COACHING", "INTERVAL_DURATION", "EXISTING_REVIEW"]
      : family === "ATP-PC" ? ["SPRINT_ENERGY", "EXISTING_REVIEW"]
        : family === "GLY" ? ["SPRINT_RECOVERY", "SPRINT_ENERGY", "EXISTING_REVIEW"] : ["EXISTING_REVIEW"]
  const publishedExamples = [
    { method: "TWO_MINUTE", reps: 6, work: 120, recovery: 60 },
    { method: "THREE_MINUTE", reps: 5, work: 180, recovery: 120 },
    { method: "FOUR_MINUTE", reps: 4, work: 240, recovery: 180 },
  ]
  const exactPublishedWorkRest = family === "VO2" && protocol.sets === 1 && protocol.work.length === 1
    && protocol.work[0]?.role === "WORK" && protocol.work[0]?.unit === "SECONDS"
    && protocol.between?.role === "JOG" && protocol.between?.unit === "SECONDS"
    && protocol.setRest === null && protocol.afterEvery === null
    && publishedExamples.some(example => example.method === protocol.method && example.reps === protocol.reps
      && example.work === protocol.work[0]?.value && example.recovery === protocol.between?.value)
  return {
    links: keys.map(key => ({ id: key, ...METHOD_SOURCE_ASSESSMENTS[key]! })),
    workRestEvidence: exactPublishedWorkRest ? "PUBLISHED_COACHING_WORK_REST_EXAMPLE" as const
      : "PRODUCT_COACHING_CONFIGURATION" as const,
    exactPopulationDoseEstablished: false as const,
    note: exactPublishedWorkRest
      ? "운동·회복 숫자는 공식 코칭 예와 일치해요. 강도 기준·총량 조건·대상·지원 구간까지 동일하다는 뜻은 아니에요."
      : "기존 검토용 코칭 구성입니다. 논문에서 이 거리·반복·회복을 그대로 처방했다고 설명하지 않아요.",
  }
}
