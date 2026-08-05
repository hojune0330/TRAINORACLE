import { describe, expect, it } from "vitest"
import { normalizePace, parsePaceText } from "./numeric-input"

describe("normalizePace (WORK_ORDER_UX2 §3-2)", () => {
  it("normalizes colon, quote, and dot formats to the single standard", () => {
    expect(normalizePace("5:30")).toBe("5'30\"")
    expect(normalizePace("5'30\"")).toBe("5'30\"")
    expect(normalizePace("5.30")).toBe("5'30\"")
    expect(normalizePace("530")).toBe("5'30\"")
  })

  it("keeps the seconds value identical to parsePaceText so nothing changes at save time", () => {
    expect(parsePaceText("5:30")).toBe(330)
    expect(parsePaceText("5'30\"")).toBeNull() // parsePaceText는 정규화 전 원본 파서 — 콜론만
    expect(normalizePace("5'30\"")).toBe("5'30\"")
    expect(normalizePace("5:30")).toBe("5'30\"")
  })

  it("pads single-digit seconds", () => {
    expect(normalizePace("5:05")).toBe("5'05\"")
    expect(normalizePace("5'5\"")).toBe("5'05\"")
  })

  it("rejects invalid seconds and empty input", () => {
    expect(normalizePace("")).toBeNull()
    expect(normalizePace("   ")).toBeNull()
    expect(normalizePace("5:60")).toBeNull()
    expect(normalizePace("0:30")).toBeNull()
    expect(normalizePace("abc")).toBeNull()
    expect(normalizePace("5:")).toBeNull()
  })

  it("does not touch sprint-range paces (NORTH_STAR §3 — format-only change)", () => {
    // 1마일 스프린트 페이스 4:00은 240s/km — 환산하지 않고 형식만 표준화
    expect(normalizePace("4:00")).toBe("4'00\"")
    expect(parsePaceText("4:00")).toBe(240)
  })

  it("parses four-digit bare input as mm:ss", () => {
    expect(normalizePace("430")).toBe("4'30\"")
    expect(normalizePace("5300")).toBe("53'00\"")
  })
})
