import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OracleTopicGrid } from "../components/OracleTopicGrid"
import * as catalog from "../domain/oracle-exploration"
import type { OracleTopicId } from "../domain/oracle-exploration"
import { OracleExplore } from "./OracleExplore"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const routes = [
  { id: "level", title: "현재 수준", next: "focus", action: "records" },
  { id: "focus", title: "강점·보완점", next: "priority", action: "journal" },
  { id: "compare", title: "훈련 비교", next: "change", action: "journal" },
  { id: "mix", title: "훈련 구성", next: "compare", action: "trends" },
  { id: "priority", title: "우선 훈련", next: "mix", action: "plan" },
  { id: "change", title: "훈련 후 변화", next: "level", action: "trends" },
] as const

function mountExplore(topicId: OracleTopicId = "level") {
  const callbacks = { onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn() }
  return { ...render(<OracleExplore topicId={topicId} {...callbacks} />), ...callbacks }
}

function readWidths(chart: HTMLElement) {
  return Array.from(chart.querySelectorAll<HTMLElement>(".oracle-explore__bar"), bar => Number.parseFloat(bar.style.width))
}

describe("Oracle exploration examples", () => {
  it.each(routes)("$id keeps the example and source visible while supporting explanation starts closed", ({ id }) => {
    const topic = catalog.getOracleTopic(id)
    mountExplore(id)

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { name: topic.example.headline })).toBeVisible()
    expect(screen.getByText(id === "priority" ? "예시 상황" : "예시 기록")).toBeVisible()
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.getByText(topic.example.source)).toBeVisible()

    const explanation = screen.getByText("예시의 기준과 읽는 방법")
    const personalAction = screen.getByRole("button", { name: topic.personalLabel })
    const relatedAction = screen.getByRole("button", { name: name => name.startsWith("이어서 살펴보기") && name.endsWith(topic.nextLabel) })
    expect(personalAction.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(relatedAction.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(explanation.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText(topic.example.summary)).not.toBeVisible()
    expect(screen.getByText(topic.example.detail)).not.toBeVisible()
    fireEvent.click(explanation)
    expect(screen.getByText(topic.example.summary)).toBeVisible()
    expect(screen.getByText(topic.example.detail)).toBeVisible()
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.getByText(topic.example.source)).toBeVisible()
  })

  it.each(routes)("$id routes related exploration and personal CTA only to their assigned destinations", ({ id, next, action }) => {
    const topic = catalog.getOracleTopic(id)
    const callbacks = mountExplore(id)
    expect(callbacks.onSelectTopic).not.toHaveBeenCalled()
    expect(callbacks.onPersonalAction).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: name => name.startsWith("이어서 살펴보기") && name.endsWith(topic.nextLabel) }))
    expect(callbacks.onSelectTopic).toHaveBeenCalledExactlyOnceWith(next)
    expect(callbacks.onPersonalAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: topic.personalLabel }))
    expect(callbacks.onPersonalAction).toHaveBeenCalledExactlyOnceWith(action)
    expect(callbacks.onSelectTopic).toHaveBeenCalledTimes(1)
    expect(callbacks.onBack).not.toHaveBeenCalled()
  })

  it("offers all six topics in a labelled native picker and emits the selected topic", async () => {
    const { onSelectTopic } = mountExplore()
    const picker = screen.getByRole("combobox", { name: "분석 주제" })
    expect(picker).toHaveValue("level")
    expect(within(picker).getAllByRole("option")).toHaveLength(6)

    for (const [index, route] of routes.entries()) {
      expect(within(picker).getByRole("option", { name: route.title })).toHaveValue(route.id)
      await userEvent.selectOptions(picker, route.id)
      expect(onSelectTopic).toHaveBeenNthCalledWith(index + 1, route.id)
    }
    expect(onSelectTopic).toHaveBeenCalledTimes(6)
  })

  it.each([
    { id: "level", labels: ["앞선 기록", "최근 기록"], values: ["24분 40초", "24분 10초"], widths: [100, 97.97297297297297] },
    { id: "focus", labels: ["계획", "실제"], values: ["RPE 5", "RPE 7"], widths: [71.42857142857143, 100] },
    { id: "compare", labels: ["지난달", "이번 달"], values: ["5 km", "6 km"], widths: [83.33333333333334, 100] },
    { id: "mix", labels: ["기초 지구력 · BASE", "지속 페이스 · LT", "강한 유산소 반복 · VO2"], values: ["4건", "1건", "1건"], widths: [100, 25, 25] },
    { id: "change", labels: ["지난달", "이번 달"], values: ["7 / 10", "5 / 10"], widths: [100, 71.42857142857143] },
  ] as const)("$id exposes the full chart data, proportional bars and matching accessible table", ({ id, labels, values, widths }) => {
    const topic = catalog.getOracleTopic(id)
    mountExplore(id)
    const chart = screen.getByRole("img")
    expect(chart).toHaveAccessibleName(expect.stringContaining(topic.example.source))
    expect(chart).toHaveAccessibleName(expect.stringContaining(`단위 ${topic.example.unit}`))
    const actualWidths = readWidths(chart)
    expect(actualWidths).toHaveLength(widths.length)
    widths.forEach((width, index) => expect(actualWidths[index]).toBeCloseTo(width, 5))
    labels.forEach((label, index) => {
      expect(chart).toHaveAccessibleName(expect.stringContaining(`${label} ${values[index]}`))
    })

    expect(screen.getByRole("table", { hidden: true })).not.toBeVisible()
    fireEvent.click(screen.getByText("표로 보기"))
    const table = screen.getByRole("table", { name: `${topic.title} · 예시 데이터 · 단위 ${topic.example.unit}` })
    expect(within(table).getAllByRole("row")).toHaveLength(labels.length)
    labels.forEach((label, index) => {
      const row = within(table).getByRole("rowheader", { name: label }).closest("tr")!
      expect(within(row).getByRole("cell")).toHaveTextContent(values[index]!)
    })
  })

  it("draws zero and small nonzero values from zero without a minimum bar-length floor", () => {
    const topic = catalog.getOracleTopic("mix")
    vi.spyOn(catalog, "getOracleTopic").mockReturnValue({ ...topic, example: { ...topic.example, rows: [
      { label: "기록 0회", value: 0, valueLabel: "0회" },
      { label: "기록 1회", value: 1, valueLabel: "1회" },
      { label: "기록 10회", value: 10, valueLabel: "10회" },
    ] } })
    mountExplore("mix")
    expect(readWidths(screen.getByRole("img"))).toEqual([0, 10, 100])
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("기록 0회 0회"))
  })

  it("keeps an all-zero numeric example finite without inventing a nonzero bar", () => {
    const topic = catalog.getOracleTopic("mix")
    vi.spyOn(catalog, "getOracleTopic").mockReturnValue({ ...topic, example: { ...topic.example, rows: [
      { label: "기록한 조깅", value: 0, valueLabel: "0회" },
      { label: "기록한 인터벌", value: 0, valueLabel: "0회" },
    ] } })
    mountExplore("mix")
    expect(readWidths(screen.getByRole("img"))).toEqual([0, 0])
  })

  it("presents priority as a nonnumeric example sequence instead of a score or an empty chart", () => {
    const { container } = mountExplore("priority")
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByRole("table", { hidden: true })).not.toBeInTheDocument()
    expect(container.querySelector(".oracle-explore__bar")).toBeNull()
    const steps = within(screen.getByRole("list")).getAllByRole("listitem")
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveTextContent("기록계획에 연결한 훈련 일지")
    expect(steps[1]).toHaveTextContent("비교계획 강도와 실제 느낌")
    expect(steps[2]).toHaveTextContent("다음 행동현재 계획 검토")
    expect(screen.getByText("예시 상황")).toBeVisible()
  })

  it("returns through the explicit back callback without opening another destination", async () => {
    const { onBack, onSelectTopic, onPersonalAction } = mountExplore()
    const back = screen.getByRole("button", { name: "이전 화면으로 돌아가기" })
    back.focus()
    await userEvent.keyboard("{Enter}")
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onSelectTopic).not.toHaveBeenCalled()
    expect(onPersonalAction).not.toHaveBeenCalled()
  })

  it("replaces the result and closes supporting details when a new topic is supplied", () => {
    const first = catalog.getOracleTopic("level")
    const next = catalog.getOracleTopic("mix")
    const callbacks = { onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn() }
    const view = render(<OracleExplore topicId="level" {...callbacks} />)
    fireEvent.click(screen.getByText("예시의 기준과 읽는 방법"))
    fireEvent.click(screen.getByText("표로 보기"))
    expect(screen.getByText(first.example.detail)).toBeVisible()

    view.rerender(<OracleExplore topicId="mix" {...callbacks} />)
    expect(screen.getByRole("combobox", { name: "분석 주제" })).toHaveValue("mix")
    expect(screen.queryByRole("heading", { name: first.example.headline })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: next.example.headline })).toBeVisible()
    expect(screen.getByText(next.example.detail)).not.toBeVisible()
    expect(screen.getByRole("table", { hidden: true })).not.toBeVisible()
    expect(screen.getByText(next.example.source)).toBeVisible()
  })

  it("does not write local or session storage while browsing examples or invoking navigation", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const removeItem = vi.spyOn(Storage.prototype, "removeItem")
    const clear = vi.spyOn(Storage.prototype, "clear")
    const callbacks = { onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn() }
    const view = render(<OracleExplore topicId="level" {...callbacks} />)
    for (const { id } of routes) {
      const topic = catalog.getOracleTopic(id)
      view.rerender(<OracleExplore topicId={id} {...callbacks} />)
      fireEvent.click(screen.getByText("예시의 기준과 읽는 방법"))
      if (id !== "priority") fireEvent.click(screen.getByText("표로 보기"))
      fireEvent.change(screen.getByRole("combobox", { name: "분석 주제" }), { target: { value: topic.nextId } })
      fireEvent.click(screen.getByRole("button", { name: topic.personalLabel }))
      fireEvent.click(screen.getByRole("button", { name: name => name.startsWith("이어서 살펴보기") && name.endsWith(topic.nextLabel) }))
      fireEvent.click(screen.getByRole("button", { name: "이전 화면으로 돌아가기" }))
    }
    view.unmount()
    render(<OracleTopicGrid onSelectTopic={callbacks.onSelectTopic} />)
    for (const button of screen.getAllByRole("button")) fireEvent.click(button)
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })
})

describe("Oracle six-topic entry grid", () => {
  it.each([false, true])("keeps all six example entries active with compact=%s and preserves custom section names", compact => {
    const onSelectTopic = vi.fn()
    render(<OracleTopicGrid compact={compact} title="궁금한 항목부터" onSelectTopic={onSelectTopic} />)
    const grid = screen.getByRole("region", { name: "궁금한 항목부터" })
    expect(within(grid).getByText("내 기록 · 결과 예시")).toBeVisible()
    expect(within(grid).getAllByRole("button")).toHaveLength(6)
    routes.forEach(({ id, title }, index) => {
      const topic = catalog.getOracleTopic(id)
      const button = within(grid).getByRole("button", { name: `${title} · ${topic.question} · 분석 열기` })
      expect(button).toBeEnabled()
      expect(within(button).getByText(title)).toBeVisible()
      if (compact) expect(within(button).queryByText(topic.teaser)).not.toBeInTheDocument()
      else expect(within(button).getByText(topic.teaser)).toBeVisible()
      fireEvent.click(button)
      expect(onSelectTopic).toHaveBeenNthCalledWith(index + 1, id)
    })
    expect(onSelectTopic).toHaveBeenCalledTimes(6)
  })
})
