import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { eraseAllLocalData } from "../../domain/erase-local-data"
import { SafeJournalExport } from "../home/DeviceJournal"
import { secondaryBtn } from "./styles"

export function EraseLocalData({ onOpenRestore }: {
  readonly onOpenRestore?: () => void
} = {}) {
  const [confirming, setConfirming] = React.useState(false)
  const [done, setDone] = React.useState<string | null>(null)

  const handleErase = () => {
    const result = eraseAllLocalData()
    setConfirming(false)
    setDone(
      result.ok
        ? `이 기기에서 ${result.cleared}개 항목을 지웠어요.`
        : "일부 항목을 지우지 못했어요. 브라우저 설정에서 사이트 데이터를 삭제해 주세요.",
    )
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <SectionLb>이 기기 데이터 지우기</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "8px 0 0" }}>
        이 기기에 저장된 일지·계획·포인트·로그인 정보를 모두 지워요.
        <b> 되돌릴 수 없으니 필요하면 먼저 백업을 받아 두세요.</b>
      </p>

      {/*
        Q3 — "모두 지워요"라고만 말하면 사실과 다르다. 한 가지가 남는다:
        **어떤 일지를 지웠다는 기록(tombstone)**이다.

        왜 남기는가: 이것까지 지우면 전부 지운 뒤 다시 로그인해 동기화할 때
        서버 사본이 되살아난다. "지웠다는 사실"이 없으면 삭제가 무효가 된다.

        왜 지우는 선택지를 화면에 두지 않는가(사용자 결정 Q3=나): 그 선택지는
        고르는 순간 지운 일지가 되살아나는 부작용을 만든다. 대신 남는다는 사실만
        정직하게 밝힌다. 무엇이 남는지 알리지 않는 것과, 위험한 선택지를 주는
        것은 다른 문제다 — 전자는 고치고 후자는 만들지 않는다.

        내용이 아니라 "어떤 항목을 지웠다"는 표시만 남는다는 점을 함께 말한다.
        그러지 않으면 사용자는 일지 내용이 남는다고 오해한다.
      */}
      <p
        data-testid="erase-deletion-record-notice"
        style={{ fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.7, color: "var(--ink-4)", margin: "8px 0 0" }}
      >
        한 가지는 남아요 — <b>어느 계정에서 어떤 일지를 지웠는지에 대한 표시</b>예요.
        일지 내용이 아니라 계정 식별자·일지 ID·삭제 시각만 남고, 날짜·수치·메모는 남지 않아요.
        이걸 지우면 나중에 다시 로그인해 동기화할 때 지운 일지가 서버에서 되살아나기 때문에 남겨 둬요.
      </p>

      {done === null && <SafeJournalExport onOpenRestore={onOpenRestore} />}

      {done !== null ? (
        <div style={{ marginTop: 10 }}>
          <p role="status" data-testid="erase-result" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", margin: 0 }}>
            {done}
          </p>
          {onOpenRestore && (
            <button type="button" onClick={onOpenRestore} style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}>
              백업 파일 되돌리기
            </button>
          )}
        </div>
      ) : confirming ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <p style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, margin: 0 }}>
            정말 지울까요? 이 작업은 되돌릴 수 없어요.
          </p>
          <button
            type="button"
            data-testid="erase-confirm"
            onClick={handleErase}
            style={{
              minHeight: 44,
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              border: "1px solid var(--ink)",
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            네, 전부 지울게요
          </button>
          <button type="button" data-testid="erase-cancel" onClick={() => setConfirming(false)} style={{ ...secondaryBtn, minHeight: 44 }}>
            그만두기
          </button>
        </div>
      ) : (
        <button type="button" data-testid="erase-start" onClick={() => setConfirming(true)} style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}>
          이 기기 데이터 전부 지우기
        </button>
      )}
    </div>
  )
}
