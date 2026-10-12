import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const SRC_ROOT = dirname(fileURLToPath(import.meta.url))
const FORBIDDEN_COPY = [
  /오늘의 흐름/u,
  /기록과 흐름/u,
  /훈련 흐름/u,
  /다음 계획에 이어지는 정보/u,
  /다음 훈련 살펴보기/u,
  /(?:생리학적|에너지 경로|젖산|사용 연료) 맥락/u,
  /^자세히$/u,
]
// Every forbidden phrase contains one of these raw fragments. Parse escaped
// strings too, since their displayed Korean text may not appear in source.
const POSSIBLE_FORBIDDEN_COPY = /흐름|이어지는|살펴보기|생리학적|에너지|젖산|연료|자세히|\\/u

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    if (!/\.(?:ts|tsx)$/u.test(entry.name) || /\.(?:test|spec)\./u.test(entry.name)) return []
    return [path]
  })
}

function koreanCopy(file: string, code = readFileSync(file, "utf8")): readonly string[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const values: string[] = []
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = ts.isJsxText(node) ? node.getText(source) : node.text
      const normalized = value.replace(/\s+/gu, " ").trim()
      // The approved memo depth switch is a mode, not an unnamed destination.
      let owner: ts.Node | undefined = node.parent
      while (owner && !ts.isVariableDeclaration(owner)) owner = owner.parent
      const memoDepthMode = file === join(SRC_ROOT, "domain", "workout-memo-presentation.ts")
        && normalized === "자세히" && owner && ts.isVariableDeclaration(owner)
        && ts.isIdentifier(owner.name) && owner.name.text === "WORKOUT_MEMO_GROUPS"
      if (/[가-힣]/u.test(normalized) && !memoDepthMode) values.push(normalized)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return values
}

function forbiddenCopy(file: string, code: string): readonly string[] {
  if (!POSSIBLE_FORBIDDEN_COPY.test(code)) return []
  return koreanCopy(file, code).filter(copy => FORBIDDEN_COPY.some(pattern => pattern.test(copy)))
}

describe("사용자 문구는 행동과 내용을 직접 말한다", () => {
  it("limits the approved depth-mode label to the memo switch, not generic actions", () => {
    const mode = 'const WORKOUT_MEMO_GROUPS = [{ id: "detail", label: "자세히" }]'
    const memo = join(SRC_ROOT, "domain", "workout-memo-presentation.ts")
    expect(koreanCopy(memo, mode)).toEqual([])
    expect(koreanCopy(memo, `${mode}; const button = "자세히"`)).toEqual(["자세히"])
    expect(koreanCopy(join(SRC_ROOT, "other.ts"), mode)).toEqual(["자세히"])
  })
  it("추상적인 홈·계획·분석 문구를 다시 사용하지 않는다", () => {
    const violations = sourceFiles(SRC_ROOT).flatMap(file =>
      forbiddenCopy(file, readFileSync(file, "utf8")).map(copy => `${file}: ${copy}`),
    )
    expect(violations).toEqual([])
  }, 20_000)
  it("does not filter forbidden copy when source contains escapes or line breaks", () => {
    const file = join(SRC_ROOT, "other.ts")
    for (const [source, text] of [
      ['const label = "훈련\\n흐름"', "훈련 흐름"],
      ['const label = "\\uC790\\uC138\\uD788"', "자세히"],
      ['const label = "다음 계획에 이어지는 정보"', "다음 계획에 이어지는 정보"],
      ['const label = "사용 연료 맥락"', "사용 연료 맥락"],
    ] as const) {
      expect(forbiddenCopy(file, source)).toEqual([text])
    }
  })
})
