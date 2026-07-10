/**
 * BalanceMarker — 훈련 구성 균형 마커 (▽ 부족 / △ 과다) + 탭 카드
 *
 * 원칙 (총책임자 결정, 사용자 승인 권장안 ①):
 * - 추이 화면에선 "가볍게": 벗어난 항목에만 작은 마커. in_range는 침묵.
 * - 마커를 누르면 3행 카드: 무엇이 / 얼마나 벗어났나 / 관련 신호 1개.
 * - 절대 안전 판정이 아니다 — '과다'가 떠도 훈련을 막지 않고,
 *   '균형'이어도 D9/Safety Gate 차단을 풀지 않는다. 표시 전용.
 * - 기준값 계약(ORDER_005 Task B) 수용 전까지 `기준: 데모` 배지 유지.
 * - 위치 보정(오버플로우/플립)·Escape 닫기는 공용 Popover가 담당.
 */
import type { BalanceHintData } from "../domain/balance"
import { BALANCE_BASIS_LABEL } from "../domain/balance"
import { usePopover, PopCard } from "./Popover"

export function BalanceMarker({ hint }: { hint: BalanceHintData | null }) {
  const { open, toggle, wrapRef } = usePopover()

  if (!hint) return null // in_range → 마커 없음 (침묵)

  const above = hint.state === "above_range"
  const glyph = above ? "△" : "▽"
  const accent = above ? "var(--warn)" : "var(--ink-3)"

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-label={`${hint.title} — 자세히 ${open ? "닫기" : "보기"}`}
        aria-expanded={open}
        onClick={toggle}
        style={{
          // 히트 영역 26px 확보 (시각 글리프는 그대로)
          marginLeft: 2, padding: "0 6px", height: 26,
          border: 0, background: "transparent",
          color: accent, fontFamily: "var(--mono)",
          fontSize: 10, fontWeight: 700, lineHeight: 1,
          cursor: "pointer",
          display: "inline-flex", alignItems: "center",
          verticalAlign: "middle",
        }}
      >{glyph}</button>

      <PopCard
        open={open}
        align="right"
        width={244}
        label={`balance:${hint.title}`}
        accentBorder={{ border: above ? "var(--warn)" : "var(--line)", bar: accent }}
      >
        <div style={{
          fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700,
          color: accent, letterSpacing: "0.1em", marginBottom: 5,
        }}>
          {glyph} {hint.title}
        </div>
        <div style={{
          fontFamily: "var(--sans, inherit)", fontSize: 11.5, lineHeight: 1.55,
          color: "var(--ink)", fontWeight: 400, whiteSpace: "normal",
        }}>
          {hint.detail}
        </div>
        <div style={{
          marginTop: 5, fontSize: 10.5, lineHeight: 1.5,
          color: "var(--ink-2)", fontWeight: 400, whiteSpace: "normal",
        }}>
          {hint.signal}
        </div>
        <div style={{
          marginTop: 7, paddingTop: 6, borderTop: "1px dashed var(--hair)",
          fontFamily: "var(--mono)", fontSize: 9, lineHeight: 1.5,
          color: "var(--ink-3)", letterSpacing: "0.03em", whiteSpace: "normal",
        }}>
          자세한 건 분석 탭에서 · 참고용이에요 — 훈련 판단은 코치와 함께
        </div>
      </PopCard>
    </span>
  )
}

/** `기준: 데모` 배지 — Task B 계약 수용 전까지 균형 표시 섹션에 부착 */
export function DemoBasisBadge() {
  return (
    <span style={{
      marginLeft: 8, padding: "1px 5px",
      border: "1px dashed var(--ink-4)",
      fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 500,
      color: "var(--ink-4)", letterSpacing: "0.08em",
      verticalAlign: "middle", whiteSpace: "nowrap",
    }}>{BALANCE_BASIS_LABEL}</span>
  )
}
