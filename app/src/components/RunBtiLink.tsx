import { Compass } from "lucide-react"
import { MenuAction } from "./MenuAction"

export function RunBtiLink() {
  return <MenuAction category="oracle" icon={Compass} label="런비티아이 해보기"
    detail="신호를 기다릴 때 나는 뭘 먼저 볼까?"
    href={`${import.meta.env.BASE_URL}run-bti/index.html?edition=train`} target="_blank" />
}
