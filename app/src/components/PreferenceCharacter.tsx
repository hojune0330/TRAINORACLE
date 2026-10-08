import { useId, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { OracleAxisId } from "../domain/oracle-profile-v2"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { ContextualIllustration, type ContextualIllustrationName } from "./ContextualIllustration"
import "../styles/preference-character.css"

type PreferenceAxis = Exclude<OracleAxisId, "SU" | "WE">
type Character = {
  readonly image: ContextualIllustrationName
  readonly name: string
  readonly story: string
}

const characters: Record<PreferenceAxis, Character> = {
  STRUCTURE: {
    image: "preference-structure",
    name: "계획을 챙기는 여우",
    story: "미리 정한 순서와 일정을 좋아한다는 답을 담은 여우예요.",
  },
  CHALLENGE: {
    image: "preference-challenge",
    name: "기록을 살피는 수달",
    story: "내가 정한 기록 목표에 도전하는 과정이 즐겁다는 답을 담은 수달이에요.",
  },
  INTENSITY: {
    image: "preference-intensity",
    name: "달리는 느낌을 즐기는 토끼",
    story: "힘차게 달리는 느낌을 좋아한다는 답을 담은 토끼예요.",
  },
  SOCIAL: {
    image: "preference-social",
    name: "함께 달리는 강아지",
    story: "다른 사람과 함께 달리는 시간이 좋다는 답을 담은 강아지예요.",
  },
  EXPLORE: {
    image: "preference-explore",
    name: "새 길이 궁금한 고양이",
    story: "달리며 새로운 경험을 만나는 일이 좋다는 답을 담은 고양이예요.",
  },
  REFRESH: {
    image: "preference-refresh",
    name: "바람을 쐬는 곰",
    story: "기분을 전환하는 것이 달리는 이유라는 답을 담은 곰이에요.",
  },
}

type Props = {
  readonly axis: OracleAxisId
  readonly label: string
}

/** An optional illustration of a response nickname; it never scores or selects a type. */
export function PreferenceCharacter({ axis, label }: Props) {
  if (axis === "SU" || axis === "WE") return null
  return <CharacterStory key={`${axis}:${label}`} character={characters[axis]} label={label} />
}

function CharacterStory({ character, label }: { readonly character: Character; readonly label: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { reduced } = useCalendarMotion()
  const Chevron = open ? ChevronUp : ChevronDown

  return <div className="preference-character" role="group" aria-label={`${label} 캐릭터`}
    data-reduced-motion={reduced} onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
    }}>
    <button type="button" className="preference-character__button" aria-label={`${character.name} 캐릭터 이야기`}
      aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}>
      <ContextualIllustration image={character.image} size="medium" />
      <span className="preference-character__copy">
        <span className="preference-character__name">{character.name}</span>
        <span className="preference-character__action">캐릭터 이야기 <Chevron size={16} aria-hidden="true" /></span>
      </span>
    </button>
    <p id={id} className="preference-character__story" hidden={!open}>{character.story}</p>
  </div>
}
