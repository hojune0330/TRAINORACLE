import { describe, expect, it } from "vitest"
import { eulReul, euroRo, iGa, withJosa } from "./korean-josa"

/*
 * 감사 2026-08-27 F2: 꾸미기 알림이 "결승선 스티커을 사용했어요",
 * "맑은 날으로 교체했어요"처럼 받침을 무시했다.
 * 사용자에게 보이는 문장은 어법이 맞아야 한다.
 */
describe("korean josa selection", () => {
  it("chooses 을/를 by final consonant", () => {
    expect(eulReul("결승선 스티커")).toBe("를")
    expect(eulReul("맑은 날")).toBe("을")
    expect(eulReul("체크 테이프")).toBe("를")
    expect(eulReul("남색 잉크")).toBe("를")
    expect(eulReul("푹 쉬었어요")).toBe("를")
    expect(eulReul("출발선 아바타")).toBe("를")
  })

  it("chooses 으로/로 with the ㄹ-final exception", () => {
    expect(euroRo("맑은 날")).toBe("로")
    expect(euroRo("결승선 스티커")).toBe("로")
    expect(euroRo("트랙 노트")).toBe("로")
    expect(euroRo("하늘 일지 테마")).toBe("로")
    expect(euroRo("도장")).toBe("으로")
  })

  it("chooses 이/가 by final consonant", () => {
    expect(iGa("맑은 날")).toBe("이")
    expect(iGa("결승선 스티커")).toBe("가")
  })

  it("joins word and josa for notification sentences", () => {
    expect(withJosa("결승선 스티커", "을/를")).toBe("결승선 스티커를")
    expect(withJosa("맑은 날", "을/를")).toBe("맑은 날을")
    expect(withJosa("맑은 날", "으로/로")).toBe("맑은 날로")
  })

  it("stays safe on words without hangul", () => {
    expect(eulReul("RPE")).toBe("를")
    expect(euroRo("5000m")).toBe("으로")
    expect(eulReul("")).toBe("를")
  })
})
