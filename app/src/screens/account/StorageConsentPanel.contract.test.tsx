import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StorageConsentPanel } from "./StorageConsentPanel"
import type { StorageConsent } from "../../domain/account/storage-consent"
const A="a1111111-1111-4111-8111-111111111111"
const receipt:StorageConsent={userId:A,revision:0,purposeVersion:"2026-10-05",healthStorage:false,journalTextStorage:false,decidedAt:null,operationsReady:true,liveErasedAt:null,backupStatus:null}
afterEach(cleanup)
describe("separate optional online storage consent",()=>{
  it("starts unchecked, keeps local use explicit and requires both independent choices",async()=>{
    const save=vi.fn().mockResolvedValue({ok:true,consent:{...receipt,revision:1,healthStorage:true,journalTextStorage:true}})
    render(<StorageConsentPanel userId={A} load={async()=>({ok:true,consent:receipt})} save={save}/>)
    await waitFor(()=>expect(screen.getByRole("button",{name:"온라인 보관 동의 철회"})).toBeEnabled())
    const health=screen.getByRole("checkbox",{name:/건강정보/}),text=screen.getByRole("checkbox",{name:/메모·글/})
    expect(health).not.toBeChecked();expect(text).not.toBeChecked()
    expect(screen.getByText(/동의하지 않아도 가입과 기기 일지/)).toBeVisible()
    await userEvent.click(health)
    expect(screen.getByRole("button",{name:"선택한 동의 저장"})).toBeDisabled()
    await userEvent.click(text)
    await userEvent.click(screen.getByRole("button",{name:"선택한 동의 저장"}))
    expect(save).toHaveBeenCalledWith(receipt,true,true)
  })
  it("reports live purpose erasure without claiming device or backup erasure",async()=>{
    const previous={...receipt,revision:3,healthStorage:true,journalTextStorage:true}
    const save=vi.fn().mockResolvedValue({ok:true,consent:{...receipt,revision:4,liveErasedAt:"2026-10-05T00:00:00Z",backupStatus:"PENDING"}})
    render(<StorageConsentPanel userId={A} load={async()=>({ok:true,consent:previous})} save={save}/>)
    await waitFor(()=>expect(screen.getByRole("button",{name:"온라인 보관 동의 철회"})).toBeEnabled())
    await userEvent.click(screen.getByRole("button",{name:"온라인 보관 동의 철회"}))
    expect(save).toHaveBeenCalledWith(previous,false,false)
    expect(screen.getByRole("status")).toHaveTextContent("보관 자료·교체본·휴지통을 삭제했어요")
    expect(screen.getByRole("status")).toHaveTextContent("기기 기록은 그대로")
    expect(screen.getByRole("status")).toHaveTextContent("백업 정리는 별도 확인 중")
  })
  it("does not call failed withdrawal successful and offers a current-state retry",async()=>{
    render(<StorageConsentPanel userId={A} load={async()=>({ok:true,consent:receipt})}
      save={async()=>({ok:false,message:"서버 변경 미확인"})}/>)
    await waitFor(()=>expect(screen.getByRole("button",{name:"온라인 보관 동의 철회"})).toBeEnabled())
    await userEvent.click(screen.getByRole("button",{name:"온라인 보관 동의 철회"}))
    expect(screen.getByRole("status")).toHaveTextContent("서버 변경 미확인")
    expect(screen.getByRole("button",{name:"현재 상태 다시 확인"})).toBeEnabled()
  })
  it("closed server operations never become a checkbox-only approval",async()=>{
    render(<StorageConsentPanel userId={A} load={async()=>({ok:true,consent:{...receipt,operationsReady:false}})}/>)
    await screen.findByText(/온라인 보관은 운영 확인 전/)
    await userEvent.click(screen.getByRole("checkbox",{name:/건강정보/}))
    await userEvent.click(screen.getByRole("checkbox",{name:/메모·글/}))
    expect(screen.getByRole("button",{name:"선택한 동의 저장"})).toBeDisabled()
  })
})
