import { useEffect, useId, useState } from "react"
import { Footprints, MoveUp, Zap, ArrowRight, Check } from "lucide-react"
import { applyUpgrade, TREADMILL_RULES, TREADMILL_UPGRADES } from "../../domain/minigame/treadmill"
import type { TreadmillState, TreadmillStage, TreadmillUpgrade } from "../../domain/minigame/treadmill"
import { GearArt } from "./GearArt"
import { PartyEffect } from "./PartyEffect"
import { CharacterPortrait } from "./GamePanels"
import type { RunnerCharacter } from "./sprites"

export const UPGRADE_STORIES = {
  grip: { title: "진흙에서 덜 밀리기", detail: "접지 밑창", effect: "진흙을 딛고 앞으로!", tradeoff: "대신 점프할 때 힘을 더 써요", appearance: "신발 아래 접지 돌기", Icon: Footprints },
  spring: { title: "점프를 가볍게", detail: "스프링 밑창", effect: "적은 에너지로 점프!", tradeoff: "대신 달릴 때 덜 나아가요", appearance: "신발 아래 금색 스프링", Icon: MoveUp },
  economy: { title: "오래 달리기", detail: "일정한 박자", effect: "달리기 에너지를 아껴요!", tradeoff: "대신 회복과 대시 충전이 느려요", appearance: "손목의 금색 리듬 밴드", Icon: Zap },
} as const
const number = (value: number) => Number(value.toFixed(1)).toString()

/** Uses the same upgrade function as play, including repeated picks and the jump floor. */
export function upgradePreview(state: TreadmillState, id: TreadmillUpgrade) {
  const next = applyUpgrade(state, id)
  const change = (before: number, after: number) => `${number(before)} → ${number(after)}`
  if (id === "grip") return {
    gain: `진흙 추진력 ${change(state.strideFactor * (1 + state.mudBonus) * 100, next.strideFactor * (1 + next.mudBonus) * 100)}%`,
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

type UpgradeChange = { label: string; before: number; after: number; unit: string; lowerIsBetter: boolean }
export function upgradeChanges(state: TreadmillState, id: TreadmillUpgrade): readonly UpgradeChange[] {
  const next = applyUpgrade(state, id)
  if (id === "grip") return [
    { label: "진흙 추진력", before: state.strideFactor * (1 + state.mudBonus) * 100, after: next.strideFactor * (1 + next.mudBonus) * 100, unit: "%", lowerIsBetter: false },
    { label: "충돌 밀림", before: state.knockbackFactor * 100, after: next.knockbackFactor * 100, unit: "%", lowerIsBetter: true },
    { label: "점프 에너지", before: state.jumpCost, after: next.jumpCost, unit: "", lowerIsBetter: true },
  ]
  if (id === "spring") return [
    { label: "점프 에너지", before: state.jumpCost, after: next.jumpCost, unit: "", lowerIsBetter: true },
    { label: "달리기 추진력", before: state.strideFactor * 100, after: next.strideFactor * 100, unit: "%", lowerIsBetter: false },
  ]
  return [
    { label: "달리기 소모", before: TREADMILL_RULES.runDrain * state.runDrainFactor, after: TREADMILL_RULES.runDrain * next.runDrainFactor, unit: "/초", lowerIsBetter: true },
    { label: "대시 대기", before: state.cooldownSeconds, after: next.cooldownSeconds, unit: "초", lowerIsBetter: true },
    { label: "회복 속도", before: TREADMILL_RULES.recovery * state.recoveryFactor, after: TREADMILL_RULES.recovery * next.recoveryFactor, unit: "/초", lowerIsBetter: false },
  ]
}

/** Applied equipment only: no preview values, invented levels, or persistent growth. */
export function EquippedGearSummary({ state, compact = false }: { readonly state: TreadmillState; readonly compact?: boolean }) {
  const items = TREADMILL_UPGRADES.filter(item => state.upgrades.includes(item.id))
  return <section className="upgrade-loadout" data-compact={compact || undefined} aria-label="이번 판에 적용된 강화">
    <strong>이번 판 장착{items.length === 0 && <small> · 아직 없음</small>}</strong>
    {items.length > 0 && <ul>{items.map(item => {
      const count = state.upgrades.filter(id => id === item.id).length
      return <li key={item.id}><GearArt upgrade={item.id} /><span>{item.name}<small>{count}회 적용</small></span></li>
    })}</ul>}
    {!compact && <p>점프 {number(state.jumpCost)} · 달리기 {number(TREADMILL_RULES.runDrain * state.runDrainFactor)}/초 · 대시 대기 {number(state.cooldownSeconds)}초</p>}
  </section>
}

export function UpgradeChoice({ state, nextStage, onPick, reduced = false, character = "tori" }: {
  readonly state: TreadmillState; readonly nextStage: TreadmillStage; readonly onPick: (id: TreadmillUpgrade) => void
  readonly reduced?: boolean; readonly character?: RunnerCharacter
}) {
  const [explaining, setExplaining] = useState(state.upgrades.length === 0)
  const [selected, setSelected] = useState<TreadmillUpgrade | null>(null)
  const [committing, setCommitting] = useState(false)
  const previewId = useId()
  useEffect(() => {
    if (!explaining) return
    const timer = window.setTimeout(() => setExplaining(false), 2400)
    return () => window.clearTimeout(timer)
  }, [explaining])
  const next = selected ? applyUpgrade(state, selected) : null
  const selectedStory = selected ? UPGRADE_STORIES[selected] : null
  const atJumpFloor = selected === "spring" && next?.jumpCost === state.jumpCost
  return <div className="treadmill-game__overlay treadmill-game__overlay--light">
    <section className="treadmill-game__card treadmill-game__pick upgrade-choice" aria-labelledby="treadmill-upgrade-title">
      <span className="treadmill-game__ribbon" data-tone="gold">{state.stage + 1}구간 통과!</span>
      {explaining ? <div className="upgrade-choice__intro" role="status">
        <PartyEffect id="fx-upgrade-burst" reduced={reduced} />
        <h2 id="treadmill-upgrade-title">이번 판의 능력을 바꿔요</h2>
        <div className="upgrade-choice__effects" aria-label="강화 효과 미리보기">
          {TREADMILL_UPGRADES.map(item => {
            const story = UPGRADE_STORIES[item.id]
            return <div key={item.id} data-effect={item.id}><span className="upgrade-choice__demo" aria-hidden="true"><GearArt upgrade={item.id} /><i /></span><strong>{story.title}</strong></div>
          })}
        </div>
        <p>장비를 골라 변화를 확인하고<br />장착하면 다음 구간으로 출발해요.</p>
        <button type="button" className="treadmill-game__text-button" onClick={() => setExplaining(false)}>바로 고르기<ArrowRight size={16} aria-hidden="true" /></button>
      </div> : <>
        <h2 id="treadmill-upgrade-title">어떤 능력을 키울까요?</h2>
        <p className="treadmill-game__pick-next" data-stage={nextStage.surface}><b>다음</b>{nextStage.name} · {TREADMILL_RULES.stageSeconds}초</p>
        <EquippedGearSummary state={state} compact />
        <div className="treadmill-game__upgrades" aria-label="강화 미리보기 선택">
          {TREADMILL_UPGRADES.map(upgrade => {
            const story = UPGRADE_STORIES[upgrade.id], preview = upgradePreview(state, upgrade.id)
            const owned = state.upgrades.filter(id => id === upgrade.id).length
            const unchanged = upgrade.id === "spring" && applyUpgrade(state, upgrade.id).jumpCost === state.jumpCost
            return <button type="button" key={upgrade.id} data-upgrade={upgrade.id} aria-pressed={selected === upgrade.id}
              aria-controls={previewId} disabled={committing} onClick={() => setSelected(upgrade.id)}>
              <b className="treadmill-game__gear-icon" aria-hidden="true"><GearArt upgrade={upgrade.id} /></b>
              <span className="treadmill-game__gear-text">
                <strong>{story.title}{upgrade.fits === nextStage.surface && !unchanged && <mark>추천</mark>}</strong>
                <small>{story.detail} · {owned ? `${owned}회 → ${owned + 1}회 적용` : "새 장착"}</small>
                <span className={unchanged ? "upgrade-choice__limit" : "treadmill-game__plus"}>{unchanged ? "점프 비용 최저치 · 추가 이득 없음" : preview.gain}</span>
                <span className="treadmill-game__minus">{preview.cost}{upgrade.id === "economy" && <> · {preview.extra}</>}</span>
              </span>
              {selected === upgrade.id ? <Check className="upgrade-choice__arrow" size={18} aria-label="선택됨" /> : <ArrowRight className="upgrade-choice__arrow" size={18} aria-hidden="true" />}
            </button>
          })}
        </div>
        <section id={previewId} className="upgrade-choice__preview" aria-label="장착 전후 미리보기" aria-live="polite">
          {selected && selectedStory && next ? <>
            <header><strong>{selectedStory.detail}</strong><span>미리보기 · 아직 적용 전</span></header>
            <div className="upgrade-choice__portraits">
              <figure><CharacterPortrait character={character} upgrades={state.upgrades} size={80} label="현재 장비 모습" /><figcaption>현재</figcaption></figure>
              <ArrowRight size={20} aria-hidden="true" />
              <figure data-preview="true"><CharacterPortrait character={character} upgrades={next.upgrades} size={80} label={`${selectedStory.detail} 장착 후 모습`} /><figcaption>장착 후</figcaption></figure>
              <p><GearArt upgrade={selected} /><span>{selectedStory.appearance}<small>{state.upgrades.includes(selected) ? "같은 장비의 효과 누적 · 외형은 유지" : "새 장비가 캐릭터에 보여요"}</small></span></p>
            </div>
            <table className="upgrade-choice__stats">
              <caption className="sr-only">현재 능력과 {selectedStory.detail} 장착 후 능력 비교</caption>
              <thead><tr><th scope="col">능력</th><th scope="col">현재</th><th scope="col">장착 후</th><th scope="col">변화</th></tr></thead>
              <tbody>{upgradeChanges(state, selected).map(row => {
                const same = Math.abs(row.after - row.before) < 0.00001
                const better = row.lowerIsBetter ? row.after < row.before : row.after > row.before
                return <tr key={row.label} data-change={same ? "same" : better ? "gain" : "cost"}>
                  <th scope="row">{row.label}</th><td>{number(row.before)}{row.unit}</td><td><strong>{number(row.after)}{row.unit}</strong></td><td>{same ? "유지" : better ? "이득" : "손해"}</td>
                </tr>
              })}</tbody>
            </table>
            {selected !== "economy" && <p className="upgrade-choice__note">추진력·밀림의 100%는 기본 장비 기준이에요.</p>}
            {selected === "spring" && <p className={atJumpFloor ? "upgrade-choice__limit" : "upgrade-choice__note"}>{atJumpFloor ? "점프 에너지는 이미 최저 2예요. 다시 골라도 더 줄지 않고 달리기 추진력만 낮아져요." : "점프 높이는 그대로예요. 점프에 쓰는 에너지만 줄어요."}</p>}
            <div className="upgrade-choice__apply">
              <button type="button" className="treadmill-game__cta" disabled={committing} onClick={() => { if (!committing) { setCommitting(true); onPick(selected) } }}>장착하고 출발<ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="treadmill-game__text-button" disabled={committing} onClick={() => setSelected(null)}>미리보기 취소</button>
            </div>
          </> : <p className="upgrade-choice__empty">장비를 누르면 외형과 이득·손해를 비교할 수 있어요.</p>}
        </section>
        <p className="upgrade-choice__footer">구간 완주 → 안전 발판 회복 최대 +{TREADMILL_RULES.checkpointRefill}<br />장비 효과는 이번 판에만 적용돼요.</p>
        <button type="button" className="treadmill-game__text-button" disabled={committing} onClick={() => setExplaining(true)}>효과 다시 보기</button>
      </>}
    </section>
  </div>
}
