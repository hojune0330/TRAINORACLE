/** Presentation assets only: never an assessment, reward condition or training dose. */
export const COMPANION_ANIMALS = [
  { id: "otter", name: "수달" }, { id: "cat", name: "고양이" }, { id: "bear", name: "곰" },
] as const
export const COMPANION_POSES = [
  { id: "run", name: "달리기" }, { id: "walk", name: "걷기" }, { id: "warm_up", name: "몸 풀기" },
] as const
export type CompanionAnimal = (typeof COMPANION_ANIMALS)[number]["id"]
export type CompanionPose = (typeof COMPANION_POSES)[number]["id"]
export type CompanionStamp = { readonly animal: CompanionAnimal; readonly pose: CompanionPose }
export type CompanionMotion = CompanionPose | "nod"
export const COMPANION_MOTION_SECONDS: Record<CompanionMotion, number> = { run: 1.25, walk: 2.333333, warm_up: 2.8, nod: 1.2 }
export function companionStampUrl(stamp: CompanionStamp): string {
  return `${import.meta.env.BASE_URL}collections/training-companions-v1/${stamp.animal}-${stamp.pose}.webp`
}
export function companionMotionPoster(motion: CompanionMotion): string {
  return motion === "nod" ? `${import.meta.env.BASE_URL}companions/v1/otter-nod.webp` : companionStampUrl({ animal: "otter", pose: motion })
}
export function companionMotionAtlas(motion: CompanionMotion): string {
  return `${import.meta.env.BASE_URL}companions/v1/otter-${motion}-atlas.webp`
}
