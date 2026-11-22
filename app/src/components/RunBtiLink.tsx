import { Compass } from "lucide-react"
import { MenuAction } from "./MenuAction"

export function RunBtiLink({ showSaved = true }: { showSaved?: boolean }) {
  return <>
    <MenuAction category="oracle" icon={Compass} label="런비티아이 해보기"
      detail="거리와 속도부터 계획을 짜는 습관까지 내 취향을 알아봐요."
      href={`${import.meta.env.BASE_URL}run-bti/index.html?edition=train`} target="_blank" />
    {showSaved && <a href={`${import.meta.env.BASE_URL}?run-bti-profile=saved`}>프로필에 담은 런비티아이 보기</a>}
  </>
}
