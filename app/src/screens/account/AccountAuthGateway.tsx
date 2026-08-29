import React from "react"
import { ArrowLeft, ChevronRight, Mail, Phone, ShieldCheck } from "lucide-react"
import type { AuthResult, SocialAuthProvider } from "../../domain/account/auth"
import {
  maskPhoneNumber,
  PHONE_OTP_RESEND_SECONDS,
  requestEmailOtp,
  requestPhoneOtp,
  signInWithProvider,
  verifyPhoneOtp,
} from "../../domain/account/auth"
import type { AccountConfig } from "../../domain/account/config"
import {
  clearPendingAccountSetup,
  createPendingAccountSetup,
  onlineAccountEligibility,
  writePendingAccountSetup,
} from "../../domain/account/auth-onboarding"
import type { AuthMethod } from "../../domain/account/auth-onboarding"
import { formatBirthDateInput } from "./birth-date-input"

type GatewayStep = "method" | "eligibility" | "email" | "email-sent" | "phone" | "phone-code" | "under14"

export type AccountAuthGatewayProps = {
  readonly config: AccountConfig
  readonly today: string
  readonly onSocialSignIn?: (provider: SocialAuthProvider) => Promise<AuthResult>
  readonly onRequestEmailOtp?: (email: string) => Promise<AuthResult>
  readonly onRequestPhoneOtp?: (phone: string) => Promise<AuthResult>
  readonly onVerifyPhoneOtp?: (phone: string, code: string) => Promise<AuthResult>
}

export function AccountAuthGateway({
  config,
  today,
  onSocialSignIn = signInWithProvider,
  onRequestEmailOtp: sendEmailOtp = requestEmailOtp,
  onRequestPhoneOtp: sendPhoneOtp = requestPhoneOtp,
  onVerifyPhoneOtp: checkPhoneOtp = verifyPhoneOtp,
}: AccountAuthGatewayProps) {
  const [step, setStep] = React.useState<GatewayStep>("method")
  const [method, setMethod] = React.useState<AuthMethod | null>(null)
  const [birthDate, setBirthDate] = React.useState("")
  const [legalAcknowledged, setLegalAcknowledged] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [phoneCode, setPhoneCode] = React.useState("")
  const [phoneResendSeconds, setPhoneResendSeconds] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (phoneResendSeconds <= 0) return
    const timer = window.setTimeout(() => {
      setPhoneResendSeconds(value => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [phoneResendSeconds])

  const chooseMethod = (nextMethod: AuthMethod) => {
    setMethod(nextMethod)
    setNotice(null)
    setStep("eligibility")
  }

  const resetMethod = () => {
    clearPendingAccountSetup()
    setMethod(null)
    setStep("method")
    setNotice(null)
  }

  const continueAfterEligibility = async () => {
    if (method === null) return
    const eligibility = onlineAccountEligibility(birthDate, today)
    if (eligibility === "INVALID") {
      setNotice("생년월일을 확인해 주세요.")
      return
    }
    if (eligibility === "UNDER_14") {
      clearPendingAccountSetup()
      setStep("under14")
      setNotice(null)
      return
    }
    if (!legalAcknowledged) {
      setNotice("필수 약관을 확인하고 동의해 주세요.")
      return
    }

    writePendingAccountSetup(createPendingAccountSetup({ method, birthDate, config }))
    if (method === "email") {
      setStep("email")
      setNotice(null)
      return
    }
    if (method === "phone") {
      setStep("phone")
      setNotice(null)
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const result = await onSocialSignIn(method)
      if (!result.ok) setNotice(result.message)
    } catch {
      setNotice("간편 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  const sendEmailLink = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await sendEmailOtp(email)
      setNotice(result.message)
      if (result.ok) setStep("email-sent")
    } catch {
      setNotice("확인 이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  const sendPhoneCode = async () => {
    if (phoneResendSeconds > 0) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await sendPhoneOtp(phone)
      setNotice(result.message)
      if (result.ok) {
        setPhoneResendSeconds(PHONE_OTP_RESEND_SECONDS)
        setStep("phone-code")
      }
    } catch {
      setNotice("인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  const verifyPhoneCode = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await checkPhoneOtp(phone, phoneCode)
      setNotice(result.ok ? "로그인 정보를 확인하고 있어요." : result.message)
    } catch {
      setNotice("인증번호를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-auth" data-step={step}>
      {step === "method" && (
        <>
          <div className="account-auth__intro">
            <span className="account-auth__trust"><ShieldCheck aria-hidden="true" size={15} /> 로그인하고 기록을 지키세요</span>
            <h2>로그인하면 기록이 안전하게 남아요</h2>
            <p>로그인해 두면 일지와 훈련 계획을 계정과 연결해 기기를 바꾸거나 잃어버려도 지킬 수 있어요. 가장 편한 방법으로 시작하세요.</p>
          </div>
          <div className="account-auth__methods" aria-label="로그인 방법 선택">
            {config.kakaoAuthEnabled && (
              <MethodButton className="account-auth__method--kakao" mark="K" label="카카오로 계속하기" onClick={() => chooseMethod("kakao")} />
            )}
            <MethodButton mark="G" label="Google로 계속하기" onClick={() => chooseMethod("google")} />
            <MethodButton icon={<Mail aria-hidden="true" size={19} />} label="이메일로 계속하기" onClick={() => chooseMethod("email")} />
            {config.phoneAuthEnabled && (
              <MethodButton icon={<Phone aria-hidden="true" size={19} />} label="휴대전화로 계속하기" onClick={() => chooseMethod("phone")} />
            )}
          </div>
        </>
      )}

      {step === "eligibility" && (
        <>
          <StepHeader step="1 / 2" title="가입 전에 두 가지만 확인해요" onBack={resetMethod} />
          <div className="account-auth__field-group">
            <label htmlFor="account-signup-birth-date">생년월일</label>
            <input
              id="account-signup-birth-date"
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              maxLength={10}
              placeholder="예: 2000-01-01"
              value={birthDate}
              onChange={(event) => { setBirthDate(formatBirthDateInput(event.target.value)); setNotice(null) }}
            />
            <small>숫자 8자리를 입력하면 날짜로 정리돼요. 만 14세 이상인지 확인하는 데만 사용하고 코치·분석·포인트에는 보내지 않아요.</small>
          </div>
          <label className="account-auth__legal-check">
            <input
              type="checkbox"
              checked={legalAcknowledged}
              onChange={(event) => { setLegalAcknowledged(event.target.checked); setNotice(null) }}
            />
            <span>
              <b>필수 약관에 모두 동의</b>
              <small>
                <a href={config.privacyPolicy.url} target="_blank" rel="noreferrer">개인정보 처리방침</a>
                {" · "}
                <a href={config.termsOfService.url} target="_blank" rel="noreferrer">이용약관</a>
              </small>
            </span>
          </label>
          <button
            className="account-auth__primary"
            type="button"
            disabled={busy || birthDate.length !== 10}
            onClick={() => void continueAfterEligibility()}
          >
            {busy
              ? "연결하는 중..."
              : method === "email"
                ? "이메일 입력하기"
                : method === "phone"
                  ? "휴대전화 번호 입력하기"
                  : `${method === "kakao" ? "카카오" : "Google"}로 계속하기`}
            {!busy && <ChevronRight aria-hidden="true" size={18} />}
          </button>
        </>
      )}

      {step === "email" && (
        <>
          <StepHeader step="2 / 2" title="확인 링크를 받을 이메일을 적어 주세요" onBack={() => setStep("eligibility")} />
          <div className="account-auth__field-group">
            <label htmlFor="account-email">이메일</label>
            <input
              id="account-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setNotice(null) }}
              placeholder="you@example.com"
            />
            <small>비밀번호 대신 메일로 확인 링크를 보내드려요.</small>
          </div>
          <button className="account-auth__primary" type="button" disabled={busy || email.trim() === ""} onClick={() => void sendEmailLink()}>
            {busy ? "보내는 중..." : "확인 이메일 받기"}
          </button>
        </>
      )}

      {step === "email-sent" && (
        <>
          <StepHeader step="마지막" title="이메일에서 확인 링크를 열어 주세요" onBack={() => setStep("email")} />
          <div className="account-auth__under14" role="status">
            <span className="account-auth__trust">확인 이메일 전송</span>
            <h2>{email}</h2>
            <p>메일 안의 확인 버튼을 누르면 TrainOracle로 돌아와 가입이 이어져요. 같은 기기에서 열면 가장 빠르게 마칠 수 있어요.</p>
          </div>
          <button className="account-auth__primary" type="button" disabled={busy} onClick={() => void sendEmailLink()}>
            {busy ? "보내는 중..." : "확인 이메일 다시 받기"}
          </button>
          <button className="account-auth__text-action" type="button" disabled={busy} onClick={() => setStep("email")}>이메일 주소 바꾸기</button>
        </>
      )}

      {step === "phone" && (
        <>
          <StepHeader step="2 / 2" title="인증번호를 받을 휴대전화 번호를 적어 주세요" onBack={() => setStep("eligibility")} />
          <div className="account-auth__field-group">
            <label htmlFor="account-phone">휴대전화 번호</label>
            <input
              id="account-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => { setPhone(event.target.value); setNotice(null) }}
              placeholder="010-1234-5678"
            />
            <small>국내 010 번호만 지원해요. 비밀번호 대신 문자로 6자리 번호를 보내드려요.</small>
          </div>
          <button className="account-auth__primary" type="button" disabled={busy || phone.trim() === ""} onClick={() => void sendPhoneCode()}>
            {busy ? "보내는 중..." : "문자로 인증번호 받기"}
          </button>
        </>
      )}

      {step === "phone-code" && (
        <>
          <StepHeader step="마지막" title="문자로 받은 6자리 번호를 입력해 주세요" onBack={() => { setStep("phone"); setPhoneCode("") }} />
          <div className="account-auth__field-group">
            <label htmlFor="account-phone-code">{maskPhoneNumber(phone)}로 보낸 번호</label>
            <input
              id="account-phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={phoneCode}
              onChange={(event) => { setPhoneCode(event.target.value.replace(/\D/gu, "").slice(0, 6)); setNotice(null) }}
              placeholder="000000"
            />
          </div>
          <button className="account-auth__primary" type="button" disabled={busy || phoneCode.length !== 6} onClick={() => void verifyPhoneCode()}>
            {busy ? "확인하는 중..." : "로그인 완료하기"}
          </button>
          <button className="account-auth__text-action" type="button" disabled={busy || phoneResendSeconds > 0} onClick={() => void sendPhoneCode()}>
            {phoneResendSeconds > 0 ? `다시 받기 (${phoneResendSeconds}초)` : "인증번호 다시 받기"}
          </button>
        </>
      )}

      {step === "under14" && (
        <div className="account-auth__under14" role="status">
          <span className="account-auth__trust">온라인 계정 안내</span>
          <h2>온라인 계정은 만 14세부터 만들 수 있어요</h2>
          <p>만 14세가 되면 로그인해서 기록을 계정에 안전하게 남길 수 있어요. 그 전까지는 이 기기에서 일지를 쓰고 훈련 계획을 만들 수 있어요.</p>
          <button className="account-auth__primary" type="button" onClick={resetMethod}>생년월일 다시 확인</button>
        </div>
      )}

      {notice !== null && <p className="account-auth__notice" role="status">{notice}</p>}
      <p className="account-auth__privacy-note">기록을 안전하게 남기려면 로그인한 상태로 쓰는 걸 권해요. 업로드 항목은 로그인 뒤 계정 설정에서 확인할 수 있어요.</p>
    </div>
  )
}

function MethodButton({ mark, icon, label, className = "", onClick }: {
  readonly mark?: string
  readonly icon?: React.ReactNode
  readonly label: string
  readonly className?: string
  readonly onClick: () => void
}) {
  return (
    <button className={`account-auth__method ${className}`} type="button" onClick={onClick}>
      <span className="account-auth__method-mark" aria-hidden="true">{icon ?? mark}</span>
      <span>{label}</span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  )
}

function StepHeader({ step, title, onBack }: {
  readonly step: string
  readonly title: string
  readonly onBack: () => void
}) {
  return (
    <div className="account-auth__step-header">
      <button type="button" onClick={onBack} aria-label="이전 단계"><ArrowLeft aria-hidden="true" size={19} /></button>
      <div><span>{step}</span><h2>{title}</h2></div>
    </div>
  )
}
