import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OraclePersonalResult } from "./OraclePersonalResult"
import type { OraclePersonalResult as OraclePersonalResultData } from "../domain/oracle-personal-result"

afterEach(cleanup)

const fixture = (status: OraclePersonalResultData["status"], rows: OraclePersonalResultData["rows"] = []) => ({
  status,
  headline: status === "missing" ? "기록이 더 필요해요" : "최근 기록을 모아 봤어요",
  summary: "확인 가능한 값만 짧게 정리했어요.",
  detail: "이 결과는 저장된 구조화 기록의 표시예요.",
  source: "직접 기록",
  unit: "km",
  rows,
  requiredInput: "거리와 시간이 있는 기록",
  action: "log",
  actionLabel: "기록 남기기",
  section: "summary",
  fingerprint: null,
}) satisfies OraclePersonalResultData

describe("OraclePersonalResult", () => {
  it.each([
    ["ready", [{ label: "6월", value: 4, valueLabel: "4 km" }]],
    ["partial", [{ label: "7월", value: 0, valueLabel: "0 km" }]],
  ] as const)("renders %s data with one-axis chart and accessible table", (status, rows) => {
    render(<OraclePersonalResult result={fixture(status, rows)} onAction={vi.fn()} onShowExample={vi.fn()} />)
    expect(screen.getByRole("img")).toBeVisible()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "기록 남기기" })).toBeVisible()
    expect(screen.getByRole("button", { name: /예시로 읽는 방법/ })).toBeVisible()
  })

  it("keeps the missing input requirement visible and closes explanation by default", () => {
    render(<OraclePersonalResult result={fixture("missing")} onAction={vi.fn()} onShowExample={vi.fn()} />)
    expect(screen.getByText("필요한 입력: 거리와 시간이 있는 기록")).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByText("이 결과의 기준과 한계").closest("details")).not.toHaveAttribute("open")
  })
})
