import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { eraseAllLocalData } from "../../domain/erase-local-data"
import { secondaryBtn } from "./styles"

export function EraseLocalData() {
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
        이 기기에 저장된 일지·계획·로그인 정보를 모두 지워요.
        <b> 되돌릴 수 없으니 필요하면 먼저 백업을 받아 두세요.</b>
      </p>

      {done !== null ? (
        <p role="status" data-testid="erase-result" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", margin: "10px 0 0" }}>
          {done}
        </p>
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
              borderRadius: 10,
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
