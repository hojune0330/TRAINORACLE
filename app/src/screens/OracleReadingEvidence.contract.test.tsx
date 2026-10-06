import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { OracleContentReading, OracleReaderRef, OracleReadingStatus } from "../domain/oracle-content-reader"
import { OracleReadingEvidence } from "./OracleReadingEvidence"

afterEach(cleanup)
const ref: OracleReaderRef = { source: "planActual", sourceVersion: "ORIGINAL_PLAN_7", itemId: "session:private-id", date: "2026-10-04", provenance: "ORIGINAL_PLAN" }
function reading(extra: Partial<OracleContentReading> = {}): OracleContentReading {
  return { topicId: "C07", title: "계획과 실제 수행", kind: "COMPARISON", status: "PARTIAL", personalized: true,
    readerVersion: "ORACLE_CONTENT_READER_V2_2", contentVersion: "CONTENT_9", sourceVersions: { planActual: "INPUT_COLLECTION_3" },
    inputStates: { planActual: "SUFFICIENT", training: "PARTIAL" },
    missingInputs: ["training:opaque:id:recovery", "conditions:availableMinutes"],
    facts: [{ id: "fact-1", label: "기록된 운동 시간", value: 30, unit: "min", metric: "DIRECT", owner: "SELF", sourceRefs: [ref] }],
    paragraphs: [], limitations: [], nextAction: "PLAN_REVIEW", ...extra }
}
function open() { fireEvent.click(screen.getByText("이 풀이의 자료")) }
function details() { fireEvent.click(screen.getByText("버전과 상세 출처")) }

describe("OracleReadingEvidence", () => {
  it("owns only a closed disclosure and keeps codes and identifiers out of the first reading level", () => {
    render(<OracleReadingEvidence reading={reading()} />)
    expect(screen.getByText("이 풀이의 자료")).toBeVisible()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("확인한 출처")).not.toBeVisible()
    open()
    expect(screen.getByText("이번 기간 훈련 일지 · 실제 회복 기록")).toBeVisible()
    expect(screen.getByText("시간·장소·장비와 대회 여건 · 운동할 수 있는 시간")).toBeVisible()
    for (const code of ["ORIGINAL_PLAN_7", "INPUT_COLLECTION_3", "CONTENT_9", "ORACLE_CONTENT_READER_V2_2", "session:private-id", "training:opaque:id:recovery"]) {
      expect(screen.getByText(code, { exact: true })).not.toBeVisible()
    }
    const sources = screen.getByRole("list", { name: "풀이에 사용한 출처" })
    expect(sources).toHaveTextContent("당시 계획과 실제 수행 · 2026-10-04 · 당시 계획 원본")
    expect(sources).not.toHaveTextContent("session:private-id")
  })
  it("shows the five input states distinctly without treating failed reads as missing", () => {
    const states: Record<string, OracleReadingStatus> = { profile: "SUFFICIENT", training: "PARTIAL", records: "MISSING", device: "UNAVAILABLE", friend: "REVOKED" }
    render(<OracleReadingEvidence reading={reading({ inputStates: states })} />)
    open()
    const dl = screen.getByLabelText("자료별 확인 상태")
    expect(dl).toHaveTextContent("현재 프로필 응답확인한 자료 있음")
    expect(dl).toHaveTextContent("이번 기간 훈련 일지일부 자료만 확인됨")
    expect(dl).toHaveTextContent("경기 기록입력된 자료 없음")
    expect(dl).toHaveTextContent("워치 예상 기록지금 자료를 확인할 수 없음")
    expect(dl).toHaveTextContent("친구와 비교할 자료자료 사용 동의가 철회됨")
  })
  it("translates axis, dotted friend keys and multi-part reasons without exposing embedded IDs", () => {
    render(<OracleReadingEvidence reading={reading({ missingInputs: ["STRUCTURE:three-numeric-answers", "friend.conditions:meetingWindows",
      "plan:uuid:with:colons:matching-duration-scope", "records:conflict:uuid:with:colons", "file-lap:2:time-meaning", "motivations"] })} />)
    open()
    for (const label of ["계획 선호 · 세 문항의 숫자 응답", "친구의 시간·장소·장비와 대회 여건 · 함께 운동할 수 있는 시간",
      "당시 계획 · 계획·수행 시간의 포함 범위", "경기 기록 · 서로 다른 내용으로 중복된 기록 확인", "가져온 파일의 구간 · 구간 시간의 기준", "달리는 이유"]) {
      expect(screen.getByText(label, { exact: true })).toBeVisible()
    }
    expect(screen.getByText("plan:uuid:with:colons:matching-duration-scope")).not.toBeVisible()
  })
  it("uses a safe human fallback for future keys and prototype names while preserving raw codes in nested details", () => {
    render(<OracleReadingEvidence reading={reading({ missingInputs: ["future:secret-id:unknown", "constructor:__proto__", "__proto__"] })} />)
    open()
    expect(screen.getByText("추가 자료 · 필요한 내용 확인")).toBeVisible()
    expect(screen.getByText("추가 자료", { exact: true })).toBeVisible()
    details()
    expect(screen.getByText("future:secret-id:unknown")).not.toBeVisible()
    fireEvent.click(screen.getByText("확인 항목의 원본 표기"))
    expect(screen.getByText("future:secret-id:unknown")).toBeVisible()
  })
  it("preserves fact-level references and distinguishes source collection versions from original plan versions", () => {
    render(<OracleReadingEvidence reading={reading()} />)
    open(); details()
    expect(screen.getByText("INPUT_COLLECTION_3")).toBeVisible()
    expect(screen.getByText("ORIGINAL_PLAN_7")).toBeVisible()
    expect(screen.getByText("CONTENT_9")).toBeVisible()
    expect(screen.getByText("ORACLE_CONTENT_READER_V2_2")).toBeVisible()
    const fact = screen.getByRole("region", { name: "기록된 운동 시간의 출처" })
    expect(within(fact).getByText("session:private-id")).toBeVisible()
    expect(within(fact).getByText("2026-10-04")).toHaveAttribute("datetime", "2026-10-04")
    expect(within(fact).getByText("planActual", { exact: true })).toBeVisible()
  })
  it("deduplicates identical refs but retains distinct versions and fact associations", () => {
    const input = reading()
    const facts = [{ ...input.facts[0]!, sourceRefs: [ref, ref, { ...ref, sourceVersion: "ORIGINAL_PLAN_8" }] },
      { ...input.facts[0]!, id: "fact-2", label: "두 번째 사실", sourceRefs: [ref] }]
    render(<OracleReadingEvidence reading={{ ...input, facts }} />)
    open()
    expect(within(screen.getByRole("list", { name: "풀이에 사용한 출처" })).getAllByRole("listitem")).toHaveLength(2)
    details()
    expect(screen.getAllByText("ORIGINAL_PLAN_7")).toHaveLength(2)
    expect(screen.getByText("ORIGINAL_PLAN_8")).toBeVisible()
    expect(screen.getByRole("region", { name: "두 번째 사실의 출처" })).toBeVisible()
  })
  it.each(["overall", "source"])("withholds stale fact identities and source versions on %s revocation", mode => {
    render(<OracleReadingEvidence reading={reading(mode === "overall" ? { status: "REVOKED" } : { inputStates: { friend: "REVOKED" } })} />)
    open(); details()
    expect(screen.getByText("철회된 풀이의 기록 출처와 식별자는 표시하지 않아요.")).toBeVisible()
    for (const value of ["session:private-id", "ORIGINAL_PLAN_7", "INPUT_COLLECTION_3", "기록된 운동 시간", "training:opaque:id:recovery"]) {
      expect(screen.queryByText(value, { exact: true })).toBeNull()
    }
    expect(screen.getByText("CONTENT_9")).toBeVisible()
  })
  it("does not invent dates, IDs, zero counts or evidence for an empty educational reading", () => {
    render(<OracleReadingEvidence reading={reading({ kind: "EDUCATION", status: "SUFFICIENT", facts: [], inputStates: {}, missingInputs: [], sourceVersions: {} })} />)
    open()
    expect(screen.getByText("개인 입력 자료의 확인 상태가 제공되지 않았어요.")).toBeVisible()
    expect(screen.getByText("이 일반 해설에는 개인 기록의 출처 참조가 제공되지 않았어요.")).toBeVisible()
    expect(screen.queryByText("더 확인할 자료")).toBeNull()
    expect(screen.queryByText("0")).toBeNull()
  })
  it("labels absent ref metadata and escapes opaque strings instead of treating them as markup", () => {
    const input = reading()
    const facts: OracleContentReading["facts"] = [{ ...input.facts[0]!, sourceRefs: [{ source: "records", sourceVersion: '<img src=x onerror="alert(1)">', provenance: "VERIFIED_RECORD" }] }]
    const { container } = render(<OracleReadingEvidence reading={{ ...input, facts }} />)
    open(); details()
    expect(screen.getAllByText("날짜 미제공").length).toBeGreaterThan(0)
    expect(screen.getByText("미제공", { exact: true })).toBeVisible()
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeVisible()
    expect(container.querySelector("img")).toBeNull()
  })
  it("updates supplied evidence without retaining old source identities", () => {
    const { rerender } = render(<OracleReadingEvidence reading={reading()} />)
    open(); details()
    rerender(<OracleReadingEvidence reading={reading({ facts: [], sourceVersions: {}, missingInputs: [], inputStates: { records: "UNAVAILABLE" } })} />)
    expect(screen.queryByText("session:private-id")).toBeNull()
    expect(screen.queryByText("INPUT_COLLECTION_3")).toBeNull()
    expect(screen.getByText("지금 자료를 확인할 수 없음")).toBeVisible()
  })
})
