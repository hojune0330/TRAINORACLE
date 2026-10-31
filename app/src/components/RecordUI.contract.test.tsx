import { createRef, useState } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { RecordAction, RecordChoice, RecordMetrics, RecordNotice, RecordSource, RecordStateList } from "./RecordUI"

afterEach(cleanup)

it("keeps receipt, account confirmation and analysis readiness independent", () => {
  render(<RecordStateList label="확인한 상태" items={[
    { id: "c", state: { phase: "connection", status: "connected" } },
    { id: "r", state: { phase: "receipt", status: "received" } },
    { id: "s", state: { phase: "storage", status: "pending" }, detail: "기기 입력 유지" },
    { id: "a", state: { phase: "analysis", status: "review" } },
  ]} />)
  expect(screen.getByText("연결됨")).toBeVisible()
  expect(screen.getByText("기록 수신됨")).toBeVisible()
  expect(screen.getByText("계정 저장 확인 중")).toBeVisible()
  expect(screen.getByText("분석 기준 확인 필요")).toBeVisible()
  expect(screen.queryByText("계정 저장 확인됨")).toBeNull()
  expect(screen.queryByText("분석 가능")).toBeNull()
  expect(screen.queryByRole("status")).toBeNull()
})

it("shows rejected, conflict and unknown outcomes without promoting them to success", () => {
  const view = render(<RecordStateList label="저장 확인" items={[{ id: "s", state: { phase: "storage", status: "unknown" } }]} />)
  expect(screen.getByText("저장 결과 확인 불가")).toBeVisible()
  view.rerender(<RecordStateList label="저장 확인" items={[{ id: "s", state: { phase: "storage", status: "conflict" } }]} />)
  expect(screen.getByText("다른 수정본 확인 필요")).toBeVisible()
  view.rerender(<RecordStateList label="저장 확인" items={[{ id: "s", state: { phase: "storage", status: "rejected" } }]} />)
  expect(screen.getByText("저장 거절됨")).toBeVisible()
  view.rerender(<RecordStateList label="저장 확인" items={[{ id: "s", state: { phase: "storage", status: "confirmed" } }]} />)
  expect(screen.getByText("계정 저장 확인됨")).toBeVisible()
})

it("preserves selected-only child controls and their draft across deselection", () => {
  const save = vi.fn()
  function Example() {
    const [checked, setChecked] = useState(true)
    return <><RecordChoice title="운동 1 · 달리기" checked={checked} onChange={setChecked}>
      <label>저장 방식<select defaultValue="separate"><option value="separate">별도 기록</option><option value="exclude">제외</option></select></label>
    </RecordChoice><button onClick={save}>저장</button></>
  }
  render(<Example />)
  const choice = screen.getByRole("checkbox", { name: /운동 1/ })
  const select = screen.getByRole("combobox", { name: "저장 방식" })
  fireEvent.change(select, { target: { value: "exclude" } })
  fireEvent.click(choice)
  expect(choice).not.toBeChecked()
  expect(select).toBeVisible()
  expect(select).toHaveValue("exclude")
  fireEvent.click(choice)
  expect(choice).toBeChecked()
  expect(select).toHaveValue("exclude")
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  expect(save).toHaveBeenCalledTimes(1)
})

it("does not toggle choice when a sibling control is used and explains disabled input", () => {
  const change = vi.fn()
  const view = render(<RecordChoice checked={false} onChange={change} title="운동 1"><button>자세히</button></RecordChoice>)
  fireEvent.click(screen.getByRole("button", { name: "자세히" }))
  expect(change).not.toHaveBeenCalled()
  view.rerender(<RecordChoice checked={true} onChange={change} title="운동 1" disabled disabledReason="결과 확인 중" />)
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(/결과 확인 중/)
})

it("keeps original and confirmed time meanings separate without filling missing data", () => {
  render(<><RecordSource source="파일에서 가져옴" format="TCX" originalTimeMeaning="종류 미확인" confirmedTimeMeaning="이동 시간" dateBasis="시간대 미확인" />
    <RecordMetrics label="수치" items={[{ id: "distance", label: "거리", value: "파일에 없음" }, { id: "duration", label: "시간", value: "0 분" }]} /></>)
  expect(screen.getByText("원본 시간").parentElement).toHaveTextContent("종류 미확인")
  expect(screen.getByText("내가 확인한 시간").parentElement).toHaveTextContent("이동 시간")
  expect(screen.getByText("파일에 없음")).toBeVisible()
  expect(screen.getByText("0 분")).toBeVisible()
  expect(screen.queryByText("0 km")).toBeNull()
})

it("exposes errors, confirmed empty results and explicit retry without automatic action", () => {
  const retry = vi.fn()
  const view = render(<RecordNotice kind="error" title="읽기 실패" announce action={{ label: "다시 읽기", onClick: retry }}><p>입력을 유지했어요</p></RecordNotice>)
  expect(screen.getByRole("status")).toHaveTextContent("읽기 실패")
  expect(within(screen.getByRole("status")).queryByRole("button")).toBeNull()
  expect(retry).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "다시 읽기" }))
  expect(retry).toHaveBeenCalledTimes(1)
  view.rerender(<RecordNotice kind="empty" title="활동 없음"><p>읽기 완료 · 활동 0건</p></RecordNotice>)
  expect(screen.getByText("활동 없음")).toBeVisible()
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.queryByText("읽기 실패")).toBeNull()
})

it("does not emit an empty metrics or states surface", () => {
  const view = render(<><RecordMetrics items={[]} /><RecordStateList label="상태" items={[]} /></>)
  expect(view.container).toBeEmptyDOMElement()
})

it("keeps the exact activity facts name, native input and row body when adopting a compact list", () => {
  const change = vi.fn()
  const name = "운동 2, 2026·10·16 같은 이름, 거리 3km, 파일의 시간 · 종류 미확인 15분 가져오기"
  const view = render(<RecordChoice checked={false} title="같은 이름" context="운동 2 · 2026·10·16"
    inputLabel={name} onChange={change} density="row" data-testid="import-draft-row">
    <label>저장 방식<select defaultValue="exclude"><option value="exclude">이번 가져오기에서 제외</option></select></label>
  </RecordChoice>)
  expect(screen.getByRole("checkbox", { name })).not.toBeChecked()
  expect(screen.getByTestId("import-draft-row")).toHaveAttribute("data-density", "row")
  fireEvent.click(screen.getByRole("checkbox"))
  expect(change).toHaveBeenCalledWith(true)
  view.rerender(<RecordChoice checked={true} title="같은 이름" inputLabel={name} onChange={change} density="row">
    <label>저장 방식<select defaultValue="exclude"><option value="exclude">이번 가져오기에서 제외</option></select></label>
  </RecordChoice>)
  expect(screen.getByRole("checkbox", { name })).toBeChecked()
  expect(screen.getByRole("combobox", { name: "저장 방식" })).toHaveValue("exclude")
})

it("accepts a runtime busy boolean with its visible reason without treating busy as a save", () => {
  function Example({ busy }: { busy: boolean }) {
    return <RecordChoice checked={true} onChange={vi.fn()} title="운동 1" busy={busy} disabled={busy} disabledReason="현재 저장 결과를 확인하고 있어요." />
  }
  const view = render(<Example busy={true} />)
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(/현재 저장 결과/)
  view.rerender(<Example busy={false} />)
  expect(screen.getByRole("checkbox")).toBeEnabled()
  expect(screen.queryByText("현재 저장 결과를 확인하고 있어요.")).toBeNull()
})

it("uses one native record action contract for device/account next steps and forwards focus", () => {
  const action = vi.fn(), ref = createRef<HTMLButtonElement>()
  const view = render(<RecordAction ref={ref} onClick={action} aria-describedby="reason">저장 다시 시도</RecordAction>)
  const button = screen.getByRole("button", { name: "저장 다시 시도" })
  expect(button).toHaveAttribute("type", "button")
  expect(button).toHaveAttribute("data-priority", "primary")
  ref.current?.focus()
  expect(button).toHaveFocus()
  expect(action).not.toHaveBeenCalled()
  fireEvent.click(button)
  expect(action).toHaveBeenCalledTimes(1)
  view.rerender(<RecordAction priority="secondary" onClick={action} disabled>저장 다시 시도</RecordAction>)
  expect(button).toHaveAttribute("data-priority", "secondary")
  fireEvent.click(button)
  expect(action).toHaveBeenCalledTimes(1)
})

it("allows assertive file errors with correct heading while keeping actions outside live content", () => {
  const retry = vi.fn()
  render(<RecordNotice kind="error" title="파일을 읽지 못했어요" headingLevel={2} announce="assertive" data-testid="import-failure"
    action={{ label: "다른 파일 고르기", onClick: retry }}><p>이전 선택은 그대로예요.</p></RecordNotice>)
  expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("파일을 읽지 못했어요")
  expect(screen.getByTestId("import-failure")).toBeVisible()
  expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive")
  expect(within(screen.getByRole("alert")).queryByRole("button")).toBeNull()
  expect(retry).not.toHaveBeenCalled()
})

it("names providers or result partitions while preserving the independent state meaning", () => {
  render(<RecordStateList label="연결 및 저장 상태" items={[
    { id: "garmin", label: "Garmin", state: { phase: "connection", status: "unavailable" } },
    { id: "local", label: "기기 보관", state: { phase: "storage", status: "device" }, detail: "1건" },
    { id: "unknown", label: "확인 불가", state: { phase: "storage", status: "unknown" }, detail: "기존 요청 확인 필요" },
  ]} />)
  expect(screen.getByText("Garmin").parentElement).toHaveTextContent("연결 미제공")
  expect(screen.getByText("기기 보관").parentElement).toHaveTextContent("기기에 보관됨1건")
  expect(screen.getByText("확인 불가").parentElement).toHaveTextContent("저장 결과 확인 불가")
  expect(screen.queryByText("계정 저장 확인됨")).toBeNull()
})

it("uses one existing flow reason for multiple disabled choices without repeating it per row", () => {
  render(<><p id="flow-pending" role="status">저장 상태 확인 중에는 선택을 유지해요.</p>
    {[1, 2].map(index => <RecordChoice key={index} checked title={`운동 ${index}`} onChange={vi.fn()} disabled disabledReasonId="flow-pending" />)}
  </>)
  expect(screen.getAllByText("저장 상태 확인 중에는 선택을 유지해요.")).toHaveLength(1)
  for (const input of screen.getAllByRole("checkbox")) {
    expect(input).toBeDisabled()
    expect(input).toHaveAccessibleDescription(/저장 상태 확인 중에는 선택을 유지해요/)
  }
})
