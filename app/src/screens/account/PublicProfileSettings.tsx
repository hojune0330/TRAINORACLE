import React from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { SectionLb } from "../../components/JournalPrimitives"
import { loadPlanBetaState } from "../../domain/plan-beta-store"
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
    return () => { cancelled = true }
  }, [userId])

  const save = async () => {
    setBusy(true)
    const result = await savePublicProfile(userId, { handle, displayName, profileTag, isPublic })
    setBusy(false)
    setNotice(result.message)
    setShareUrl(result.ok ? result.url ?? null : null)
    if (result.ok) setSavedHandle(handle.trim().toLowerCase())
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
