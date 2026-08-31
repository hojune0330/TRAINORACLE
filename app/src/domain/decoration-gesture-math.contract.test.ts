import { describe, expect, it } from "vitest"
import {
  clampToCenterBounds,
  INERTIA_DECAY_MS,
  inertiaCarryPx,
  inertiaProgress,
  PLACEMENT_MAX_PERCENT,
  PLACEMENT_MIN_PERCENT,
  rotatedAabbHalfExtents,
  rotationAwareCenterBounds,
} from "./decoration-gesture-math"

/* P6 계약 §3-20 — 회전 인지 AABB 경계. */
describe("rotation-aware AABB bounds (P6 §3-20)", () => {
  it("matches the item box exactly at 0° rotation", () => {
    // Given / When
    const { halfWidthPx, halfHeightPx } = rotatedAabbHalfExtents(78, 78, 0)

    // Then
    expect(halfWidthPx).toBeCloseTo(39, 6)
    expect(halfHeightPx).toBeCloseTo(39, 6)
  })

  it("swaps the extents at 90° rotation", () => {
    // Given — 가로로 긴 테이프형 아이템
    const { halfWidthPx, halfHeightPx } = rotatedAabbHalfExtents(210, 58, 90)

    // Then — 90° 회전이면 폭·높이가 뒤바뀐다
    expect(halfWidthPx).toBeCloseTo(29, 6)
    expect(halfHeightPx).toBeCloseTo(105, 6)
  })

  it("grows to the diagonal-projected box at 45° rotation", () => {
    // Given
    const { halfWidthPx, halfHeightPx } = rotatedAabbHalfExtents(78, 78, 45)

    // Then — |w·cos45|+|h·sin45| = 78·√2 ≈ 110.3 → half ≈ 55.15 (39보다 넓다)
    expect(halfWidthPx).toBeCloseTo((78 * Math.SQRT2) / 2, 3)
    expect(halfHeightPx).toBeCloseTo((78 * Math.SQRT2) / 2, 3)
    expect(halfWidthPx).toBeGreaterThan(39)
  })

  it("narrows the center range so the whole item stays inside the 4% margin", () => {
    // Given — 아이템 절반이 페이지의 10%를 차지
    const bounds = rotationAwareCenterBounds(10)

    // Then
    expect(bounds).toEqual({ minPercent: 14, maxPercent: 86 })
    expect(clampToCenterBounds(5, bounds)).toBe(14)
    expect(clampToCenterBounds(95, bounds)).toBe(86)
    expect(clampToCenterBounds(50, bounds)).toBe(50)
  })

  it("falls back to the schema range for oversized items instead of inverting", () => {
    // Given — AABB가 페이지의 92%를 초과하는 극단 케이스
    const bounds = rotationAwareCenterBounds(60)

    // Then — 범위 반전 금지, 스키마 기본 4~96으로 폴백 (좁히기만 허용)
    expect(bounds).toEqual({ minPercent: PLACEMENT_MIN_PERCENT, maxPercent: PLACEMENT_MAX_PERCENT })
  })

  it("never widens beyond the schema contract regardless of extent", () => {
    // Given / When / Then — 어떤 half-extent에서도 4~96 밖으로 나가지 않는다
    for (const extent of [0, 1, 10, 45.9, 46, 46.1, 60, 100]) {
      const bounds = rotationAwareCenterBounds(extent)
      expect(bounds.minPercent).toBeGreaterThanOrEqual(PLACEMENT_MIN_PERCENT)
      expect(bounds.maxPercent).toBeLessThanOrEqual(PLACEMENT_MAX_PERCENT)
      expect(bounds.minPercent).toBeLessThanOrEqual(bounds.maxPercent)
    }
  })
})

/* P6 계약 §3-19 — 40ms 관성 감속. */
describe("release inertia (P6 §3-19)", () => {
  it("carries v·t/2 for a linear decay over 40ms", () => {
    // Given — 1px/ms로 놓으면 40ms 선형 감속 → 20px 이월
    expect(INERTIA_DECAY_MS).toBe(40)
    expect(inertiaCarryPx(1, 1)).toBe(20)
    expect(inertiaCarryPx(1, -1)).toBe(-20)
    expect(inertiaCarryPx(0.5, 1)).toBe(10)
  })

  it("ignores noise velocities below 0.05px/ms", () => {
    // Given / When / Then
    expect(inertiaCarryPx(0.049, 1)).toBe(0)
    expect(inertiaCarryPx(0, 1)).toBe(0)
  })

  it("progresses along 2t−t² and completes exactly at 40ms", () => {
    // Given / When / Then — 감속 곡선: 시작은 빠르고 끝은 0 속도
    expect(inertiaProgress(0)).toBe(0)
    expect(inertiaProgress(20)).toBeCloseTo(0.75, 6)
    expect(inertiaProgress(40)).toBe(1)
    expect(inertiaProgress(999)).toBe(1)
    /* 전반 20ms 이동량(0.75)이 후반 20ms(0.25)보다 크다 — 감속 방향 확인 */
    expect(inertiaProgress(20)).toBeGreaterThan(1 - inertiaProgress(20))
  })
})
