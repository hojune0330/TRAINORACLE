// 가져오기 화면 계약 — 화면이 지켜야 할 안전 약속을 잠근다.
//
// 잠그는 약속:
//  1. 파일을 고르기 전에 "이 기기에서만 읽는다"는 안내가 보인다.
//  2. 자동 연동을 되는 척하지 않는다(시점 미약속 안내).
//  3. 읽지 못한 활동 수를 숨기지 않는다(fail-visible).
//  4. 중복으로 보이는 항목은 기본 해제 — 사용자가 켜야 저장된다.
//  5. 고른 것만 저장된다. 저장 전에는 localStorage가 비어 있다.
//  6. RPE·메모는 파일에 없다는 사실과, 가져온 값이 통계에서 빠진다는 사실을 알린다.
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImportActivities } from "./ImportActivities"
import { loadAnalysisEntries, loadEntries } from "../domain/journal-store"

afterEach(cleanup)

const JOURNAL_KEY = "trainoracle.journal.v1"

function tcxLap(startISO: string, meters: number, seconds: number): string {
  return `<Lap StartTime="${startISO}">
    <TotalTimeSeconds>${seconds}</TotalTimeSeconds>
    <DistanceMeters>${meters}</DistanceMeters>
  </Lap>`
}

function tcxFile(laps: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase><Activities>
  ${laps.map((lap) => `<Activity Sport="Running"><Id>2026-07-20T06:00:00Z</Id>${lap}</Activity>`).join("\n")}
</Activities></TrainingCenterDatabase>`
}

function upload(text: string, name = "activity.tcx"): File {
  return new File([text], name, { type: "application/xml" })
}

async function pickFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = screen.getByLabelText(/내보낸 활동 파일/u)
  await user.upload(input, file)
}

describe("ImportActivities — 고르기 단계", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("파일을 고르기 전에 기기 내 처리 안내를 보여준다", () => {
    // Given / When
    render(<ImportActivities />)

    // Then
    const notice = screen.getByTestId("import-privacy-notice")
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent(/서버로 올라가지 않아요/u)
  })

  it("자동 연동 시점을 약속하지 않는다", () => {
    // Given / When
    render(<ImportActivities />)

    // Then
    const status = screen.getByTestId("oauth-status")
    expect(status).toHaveTextContent(/아직 시점을 약속할 수 없어요/u)
    expect(status).toHaveTextContent(/읽기 전용/u)
    expect(status.textContent ?? "").not.toMatch(/곧 가져올 수 있어요/u)
  })

  it("읽지 못한 파일은 실패를 드러내고 기존 일지를 건드리지 않는다", async () => {
    // Given
    const user = userEvent.setup()
    render(<ImportActivities />)

    // When
    await pickFile(user, upload("this is not xml at all", "broken.tcx"))

    // Then
    await waitFor(() => expect(screen.getByTestId("import-failure")).toBeVisible())
    expect(screen.getByTestId("import-failure")).toHaveTextContent(/기존 일지는 그대로 있어요/u)
    expect(window.localStorage.getItem(JOURNAL_KEY)).toBeNull()
  })
})

describe("ImportActivities — 확인 단계", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("읽은 활동을 목록으로 보여주고, 고르기 전에는 저장 버튼이 잠겨 있다", async () => {
    // Given
    const user = userEvent.setup()
    render(<ImportActivities />)

    // When
    await pickFile(user, upload(tcxFile([tcxLap("2026-07-20T06:00:00Z", 10000, 3000)])))

    // Then
    await waitFor(() => expect(screen.getAllByTestId("import-draft-row")).toHaveLength(1))
    expect(screen.getByRole("button", { name: /고른 1건 일지에 저장/u })).toBeEnabled()
    await user.click(screen.getByRole("checkbox"))
    expect(screen.getByRole("button", { name: /저장할 활동을 골라 주세요/u })).toBeDisabled()
  })

  it("읽지 못한 활동 수를 숨기지 않는다", async () => {
    // Given
    const user = userEvent.setup()
    render(<ImportActivities />)
    const mixed = tcxFile([
      tcxLap("2026-07-20T06:00:00Z", 10000, 3000),
      tcxLap("", 0, 0),
    ])

    // When
    await pickFile(user, upload(mixed))

    // Then
    await waitFor(() => expect(screen.getByTestId("import-skipped")).toBeVisible())
    expect(screen.getByTestId("import-skipped")).toHaveTextContent(/1건은 목록에서 빠졌어요/u)
  })

  it("중복으로 보이는 활동은 기본 해제 상태로 둔다", async () => {
    // Given — 같은 날 같은 거리의 일지가 이미 있다
    const user = userEvent.setup()
    render(<ImportActivities />)
    await pickFile(user, upload(tcxFile([tcxLap("2026-07-20T06:00:00Z", 10000, 3000)])))
    await waitFor(() => expect(screen.getAllByTestId("import-draft-row")).toHaveLength(1))
    await user.click(screen.getByRole("button", { name: /고른 1건 일지에 저장/u }))
    await waitFor(() => expect(screen.getByTestId("import-saved")).toBeVisible())

    // When — 같은 파일을 다시 가져온다
    await user.click(screen.getByRole("button", { name: "파일 더 가져오기" }))
    await pickFile(user, upload(tcxFile([tcxLap("2026-07-20T06:00:00Z", 10000, 3000)])))

    // Then
    await waitFor(() => expect(screen.getByTestId("import-duplicate-flag")).toBeVisible())
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(screen.getByRole("button", { name: /저장할 활동을 골라 주세요/u })).toBeDisabled()
    expect(loadEntries()).toHaveLength(1)
  })

  it("RPE·메모 미포함과 통계 제외를 미리 알린다", async () => {
    // Given
    const user = userEvent.setup()
    render(<ImportActivities />)

    // When
    await pickFile(user, upload(tcxFile([tcxLap("2026-07-20T06:00:00Z", 10000, 3000)])))

    // Then
    await waitFor(() => expect(screen.getByText(/RPE와 메모는 파일에 없어요/u)).toBeVisible())
    expect(screen.getByText(/주간 통계·추이·훈련계획에는 들어가지 않아요/u)).toBeVisible()
  })
})

describe("ImportActivities — 저장", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("고른 활동만 이 기기 일지에 저장하고 분석에서는 제외한다", async () => {
    // Given
    const user = userEvent.setup()
    const onOpenLog = vi.fn()
    render(<ImportActivities onOpenLog={onOpenLog} />)
    const two = tcxFile([
      tcxLap("2026-07-20T06:00:00Z", 10000, 3000),
      tcxLap("2026-07-21T06:00:00Z", 5000, 1500),
    ])
    await pickFile(user, upload(two))
    await waitFor(() => expect(screen.getAllByTestId("import-draft-row")).toHaveLength(2))

    // When — 두 번째만 해제하고 저장
    const boxes = screen.getAllByRole("checkbox")
    await user.click(boxes[1] as HTMLElement)
    await user.click(screen.getByRole("button", { name: /고른 1건 일지에 저장/u }))

    // Then
    await waitFor(() => expect(screen.getByTestId("import-saved")).toBeVisible())
    expect(screen.getByTestId("import-saved")).toHaveTextContent("1건을 일지에 저장했어요")
    const stored = loadEntries()
    expect(stored).toHaveLength(1)
    expect(stored[0]?.syncState).toBe("local")
    expect(loadAnalysisEntries()).toHaveLength(0)

    // And — 일지로 이동할 수 있다
    await user.click(screen.getByRole("button", { name: "일지에서 확인하기" }))
    expect(onOpenLog).toHaveBeenCalledOnce()
  })

  it("저장한 값은 RPE를 채워 넣지 않는다", async () => {
    // Given
    const user = userEvent.setup()
    render(<ImportActivities />)
    await pickFile(user, upload(tcxFile([tcxLap("2026-07-20T06:00:00Z", 10000, 3000)])))
    await waitFor(() => expect(screen.getAllByTestId("import-draft-row")).toHaveLength(1))

    // When
    await user.click(screen.getByRole("button", { name: /고른 1건 일지에 저장/u }))

    // Then
    await waitFor(() => expect(screen.getByTestId("import-saved")).toBeVisible())
    const entry = loadEntries()[0]
    expect(entry?.kind).toBe("post-session")
    expect(entry?.fieldProvenance?.rpe?.provenance).toBe("MISSING")
  })
})
