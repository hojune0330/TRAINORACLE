export const BODY_PARTS = [
  { id: "rKnee", x: 96, y: 290, name: "오른 무릎" },
  { id: "lKnee", x: 124, y: 290, name: "왼 무릎" },
  { id: "rCalf", x: 96, y: 350, name: "오른 종아리" },
  { id: "lCalf", x: 124, y: 350, name: "왼 종아리" },
  { id: "rHam", x: 96, y: 240, name: "오른 햄스트링" },
  { id: "lHam", x: 124, y: 240, name: "왼 햄스트링" },
  { id: "lBack", x: 110, y: 150, name: "허리" },
  { id: "rFoot", x: 96, y: 410, name: "오른 발" },
  { id: "lFoot", x: 124, y: 410, name: "왼 발" },
  { id: "rShin", x: 96, y: 380, name: "정강이" },
] as const

export function bodyPartLabel(id: string): string {
  return BODY_PARTS.find(part => part.id === id || part.name === id)?.name ?? "기타 부위"
}
