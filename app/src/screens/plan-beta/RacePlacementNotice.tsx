import type { RacePlacementState } from "@impl/plan-generator/race-placement"

export function RacePlacementNotice({
  state,
}: {
  readonly state: RacePlacementState
}) {
  const content = racePlacementCopy(state)
  return (
    <section className="race-placement-notice" aria-label="목표 경기 반영 상태" role="status">
      <span>목표 경기 반영</span>
      <strong>{content.title}</strong>
      <p>{content.body}</p>
      {"targetRaceDate" in state && <small>선택한 날짜: {state.targetRaceDate}</small>}
    </section>
  )
}

export function racePlacementCopy(state: RacePlacementState): {
  readonly title: string
  readonly body: string
} {
  switch (state.kind) {
    case "NO_TARGET_RACE":
      return {
        title: "경기 날짜 없이 만든 일반 계획",
        body: "선택한 종목과 훈련 조건으로 후보를 만들었어요. 특정 경기에 맞춘 날짜 이동이나 훈련량·강도 조정은 적용하지 않았어요.",
      }
    case "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED":
      return {
        title: "경기 날짜는 미리보기만 가능",
        body: "날짜 저장 권한과 적용 가능한 경기 배치 기준이 아직 없어요. 계획 후보를 저장하거나 시작할 수 없고, 훈련 내용·양·강도도 바꾸지 않아요.",
      }
    case "TARGET_RACE_STORED_FOR_LATER":
      return {
        title: "경기 날짜만 나중을 위해 보관",
        body: "경기가 현재 계획 범위보다 뒤에 있어 날짜만 보관한 상태예요. 현재 계획의 훈련 내용·양·강도와 날짜 배치는 바꾸지 않았어요.",
      }
    case "RACE_PLACEMENT_ONLY":
      return {
        title: "승인된 기준으로 날짜 배치만 적용",
        body: "승인된 같은 종목·계획 길이 기준으로 훈련 날짜만 옮겼어요. 훈련 내용·양·강도는 그대로예요.",
      }
    case "GENERIC_PLACEMENT_NO_AUTHORITY":
      return {
        title: "적용 가능한 경기 배치 기준 없음",
        body: "같은 종목과 계획 길이에 맞는 승인 기준을 찾지 못했어요. 일반 배치를 유지하며 훈련 내용·양·강도는 바꾸지 않았어요.",
      }
  }
}
