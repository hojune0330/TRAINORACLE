export const ACCOUNT_WRITE_REJECTIONS = [
  "PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE",
  "UPGRADE_REQUIRED", "FILE_EVIDENCE_DISABLED", "INVALID_FILE_OBSERVATION", "FILE_OBSERVATION_CONFLICT",
  "COMPARISON_ORIGINAL_UNAVAILABLE", "INVALID_COMPARISON_RELATION", "COMPARISON_CAPACITY_EXCEEDED",
] as const
export type AccountJournalWriteRejection = (typeof ACCOUNT_WRITE_REJECTIONS)[number]
export const FILE_WRITE_REJECTION_MESSAGES = {
  UPGRADE_REQUIRED: "이 기록을 읽고 저장하려면 앱을 새로 열어 최신 버전을 사용해 주세요. 기존 기록과 입력은 보관돼 있어요.",
  FILE_EVIDENCE_DISABLED: "파일 분석 자료의 새 저장을 잠시 중단했어요. 기존 기록은 그대로 있고 원본 파일도 바뀌지 않았어요.",
  INVALID_FILE_OBSERVATION: "가져온 기록의 수치를 확인하지 못해 저장하지 않았어요. 원본 파일을 다시 확인해 주세요.",
  FILE_OBSERVATION_CONFLICT: "다른 곳에서 이 운동 기록이 바뀌었어요. 기존 기록을 확인한 뒤 다시 정정해 주세요.",
  COMPARISON_ORIGINAL_UNAVAILABLE: "계정에 저장된 원래 계획을 확인하지 못해 비교를 저장하지 않았어요. 운동 기록은 그대로예요.",
  INVALID_COMPARISON_RELATION: "비교할 구간과 원본 기록을 다시 확인해 주세요. 기존 기록을 덮어쓰지 않았어요.",
  COMPARISON_CAPACITY_EXCEEDED: "이 기록에 보관할 수 있는 비교 수를 넘었어요. 기존 비교는 삭제하지 않고 유지했어요.",
} as const
export function isAccountJournalWriteRejection(value: unknown): value is AccountJournalWriteRejection {
  return ACCOUNT_WRITE_REJECTIONS.some(reason => reason === value)
}
