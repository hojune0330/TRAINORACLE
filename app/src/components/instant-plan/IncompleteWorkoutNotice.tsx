import { InfoDisclosure } from "../InfoDisclosure"

export function IncompleteWorkoutNotice({ detail }: { readonly detail: string }) {
  return <aside className="instant-plan__guidance" role="note" aria-label="훈련 구성 확인">
    <InfoDisclosure title="반복·휴식이 아직 없어요">
      <p>{detail}</p>
    </InfoDisclosure>
    <p>이 시간 내내 강하게 뛰지 마세요.</p>
  </aside>
}
