import React from "react"
import { accountJournalPreviewEnabled, requestAccountDocument, type AccountJournalRequest } from "../domain/account/account-journal-api"
import { accountRunBtiProfileDocumentSchema, RUN_BTI_PROFILE_NAMESPACE, type AccountRunBtiProfileDocument as Document } from "../domain/account/account-run-bti-profile-schema"
import { namespacedAccountDocumentId } from "../domain/account/account-running-profile-service"
import { activeLocalAccount, localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import "./running-profile.css"

type Data = Document["data"]
type Catalog = {
  names: Record<string, string>
  axes: {id: string; sides: {label: string}[]}[]
  extras: {id: string; options: {id: string; label: string}[]}[]
}
const extras: Record<string, string> = { learning: "배우고 싶은 방식", distanceLevel: "쉬지 않고 뛴 거리", strength: "자신 있는 것", goal: "다음 목표" }
const storyLabels: Record<string, string> = {training: "훈련", summer: "여름", winter: "겨울", snow: "눈 오는 날", rain: "비 오는 날", time: "뛰는 시간대"}
const storyValues: Record<string, string> = {
  drills: "러닝 드릴", strength: "근력 운동", distance: "거리 늘리기", speed: "속도 내기",
  outside: "밖에서 뛰기", less: "덜 뛰기", indoor: "실내에서 뛰기", want: "나가 보고 싶어", maybe: "그날 정할래",
  no: "나가고 싶지 않아", morning: "아침", day: "낮", evening: "저녁", varies: "그때그때 달라",
}
type SpecificGoal = Exclude<Data["goal"], undefined | "unknown" | "other">
const firstQuestions: Record<SpecificGoal, string> = {
  distance: "어디까지 뛰어 보고 싶어요?",
  speed: "어느 때 속도를 더 내고 싶어요?",
  consistency: "일주일 중 언제 뛰는 게 가장 편해요?",
  finish: "완주해 보고 싶은 거리나 대회가 있어요?",
  technique: "달릴 때 어떤 동작을 더 편하게 하고 싶어요?",
}

function CoachQuestionPreview({goal}: {goal: Data["goal"]}) {
  if (!goal || goal === "unknown" || goal === "other") return null
  return <details className="run-bti-account__coach">
    <summary>코치의 첫 질문 미리보기</summary>
    <p>{firstQuestions[goal]}</p>
  </details>
}

function Summary({data, catalog}: {data: Data; catalog: Catalog}) {
  return <><p>본인 응답 · {new Date(data.answeredAt).toLocaleDateString("ko-KR")} · {data.version}</p><dl>
    {data.defaultKey && <><dt>기본 별명</dt><dd>{catalog.names[data.defaultKey]}</dd></>}
    {catalog.axes.map(axis => {
      const pair = data.preferences?.[axis.id as keyof NonNullable<Data["preferences"]>]
      return pair && <React.Fragment key={axis.id}><dt>{axis.sides.map(s => s.label).join(" · ")}</dt>
        <dd>{pair.map(v => v === null ? "답 없음" : Number(v.toFixed(2)) + "점").join(" · ")} (각 2점 만점)</dd></React.Fragment>
    })}
    {Object.entries(extras).map(([key, title]) => {
      const match = catalog.extras.find(item => item.id === key)?.options.find(option => option.id === data[key as keyof Data])
      return match && <React.Fragment key={key}><dt>{title}</dt><dd>{match.label}</dd></React.Fragment>
    })}
    {Object.entries(storyLabels).map(([key, title]) => {
      const value = data[key as keyof Data]
      if (!value || typeof value !== "string" && !Array.isArray(value)) return null
      const labels = (Array.isArray(value) ? value : [value]).map(id => storyValues[id]).filter(Boolean)
      return <React.Fragment key={key}><dt>{title}</dt><dd>{labels.join(" · ")}</dd></React.Fragment>
    })}
  </dl></>
}

export default function RunBtiAccountPanel({token, onClose, onLogin}: {token: string; onClose: () => void; onLogin: () => void}) {
  const owner = activeLocalAccount()
  const [reload, setReload] = React.useState(0)
  const [status, setStatus] = React.useState<"loading" | "ready" | "ineligible" | "failure">("loading")
  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [saved, setSaved] = React.useState<Document | null>(null)
  const [incoming, setIncoming] = React.useState<Document | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const write = React.useRef<((doc: Document | null) => Promise<void>) | null>(null)
  React.useEffect(() => {
    let alive = true
    let channel: BroadcastChannel | undefined
    let pendingTimer: ReturnType<typeof setTimeout> | undefined
    let received = false
    const generation = localJournalScopeGeneration()
    const current = () => alive && owner === activeLocalAccount() && generation === localJournalScopeGeneration()
    setStatus("loading"); setNotice(""); setConfirmDelete(false); setBusy(false); setSaved(null); setIncoming(null)
    async function load() {
      if (!owner) return
      if (!accountJournalPreviewEnabled()) throw Error("storage unavailable")
      const request = (value: AccountJournalRequest<Document>) => requestAccountDocument(owner, value, current, accountRunBtiProfileDocumentSchema)
      const support = await request({action: "runBtiProfileSupport"})
      if (!current()) return
      if (!support.ok || support.data.kind !== "run-bti-profile-support") throw Error("support unavailable")
      if (!support.data.eligible) { setStatus("ineligible"); return }
      const modelURL = new URL(import.meta.env.BASE_URL + "run-bti/rb-pairs-model.js?v=pairs-characters-1", location.href).href
      await import(/* @vite-ignore */ modelURL)
      const labels = (window as Window & {RBPairsModel?: Catalog}).RBPairsModel
      if (!labels) throw Error("labels unavailable")
      const id = await namespacedAccountDocumentId(RUN_BTI_PROFILE_NAMESPACE, owner)
      const read = await request({action: "read", documentId: id})
      if (!current()) return
      let revision = 0
      if (read.ok && (read.data.kind === "document" || read.data.kind === "deleted") && read.data.documentId === id) {
        revision = read.data.revision
        setSaved(read.data.kind === "document" ? read.data.document : null)
      } else if (read.ok || read.code !== "NOT_FOUND") throw Error("read unavailable")
      setCatalog(labels); setStatus("ready")
      if (token !== "saved") {
        channel = new BroadcastChannel("run-bti-profile/" + token)
        channel.onmessage = ({data: message}) => {
          if (!current() || received || message?.type !== "preview") return
          const parsed = accountRunBtiProfileDocumentSchema.safeParse({version: 3, state: "ACCOUNT_STATE", kind: "RUN_BTI_PROFILE", data: message.data})
          if (!parsed.success) { setNotice("이 결과를 읽을 수 없어요. 검사 결과에서 다시 연결해 주세요."); return }
          received = true; clearTimeout(pendingTimer); setIncoming(parsed.data); setNotice("")
        }
        channel.postMessage("ready")
        pendingTimer = setTimeout(() => { if (current() && !received) setNotice("결과를 보낸 창을 찾지 못했어요. 검사 결과에서 다시 연결해 주세요.") }, 5000)
      }
      let writing = false
      write.current = async doc => {
        if (!current() || writing) return
        writing = true; setBusy(true); setNotice("")
        try {
          const operationId = crypto.randomUUID()
          const identity = {documentId: id, expectedRevision: revision, operationId}
          const change = await request(doc ? {action: "save", ...identity, document: doc} : {action: "delete", ...identity})
          if (!current()) return
          if (change.ok && ((doc && change.data.kind === "saved") || (!doc && change.data.kind === "deleted")) &&
              change.data.documentId === id && change.data.operationId === operationId) {
            revision = change.data.revision; setSaved(doc); setIncoming(null); setConfirmDelete(false)
            setNotice(doc ? "내 프로필에 저장했어요." : "프로필에서 지웠어요.")
            if (doc) channel?.postMessage("saved")
          } else if (change.ok && change.data.kind === "conflict" || !change.ok && change.code === "CONFLICT") {
            setNotice("다른 창에서 프로필이 바뀌었어요. 다시 불러온 뒤 확인해 주세요.")
            write.current = null
          } else setNotice("변경을 확인하지 못했어요. 다시 불러와 확인해 주세요.")
        } catch { if (current()) setNotice("연결을 확인한 뒤 다시 시도해 주세요.") }
        finally { writing = false; if (current()) setBusy(false) }
      }
    }
    void load().catch(() => { if (current()) setStatus("failure") })
    return () => { alive = false; write.current = null; clearTimeout(pendingTimer); channel?.close() }
  }, [owner, token, reload])
  return <main className="running-profile running-profile__body run-bti-account">
    <button type="button" onClick={onClose}>러닝 프로필로 돌아가기</button>
    <h1>내 프로필에 담은 런비티아이</h1>
    {!owner ? <><p>본인 계정에서 저장할 내용을 확인해 주세요.</p><button onClick={onLogin}>로그인</button></>
      : status === "loading" ? <p role="status">프로필을 불러오고 있어요.</p>
      : status === "ineligible" ? <p>계정 저장은 만 19세 이상만 이용할 수 있어요. 검사 결과는 원래 창에서 볼 수 있어요.</p>
      : status === "failure" ? <p role="alert">계정 저장을 지금 이용할 수 없어요. 연결과 계정 저장 설정을 확인해 주세요.</p>
      : <>{incoming && catalog && <section><h2>이번에 담을 항목</h2><Summary data={incoming.data} catalog={catalog} />
        <p>{saved ? "저장하면 아래에 보이는 지난 결과를 이번에 고른 항목으로 바꿔요." : "저장하면 이 계정의 러닝 프로필에서 다시 볼 수 있어요."}</p>
        <button disabled={busy || !write.current} onClick={() => void write.current?.(incoming)}>내 프로필에 저장</button></section>}
        {saved && catalog ? <section><h2>저장한 결과</h2><Summary data={saved.data} catalog={catalog} />
          {!incoming && <CoachQuestionPreview key={saved.data.goal} goal={saved.data.goal} />}
          {confirmDelete ? <><p>프로필에 담은 이 결과를 지울까요?</p><button disabled={busy} onClick={() => void write.current?.(null)}>지우기</button>
            <button onClick={() => setConfirmDelete(false)}>취소</button></> : <button onClick={() => setConfirmDelete(true)}>프로필에서 지우기</button>}</section>
        : <p>아직 프로필에 담은 결과가 없어요.</p>}</>}
    <p role="status">{notice}</p>
    {owner && (status === "failure" || notice && status === "ready") && <button disabled={busy} onClick={() => setReload(n => n + 1)}>다시 불러오기</button>}
  </main>
}
