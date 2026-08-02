import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  loadProductAnalyticsConsent,
  setProductAnalyticsConsent,
} from "../../domain/account/product-analytics-service"
import type { ProductAnalyticsConsentStatus } from "../../domain/account/product-analytics-service"
import type { AccountActionResult } from "../../domain/account/account-service"
import { primaryBtn } from "./styles"

type ProductAnalyticsConsentPanelProps = {
  readonly userId: string
  readonly onLoadConsent?: (userId: string) => Promise<ProductAnalyticsConsentStatus>
  readonly onSetConsent?: (userId: string, optedIn: boolean) => Promise<AccountActionResult>
}

export function ProductAnalyticsConsentPanel({
  userId,
  onLoadConsent = loadProductAnalyticsConsent,
  onSetConsent = setProductAnalyticsConsent,
}: ProductAnalyticsConsentPanelProps) {
  const [optedIn, setOptedIn] = React.useState(false)
  const [savedOptedIn, setSavedOptedIn] = React.useState(false)
  const [available, setAvailable] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    void onLoadConsent(userId).then((result) => {
      if (!mounted) return
      setOptedIn(result.optedIn)
      setSavedOptedIn(result.optedIn)
      setAvailable(result.ok)
      setNotice(result.ok ? null : result.message)
      setLoading(false)
    }).catch(() => {
      if (!mounted) return
      setAvailable(false)
      setNotice("분석 설정을 불러오지 못했어요.")
      setLoading(false)
    })
    return () => { mounted = false }
  }, [onLoadConsent, userId])

  const save = async () => {
    setBusy(true)
    try {
      const result = await onSetConsent(userId, optedIn)
      setNotice(result.message)
      if (result.ok) setSavedOptedIn(optedIn)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="product-analytics-title" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb><span id="product-analytics-title">선택 사용 흐름 분석</span></SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        계정과 연결된 사용 흐름만 모아요. 어떤 화면을 열고 저장이 성공했는지 같은 정해진 이름만 기록하며,
        메모 원문, 통증값, 기분값, 훈련 내용은 보내지 않아요.
      </p>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-3)", margin: 0 }}>
        기록은 생긴 날부터 30일 뒤 자동으로 삭제해요. 거절해도 기본 기능을 그대로 쓸 수 있어요.
      </p>
      {loading ? (
        <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, margin: 0 }}>분석 설정을 확인하고 있어요.</p>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, minHeight: 44 }}>
            <input
              type="checkbox"
              aria-label="선택 사용 흐름 분석 허용"
              checked={optedIn}
              disabled={!available || busy}
              onChange={(event) => setOptedIn(event.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.5 }}>
              선택 사용 흐름 분석 허용
              {!optedIn && savedOptedIn && (
                <small style={{ display: "block", color: "var(--ink-3)" }}>
                  저장하면 새 기록을 보내지 않고 전에 모인 사용 흐름 기록도 삭제해요.
                </small>
              )}
            </span>
          </label>
          <button
            type="button"
            style={primaryBtn}
            disabled={!available || busy || optedIn === savedOptedIn}
            onClick={() => void save()}
          >
            분석 설정 저장
          </button>
        </>
      )}
      {notice !== null && <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, margin: 0 }}>{notice}</p>}
    </section>
  )
}
