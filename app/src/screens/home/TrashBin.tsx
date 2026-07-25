// 휴지통 화면 — 지운 일지를 30일 안에 되돌리는 창구.
//
// 왜 별도 화면이 필요한가:
//  삭제 직후의 "되돌리기" 배너만 있으면, 화면을 벗어난 뒤에는 되돌릴 방법이
//  없다. 실수는 보통 나중에 깨닫는다("어제 지운 게 그거였나?"). 30일 보관을
//  약속했으면 30일 내내 닿을 수 있는 자리가 있어야 한다.
//
// 표시 원칙:
//  - 지운 것이 없으면 이 영역 자체를 렌더하지 않는다. 빈 휴지통을 늘 보여주는
//    것은 "삭제"를 앱의 주된 행동처럼 보이게 만든다.
//  - 남은 일수를 숫자로 보여준다. "곧 사라져요" 같은 모호한 압박 표현은 쓰지 않는다.
//  - 완전 삭제에는 확인을 받는다. 이건 진짜로 되돌릴 수 없는 유일한 지점이다.
//  - 메모 원문은 여기 표시하지 않는다. 지운 기록을 목록에 다시 펼쳐 놓으면
//    "지웠다"는 감각과 어긋난다. 무엇인지 알아볼 만큼(날짜·종류·요약)만 보여준다.

import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { compactDate } from "../../domain/dates"
import { restoreDeletedEntry } from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import {
  TRASH_RETENTION_DAYS,
  daysLeftInTrash,
  dropFromTrash,
  loadTrash,
} from "../../domain/journal-trash"

const KIND_LABEL: Record<JournalEntry["kind"], string> = {
  "post-session": "훈련 후",
  evening: "하루 마무리",
  race: "경기",
}

/** 무엇을 지웠는지 알아볼 만큼만 — 메모 원문은 넣지 않는다 */
function summarize(entry: JournalEntry): string {
  if (entry.kind === "post-session") {
    return entry.title.trim() !== "" ? entry.title : "훈련 기록"
  }
  if (entry.kind === "race") {
    return entry.record.trim() !== "" ? `기록 ${entry.record}` : "경기 기록"
  }
  const parts = [
    entry.sleepH > 0 ? `수면 ${entry.sleepH}h` : null,
    entry.mood > 0 ? `기분 ${entry.mood}/5` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(" · ") : "하루 마무리"
}

export function TrashBin({ onChanged }: { readonly onChanged?: () => void } = {}) {
  const [rev, setRev] = React.useState(0)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const items = React.useMemo(() => loadTrash(), [rev])

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[JTRASH] items=${items.length}`)
    }
  }, [items])

  if (items.length === 0) return null

  const refresh = () => {
    setRev((value) => value + 1)
    onChanged?.()
  }

  const restore = (id: string) => {
    const result = restoreDeletedEntry(id)
    if (window.location.search.includes("uitest")) console.log(`[JTRASH] restore ok=${result.ok}`)
    if (!result.ok) {
      window.alert("되돌리지 못했어요. 잠시 후 다시 시도해 주세요.")
      return
    }
    refresh()
  }

  const purge = (id: string) => {
    const ok = dropFromTrash(id)
    if (window.location.search.includes("uitest")) console.log(`[JTRASH] purge ok=${ok}`)
    setConfirmingId(null)
    if (!ok) {
      window.alert("지우지 못했어요. 잠시 후 다시 시도해 주세요.")
      return
    }
    refresh()
  }

  return (
    <div data-testid="trash-bin" style={{ padding: "28px 0 0" }}>
      <SectionLb>— 휴지통 · {items.length}건</SectionLb>
      <div style={{ margin: "0 20px", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
        지운 일지는 {TRASH_RETENTION_DAYS}일 동안 여기 남아요. 되돌리면 내용은 그대로 돌아와요.
      </div>
      <div style={{ margin: "10px 20px 0", borderTop: "1px solid var(--ink)" }}>
        {items.map((item) => {
          const daysLeft = daysLeftInTrash(item.deletedAt)
          const isConfirming = confirmingId === item.entry.id
          return (
            <div
              key={item.entry.id}
              data-testid="trash-item"
              style={{ padding: "12px 0", borderBottom: "1px dashed var(--hair)" }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
                  {compactDate(item.entry.date)}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}>
                  {KIND_LABEL[item.entry.kind]}
                </span>
                <span data-testid="trash-days-left" style={{
                  fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--ink-4)",
                  border: "1px solid var(--hair)", padding: "2px 5px", whiteSpace: "nowrap",
                }}>
                  {daysLeft > 0 ? `${daysLeft}일 남음` : "오늘까지"}
                </span>
              </div>
              <div style={{
                marginTop: 3, fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{summarize(item.entry)}</div>

              {isConfirming ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    완전히 지우면 되돌릴 수 없어요.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      data-testid="trash-purge-confirm"
                      onClick={() => purge(item.entry.id)}
                      style={{
                        minHeight: 44, padding: "0 12px",
                        border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)",
                        fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                      }}
                    >완전히 지우기</button>
                    <button
                      type="button"
                      data-testid="trash-purge-cancel"
                      onClick={() => setConfirmingId(null)}
                      style={{
                        minHeight: 44, padding: "0 12px",
                        border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)",
                        fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer",
                      }}
                    >취소</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                  <button
                    type="button"
                    data-testid="trash-restore"
                    onClick={() => restore(item.entry.id)}
                    style={{
                      background: "transparent", border: 0, cursor: "pointer", padding: "4px 0",
                      minHeight: 44,
                      fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)",
                      letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >되돌리기</button>
                  <button
                    type="button"
                    data-testid="trash-purge"
                    onClick={() => setConfirmingId(item.entry.id)}
                    style={{
                      background: "transparent", border: 0, cursor: "pointer", padding: "4px 0",
                      minHeight: 44,
                      fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)",
                      letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >완전히 지우기</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
