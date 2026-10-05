import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { currentSyncOwner, loadSyncConsent, releaseSyncOwner, saveSyncConsent } from "../../domain/account/sync"
import type { ReleaseOwnerResult, SyncConsent } from "../../domain/account/sync"
import type { AuthResult } from "../../domain/account/auth"
import { loadEntries } from "../../domain/journal-store"
import { secondaryBtn } from "./styles"

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
  onOutcome,
}: {
  /** 로그아웃 — 잠금만 풀고 로그인 상태를 남기면 원래 계정에 다시 묶인다 */
  readonly onSignOut: () => AuthResult | Promise<AuthResult>
  readonly onRelease?: () => ReleaseOwnerResult
  /** 백업 화면으로 보내기 — 없으면 권유 버튼을 숨긴다 */
  readonly onOpenBackup?: (() => void) | undefined
  /** 로그아웃으로 이 패널이 사라져도 최종 결과를 상위 화면에 남긴다. */
  readonly onOutcome?: ((result: ReleaseOwnerResult) => void) | undefined
}) {
  const [confirming, setConfirming] = React.useState(false)
  const [result, setResult] = React.useState<ReleaseOwnerResult | null>(null)
  const [working, setWorking] = React.useState(false)
  const owner = React.useMemo(() => currentSyncOwner(), [result])

  const publishResult = (outcome: ReleaseOwnerResult) => {
    setResult(outcome)
    try {
      onOutcome?.(outcome)
    } catch {
      // 결과 표시 콜백이 실패해도 이미 완료된 로그아웃/연결 해제를 되돌리지 않는다.
    }
  }

  // 이 기기가 아무 계정과도 묶여 있지 않으면 보여줄 이유가 없다.
  // 없는 문제를 위한 버튼은 사용자를 불안하게 만든다.
  if (owner === null && result === null) return null

  const release = async () => {
    if (working || owner === null) return
    setWorking(true)

    try {
      // 순서가 중요하다. 현재 owner의 동의를 먼저 보관하고 끈다. 로그아웃
      // 실패 시 이 값을 되돌리고, 성공한 뒤에만 계정 잠금을 푼다.
      let consent: SyncConsent
      try {
        consent = loadSyncConsent(owner)
      } catch {
        publishResult({ ok: false, message: "동기화 설정을 확인하지 못해 계정을 바꾸지 않았어요." })
        return
      }
      if (!saveSyncConsent({ ...consent, enabled: false }, owner)) {
        const restored = saveSyncConsent(consent, owner)
        publishResult({
          ok: false,
          message: restored
            ? "동기화를 끄지 못해 계정을 바꾸지 않았어요."
            : "동기화 설정을 안전하게 바꾸지 못해 계정을 바꾸지 않았어요.",
        })
        return
      }

      let signOutResult: AuthResult
      try {
        signOutResult = await onSignOut()
      } catch {
        signOutResult = { ok: false, message: "로그아웃에 실패했어요." }
      }
      if (!signOutResult.ok) {
        const restored = saveSyncConsent(consent, owner)
        publishResult({
          ok: false,
          message: restored
            ? signOutResult.message
            : `${signOutResult.message} 동기화 설정도 되돌리지 못했어요.`,
        })
        return
      }

      let outcome: ReleaseOwnerResult
      try {
        outcome = onRelease()
      } catch {
        outcome = { ok: false, message: "계정 연결을 끊지 못했어요. 일지는 그대로 있어요." }
      }
      publishResult(outcome.ok ? outcome : {
        ok: false,
        message: `로그아웃은 됐지만 ${outcome.message}`,
      })
    } finally {
      setConfirming(false)
      setWorking(false)
    }
  }

  return (
    <div className="account-panel" data-testid="switch-account-panel">
      <SectionLb>다른 계정으로 바꾸기</SectionLb>

      {result !== null ? (
        <p
          className="account-panel__status"
          data-state={result.ok ? "success" : "error"}
          role="status"
          aria-live="polite"
          data-testid="switch-account-result"
        >
          {result.message}
        </p>
      ) : confirming ? (
        <>
          <p className="account-panel__body">
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
          <div className="account-panel__actions account-panel__actions--split">
            <button
              type="button"
              data-testid="switch-account-confirm"
              style={secondaryBtn}
              disabled={working}
              onClick={() => void release()}
            >
              {working ? "처리 중" : "연결 끊기"}
            </button>
            <button
              type="button"
              data-testid="switch-account-cancel"
              style={secondaryBtn}
              disabled={working}
              onClick={() => setConfirming(false)}
            >
              그만두기
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="account-panel__body">
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
