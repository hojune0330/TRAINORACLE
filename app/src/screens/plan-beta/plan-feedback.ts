export function planErrorMessage(errorCode: string): string {
  switch (errorCode) {
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
    default:
      return `계획을 만들지 못했어요 · ${errorCode}`
  }
}
