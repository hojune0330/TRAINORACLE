/*
 * P6 마감 디테일 (마스터 플랜 §3-19/20) — 제스처 수학 순수 함수 모음.
 * 프레임 컴포넌트에서 분리해 유닛 테스트가 DOM 없이 수치 계약을 검증한다.
 */

/* 스키마 계약(마이그레이션 §2 C4): 중심 좌표는 어떤 경우에도 4~96%를 벗어날 수 없다. */
export const PLACEMENT_MIN_PERCENT = 4
export const PLACEMENT_MAX_PERCENT = 96

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
)

/*
 * 회전·스케일이 반영된 축 정렬 경계 상자(AABB)의 반폭/반높이 (px).
 * w' = |w·cosθ| + |h·sinθ|, h' = |w·sinθ| + |h·cosθ| — 표준 회전 AABB 공식.
 */
export function rotatedAabbHalfExtents(
  widthPx: number,
  heightPx: number,
  rotationDeg: number,
): { readonly halfWidthPx: number; readonly halfHeightPx: number } {
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  return {
    halfWidthPx: (widthPx * cos + heightPx * sin) / 2,
    halfHeightPx: (widthPx * sin + heightPx * cos) / 2,
  }
}

/*
 * 회전 인지 중심 좌표 허용 범위 (마스터 플랜 §3-20).
 * 목표: 아이템 AABB 전체가 페이지 4% 마진 안에 머물도록 중심 clamp 범위를 좁힌다.
 * 큰 아이템(범위 반전 — AABB가 92%를 초과)은 스키마 기본 범위 4~96으로 폴백한다:
 * 좁히기만 허용하고 절대 넓히지 않으므로 스키마 계약은 항상 지켜진다.
 */
export function rotationAwareCenterBounds(
  halfExtentPercent: number,
): { readonly minPercent: number; readonly maxPercent: number } {
  const minCandidate = PLACEMENT_MIN_PERCENT + halfExtentPercent
  const maxCandidate = PLACEMENT_MAX_PERCENT - halfExtentPercent
  if (minCandidate > maxCandidate) {
    return { minPercent: PLACEMENT_MIN_PERCENT, maxPercent: PLACEMENT_MAX_PERCENT }
  }
  return { minPercent: minCandidate, maxPercent: maxCandidate }
}

export function clampToCenterBounds(
  percent: number,
  bounds: { readonly minPercent: number; readonly maxPercent: number },
): number {
  return clamp(percent, bounds.minPercent, bounds.maxPercent)
}

/* 관성 감속 시간 (마스터 플랜 §3-19): 놓는 순간 40ms 선형 감속. */
export const INERTIA_DECAY_MS = 40

/*
 * 관성 이월 거리 (px): 초기 속도 v(px/ms)가 40ms 동안 선형으로 0까지 감속하면
 * 이동 거리는 v·t/2. 속도 0.05px/ms 미만은 노이즈로 보고 이월하지 않는다.
 */
export function inertiaCarryPx(velocityPxPerMs: number, directionSign: number): number {
  if (velocityPxPerMs < 0.05) return 0
  return directionSign * velocityPxPerMs * INERTIA_DECAY_MS / 2
}

/* 관성 진행률(0~1)에 따른 누적 이동 비율 — 선형 감속 적분: 2t − t². */
export function inertiaProgress(elapsedMs: number): number {
  const t = clamp(elapsedMs / INERTIA_DECAY_MS, 0, 1)
  return 2 * t - t * t
}
