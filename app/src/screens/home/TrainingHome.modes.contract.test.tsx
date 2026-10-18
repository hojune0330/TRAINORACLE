import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HomeOraclePreview } from "./HomeOraclePreview"

const BASE = { homeMode: "WELCOME", todayMessage: "아직 오늘 기록이 없어요.", todayRecordCount: 0, journalSummary: "아직 기록이 없어요", flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택", planSummary: "저장된 계획 없음 · 계획안 만들기", analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요", showMinjiPrompt: true, nextTraining: null, briefing: "" } satisfies TrainingHomeViewModel
const TRAINING = { ...BASE, homeMode: "TRAINING", planSummary: "저장된 계획 · 2개 일정", nextTraining: { date: "2026-08-20", laterSameDaySession: null, session: { day: 2, slot: "PM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 5, maximum: 6 }, durationMinutes: { minimum: 25, maximum: 40 } } } } } satisfies TrainingHomeViewModel

afterEach(cleanup)
beforeEach(() => {
  window.localStorage.clear()
})

describe("training home presentation", () => {
  it.each([
    { model: BASE, title: "운동 분석과 훈련 계획" },
    { model: TRAINING, title: "훈련과 기록" },
    { model: { ...BASE, homeMode: "JOURNAL", showMinjiPrompt: false, journalSummary: "1일 · 1개의 기록" } satisfies TrainingHomeViewModel, title: "내 기록" },
  ])("uses one accented hero and section headings for $title", ({ model, title }) => {
    const { container } = render(<TrainingHome model={model} introductionAllowed={false} />)
    const hero = screen.getByRole("heading", { level: 1, name: title })
    expect(hero).toHaveClass("app-heading--hero", "app-heading--accent")
    expect(hero).toHaveAttribute("id", "home-hub-title")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(container.querySelector(".home-hub__eyebrow")).toBeNull()
    expect(screen.queryByRole("heading", { level: 2, name: "오늘" })).toBeNull()
    expect(container.querySelectorAll(".home-hub__primary")).toHaveLength(1)
    if (model.homeMode === "TRAINING") {
      expect(screen.getByRole("heading", { level: 2, name: "다음 훈련" })).toHaveClass("app-heading--section")
    }
    if (model.homeMode !== "WELCOME" && !model.showMinjiPrompt) {
      expect(screen.getByRole("heading", { level: 2, name: "최근 하루 기록" })).toHaveClass("app-heading--section")
    }
  })

  it("keeps the today action visible and uses a neutral Oracle fallback without a prepared result", () => {
    const explore = vi.fn()
    render(<TrainingHome model={BASE} onOpenOracle={explore} />)
    expect(screen.getByRole("button", { name: "오라클 결과 보기" })).toBeVisible()
    expect(screen.queryByText(BASE.todayMessage)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" }))
    fireEvent.click(screen.getByRole("button", { name: "오라클 결과 보기" }))
    expect(explore).toHaveBeenCalledWith("level")
  })
  it.each(["personal", "partial"] as const)("opens the %s analysis from one concise card without repeating its explanation on home", kind => {
    const open = vi.fn()
    render(<TrainingHome model={TRAINING} oraclePreview={<HomeOraclePreview
      kind={kind}
      question="최근 경기 기록을 비교했어요"
      answer="같은 종목에 저장한 두 기록을 나란히 볼 수 있어요."
      sourceLabel="출처 · 경기 기록 · 2026.09.12 / 2026.09.28"
      onOpen={open}
    />} />)
    const preview = screen.getByRole("region", { name: kind === "personal" ? "오라클 · 내 기록 결과" : "오라클 · 기록 일부로 확인" })
    expect(preview).toBeVisible()
    expect(preview.closest("details")).toBeNull()
    expect(preview).toHaveAttribute("data-oracle-kind", kind)
    expect(preview.querySelector('img[src$="analysis-lens-v2.webp"]')).toBeNull()
    expect(within(preview).queryByText(/2026\.09\.12 \/ 2026\.09\.28/u)).toBeNull()
    expect(within(preview).queryByText("같은 종목에 저장한 두 기록을 나란히 볼 수 있어요.")).toBeNull()
    expect(screen.getAllByRole("region", { name: /오라클/u })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: / · 결과 보기$/u })).not.toBeInTheDocument()
    const result = within(preview).getByRole("button", { name: "내 훈련 분석" })
    expect(result).toHaveTextContent(/^내 훈련 분석$/)
    expect(result.querySelector(".category-card__description")).toBeNull()
    expect(result).toHaveAttribute("data-category", "oracle")
    expect(preview.querySelectorAll("button")).toHaveLength(1)
    expect(within(preview).getByRole("heading", { level: 2, name: "내 훈련 분석" })).toBeVisible()
    fireEvent.click(result)
    expect(open).toHaveBeenCalledOnce()
  })
  it("does not turn a plan checklist into a home Oracle result or help panel", () => {
    const open = vi.fn()
    const source = "저장 계획 9회 · 완료 체크 1회 · 실제 운동은 일지에서 확인해요."
    render(<HomeOraclePreview kind="plan" question="저장한 훈련 계획" answer="계획 9회 · 완료 체크 1회"
      sourceLabel={source} onOpen={open} />)
    expect(screen.queryByRole("region", { name: "오라클 · 내 계획 진행" })).toBeNull()
    expect(screen.queryByText("계획 9회 · 완료 체크 1회")).toBeNull()
    expect(screen.queryByText("계획과 완료 체크 기준")).toBeNull()
    expect(screen.queryByText("운동 일지와 별도")).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
  it("keeps welcome focused on recording and planning with a named learning and decoration entry", () => {
    const learn = vi.fn(); const decorate = vi.fn(); const guide = vi.fn()
    render(<TrainingHome model={BASE} onOpenContent={learn} onOpenRewards={decorate} onOpenGuide={guide} />)
    expect(screen.getByRole("heading", { name: "운동 분석과 훈련 계획" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련법 읽기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지 꾸미기" })).toBeVisible()
    expect(screen.getByRole("navigation", { name: "훈련 계획과 운동 분석" }).querySelectorAll("button")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "훈련법 읽기" }).closest("details")).toBeNull()
    expect(screen.getByRole("button", { name: "일지 꾸미기" }).closest("details")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "훈련법 읽기" })); fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    fireEvent.click(screen.getByRole("button", { name: "일지 예시 보기" }))
    expect(learn).toHaveBeenCalledOnce(); expect(decorate).toHaveBeenCalledOnce()
    expect(guide).toHaveBeenCalledOnce()
  })
  it("groups four short home shortcuts in destination order before the separate install action", () => {
    const trends = vi.fn(), guide = vi.fn(), learn = vi.fn(), decorate = vi.fn()
    render(<TrainingHome model={TRAINING} onOpenTrends={trends} onOpenGuide={guide}
      onOpenContent={learn} onOpenRewards={decorate} installSuggestion={<button>앱 추가</button>} />)
    const navigation = screen.getByRole("navigation", { name: "홈 바로가기" })
    const buttons = within(navigation).getAllByRole("button")
    expect(buttons.map(button => button.textContent)).toEqual(["훈련량", "일지 예시", "훈련법", "꾸미기"])
    expect(buttons.map(button => button.getAttribute("data-category"))).toEqual(["oracle", "journal", "training", "journal"])
    expect(navigation.compareDocumentPosition(screen.getByRole("button", { name: "앱 추가" })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    const callbacks = [trends, guide, learn, decorate]
    for (const [index, button] of buttons.entries()) {
      expect(button.querySelector(".category-icon")).toHaveAttribute("aria-hidden", "true")
      fireEvent.click(button)
      callbacks.forEach((callback, callbackIndex) => expect(callback).toHaveBeenCalledTimes(callbackIndex <= index ? 1 : 0))
    }
    expect(buttons[1]).toHaveAccessibleName("일지 예시 보기")
  })
  it("does not render empty shortcut groups or unavailable destinations", () => {
    const { rerender } = render(<TrainingHome model={BASE} />)
    expect(screen.queryByRole("navigation", { name: "홈 바로가기" })).toBeNull()
    rerender(<TrainingHome model={BASE} onOpenGuide={vi.fn()} />)
    expect(within(screen.getByRole("navigation", { name: "홈 바로가기" })).getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "훈련법 읽기" })).toBeNull()
  })
  it("offers one example action without automatically showing fictional results", () => {
    const open = vi.fn()
    render(<TrainingHome model={BASE} oraclePreview={<HomeOraclePreview
      kind="example"
      question="예시 결과는 이렇게 읽어요"
      answer="가상 기록으로 결과 화면을 먼저 둘러볼 수 있어요."
      sourceLabel="출처 · 예시 데이터"
      onOpen={open}
    />} />)
    const preview = screen.getByRole("region", { name: "오라클 · 예시 결과" })
    expect(preview).toBeVisible()
    expect(preview.closest("details")).toBeNull()
    expect(screen.queryByText("예시 결과는 이렇게 읽어요")).toBeNull()
    expect(screen.queryByText("가상 기록으로 결과 화면을 먼저 둘러볼 수 있어요.")).toBeNull()
    expect(preview.querySelector("img")).toBeNull()
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(within(preview).getByRole("button", { name: "운동 분석 예시 보기" }))
    expect(open).toHaveBeenCalledOnce()
  })
  it("places safety notice immediately after the header", () => {
    render(<TrainingHome model={BASE} safetyNotice={<div data-testid="safety">안전 안내</div>} />)
    expect(screen.getByRole("banner").nextElementSibling).toBe(screen.getByTestId("safety"))
  })
  it("keeps today's action before optional Oracle detail and recent journal", () => {
    render(<TrainingHome
      model={{ ...TRAINING, showMinjiPrompt: false }}
      safetyNotice={<div data-testid="safety">안전 안내</div>}
      oraclePreview={<HomeOraclePreview kind="partial" question="최근 결과" answer="확인한 기록만 보여요." sourceLabel="출처 · 2026.09.28" onOpen={vi.fn()} />}
      recentJournal={<div data-testid="recent-journal">하루 기록 1개</div>}
    />)
    const safety = screen.getByTestId("safety")
    const preview = screen.getByRole("region", { name: "오라클 · 기록 일부로 확인" })
    const next = screen.getByRole("region", { name: "다음 훈련" })
    const today = screen.getByLabelText("오늘")
    const journal = screen.getByTestId("recent-journal")
    expect(safety.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(next.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(next.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(journal) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
  it("preserves the optional install suggestion and a stable focus return target", () => {
    render(<TrainingHome model={TRAINING} installSuggestion={<section data-testid="install">바로가기 추가</section>} />)
    expect(screen.getByTestId("install")).toBeVisible()
    expect(screen.getByRole("button", { name: "더보기" })).toHaveAttribute("data-install-shortcut-return", "home")
  })
  it("shows the saved core prescription and opens its full reader before recording", () => {
    const next = vi.fn(); const plan = vi.fn()
    render(<TrainingHome model={TRAINING} onOpenNextTraining={next} onOpenPlan={plan} />)
    const card = screen.getByRole("button", { name: /^다음 훈련 ·/u })
    expect(card).toHaveTextContent(/전체 25–40분/u)
    expect(card).toHaveTextContent("주요")
    expect(card).toHaveAccessibleName(/주요/u)
    expect(card).not.toHaveTextContent("훈련 내용 보기")
    fireEvent.click(card)
    expect(next).toHaveBeenCalledOnce(); expect(plan).not.toHaveBeenCalled()
  })
  it("shows the saved future training and useful record actions without a no-record panel", () => {
    const write = vi.fn()
    render(<TrainingHome model={{ ...TRAINING, showMinjiPrompt: false, nextTraining: { ...TRAINING.nextTraining, date: "2099-10-09" } }}
      onWriteLog={write} oraclePreview={<div>오라클 결과</div>} recentJournal={<div data-testid="actual-recent">10월 6일 기록 2개</div>} />)
    expect(screen.getByRole("heading", { name: "훈련과 기록" })).toBeVisible()
    const next = screen.getByRole("button", { name: /^다음 훈련 ·/u })
    expect(next).toHaveAccessibleName(/10월 9일.*오후/u)
    expect(next).toHaveTextContent(/25–40분/u)
    expect(screen.queryByText(TRAINING.todayMessage)).toBeNull()
    expect(screen.queryByText(/오늘의 훈련|휴식일|미완료/u)).toBeNull()
    const recent = screen.getByTestId("actual-recent")
    expect(recent).toBeVisible()
    expect(recent.compareDocumentPosition(screen.getByText("오라클 결과")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" }))
    expect(write).toHaveBeenCalledWith("quick-session")
    fireEvent.click(screen.getByRole("button", { name: "컨디션·메모" }))
    expect(write).toHaveBeenCalledWith("evening")
  })
  it("omits empty journal and analysis rows for plan-only users but keeps real history when today is unrecorded", () => {
    const write = vi.fn(), plan = vi.fn(), archive = vi.fn(), trends = vi.fn()
    const actions = { onWriteLog: write, onOpenPlan: plan, onOpenArchive: archive, onOpenTrends: trends }
    const { rerender } = render(<TrainingHome model={TRAINING} {...actions} />)
    expect(screen.queryByRole("heading", { name: "최근 하루 기록" })).toBeNull()
    expect(screen.queryByRole("button", { name: "최근 기록" })).toBeNull()
    expect(screen.getByRole("navigation", { name: "홈 바로가기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).toBeVisible()
    expect(screen.queryByText(TRAINING.journalSummary)).toBeNull()
    expect(screen.queryByText(TRAINING.analysisSummary)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" }))
    fireEvent.click(screen.getByRole("button", { name: /^다음 훈련 ·/u }))
    expect(write).toHaveBeenCalledWith("quick-session")
    expect(plan).toHaveBeenCalledOnce()

    rerender(<TrainingHome model={{ ...TRAINING, showMinjiPrompt: false, journalSummary: "2일 · 3개의 기록", analysisSummary: "이번 주 2회 · 12km" }} {...actions} />)
    expect(screen.getByText("2일 · 3개의 기록")).toBeVisible()
    expect(screen.getByRole("navigation", { name: "홈 바로가기" })).toBeVisible()
    expect(screen.queryByText("이번 주 2회 · 12km")).toBeNull()
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).toHaveTextContent(/^훈련량$/u)
    fireEvent.click(screen.getByRole("button", { name: "최근 기록" }))
    fireEvent.click(screen.getByRole("button", { name: "훈련량·변화 보기" }))
    expect(archive).toHaveBeenCalledOnce()
    expect(trends).toHaveBeenCalledOnce()
  })
  it("does not claim all training is complete when today has a record", () => {
    render(<TrainingHome model={{ ...TRAINING, todayRecordCount: 1, briefing: "오늘 기록 · 수면 7h" }} />)
    expect(screen.getByText("오늘 남긴 기록 1개")).toBeVisible(); expect(screen.getByText("다음 훈련")).toBeVisible(); expect(screen.queryByText(/모든 훈련을 마쳤어요/u)).toBeNull()
  })
  it("keeps the write action without presenting cached counts as confirmed before a successful read", () => {
    const trends = vi.fn()
    render(<TrainingHome model={{ ...TRAINING, todayRecordCount: 2, briefing: "오늘 기록 · 수면 7h", showMinjiPrompt: false }}
      journalReadiness="STALE" onOpenTrends={trends} recentJournal={<div data-testid="cached-journal">보관된 최근 기록</div>}
      recordStart={<button type="button">파일 가져오기</button>} />)
    expect(screen.queryByText("오늘 기록을 남겼어요.")).toBeNull()
    expect(screen.queryByText("오늘 남긴 기록 2개")).toBeNull()
    expect(screen.queryByText("오늘 기록 · 수면 7h")).toBeNull()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toBeVisible()
    expect(screen.getByTestId("cached-journal")).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).toBeVisible()
    expect(screen.queryByText(TRAINING.analysisSummary)).toBeNull()
    expect(screen.queryByRole("button", { name: "파일 가져오기" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "훈련량·변화 보기" }))
    expect(trends).toHaveBeenCalledOnce()
  })
  it.each([
    ["컨디션·메모만", "이번 주 직접 입력 기록이 없어요"],
    ["거리는 아직 없음", "분석에 쓸 직접 입력 기록이 없어요"],
  ])("keeps the analysis destination but hides an unsupported summary for %s", (_caseName, analysisSummary) => {
    render(<TrainingHome model={{ ...TRAINING, showMinjiPrompt: false, analysisSummary }}
      onOpenTrends={vi.fn()} />)
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).toBeVisible()
    expect(screen.queryByText(analysisSummary)).toBeNull()
  })
  it("does not describe an unconfirmed empty read as a first visit or no-record state", () => {
    render(<TrainingHome model={BASE} journalReadiness="LOADING" onWriteLog={vi.fn()} />)
    expect(screen.queryByText(BASE.todayMessage)).toBeNull()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toBeVisible()
  })
  it.each([BASE, TRAINING, { ...TRAINING, todayRecordCount: 1 }])("keeps optional daily entries available without competing with the primary action: $homeMode/$todayRecordCount", (model) => {
    const write = vi.fn()
    render(<TrainingHome model={model} onWriteLog={write} />)
    const optional = screen.getByRole("group", { name: "선택해서 남기는 기록" })
    fireEvent.click(within(optional).getByRole("button", { name: "컨디션·메모" }))
    expect(write).toHaveBeenCalledWith("evening")
    expect(within(optional).queryByRole("button", { name: "기분·몸 상태" })).toBeNull()
    expect(within(optional).getAllByRole("button")).toHaveLength(1)
    expect(optional.querySelector(".home-hub__primary")).toBeNull()
    expect(screen.queryByText("기분·몸 상태·날씨 남기기")).toBeNull()
  })
  it("shows an unavailable result as a short status, never an example or collapsed explanation", () => {
    const open = vi.fn()
    render(<TrainingHome model={TRAINING} oraclePreview={<HomeOraclePreview kind="unavailable" question="기록을 아직 확인하지 못했어요" answer="기록 상태를 확인한 뒤 결과를 볼 수 있어요." sourceLabel="확인되지 않은 기록으로는 결과를 만들지 않아요." onOpen={open} />} />)
    const status = screen.getByRole("region", { name: "오라클 · 결과를 표시할 수 없어요" })
    expect(status).toBeVisible()
    expect(status.closest("details")).toBeNull()
    expect(within(status).queryByRole("heading")).toBeNull()
    expect(within(status).getByText("기록 상태를 확인한 뒤 결과를 볼 수 있어요.")).toBeVisible()
    expect(within(status).queryByText("확인되지 않은 기록으로는 결과를 만들지 않아요.")).toBeNull()
    expect(within(status).queryByRole("button", { name: "운동 분석 예시 보기" })).toBeNull()
    fireEvent.click(within(status).getByRole("button", { name: "기록 상태 확인" }))
    expect(open).toHaveBeenCalledOnce()
  })
})
