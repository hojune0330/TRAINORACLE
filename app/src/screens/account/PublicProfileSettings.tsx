import React from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { SectionLb } from "../../components/JournalPrimitives"
import { loadPlanBetaState } from "../../domain/plan-beta-store"
import { loadAthleteRecords, formatRecordTime } from "../../domain/athlete-records"
import { loadEntries, todayISO } from "../../domain/journal-store"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"
import { buildOracleComparisonSnapshot } from "../../domain/friend-running-oracle"
import {
  loadOwnOracleComparisonSnapshot,
  saveOwnOracleComparisonSnapshot,
} from "../../domain/account/oracle-comparison-sharing"
import {
  loadOwnPublicProfile,
  PUBLIC_PROFILE_TAG_LABELS,
  publishActivePlanCard,
  publicProfileUrl,
  savePublicProfile,
} from "../../domain/account/public-profile"
import type { PublicProfileTag } from "../../domain/account/public-profile"
import { inputStyle, primaryBtn, secondaryBtn } from "./styles"

export function PublicProfileSettings({ userId }: { readonly userId: string }) {
  const [handle, setHandle] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [profileTag, setProfileTag] = React.useState<PublicProfileTag>("TRAINING_CONSISTENTLY")
  const [isPublic, setIsPublic] = React.useState(false)
  const [savedHandle, setSavedHandle] = React.useState<string | null>(null)
  const [shareUrl, setShareUrl] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [records] = React.useState(() => loadAthleteRecords())
  const [friendOracleEnabled, setFriendOracleEnabled] = React.useState(false)
  const [shareRecord, setShareRecord] = React.useState(false)
  const [shareDistance, setShareDistance] = React.useState(false)
  const [shareEnergy, setShareEnergy] = React.useState(false)
  const [selectedRecordId, setSelectedRecordId] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    void loadOwnPublicProfile(userId).then(profile => {
      if (cancelled || profile === null) return
      setHandle(profile.handle)
      setSavedHandle(profile.handle)
      setDisplayName(profile.displayName)
      setProfileTag(profile.profileTag)
      setIsPublic(profile.isPublic)
      setShareUrl(profile.isPublic ? publicProfileUrl(profile.handle) : null)
    })
    void loadOwnOracleComparisonSnapshot(userId).then(snapshot => {
      if (cancelled || snapshot === null) return
      setFriendOracleEnabled(true)
      setShareRecord(snapshot.sharedFields.includes("BEST_RECORD"))
      setShareDistance(snapshot.sharedFields.includes("RECENT_DISTANCE"))
      setShareEnergy(snapshot.sharedFields.includes("ENERGY_HISTORY"))
      if (snapshot.record !== null) {
        const matched = records.find(record => (
          record.purpose !== "RACE_GOAL"
          && record.eventDistanceM === snapshot.record?.eventDistanceM
          && record.performanceSeconds === snapshot.record.bestSeconds
        ))
        if (matched !== undefined) setSelectedRecordId(matched.id)
      }
    })
    return () => { cancelled = true }
  }, [records, userId])

  const save = async () => {
    setBusy(true)
    const result = await savePublicProfile(userId, { handle, displayName, profileTag, isPublic })
    setNotice(result.message)
    setShareUrl(result.ok ? result.url ?? null : null)
    if (result.ok) setSavedHandle(handle.trim().toLowerCase())
    if (result.ok && !isPublic) {
      const comparisonResult = await saveOwnOracleComparisonSnapshot(userId, null)
      if (comparisonResult.ok) {
        setFriendOracleEnabled(false)
      } else {
        setNotice("프로필은 비공개로 바뀌었지만 친구 비교 공개 기록을 지우지 못했어요. 다시 저장해 주세요.")
      }
    }
    setBusy(false)
  }

  const saveFriendOracle = async () => {
    if (!friendOracleEnabled) {
      setBusy(true)
      const result = await saveOwnOracleComparisonSnapshot(userId, null)
      setBusy(false)
      setNotice(result.message)
      return
    }
    const snapshot = buildOracleComparisonSnapshot({
      observations: projectStructuredJournalObservations(loadEntries()),
      records,
      selection: {
        recordId: selectedRecordId === "" ? null : selectedRecordId,
        shareRecord,
        shareDistance,
        shareEnergy,
      },
      today: todayISO(),
    })
    if (snapshot === null) {
      setNotice("친구와 비교할 항목을 하나 이상 골라 주세요.")
      return
    }
    setBusy(true)
    const result = await saveOwnOracleComparisonSnapshot(userId, snapshot)
    setBusy(false)
    setNotice(result.message)
  }

  const sharePlan = async () => {
    const activePlan = loadPlanBetaState()
    setBusy(true)
    const result = await publishActivePlanCard(userId, activePlan)
    setBusy(false)
    setNotice(result.message)
    if (result.ok && result.url !== undefined) setShareUrl(result.url)
  }

  const copyLink = async () => {
    if (savedHandle === null) return
    try {
      await navigator.clipboard.writeText(publicProfileUrl(savedHandle))
      setNotice("프로필 주소를 복사했어요.")
    } catch {
      setNotice(publicProfileUrl(savedHandle))
    }
  }

  const shareWithFriend = async () => {
    if (shareUrl === null) return
    try {
      if (navigator.share !== undefined) {
        await navigator.share({
          title: `${displayName}의 TrainOracle 훈련 계획`,
          text: "내가 진행 중인 훈련 계획 요약을 확인해 보세요.",
          url: shareUrl,
        })
        setNotice("공유 화면을 열었어요.")
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setNotice("친구에게 보낼 주소를 복사했어요.")
    } catch {
      setNotice("공유를 취소했어요. 공개 설정은 그대로예요.")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>친구에게 보여줄 내 프로필</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        공개를 켜야 다른 사람이 볼 수 있어요. 일지, 메모, 통증, 상세 훈련 처방은 공개하지 않고 이름·소개와 내가 공유한 계획 요약만 보여줘요.
      </p>
      <label htmlFor="public-profile-handle" style={labelStyle}>프로필 주소</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>@</span>
        <input
          id="public-profile-handle"
          value={handle}
          onChange={event => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/gu, ""))}
          placeholder="runner_name"
          maxLength={24}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
      <label htmlFor="public-profile-name" style={labelStyle}>보여줄 이름</label>
      <input id="public-profile-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={40} style={inputStyle} />
      <label htmlFor="public-profile-tag" style={labelStyle}>프로필 소개</label>
      <select id="public-profile-tag" value={profileTag} onChange={event => setProfileTag(event.target.value as PublicProfileTag)} style={inputStyle}>
        {Object.entries(PUBLIC_PROFILE_TAG_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.55 }}>
        <input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} />
        <span><b>다른 사람이 내 프로필을 볼 수 있게 하기</b><br /><span style={{ color: "var(--ink-3)", fontSize: 11.5 }}>끄면 기존 주소도 바로 비공개가 됩니다.</span></span>
      </label>
      <button type="button" style={primaryBtn} disabled={busy || handle.length < 3 || displayName.trim() === ""} onClick={() => void save()}>
        <Check aria-hidden="true" size={16} /> 프로필 저장
      </button>
      <button type="button" style={secondaryBtn} disabled={busy || !isPublic || loadPlanBetaState() === null} onClick={() => void sharePlan()}>
        <Share2 aria-hidden="true" size={16} /> 현재 훈련 계획 요약 공유
      </button>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        <SectionLb>친구와 기록 비교</SectionLb>
        <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
          공개 프로필과 별도로 켜야 해요. 고른 기록·최근 8주 거리·에너지 시스템 횟수만 보여주며 일지 원문, 비밀 메모, 통증, 수면은 보내지 않아요.
        </p>
        <label style={checkLabelStyle}>
          <input type="checkbox" checked={friendOracleEnabled} disabled={!isPublic} onChange={event => setFriendOracleEnabled(event.target.checked)} />
          <span><b>친구가 내 기록과 비교할 수 있게 하기</b><br /><span style={checkHelpStyle}>프로필 공개를 먼저 켜야 사용할 수 있어요.</span></span>
        </label>
        {friendOracleEnabled && isPublic && (
          <>
            <label style={checkLabelStyle}>
              <input type="checkbox" checked={shareRecord} onChange={event => setShareRecord(event.target.checked)} />
              <span>내가 고른 경기 기록 1개</span>
            </label>
            {shareRecord && (
              <select aria-label="비교에 공개할 경기 기록" value={selectedRecordId} onChange={event => setSelectedRecordId(event.target.value)} style={inputStyle}>
                <option value="">기록을 선택해 주세요</option>
                {records.filter(record => record.purpose !== "RACE_GOAL").map(record => (
                  <option key={record.id} value={record.id}>{record.eventDistanceM}m · {formatRecordTime(record.performanceSeconds)}</option>
                ))}
              </select>
            )}
            <label style={checkLabelStyle}>
              <input type="checkbox" checked={shareDistance} onChange={event => setShareDistance(event.target.checked)} />
              <span>최근 8주 거리 합계</span>
            </label>
            <label style={checkLabelStyle}>
              <input type="checkbox" checked={shareEnergy} onChange={event => setShareEnergy(event.target.checked)} />
              <span>최근 8주 에너지 시스템별 기록 횟수</span>
            </label>
          </>
        )}
        <button type="button" style={secondaryBtn} disabled={busy || !isPublic} onClick={() => void saveFriendOracle()}>
          <Share2 aria-hidden="true" size={16} /> 친구 비교 공개 설정 저장
        </button>
      </div>
      {shareUrl !== null && (
        <button type="button" style={primaryBtn} disabled={busy} onClick={() => void shareWithFriend()}>
          <Share2 aria-hidden="true" size={16} /> 친구에게 보내기
        </button>
      )}
      {savedHandle !== null && isPublic && (
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void copyLink()}>
          <Copy aria-hidden="true" size={16} /> 프로필 주소 복사
        </button>
      )}
      {notice !== null && <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{notice}</p>}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "var(--ink-3)",
}

const checkLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.55,
}

const checkHelpStyle: React.CSSProperties = {
  color: "var(--ink-3)",
  fontSize: 11.5,
}
