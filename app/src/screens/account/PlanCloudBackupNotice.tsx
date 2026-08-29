import { Cloud } from "lucide-react"
import { SectionLb } from "../../components/JournalPrimitives"

export function PlanCloudBackupNotice() {
  return (
    <section aria-labelledby="plan-cloud-backup-title" className="plan-cloud-backup-notice">
      <SectionLb>훈련 계획 온라인 보관</SectionLb>
      <div className="plan-cloud-backup-notice__body">
        <Cloud aria-hidden="true" size={17} className="plan-cloud-backup-notice__icon" />
        <div>
          <strong id="plan-cloud-backup-title">
            로그인한 계정에 자동으로 보관해요
          </strong>
          <p>
            새 계획과 완료 상태를 저장해 기기가 바뀌어도 이어갈 수 있게 해요. 이 기능으로 일지, 메모, 통증 기록은 올리지 않아요.
          </p>
        </div>
      </div>
    </section>
  )
}
