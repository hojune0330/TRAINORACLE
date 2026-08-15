// =============================================================================
// TRAINORACLE — Memo Safety (transient, local-only)
//
// ADR A3: 프론트엔드는 impl/을 직접 import 한다 (이중 구현 금지).
//
// 프라이버시 (DAILY_LOG_AND_CHECKIN_SPEC §8 memo_policy):
//  - 평가기는 원문 자유 텍스트를 저장하거나 반환하지 않는다.
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
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { D9Disposition, D9Result } from "@impl/d9/evaluator"
import type { RveRuleEvaluatorSignal } from "@impl/rve/signal"

export interface TransientMemoAssessment {
  readonly disposition: D9Disposition
  readonly blocksPlanGeneration: boolean
  /** 비민감 reason code만 — 원문 조각 없음 */
  readonly reasonCodes: readonly string[]
}

const D9_RESULT_KEYS = [
  "disposition",
  "blocksPlanGeneration",
  "reasonCodes",
  "evidence",
] as const
const D9_EVIDENCE_KEYS = [
  "ruleId",
  "family",
  "route",
  "reasonCode",
  "clauseIndex",
  "clause",
  "matchedBy",
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isD9Disposition(value: unknown): value is D9Disposition {
  return value === "D9_ACTIVE" || value === "D9_UNKNOWN" || value === "D9_CLEARED"
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.length > 0)
}

function isD9Evidence(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, D9_EVIDENCE_KEYS)) return false

  const route = value["route"]
  const clauseIndex = value["clauseIndex"]
  return typeof value["ruleId"] === "string"
    && typeof value["family"] === "string"
    && (route === "ACTIVE" || route === "UNKNOWN" || route === "ADVISORY")
    && typeof value["reasonCode"] === "string"
    && typeof clauseIndex === "number"
    && Number.isInteger(clauseIndex)
    && clauseIndex >= 0
    && typeof value["clause"] === "string"
    && isNonEmptyStringArray(value["matchedBy"])
}

function isD9Result(value: unknown): value is D9Result {
  if (!isRecord(value) || !hasOnlyKeys(value, D9_RESULT_KEYS)) return false

  const disposition = value["disposition"]
  const blocksPlanGeneration = value["blocksPlanGeneration"]
  return isD9Disposition(disposition)
    && typeof blocksPlanGeneration === "boolean"
    && blocksPlanGeneration === (disposition !== "D9_CLEARED")
    && isNonEmptyStringArray(value["reasonCodes"])
    && Array.isArray(value["evidence"])
    && value["evidence"].every(isD9Evidence)
}

function isCanonicalRveSignal(value: unknown): value is RveRuleEvaluatorSignal {
  if (!isRecord(value)) return false

  const storedStatus = value["storedStatus"]
  const isBlockingStatus = storedStatus === "ACTIVE" || storedStatus === "UNKNOWN"
  const isClearedStatus = storedStatus === "CLEARED"
  const audit = value["audit"]

  return (isBlockingStatus || isClearedStatus)
    && value["ruleRef"] === "RULE_SPEC_D1_D9.D-9"
    && value["blocksPlanGeneration"] === isBlockingStatus
    && value["requiresHumanReview"] === isBlockingStatus
    && isNonEmptyStringArray(value["nonSensitiveReasonCodes"])
    && isRecord(audit)
    && audit["event"] === "RVE_SIGNAL_CREATED"
    && audit["privacy"] === "REASON_CODES_ONLY"
}

function evaluatorShapeFailsafe(): TransientMemoAssessment {
  return {
    disposition: "D9_UNKNOWN",
    blocksPlanGeneration: true,
    reasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
  }
}

/**
 * 자유 텍스트 메모를 로컬에서 일시 평가한다.
 * 원문은 반환값에 포함되지 않으며, 평가기 자체는 원문을 저장하지 않는다.
 * 평가기 예외 시 fail-safe로 D9_UNKNOWN을 반환한다.
 */
export function assessMemoTransient(rawText: string): TransientMemoAssessment {
  try {
    const result: unknown = evaluateD9ColloquialLayer(rawText)
    if (!isD9Result(result)) return evaluatorShapeFailsafe()

    const rve = mapD9ResultToRveSignal(result)
    if (!isCanonicalRveSignal(rve)) return evaluatorShapeFailsafe()

    return {
      disposition: result.disposition,
      blocksPlanGeneration: rve.blocksPlanGeneration,
      reasonCodes: rve.nonSensitiveReasonCodes,
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
export function assessPurposeScopedMemo(
  rawText: string,
  purpose?: unknown,
): TransientMemoAssessment | null {
  if (purpose !== "ANALYZABLE_TRAINING_NOTE" || rawText.trim() === "") return null
  return assessMemoTransient(rawText)
}

export function painLevelsRequireReview(painParts: Record<string, number>): boolean {
  return Object.values(painParts).some((lvl) => lvl >= 4)
}
