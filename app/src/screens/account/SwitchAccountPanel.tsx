import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { currentSyncOwner, loadSyncConsent, releaseSyncOwner, saveSyncConsent } from "../../domain/account/sync"
import type { ReleaseOwnerResult } from "../../domain/account/sync"
import { loadEntries } from "../../domain/journal-store"
import { mono, secondaryBtn } from "./styles"

/**
 * "다른 계정으로 바꾸기" — 일지를 지키면서 기기의 계정 잠금을 푼다 (Q4).
 *
 * 왜 이 화면이 필요한가:
 *  동기화는 기기 하나를 계정 하나에 묶는다(claimSyncBinding). 그 잠금 자체는
 *  옳다 — 없으면 내 일지가 남의 계정으로 올라간다. 문제는 잠금을 푸는 **유일한
 *  안내가 "이 기기 데이터 전부 지우기"** 였다는 것이다. 계정만 바꾸려는 사람에게
 *  "일지를 다 지우세요"는 과한 요구이고, 실제로 지우면 되돌릴 수 없다.
 *
 * 이 화면의 책임 (도메인이 일부러 안 하는 것들):
 *  - 동의 끄기: 잠금을 풀자마자 새 계정으로 **자동 업로드되면 안 된다.**
 *    releaseSyncOwner는 동의를 건드리지 않으므로 여기서 명시적으로 끈다.
 *  - 로그아웃: 지금 로그인된 계정이 남아 있으면 사용자는 바뀐 줄 알고
 *    동기화를 눌러 원래 계정에 다시 묶인다.
 *  - 백업 권유: 되돌릴 수 없는 일은 아니지만, 계정을 옮기는 김에 내려받아
 *    두는 것이 안전하다. **강요하지 않고 권한다.**
 *
 * 겁주지 않는다. 이 동작은 일지를 지우지 않으므로 경고가 아니라 설명을 쓴다.
 */
export function SwitchAccountPanel({
  onSignOut,
  onRelease = releaseSyncOwner,
  onOpenBackup,
}: {
  /** 로그아웃 — 잠금만 풀고 로그인 상태를 남기면 원래 계정에 다시 묶인다 */
  readonly onSignOut: () => void | Promise<void>
  readonly onRelease?: () => ReleaseOwnerResult
  /** 백업 화면으로 보내기 — 없으면 권유 버튼을 숨긴다 */
  readonly onOpenBackup?: (() => void) | undefined
}) {
  const [confirming, setConfirming] = React.useState(false)
  const [result, setResult] = React.useState<ReleaseOwnerResult | null>(null)
  const owner = React.useMemo(() => currentSyncOwner(), [result])

  // 이 기기가 아무 계정과도 묶여 있지 않으면 보여줄 이유가 없다.
  // 없는 문제를 위한 버튼은 사용자를 불안하게 만든다.
  if (owner === null && result === null) return null

  const release = async () => {
    // 순서가 중요하다. 동의를 먼저 끈다 — 잠금이 풀린 순간과 동의가 꺼지는
    // 순간 사이에 자동 동기화가 끼어들 틈을 주지 않는다.
    const consent = loadSyncConsent()
    saveSyncConsent({ ...consent, enabled: false })
    const outcome = onRelease()
    setResult(outcome)
    setConfirming(false)
    // 실패했으면 로그아웃하지 않는다. 잠금이 그대로인데 로그아웃까지 하면
    // 사용자는 상태를 알 수 없게 된다.
    if (outcome.ok) await onSignOut()
  }

  return (
    <div data-testid="switch-account-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>다른 계정으로 바꾸기</SectionLb>

      {result !== null ? (
        <p
          role="status"
          data-testid="switch-account-result"
          style={{ ...mono, fontSize: 12, lineHeight: 1.7, color: "var(--ink-2)", margin: 0 }}
        >
          {result.message}
        </p>
      ) : confirming ? (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            이 기기의 계정 연결만 끊어요. <b>현재 볼 수 있는 일지 {loadEntries().length}개는 그대로 남아요.</b>
            {" "}동기화는 꺼지고 로그아웃돼요. 다른 계정으로 로그인해서 다시 켤 수 있어요.
          </p>
          {onOpenBackup !== undefined && (
            <button
              type="button"
              data-testid="switch-account-backup"
              style={secondaryBtn}
              onClick={onOpenBackup}
            >
              먼저 백업 내려받기
            </button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              data-testid="switch-account-confirm"
              style={{ ...secondaryBtn, flex: 1 }}
              onClick={() => void release()}
            >
              연결 끊기
            </button>
            <button
              type="button"
              data-testid="switch-account-cancel"
              style={{ ...secondaryBtn, flex: 1 }}
              onClick={() => setConfirming(false)}
            >
              그만두기
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            이 기기는 계정 하나와 연결되어 있어요. 다른 계정으로 동기화하려면 연결을 끊어야 해요.
            <br />
            <b>일지를 지우지 않고</b> 연결만 끊을 수 있어요.
          </p>
          <button
            type="button"
            data-testid="switch-account-start"
            style={secondaryBtn}
            onClick={() => setConfirming(true)}
          >
            이 기기의 계정 연결 끊기
          </button>
        </>
      )}
    </div>
  )
}
