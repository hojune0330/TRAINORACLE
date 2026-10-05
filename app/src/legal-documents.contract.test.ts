import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const PUBLIC_LEGAL_DIR = resolve(process.cwd(), "public", "legal")
const VERSION = "2026-10-05"

function readLegalDocument(filename: string) {
  return readFileSync(resolve(PUBLIC_LEGAL_DIR, filename), "utf8")
}

describe("public legal documents", () => {
  it("publishes the approved operator identity and version in both documents", () => {
    for (const filename of ["privacy.html", "terms.html"]) {
      const document = readLegalDocument(filename)

      expect(document).toContain("인피니트 오퍼튜니티")
      expect(document).toContain("aaclub")
      expect(document).toContain("528-05-02781")
      expect(document).toContain(VERSION)
      expect(document).not.toMatch(/TODO|TBD|PLACEHOLDER/u)
    }
  })

  it("distinguishes local text from optional decryptable server storage", () => {
    const privacy = readLegalDocument("privacy.html")
    const terms = readLegalDocument("terms.html")

    expect(privacy).toContain("계정 보관을 선택하지 않은 자유 메모 원문은 기기에 저장됩니다")
    expect(privacy).toContain("종단간 암호화는 아닙니다")
    expect(privacy).toContain("기존 가입·동기화 동의는 새 목적 동의로 대체되지 않습니다")
    expect(terms).toContain("비밀 글은 분석·공유에서 제외하고 원문을 외부 AI로 전송하지 않습니다")
  })

  it("keeps training plans distinct from medical clearance", () => {
    const terms = readLegalDocument("terms.html")

    expect(terms).toContain("의료 진단, 치료, 재활 처방 또는 경기 출전 허가가 아닙니다")
    expect(terms).toContain("의학적 이상이 없다는 뜻은 아닙니다")
  })

  it("cross-links the two documents and the app", () => {
    const privacy = readLegalDocument("privacy.html")
    const terms = readLegalDocument("terms.html")

    for (const document of [privacy, terms]) {
      expect(document).toContain('href="../"')
      expect(document).toContain('href="./privacy.html"')
      expect(document).toContain('href="./terms.html"')
      expect(document).toContain('href="./legal.css"')
    }
  })
})
