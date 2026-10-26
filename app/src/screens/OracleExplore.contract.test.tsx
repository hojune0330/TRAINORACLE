import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OracleTopicGrid } from "../components/OracleTopicGrid"
import * as catalog from "../domain/oracle-exploration"
import type { OracleTopicId } from "../domain/oracle-exploration"
import { OracleExplore } from "./OracleExplore"
import { buildOraclePersonalResult } from "../domain/oracle-personal-result"
import { createOracleReturnStore } from "../domain/oracle-return-state"
import { replacedReplanFixture } from "../domain/execution-replan-lineage.test-fixture"
import * as demoScenario from "../domain/oracle-demo-scenario"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const routes = [
  { id: "level", title: "내 경기 기록 비교", question: "지난 경기 기록과 얼마나 달라졌을까?", next: "focus", action: "records" },
  { id: "focus", title: "계획과 실제 강도", question: "계획보다 더 힘들게 느껴진 훈련은?", next: "priority", action: "journal" },
  { id: "compare", title: "월별 훈련 거리 비교", question: "최근 두 달, 한 번에 달린 거리는?", next: "change", action: "journal" },
  { id: "mix", title: "훈련 구성", question: "최근에는 어떤 훈련을 많이 했을까?", next: "compare", action: "trends" },
  { id: "priority", title: "다음 훈련 검토", question: "다음 훈련 전에 무엇을 확인할까?", next: "mix", action: "plan" },
  { id: "change", title: "월별 기록 비교", question: "최근 두 달에 남긴 기록은 어떻게 달랐을까?", next: "level", action: "trends" },
] as const

function mountExplore(topicId: OracleTopicId = "level") {
  const callbacks = { onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn() }
  return { ...render(<OracleExplore topicId={topicId} {...callbacks} />), ...callbacks }
}

function readWidths(chart: HTMLElement) {
  return Array.from(chart.querySelectorAll<HTMLElement>(".oracle-explore__bar"), bar => Number.parseFloat(bar.style.width))
}

describe("Oracle exploration examples", () => {
  it("honors an explicit example destination even when a personal result exists", () => {
    const result = buildOraclePersonalResult({ topicId: "level", entries: [], planState: null, today: "2026-09-27" })
    const seen = vi.fn()
    const props = { topicId: "level" as const, personalResult: { ...result, status: "ready" as const, headline: "개인 결과" }, onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn(), onPersonalResultSeen: seen }
    const view = render(<OracleExplore {...props} initialMode="personal" />)
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
    view.rerender(<OracleExplore {...props} initialMode="example" />)
    expect(screen.getByRole("button", { name: "예시" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.queryByText("개인 결과")).toBeNull()
  })

  it("uses Oracle category choices and keeps both result modes freely selectable", async () => {
    const result = buildOraclePersonalResult({ topicId: "level", entries: [], planState: null, today: "2026-09-27" })
    const onPersonalAction = vi.fn()
    render(<OracleExplore topicId="level" personalResult={result} initialMode="example"
      onBack={vi.fn()} onSelectTopic={vi.fn()} onPersonalAction={onPersonalAction} />)
    const modes = screen.getByRole("group", { name: "결과 종류" })
    const personal = within(modes).getByRole("button", { name: "내 기록" })
    const example = within(modes).getByRole("button", { name: "예시" })
    for (const button of [personal, example]) {
      expect(button).toHaveClass("app-choice-control", "category-choice")
      expect(button).toHaveAttribute("data-category", "oracle")
    }
    expect(example).toHaveAttribute("aria-pressed", "true")
    personal.focus()
    await userEvent.keyboard("{Enter}")
    expect(personal).toHaveAttribute("aria-pressed", "true")
    expect(example).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("heading", { name: result.headline })).toBeVisible()
    example.focus()
    await userEvent.keyboard(" ")
    expect(example).toHaveAttribute("aria-pressed", "true")
    expect(personal).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(onPersonalAction).not.toHaveBeenCalled()
  })

  it.each([
    { id: "level", label: "기록 관리 열기", action: "records", section: "summary", metric: undefined },
    { id: "focus", label: "계획 만들기", action: "plan", section: "summary", metric: undefined },
    { id: "compare", label: "훈련 기록 남기기", action: "log", section: "monthly", metric: "DISTANCE_KM" },
    { id: "mix", label: "훈련 기록 남기기", action: "log", section: "mix", metric: undefined },
    { id: "priority", label: "계획 만들기", action: "plan", section: "summary", metric: undefined },
    { id: "change", label: "훈련 기록 남기기", action: "log", section: "monthly", metric: "RPE" },
  ] as const)("$id opens the confirmed missing result's assigned input directly from its example", ({ id, label, action, section, metric }) => {
    const result = buildOraclePersonalResult({ topicId: id, entries: [], planState: null, today: "2026-09-27" })
    expect(result).toMatchObject({ status: "missing", actionLabel: label, action, section })
    expect(result.metric).toBe(metric)
    const onPersonalAction = vi.fn()
    const onModeChange = vi.fn()
    const onPersonalResultSeen = vi.fn()
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    render(<OracleExplore topicId={id} personalResult={result} initialMode="example" onBack={vi.fn()}
      onSelectTopic={vi.fn()} onPersonalAction={onPersonalAction} onModeChange={onModeChange}
      onPersonalResultSeen={onPersonalResultSeen} />)
    expect(onPersonalAction).not.toHaveBeenCalled()
    expect(onModeChange).not.toHaveBeenCalled()
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: label }))
    expect(onPersonalAction).toHaveBeenCalledExactlyOnceWith(action, section, metric)
    expect(onModeChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "예시" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })

  it.each(["partial", "ready"] as const)("opens the %s personal result from the example without sending the user to input", status => {
    const base = buildOraclePersonalResult({ topicId: "compare", entries: [], planState: null, today: "2026-09-27" })
    const result = { ...base, status, headline: "확인한 월별 결과", fingerprint: `confirmed-${status}`,
      rows: [{ label: "이번 달", value: 6, valueLabel: "6 km" }],
      ...(status === "partial" ? { notice: "비교할 월별 기록이 1개월뿐이에요." } : {}) }
    const onPersonalAction = vi.fn()
    const onModeChange = vi.fn()
    const onPersonalResultSeen = vi.fn()
    render(<OracleExplore topicId="compare" personalResult={result} initialMode="example" onBack={vi.fn()}
      onSelectTopic={vi.fn()} onPersonalAction={onPersonalAction} onModeChange={onModeChange}
      onPersonalResultSeen={onPersonalResultSeen} />)
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "내 기록 보기" }))
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("heading", { name: result.headline })).toBeVisible()
    expect(screen.queryByText("내 기록을 분석한 결과가 아니에요")).toBeNull()
    if (status === "partial") expect(screen.getByText("비교할 월별 기록이 1개월뿐이에요.")).toBeVisible()
    expect(onModeChange).toHaveBeenCalledExactlyOnceWith("personal")
    expect(onPersonalAction).not.toHaveBeenCalled()
    expect(onPersonalResultSeen).toHaveBeenCalledExactlyOnceWith(result.fingerprint)
  })

  it.each(["absent", "missing", "ready"] as const)("returns an unavailable %s result to its loading state instead of opening input", state => {
    const base = buildOraclePersonalResult({ topicId: "focus", entries: [], planState: null, today: "2026-09-27" })
    const result = state === "absent" ? undefined : { ...base, status: state, fingerprint: state === "ready" ? "unconfirmed" : null }
    const onPersonalAction = vi.fn()
    const onModeChange = vi.fn()
    const onPersonalResultSeen = vi.fn()
    render(<OracleExplore topicId="focus" personalResult={result} personalResultUnavailable initialMode="example"
      historyNotice={<p>이전 계획 확인 중</p>} onBack={vi.fn()} onSelectTopic={vi.fn()}
      onPersonalAction={onPersonalAction} onModeChange={onModeChange} onPersonalResultSeen={onPersonalResultSeen} />)
    expect(onPersonalAction).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: base.actionLabel })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "내 기록 확인" }))
    expect(screen.getByText("기록을 모두 확인하지 못했어요. 다시 확인한 뒤 결과를 볼 수 있어요.")).toBeVisible()
    expect(screen.getByText("이전 계획 확인 중")).toBeVisible()
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("heading", { name: base.headline })).toBeNull()
    expect(screen.queryByText("내 기록을 분석한 결과가 아니에요")).toBeNull()
    expect(onModeChange).toHaveBeenCalledExactlyOnceWith("personal")
    expect(onPersonalAction).not.toHaveBeenCalled()
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
  })

  it("does not replace an unavailable result with an example when no result object exists", () => {
    render(<OracleExplore topicId="focus" personalResultUnavailable onBack={vi.fn()} onSelectTopic={vi.fn()} onPersonalAction={vi.fn()} />)
    expect(screen.getByText(/기록을 모두 확인하지 못했어요/)).toBeVisible()
    expect(screen.queryByText("내 기록을 분석한 결과가 아니에요")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "예시" }))
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
  })
  it("does not show or mark an unfinished personal comparison as read, then reveals the confirmed result", () => {
    const store = createOracleReturnStore()
    expect(store.enableOptIn().ok).toBe(true)
    expect(store.saveInterest("focus").ok).toBe(true)
    const f = replacedReplanFixture()
    const entries = [{ ...f.entries[0]!, activityOutcome: "COMPLETED" as const, planExecutionRelation: "AS_PLANNED" as const,
      rpe: 3, fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }]
    const result = buildOraclePersonalResult({ topicId: "focus", entries, planState: f.state,
      planHistory: { kind: "loaded", plans: f.archivedPlans }, today: "2026-10-01" })
    expect(result.fingerprint).not.toBeNull()
    const onPersonalResultSeen = vi.fn()
    const props = { topicId: "focus" as const, personalResult: result, onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn(), onPersonalResultSeen }
    const view = render(<OracleExplore {...props} personalResultUnavailable />)
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("기록을 모두 확인하지 못했어요. 다시 확인한 뒤 결과를 볼 수 있어요.")).toBeVisible()
    expect(screen.queryByText(result.headline)).not.toBeInTheDocument()
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
    expect(store.read().state.lastSeenAnalysisFingerprints.focus).toBeUndefined()
    fireEvent.click(screen.getByRole("button", { name: "예시" }))
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(onPersonalResultSeen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
    view.rerender(<OracleExplore {...props} personalResultUnavailable={false} />)
    expect(screen.queryByText("기록을 모두 확인하지 못했어요. 다시 확인한 뒤 결과를 볼 수 있어요.")).toBeNull()
    expect(screen.getByText(result.headline)).toBeVisible()
    expect(onPersonalResultSeen).toHaveBeenCalledWith(result.fingerprint)
    expect(store.read().state.lastSeenAnalysisFingerprints.focus).toBe(result.fingerprint)
    view.unmount()
    localStorage.clear()
  })
  it("distinguishes an active read from failure and retries without changing topic or result mode", () => {
    const result = buildOraclePersonalResult({ topicId: "mix", entries: [], planState: null, today: "2026-09-27" })
    const retry = vi.fn(), action = vi.fn(), select = vi.fn(), mode = vi.fn(), seen = vi.fn()
    const props = { topicId: "mix" as const, personalResult: result, initialMode: "personal" as const,
      onBack: vi.fn(), onSelectTopic: select, onPersonalAction: action, onModeChange: mode,
      onPersonalResultSeen: seen, onRetryPersonalResult: retry }
    const view = render(<OracleExplore {...props} personalReadStatus="loading" />)
    expect(screen.getByRole("status")).toHaveTextContent("기록을 확인하고 있어요.")
    expect(screen.queryByRole("button", { name: "다시 확인" })).toBeNull()
    expect(screen.queryByRole("heading", { name: result.headline })).toBeNull()
    view.rerender(<OracleExplore {...props} personalReadStatus="unavailable" />)
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 모두 확인하지 못했어요.")
    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("mix")
    expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
    expect(action).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled(); expect(mode).not.toHaveBeenCalled()
    expect(seen).not.toHaveBeenCalled()
    view.rerender(<OracleExplore {...props} personalReadStatus="ready" />)
    expect(screen.getByRole("heading", { name: result.headline })).toBeVisible()
    expect(screen.queryByRole("button", { name: "다시 확인" })).toBeNull()
  })

  it("keeps the selected personal mode on topic navigation even without data", () => {
    const onSelectTopic = vi.fn()
    const result = buildOraclePersonalResult({ topicId: "level", entries: [], planState: null, today: "2026-09-27" })
    render(<OracleExplore topicId="level" personalResult={result} onBack={vi.fn()}
      onSelectTopic={onSelectTopic} onPersonalAction={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
    fireEvent.click(screen.getByRole("button", { name: /이어서 살펴보기/ }))
    expect(onSelectTopic).toHaveBeenLastCalledWith("focus", "personal")
    fireEvent.change(screen.getByRole("combobox", { name: "살펴볼 주제" }), { target: { value: "mix" } })
    expect(onSelectTopic).toHaveBeenLastCalledWith("mix", "personal")
    expect(screen.queryByText("내 기록을 분석한 결과가 아니에요")).toBeNull()
  })
  it.each(routes)("$id keeps the example and source visible while supporting explanation starts closed", ({ id }) => {
    const topic = catalog.getOracleTopic(id)
    const example = demoScenario.buildOracleDemoTopicResult(id)
    mountExplore(id)

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { name: example.headline })).toBeVisible()
    expect(screen.getByRole("heading", { level: 1, name: example.headline })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(screen.getByText("예시 기록")).toBeVisible()
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.getByText(example.source)).toBeVisible()
    expect(screen.getByText("오라클", { selector: ".oracle-explore__header > span" })).toHaveClass("app-chrome-title")

    const explanation = screen.getByText("예시의 기준과 읽는 방법")
    const personalAction = screen.getByRole("button", { name: topic.personalLabel })
    const relatedAction = screen.getByRole("button", { name: name => name.startsWith("이어서 살펴보기") && name.endsWith(topic.nextLabel) })
    expect(personalAction.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(relatedAction.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(explanation.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText(example.summary)).toBeVisible()
    expect(screen.getByText(example.detail)).not.toBeVisible()
    fireEvent.click(explanation)
    expect(screen.getByText(example.summary)).toBeVisible()
    expect(screen.getByText(example.detail)).toBeVisible()
    expect(screen.getByText("내 기록을 분석한 결과가 아니에요")).toBeVisible()
    expect(screen.getByText(example.source)).toBeVisible()
  })

  it.each(routes)("$id routes related exploration and personal CTA only to their assigned destinations", ({ id, next, action }) => {
    const topic = catalog.getOracleTopic(id)
    const callbacks = mountExplore(id)
    expect(callbacks.onSelectTopic).not.toHaveBeenCalled()
    expect(callbacks.onPersonalAction).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: name => name.startsWith("이어서 살펴보기") && name.endsWith(topic.nextLabel) }))
    expect(callbacks.onSelectTopic).toHaveBeenCalledExactlyOnceWith(next, "example")
    expect(callbacks.onPersonalAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: topic.personalLabel }))
    expect(callbacks.onPersonalAction).toHaveBeenCalledExactlyOnceWith(action)
    expect(callbacks.onSelectTopic).toHaveBeenCalledTimes(1)
    expect(callbacks.onBack).not.toHaveBeenCalled()
  })

  it("offers all six topics in a labelled native picker and emits the selected topic", async () => {
    const { onSelectTopic } = mountExplore()
    const picker = screen.getByRole("combobox", { name: "살펴볼 주제" })
    expect(picker).toHaveValue("level")
    expect(within(picker).getAllByRole("option")).toHaveLength(6)

    for (const [index, route] of routes.entries()) {
      expect(within(picker).getByRole("option", { name: route.title })).toHaveValue(route.id)
      await userEvent.selectOptions(picker, route.id)
      expect(onSelectTopic).toHaveBeenNthCalledWith(index + 1, route.id, "example")
    }
    expect(onSelectTopic).toHaveBeenCalledTimes(6)
  })

  it.each([
    { id: "level", labels: ["2026-07-26", "2026-09-13"], values: ["47분 6초", "46분 45초"], widths: [100, 2805 / 2826 * 100] },
    { id: "focus", labels: ["2026-09-22 · AM", "2026-09-24 · AM", "2026-09-27 · AM", "2026-09-30 · AM"], values: ["실제 4/10 · 계획 2~4", "실제 4/10 · 계획 2~4", "실제 5/10 · 계획 2~4", "실제 4/10 · 계획 2~4"], widths: [80, 80, 100, 80] },
    { id: "compare", labels: ["2026-08", "2026-09"], values: ["7 km", "5 km"], widths: [100, 5 / 7 * 100] },
    { id: "mix", labels: ["REC 회복 운동", "BASE 기초 지구력", "LT 지속 페이스", "VO₂ 강한 유산소 반복", "MIX 여러 강도 조합"], values: ["4회", "9회", "1회", "1회", "1회"], widths: [4 / 9 * 100, 100, 1 / 9 * 100, 1 / 9 * 100, 1 / 9 * 100] },
    { id: "change", labels: ["2026-08", "2026-09"], values: ["4.5", "4"], widths: [100, 4 / 4.5 * 100] },
  ] as const)("$id exposes the full chart data, proportional bars and matching accessible table", ({ id, labels, values, widths }) => {
    const topic = catalog.getOracleTopic(id)
    const example = demoScenario.buildOracleDemoTopicResult(id)
    mountExplore(id)
    const chart = screen.getByRole("img")
    expect(chart).toHaveAccessibleName(expect.stringContaining(example.source))
    expect(chart).toHaveAccessibleName(expect.stringContaining(`단위 ${example.unit}`))
    const actualWidths = readWidths(chart)
    expect(actualWidths).toHaveLength(widths.length)
    widths.forEach((width, index) => expect(actualWidths[index]).toBeCloseTo(width, 5))
    labels.forEach((label, index) => {
      expect(chart).toHaveAccessibleName(expect.stringContaining(`${label} ${values[index]}`))
    })

    expect(screen.getByRole("table", { hidden: true })).not.toBeVisible()
    fireEvent.click(screen.getByText("표로 보기"))
    const table = screen.getByRole("table", { name: `${topic.title} · 예시 데이터 · 단위 ${example.unit}` })
    expect(within(table).getAllByRole("row")).toHaveLength(labels.length)
    labels.forEach((label, index) => {
      const row = within(table).getByRole("rowheader", { name: label }).closest("tr")!
      expect(within(row).getByRole("cell")).toHaveTextContent(values[index]!)
    })
  })

  it("draws zero and small nonzero values from zero without a minimum bar-length floor", () => {
    const example = demoScenario.buildOracleDemoTopicResult("mix")
    vi.spyOn(demoScenario, "buildOracleDemoTopicResult").mockReturnValue({ ...example, rows: [
      { label: "기록 0회", value: 0, valueLabel: "0회" },
      { label: "기록 1회", value: 1, valueLabel: "1회" },
      { label: "기록 10회", value: 10, valueLabel: "10회" },
    ] })
    mountExplore("mix")
    expect(readWidths(screen.getByRole("img"))).toEqual([0, 10, 100])
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("기록 0회 0회"))
  })

  it("keeps an all-zero numeric example finite without inventing a nonzero bar", () => {
    const example = demoScenario.buildOracleDemoTopicResult("mix")
    vi.spyOn(demoScenario, "buildOracleDemoTopicResult").mockReturnValue({ ...example, rows: [
      { label: "기록한 조깅", value: 0, valueLabel: "0회" },
      { label: "기록한 인터벌", value: 0, valueLabel: "0회" },
    ] })
    mountExplore("mix")
    expect(readWidths(screen.getByRole("img"))).toEqual([0, 0])
  })

  it("shows priority from the same four linked current-plan records without inventing a fitness score", () => {
    mountExplore("priority")
    expect(screen.getByRole("img")).toHaveAccessibleName(/현재 계획 · 연결 4건 · 비교 4건 · 2026-09-22~2026-09-30/u)
    expect(screen.getByRole("img")).toHaveAccessibleName(/실제 5\/10 · 계획 2~4/u)
    expect(screen.getByRole("table", { hidden: true })).not.toBeVisible()
    expect(screen.queryByText(/체력 점수/u)).toBeNull()
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
    const first = demoScenario.buildOracleDemoTopicResult("level")
    const next = demoScenario.buildOracleDemoTopicResult("mix")
    const callbacks = { onBack: vi.fn(), onSelectTopic: vi.fn(), onPersonalAction: vi.fn() }
    const view = render(<OracleExplore topicId="level" {...callbacks} />)
    fireEvent.click(screen.getByText("예시의 기준과 읽는 방법"))
    fireEvent.click(screen.getByText("표로 보기"))
    expect(screen.getByText(first.detail)).toBeVisible()

    view.rerender(<OracleExplore topicId="mix" {...callbacks} />)
    expect(screen.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("mix")
    expect(screen.queryByRole("heading", { name: first.headline })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: next.headline })).toBeVisible()
    expect(screen.getByText(next.detail)).not.toBeVisible()
    expect(screen.getByRole("table", { hidden: true })).not.toBeVisible()
    expect(screen.getByText(next.source)).toBeVisible()
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
      fireEvent.click(screen.getByText("표로 보기"))
      fireEvent.change(screen.getByRole("combobox", { name: "살펴볼 주제" }), { target: { value: topic.nextId } })
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
    routes.forEach(({ id, title, question }, index) => {
      const topic = catalog.getOracleTopic(id)
      const button = within(grid).getByRole("button", { name: `${title} · ${question} · 결과 보기` })
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
