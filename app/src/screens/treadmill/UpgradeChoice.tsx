import { useEffect, useState } from "react"
import { Footprints, MoveUp, Zap, ArrowRight } from "lucide-react"
import { applyUpgrade, TREADMILL_RULES, TREADMILL_UPGRADES } from "../../domain/minigame/treadmill"
import type { TreadmillState, TreadmillStage, TreadmillUpgrade } from "../../domain/minigame/treadmill"

export const UPGRADE_STORIES = {
  grip: { title: "진흙에서 덜 밀리기", detail: "접지 밑창", effect: "진흙을 딛고 앞으로!", tradeoff: "대신 점프할 때 힘을 더 써요", Icon: Footprints },
  spring: { title: "점프를 가볍게", detail: "스프링 밑창", effect: "적은 에너지로 점프!", tradeoff: "대신 달릴 때 덜 나아가요", Icon: MoveUp },
  economy: { title: "오래 달리기", detail: "일정한 박자", effect: "달리기 에너지를 아껴요!", tradeoff: "대신 회복과 대시 충전이 느려요", Icon: Zap },
} as const
const number = (value: number) => Number(value.toFixed(1)).toString()

/** Uses the same upgrade function as play, including repeated picks and the jump floor. */
export function upgradePreview(state: TreadmillState, id: TreadmillUpgrade) {
  const next = applyUpgrade(state, id)
  const change = (before: number, after: number) => `${number(before)} → ${number(after)}`
  if (id === "grip") return {
    gain: `진흙 추진력 ${change((1 + state.mudBonus) * 100, (1 + next.mudBonus) * 100)}%`,
    extra: `충돌 밀림 ${change(state.knockbackFactor * 100, next.knockbackFactor * 100)}%`,
    cost: `점프 에너지 ${change(state.jumpCost, next.jumpCost)}`,
  }
  if (id === "spring") return {
    gain: `점프 에너지 ${change(state.jumpCost, next.jumpCost)}`,
    extra: "점프 높이는 그대로",
    cost: `달리기 추진력 ${change(state.strideFactor * 100, next.strideFactor * 100)}%`,
  }
  return {
    gain: `달리기 소모 ${change(TREADMILL_RULES.runDrain * state.runDrainFactor, TREADMILL_RULES.runDrain * next.runDrainFactor)}/초`,
    extra: `대시 대기 ${change(state.cooldownSeconds, next.cooldownSeconds)}초`,
    cost: `회복 속도 ${change(state.recoveryFactor * 100, next.recoveryFactor * 100)}%`,
  }
}

export function UpgradeChoice({ state, nextStage, onPick }: {
  readonly state: TreadmillState; readonly nextStage: TreadmillStage; readonly onPick: (id: TreadmillUpgrade) => void
}) {
  const [explaining, setExplaining] = useState(state.upgrades.length === 0)
  useEffect(() => {
    if (!explaining) return
    const timer = window.setTimeout(() => setExplaining(false), 2400)
    return () => window.clearTimeout(timer)
  }, [explaining])
  return <div className="treadmill-game__overlay treadmill-game__overlay--light">
    <section className="treadmill-game__card treadmill-game__pick upgrade-choice" aria-labelledby="treadmill-upgrade-title">
      <span className="treadmill-game__ribbon" data-tone="gold">{state.stage + 1}구간 통과!</span>
      {explaining ? <div className="upgrade-choice__intro" role="status">
        <h2 id="treadmill-upgrade-title">이번 판의 능력을 바꿔요</h2>
        <div className="upgrade-choice__effects" aria-label="강화 효과 미리보기">
          {TREADMILL_UPGRADES.map(item => {
            const story = UPGRADE_STORIES[item.id]
            return <div key={item.id} data-effect={item.id}><span className="upgrade-choice__demo" aria-hidden="true"><story.Icon size={32} /><i /></span><strong>{story.title}</strong></div>
          })}
        </div>
        <p>잘하는 것 하나를 키우고<br />다른 능력은 조금 양보해요.</p>
        <button type="button" className="treadmill-game__text-button" onClick={() => setExplaining(false)}>바로 고르기<ArrowRight size={16} aria-hidden="true" /></button>
      </div> : <>
        <h2 id="treadmill-upgrade-title">어떤 능력을 키울까요?</h2>
        <p className="treadmill-game__pick-next" data-stage={nextStage.surface}><b>다음</b>{nextStage.name} · {TREADMILL_RULES.stageSeconds}초</p>
        <div className="treadmill-game__upgrades">
          {TREADMILL_UPGRADES.map(upgrade => {
            const story = UPGRADE_STORIES[upgrade.id], preview = upgradePreview(state, upgrade.id)
            const owned = state.upgrades.filter(id => id === upgrade.id).length
            return <button type="button" key={upgrade.id} data-upgrade={upgrade.id} onClick={() => onPick(upgrade.id)}>
              <b className="treadmill-game__gear-icon" aria-hidden="true"><story.Icon size={24} /></b>
              <span className="treadmill-game__gear-text">
                <strong>{story.title}{upgrade.fits === nextStage.surface && <mark>추천</mark>}</strong>
                <small>{story.detail} · Lv.{owned + 1}</small>
                <span className="treadmill-game__plus">{preview.gain}{upgrade.id === "grip" && <> · 밀림 절반</>}</span>
                <span className="treadmill-game__minus">{story.tradeoff}</span>
                <small className="upgrade-choice__numbers">{preview.cost}{upgrade.id === "economy" && <> · {preview.extra}</>}</small>
              </span>
              <ArrowRight className="upgrade-choice__arrow" size={18} aria-hidden="true" />
            </button>
          })}
        </div>
        <p className="upgrade-choice__footer">고르면 장착 후 출발 · 에너지 최대 +{TREADMILL_RULES.checkpointRefill}</p>
        <button type="button" className="treadmill-game__text-button" onClick={() => setExplaining(true)}>효과 다시 보기</button>
      </>}
    </section>
  </div>
}
