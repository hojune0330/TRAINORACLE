// =============================================================================
// TRAINORACLE — Memo Safety (transient, local-only)
//
// ADR A3: 프론트엔드는 impl/을 직접 import 한다 (이중 구현 금지).
//
// 프라이버시 (DAILY_LOG_AND_CHECKIN_SPEC §8 memo_policy):
//  - 원문 자유 텍스트는 이 함수 밖으로 영속되지 않는다.
//  - 반환값은 disposition + reasonCodes(비민감 코드)만 UI 계층에 전달한다.
//  - evidence의 clause(원문 조각)는 UI에 재노출하지 않는다.
//
// 안전 불변식 (변경 금지):
//  - D9_ACTIVE  → BLOCK
//  - D9_UNKNOWN → BLOCK_OR_HUMAN_REVIEW
//  - advisory는 CLEARED 하위에서만 존재 (4번째 처분 신설 금지)
//  - 평가기 실패 → UNKNOWN fail-safe
// =============================================================================

import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import type { D9Disposition } from "@impl/d9/evaluator"

export interface TransientMemoAssessment {
  readonly disposition: D9Disposition
  readonly blocksPlanGeneration: boolean
  /** 비민감 reason code만 — 원문 조각 없음 */
  readonly reasonCodes: readonly string[]
}

/**
 * 자유 텍스트 메모를 로컬에서 일시 평가한다.
 * 원문은 반환값에 포함되지 않으며, 호출 후 어떤 저장소에도 남지 않는다.
 * 평가기 예외 시 fail-safe로 D9_UNKNOWN을 반환한다.
 */
export function assessMemoTransient(rawText: string): TransientMemoAssessment {
  try {
    const result = evaluateD9ColloquialLayer(rawText)
    return {
      disposition: result.disposition,
      blocksPlanGeneration: result.blocksPlanGeneration,
      reasonCodes: result.reasonCodes,
    }
  } catch {
    // 평가기 실패 → UNKNOWN fail-safe (스펙 불변식)
    return {
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: ["EVALUATOR_FAILURE_FAILSAFE"],
    }
  }
}

/** 통증 4~5 입력 시 Review 상태 노출 여부 (매트릭스 GAP_UI_MISSING 대응) */
export function painLevelsRequireReview(painParts: Record<string, number>): boolean {
  return Object.values(painParts).some((lvl) => lvl >= 4)
}
