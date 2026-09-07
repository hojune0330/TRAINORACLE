export function planErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "INCOMPLETE_FRAME":
      return "현재 주기의 진행 기록이 아직 남아 있어요. 일정에서 완료·휴식·건너뜀을 기록하거나, 표시된 일정이 끝난 뒤 다시 확인해 주세요."
    case "FRAME_NOT_STARTED":
      return "현재 계획의 시작일이 아직 오지 않았어요. 기존 일정은 그대로 유지해요."
    case "INVALID_NEXT_START_DATE":
      return "다음 시작일은 오늘 또는 그 이후의 날짜로 골라 주세요."
    case "ACTIVE_HOLD":
    case "SAFETY_GATE_ACTIVE":
    case "SAFETY_GATE_UNKNOWN":
      return "통증이나 몸 상태 확인이 필요해 다음 계획으로 바꾸지 않았어요. 현재 기록을 확인해 주세요."
    case "FORMATION_REVIEW_REQUIRED":
      return "현재 입력만으로는 계획안을 만들지 않아요. 훈련 내용을 검토한 뒤 초안으로 이어집니다."
    case "PLAN_STORAGE_WRITE_FAILED":
      return "계획을 이 기기에 저장하지 못했어요. 화면은 바뀌지 않았고 다시 시도할 수 있어요."
    case "PLAN_STORAGE_STATE_UNCERTAIN":
      return "계획 저장을 되돌렸는지 확인할 수 없어요. 이 화면을 새로 열어 현재 계획을 확인해 주세요."
    case "INVALID_STORED_PLAN":
      return "이 기기에 저장된 계획을 읽을 수 없어요. 화면을 새로 열어 현재 상태를 확인해 주세요."
    case "MUTATION_LOCK_UNAVAILABLE":
      return "다른 계획 변경 작업이 진행 중이거나 안전한 저장 잠금을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요."
    case "STALE_BASE":
      return "다른 화면에서 계획이 이미 바뀌었어요. 현재 계획을 다시 연 뒤 확인해 주세요."
    case "STALE_CANDIDATE_SELECTION":
      return "훈련 방법이나 기준 기록이 바뀌어 이전 저장을 취소했어요. 지금 보이는 계획을 확인한 뒤 선택해 주세요."
    case "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE":
      return "선택한 상세 훈련을 지금 적용할 수 없어요. 현재 제공되는 방법을 다시 골라 주세요."
    case "PACE_ANCHOR_RECONFIRMATION_REQUIRED":
      return "선택했던 경기 기록이 바뀌었거나 현재 기준으로 사용할 수 없어요. 기준 기록을 다시 확인한 뒤 계획을 선택해 주세요."
    case "RECENT_JOURNAL_REQUIRES_REVIEW":
    case "CURRENT_CHECK_REQUIRES_REVIEW":
      return "저장 전에 몸 상태를 다시 확인해야 해요. 최근 기록과 현재 몸 상태를 확인한 뒤 진행해 주세요."
    default:
      return `계획을 만들지 못했어요 · ${errorCode}`
  }
}
