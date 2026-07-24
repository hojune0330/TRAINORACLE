// 데이터 안전 상시 안내 계약 테스트
// - 상시 노출: 닫기 버튼이 없다 (소유자 지시: "계속 언급하게 하자")
// - 계정 flag OFF(테스트 env): CTA 없이 내보내기 안내로 폴백
// - 사실 고지 문구 포함, 협박형 카운트다운/손실 문구 없음
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

afterEach(cleanup)
import React from "react"
import { DataSafetyNotice } from "./DataSafetyNotice"

describe("DataSafetyNotice", () => {
  it("기기 저장의 한계를 사실대로 고지한다", () => {
    render(<DataSafetyNotice />)
    const notice = screen.getByTestId("data-safety-notice")
    expect(notice.textContent).toContain("이 기기에만 있어요")
    expect(notice.textContent).toContain("지워질 수 있어요")
  })

  it("닫기 버튼이 없다 — 상시 노출", () => {
    render(<DataSafetyNotice />)
    expect(screen.queryByRole("button", { name: /닫기|dismiss/i })).toBeNull()
  })

  it("계정 flag OFF면 계정 CTA 대신 내보내기 안내로 폴백한다", () => {
    render(<DataSafetyNotice onOpenAccount={() => {}} />)
    // 테스트 환경은 VITE_SUPABASE_* 미설정 → flag OFF
    expect(screen.queryByRole("button", { name: /계정 연동/ })).toBeNull()
    expect(screen.getByTestId("data-safety-notice").textContent).toContain("안전한 내보내기")
  })

  it("협박형 문구(손실 임박·카운트다운)를 쓰지 않는다", () => {
    render(<DataSafetyNotice />)
    const text = screen.getByTestId("data-safety-notice").textContent ?? ""
    expect(text).not.toMatch(/영영|사라집니다|마지막 기회|지금 당장/)
  })
})
