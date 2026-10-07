// 앱 전역 오류 경계.
//
// 왜 필요한가 (실제 위험):
//  React는 렌더 중 예외가 나면 트리 전체를 언마운트한다. 경계가 없으면
//  화면이 **완전한 흰 화면**이 된다. 기기에 저장된 일지도 있으므로,
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
import { readVisibleJournalEntries } from "../domain/account/local-journal-ownership"
import { captureInterruptedDraft, isScreenAssetFailure, reloadScreenAssets, rememberRecoveryTab } from "../domain/screen-recovery"
import type { AppTab } from "./AppChrome"

const JOURNAL_KEY = "trainoracle.journal.v1"

type Props = {
  readonly children: React.ReactNode
  readonly region?: boolean
  readonly onExit?: () => void
  readonly recoveryTab?: AppTab
}
type State = { failed: boolean; detail: string; unsafeAtFailure: boolean; busy: boolean; message: string }

type BackupRead = { kind: "ready"; raw: string; count: number } | { kind: "unavailable" }

export function readEmergencyJournalBackup(): BackupRead {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return { kind: "unavailable" }
    const entries: { readonly id: string }[] = []
    for (const candidate of parsed) {
      if (typeof candidate !== "object" || candidate === null || typeof candidate.id !== "string") return { kind: "unavailable" }
      entries.push(candidate)
    }
    const read = readVisibleJournalEntries(entries)
    return read.kind === "loaded"
      ? { kind: "ready", raw: JSON.stringify(read.entries), count: read.entries.length }
      : { kind: "unavailable" }
  } catch { return { kind: "unavailable" } }
}

/** 깨진 상태에서도 동작하도록 localStorage를 직접 읽어 백업을 만든다 */
function downloadRawBackup(): boolean {
  try {
    const backup = readEmergencyJournalBackup()
    if (backup.kind !== "ready" || backup.count === 0) return false
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([backup.raw], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `trainoracle-비상백업-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}

export function emergencyJournalBackupRaw(): string {
  const backup = readEmergencyJournalBackup()
  return backup.kind === "ready" ? backup.raw : "[]"
}

export class ErrorBoundary extends React.Component<Props, State> {
  private mounted = false

  componentDidMount(): void { this.mounted = true }
  componentWillUnmount(): void { this.mounted = false }

  constructor(props: Props) {
    super(props)
    this.state = { failed: false, detail: "", unsafeAtFailure: false, busy: false, message: "" }
  }

  static getDerivedStateFromError(error: unknown): State {
    const detail = error instanceof Error ? error.message : String(error)
    return { failed: true, detail, unsafeAtFailure: captureInterruptedDraft(), busy: false, message: "" }
  }

  componentDidCatch(error: unknown): void {
    // 콘솔에만 남긴다 — 외부 전송 없음(일지 본문 유출 방지)
    console.error("[TRAINORACLE] 화면 오류:", error)
  }

  private handleRetry = async (): Promise<void> => {
    if (this.state.busy) return
    if (!isScreenAssetFailure(this.state.detail)) {
      this.setState({ failed: false, detail: "", message: "" })
      return
    }
    this.setState({ busy: true, message: "" })
    const result = await reloadScreenAssets({ unsafeAtFailure: this.state.unsafeAtFailure,
      beforeReload: () => { if (this.props.recoveryTab) rememberRecoveryTab(this.props.recoveryTab) },
      isCurrent: () => this.mounted,
    })
    if (!this.mounted || result === "reloading" || result === "cancelled") return
    this.setState({ busy: false, message: result === "draft-blocked"
      ? "아직 저장되지 않은 입력이 있어 새로고침하지 않았어요. 열려 있는 작성 화면을 먼저 확인해 주세요."
      : "화면 파일을 받을 수 없어요. 인터넷 연결이나 미리보기 서버가 돌아온 뒤 다시 눌러 주세요." })
  }

  override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children

    const backup = readEmergencyJournalBackup()
    const assetFailure = isScreenAssetFailure(this.state.detail)
    const mono = { fontFamily: "var(--mono, monospace)" } as const

    return (
      <div
        data-testid="error-boundary"
        style={{
          minHeight: this.props.region ? "auto" : "100dvh", background: "var(--paper, #E4E2DA)",
          color: "var(--ink, #23201B)", padding: "32px 22px",
          display: "flex", flexDirection: "column", gap: 18,
          fontFamily: "var(--sans, system-ui)",
        }}
      >
        <div style={{ ...mono, fontSize: 11, letterSpacing: 0, color: "var(--ink-4, #8A8578)" }}>
          TRAINORACLE
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.45 }}>
          {assetFailure ? "화면 파일을 불러오지 못했어요" : "화면을 여는 중 문제가 생겼어요"}
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "var(--ink-2, #4A463E)" }}>
          {assetFailure ? "연결을 확인한 뒤 앱을 다시 불러와요." : this.props.region ? "이 화면을 다시 열거나 다른 탭으로 이동할 수 있어요." : "앱 화면을 다시 열어 주세요."}
          {" "}복구를 위해 기록이나 계획을 삭제하지 않아요.
        </p>

        {this.props.onExit && <button type="button" onClick={this.props.onExit} style={{ minHeight: 44 }}>이전 화면으로</button>}

        <button
          type="button"
          data-testid="error-retry"
          onClick={this.handleRetry}
          disabled={this.state.busy}
          style={{
            minHeight: 48, borderRadius: "var(--r-md)", cursor: "pointer",
            border: "1px solid var(--ink, #23201B)",
            background: "var(--ink, #23201B)", color: "var(--paper, #E4E2DA)",
            fontFamily: "var(--sans, system-ui)", fontSize: 15, fontWeight: 600,
          }}
        >
          {this.state.busy ? "연결 확인 중…" : "다시 열어 보기"}
        </button>

        {this.state.message && <p role="status">{this.state.message}</p>}

        <details>
          <summary style={{ cursor: "pointer", minHeight: 44, fontSize: 14 }}>일지 백업과 보관 범위</summary>
        <button
          type="button"
          data-testid="error-download-backup"
          disabled={backup.kind !== "ready" || backup.count === 0}
          onClick={() => this.setState({ message: downloadRawBackup()
            ? "백업 다운로드를 요청했어요. 파일이 저장됐는지 확인해 주세요."
            : "백업 파일을 만들지 못했어요. 저장된 내용을 지우지 말고 다시 시도해 주세요." })}
          style={{
            minHeight: 48, borderRadius: "var(--r-md)", cursor: "pointer",
            border: "1px solid var(--ink, #23201B)",
            background: "transparent", color: "var(--ink, #23201B)",
            fontFamily: "var(--sans, system-ui)", fontSize: 15, fontWeight: 600,
          }}
        >
          일지 백업 파일 받기
        </button>

        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {backup.kind !== "ready" ? "기기에 있는 일지와 소유권을 확인하지 못해 백업을 만들 수 없어요."
            : backup.count === 0 ? "이 기기에서 백업할 수 있는 일지가 없어요. 온라인 저장 여부는 여기서 확인하지 못했어요."
              : `이 기기에서 읽을 수 있는 일지 ${backup.count}개를 백업할 수 있어요.`}
          {" "}훈련 계획과 온라인 전용 데이터는 이 백업에 포함되지 않아요.
        </p>

        </details>

        <p style={{ ...mono, fontSize: 10.5, lineHeight: 1.65, margin: 0, color: "var(--ink-4, #8A8578)" }}>
          오류 내용은 이 기기 밖으로 전송되지 않아요.
        </p>

        <a
          href="?feedback=1"
          style={{ color: "var(--ink, #23201B)", fontSize: 14, minHeight: 44, display: "flex", alignItems: "center" }}
        >
          문의 게시판에 알리기
        </a>

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
