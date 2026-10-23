import React from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { CARE_LABEL, petById, type CareAction, type PetId } from './pet-catalog'
import { canAdopt, type PetHome } from './pet-engine'
import { nextCare } from './pet-memories'

const GO: Record<CareAction, string> = { pet: '쓰다듬으러 가기', feed: '간식 주러 가기', play: '같이 놀러 가기', bed: '같이 잘 준비하기' }
export function PetCareGoal({ home, id, today, disabled, onCare, onAdopt }: {
  home: PetHome; id: PetId; today: string; disabled: boolean; onCare: (action: CareAction) => void; onAdopt: () => void
}) {
  const bond = home.pets[id]!
  if (bond.adoptedOn) return null
  const missions = petById(id).missions
  const next = nextCare(id, bond, today)
  const ready = canAdopt(home, id)
  const finished = missions.filter(item => bond.actions[item.action].length >= item.days).length
  return <section className="pet-care-goal" aria-label="입양 미션 진행">
    <div className="pet-care-goal__title"><h3>{ready ? '이제 우리 집으로 데려올 수 있어요!' : '입양 미션'}</h3><span>{finished}/{missions.length} 완료</span></div>
    <ul>{missions.map(item => {
      const done = Math.min(item.days, bond.actions[item.action].length)
      return <li key={item.action}><span>{CARE_LABEL[item.action]}</span><progress max={item.days} value={done} aria-label={`${CARE_LABEL[item.action]} 미션`} /><strong>{done === item.days && <Check size={12} />}{done}/{item.days}일</strong></li>
    })}</ul>
    <p>{ready ? '입양하면 놀러 온 날이 아니어도 늘 같이 지내요.' : '미션을 모두 끝내거나 30일 돌보면 입양해요. 같은 날은 한 번만 세어요.'}</p>
    {ready ? <button type="button" className="pet-secondary" disabled={disabled} onClick={onAdopt}>입양하러 가기<ChevronRight size={17} /></button>
      : next ? <button type="button" className="pet-secondary" disabled={disabled} onClick={() => onCare(next.action)}>{GO[next.action]}<ChevronRight size={17} /></button>
        : <p className="pet-care-goal__done"><Check size={16} />오늘 할 미션은 다 했어요. 다음에 와도 이어서 할 수 있어요.</p>}
  </section>
}
