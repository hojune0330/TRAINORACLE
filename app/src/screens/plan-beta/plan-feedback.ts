export function planErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "FORMATION_REVIEW_REQUIRED":
      return "현재 입력만으로는 계획 후보를 만들지 않아요. 훈련 내용을 검토한 뒤 초안으로 이어집니다."
    case "PLAN_STORAGE_WRITE_FAILED":
      return "계획을 이 기기에 저장하지 못했어요. 화면은 바뀌지 않았고 다시 시도할 수 있어요."
    default:
      return `계획을 만들지 못했어요 · ${errorCode}`
  }
}
