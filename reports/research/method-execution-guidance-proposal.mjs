import { expandProposal } from "./method-adoption-protocols.mjs"

// Product coaching proposals, not research-derived personal pace or operating approval.
const work = {
  BASE: "처음부터 끝까지 문장으로 대화할 수 있는 쉬운 노력으로 달립니다. 뒤 구간을 더 빠르게 끝내는 과제가 아닙니다.",
  LT: "짧은 문장으로 말할 여유를 남기면서 정해진 구간 내내 유지할 수 있는 노력으로 달립니다. 분할형의 회복을 이유로 매 구간을 전력으로 달리지 않습니다.",
  VO2: "숨이 많이 차는 강한 노력으로 달리되 첫 반복부터 전력으로 출발하지 않습니다. 목표 시간 동안 달리는 구성이며, 참고 페이스로 계산한 거리를 반드시 채우는 과제가 아닙니다.",
  "ATP-PC": "짧은 구간에서 높은 출력을 내는 것이 목적입니다. 처음부터 끝까지 힘을 빼고 조깅하는 구간이 아닙니다. 다음 반복에서도 빠른 움직임을 재현할 수 있는지 확인하며, 세션 전체 RPE를 목표 속도로 환산하지 않습니다.",
  GLY: "정해진 거리를 강한 노력으로 달립니다. 반복과 세트에 따라 피로가 쌓일 수 있으므로 첫 반복의 전력 기록을 매번 재현하는 과제로 해석하지 않습니다. 개인 목표 초와 허용할 기록 변화는 별도 채택 대상입니다.",
  MIX: "빠른 구간과 느린 구간의 리듬 차이를 만듭니다. 빠른 구간을 모두 전력으로 달리는 과제가 아니며, 느린 구간까지 같은 강도로 밀어붙이지 않습니다.",
  REC: "편안하게 걷습니다. 운동을 마쳤다는 사실만으로 피로나 통증이 해소됐다고 판단하지 않습니다.",
}
const roles = {
  BUILDUP: "출발부터 속도를 점차 올리는 접근 구간입니다. 뒤의 빠른 구간과 구분해서 수행합니다.",
  WALK: "표시된 시간 또는 거리만큼 걷습니다. 임의로 조깅 회복으로 바꾸지 않습니다.",
  JOG: "본운동보다 분명히 느린 편안한 조깅으로 회복합니다. 본운동 목표 페이스를 유지하는 구간이 아닙니다.",
  EASY_RUN: "빠른 구간보다 편안한 달리기로 속도를 낮춥니다. 추가 고강도 반복으로 계산하지 않습니다.",
  WALK_OR_STAND: "표시된 시간 동안 걷거나 서서 쉽니다. 시간이 지났다는 사실만으로 완전 회복을 보장하지 않습니다.",
  ROLL_ON: "달리기를 이어가되 직전 운동 구간보다 속도를 낮춥니다. 회복 거리의 기록을 경쟁하거나 빠른 구간처럼 달리지 않습니다.",
}
const methods = {
  STANDING_ACCELERATION: "서 있는 출발에서 정해진 거리까지 가속합니다. 이미 빠르게 달리다가 진입하는 플라잉 구간과 다릅니다.",
  FLYING_SEGMENT: "접근 구간에서 가속한 뒤 표시된 짧은 본운동 구간을 빠르게 통과합니다. 접근 거리도 별도 구간으로 보존합니다.",
  TIMED_ACCELERATION: "출발 뒤 정해진 초 동안 가속합니다. 특정 거리를 같은 시간 안에 채우라는 뜻은 아닙니다.",
}

// These subjective work-bout targets are product coaching choices, not a conversion
// from session RPE, measured metabolic thresholds, or percentages of maximal speed.
const efforts = {
  BASE: { rpe: [3, 4], cue: "문장으로 대화할 수 있는 노력", adjustment: "대화하기 어려우면 속도를 낮춥니다. 시간을 채우려고 강도를 올리지 않습니다." },
  LT: { rpe: [6, 7], cue: "힘들지만 정해진 구간 동안 고르게 유지하는 노력", adjustment: "첫 구간부터 끝까지 유지하기 어려우면 속도를 낮춥니다. 회복이 있는 분할형도 전력 반복으로 바꾸지 않습니다." },
  VO2: { rpe: [7, 8], cue: "숨이 많이 차지만 다음 반복을 남겨 두는 강한 노력", adjustment: "짧은 반복이라고 더 빠르게 달리지 않습니다. 참고 거리보다 정해진 운동 시간이 종료 기준입니다." },
  "ATP-PC": { rpe: null, cue: "빠르게 가속하고 높은 출력을 내되 동작의 질을 유지", adjustment: "힘을 더 줘도 가속이나 동작이 뚜렷하게 나빠지면 남은 반복을 억지로 채우지 않습니다. 숨이 덜 찬다는 이유로 반복을 추가하지 않습니다." },
  GLY: { rpe: [8, 9], cue: "강한 노력으로 정해진 거리를 반복하되 첫 회 전력 기록 경쟁은 하지 않음", adjustment: "피로로 동작이 무너지면 반복을 중단합니다. 세트 회복을 추가한 구성도 더 빠르게 달리라는 허가가 아닙니다." },
  MIX: { rpe: [6, 7], cue: "빠른 구간에서 유지 가능한 강한 리듬, 느린 구간에서 분명한 속도 감소", adjustment: "느린 구간을 경쟁하지 않습니다. 뒤의 빠른 구간을 위해 느린 구간까지 강도를 올리지 않습니다." },
  REC: { rpe: [1, 2], cue: "편안한 걷기", adjustment: "회복 운동을 완료해도 회복이 끝났다고 판단하지 않습니다." },
}

function effortProposal(p) {
  if (p.family === "OFF") return { status: "NOT_APPLICABLE", work: null, recovery: null, sessionRpeTarget: null }
  const effort = efforts[p.family]
  if (!effort) throw Error("UNKNOWN_EFFORT_FAMILY")
  return {
    status: "PRODUCT_COACHING_CHOICE_OWNER_PENDING", scale: "SUBJECTIVE_0_TO_10_WORK_BOUT",
    work: structuredClone(effort),
    recovery: { rpe: [1, 3], cue: "걷기·쉬운 조깅·정지는 원래 구간 표시를 따릅니다. 숨참이 즉시 이 숫자로 내려가야 한다는 뜻은 아닙니다." },
    sessionRpeTarget: null, measuredPhysiology: false, automaticDoseChange: false,
    boundary: "이 범위는 본운동의 체감 노력 제안입니다. 개인 젖산역치·VO2max·최대속도를 측정하거나 보장하지 않습니다. 통증·이상 시 기존 안전 절차가 우선합니다.",
  }
}

export function proposeMethodExecutionGuidance(p) {
  const parts = expandProposal(p)
  if (p.family !== "OFF" && !work[p.family]) throw Error("UNKNOWN_GUIDANCE_FAMILY")
  return {
    version: "0.2", protocolId: p.id, status: "COACHING_PROPOSAL_NOT_ADOPTED", executionAuthority: "NONE",
    scientificDoseValidation: false, personalPaceCalculated: false,
    effortProposal: effortProposal(p),
    methodCue: methods[p.method] ?? null,
    segments: parts.map(part => {
      const instruction = part.role === "WORK" ? work[p.family] : roles[part.role]
      if (!instruction) throw Error("UNEXPLAINED_SEGMENT_ROLE")
      return { ...part, instruction }
    }),
    offReason: p.family === "OFF" ? "계획된 운동 구간이 없습니다. 실제 활동이나 몸 상태를 0으로 기록하지 않습니다." : null,
    pending: p.family === "OFF" ? ["OWNER_ADOPTION", "WHOLE_CYCLE_PLACEMENT"]
      : ["OWNER_ADOPTION", "EFFORT_TARGET_APPLICABILITY", "PERSONAL_PACE_WHERE_SUPPORTED", "WHOLE_CYCLE_PLACEMENT"],
  }
}
