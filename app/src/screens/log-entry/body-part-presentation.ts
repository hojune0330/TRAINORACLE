import { BODY_PARTS } from "../../components/body-parts"

export type KnownBodyPart = typeof BODY_PARTS[number]

/** Display groups only. The persisted part IDs and their meaning remain unchanged. */
export const BODY_PART_GROUPS = [
  { id: "knee", label: "무릎", ids: ["lKnee", "rKnee"] },
  { id: "calf", label: "종아리", ids: ["lCalf", "rCalf"] },
  { id: "hamstring", label: "허벅지 뒤", ids: ["lHam", "rHam"] },
  { id: "foot", label: "발", ids: ["lFoot", "rFoot"] },
  { id: "shin", label: "정강이", ids: ["rShin"] },
  { id: "back", label: "허리", ids: ["lBack"] },
] as const

export type BodyPartGroup = typeof BODY_PART_GROUPS[number]

export function bodyPartInputLabel(part: KnownBodyPart): string {
  return part.name.replace("햄스트링", "허벅지 뒤")
}

export function bodyPartFocusLabel(part: KnownBodyPart): string {
  const label = bodyPartInputLabel(part)
  return /^(왼|오른) /u.test(label) ? `내 ${label.replace(/^왼 /u, "왼쪽 ").replace(/^오른 /u, "오른쪽 ")}` : label
}
