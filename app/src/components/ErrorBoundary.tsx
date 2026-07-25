// 앱 전역 오류 경계.
//
// 왜 필요한가 (실제 위험):
//  React는 렌더 중 예외가 나면 트리 전체를 언마운트한다. 경계가 없으면
//  화면이 **완전한 흰 화면**이 된다. 이 앱은 일지가 기기에만 있으므로,
//  흰 화면 = 사용자가 자기 기록에 닿을 방법이 사라진 상태다.
//  버그 하나가 데이터 접근 불가로 번지는 것을 막는 것이 이 파일의 목적이다.
//
// 설계 원칙:
//  - **데이터를 먼저 구한다.** 오류 화면에서 바로 백업 파일을 내려받을 수
//    있어야 한다. "다시 시도"만 있으면 같은 오류가 반복될 때 탈출구가 없다.
//  - 백업은 화면 렌더와 무관한 localStorage 직읽기로 만든다. 이미 깨진
//    상태이므로 도메인 로직을 신뢰하지 않는다(최소 의존).
//  - 오류 내용을 서버로 보내지 않는다. 일지 본문이 섞여 나갈 수 있다.
//  - 사용자를 탓하거나 불안을 주는 문구를 쓰지 않는다.
import React from "react"

const JOURNAL_KEY = "trainoracle.journal.v1"

type Props = { readonly children: React.ReactNode }
type State = { readonly failed: boolean; readonly detail: string }

/** 깨진 상태에서도 동작하도록 localStorage를 직접 읽어 백업을 만든다 */
function downloadRawBackup(): void {
  try {
    const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]"
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([raw], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `trainoracle-비상백업-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    // 여기서 또 실패하면 사용자가 할 수 있는 게 없다. 조용히 넘긴다.
  }
}

function entryCount(): number {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { failed: false, detail: "" }
  }

  static getDerivedStateFromError(error: unknown): State {
    const detail = error instanceof Error ? error.message : String(error)
    return { failed: true, detail }
  }

  componentDidCatch(error: unknown): void {
    // 콘솔에만 남긴다 — 외부 전송 없음(일지 본문 유출 방지)
    console.error("[TRAINORACLE] 화면 오류:", error)
  }

  private handleRetry = (): void => {
    this.setState({ failed: false, detail: "" })
  }

  override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children

    const count = entryCount()
    const mono = { fontFamily: "var(--mono, monospace)" } as const

    return (
      <div
        data-testid="error-boundary"
        style={{
          minHeight: "100vh", background: "var(--paper, #E4E2DA)",
          color: "var(--ink, #23201B)", padding: "32px 22px",
          display: "flex", flexDirection: "column", gap: 18,
          fontFamily: "var(--sans, system-ui)",
        }}
      >
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-4, #8A8578)" }}>
          TRAINORACLE
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.45 }}>
          화면을 여는 중 문제가 생겼어요
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "var(--ink-2, #4A463E)" }}>
          {count > 0
            ? `기록해 두신 일지 ${count}개는 이 기기에 그대로 있어요. 지워지지 않았어요.`
            : "이 기기에 저장된 일지는 그대로 있어요."}
          {" "}먼저 백업 파일을 받아 두시면 안전해요.
        </p>

        <button
          type="button"
          data-testid="error-download-backup"
          onClick={downloadRawBackup}
          style={{
            minHeight: 48, borderRadius: 10, cursor: "pointer",
            border: "1px solid var(--ink, #23201B)",
            background: "var(--ink, #23201B)", color: "var(--paper, #E4E2DA)",
            fontFamily: "var(--sans, system-ui)", fontSize: 15, fontWeight: 600,
          }}
        >
          일지 백업 파일 받기
        </button>

        <button
          type="button"
          data-testid="error-retry"
          onClick={this.handleRetry}
          style={{
            minHeight: 48, borderRadius: 10, cursor: "pointer",
            border: "1px solid var(--line, #C9C5B8)", background: "transparent",
            color: "var(--ink, #23201B)",
            fontFamily: "var(--sans, system-ui)", fontSize: 15,
          }}
        >
          다시 열어 보기
        </button>

        <p style={{ ...mono, fontSize: 10.5, lineHeight: 1.65, margin: 0, color: "var(--ink-4, #8A8578)" }}>
          문제가 계속되면 백업 파일을 보관해 두신 뒤 알려주세요.
          오류 내용은 이 기기 밖으로 전송되지 않아요.
        </p>

        {this.state.detail !== "" && (
          <details style={{ ...mono, fontSize: 10.5, color: "var(--ink-4, #8A8578)" }}>
            <summary style={{ cursor: "pointer", minHeight: 32 }}>기술 정보</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "8px 0 0" }}>
              {this.state.detail}
            </pre>
          </details>
        )}
      </div>
    )
  }
}
