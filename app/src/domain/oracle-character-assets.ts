import type { ORACLE_AXES } from "./oracle-profile-v2"

export type OracleCharacterAssetId =
  | Extract<typeof ORACLE_AXES[number], { readonly optional: false }>["id"]
  | "NEUTRAL"

export type OracleCharacterAsset = Readonly<{
  src: `/oracle-v2/${string}.png`
  label: string
  alt: string
  width: number
  height: number
}>

export const ORACLE_MARI_ASSETS = Object.freeze({
  friendly: Object.freeze({ src: "/oracle-v2/mari-friendly.png", label: "마리", alt: "부드러운 눈매로 미소 짓는 육상부 매니저 마리", width: 1024, height: 1536 }),
  wave: Object.freeze({ src: "/oracle-v2/mari-wave.png", label: "마리", alt: "밝은 얼굴로 손을 흔드는 육상부 매니저 마리", width: 1024, height: 1536 }),
  complete: Object.freeze({ src: "/oracle-v2/mari-complete.png", label: "마리", alt: "귀여운 표정으로 엄지를 들어주는 육상부 매니저 마리", width: 1024, height: 1536 }),
  analysis: Object.freeze({ src: "/oracle-v2/mari-analysis.png", label: "마리", alt: "날카로운 눈매로 클립보드를 확인하는 육상부 매니저 마리", width: 269, height: 606 }),
} as const satisfies Readonly<Record<string, OracleCharacterAsset>>)

// Mari guides the reading; the user's preference labels remain independent.
export const ORACLE_CHARACTER_ASSETS = Object.freeze({
  CHALLENGE: Object.freeze({
    ...ORACLE_MARI_ASSETS.analysis,
    label: "기록 도전자",
  }),
  INTENSITY: Object.freeze({
    ...ORACLE_MARI_ASSETS.analysis,
    label: "강한 달리기 애호가",
  }),
  STRUCTURE: Object.freeze({
    ...ORACLE_MARI_ASSETS.analysis,
    label: "계획을 즐기는 러너",
  }),
  SOCIAL: Object.freeze({
    ...ORACLE_MARI_ASSETS.wave,
    label: "함께 달리는 러너",
  }),
  EXPLORE: Object.freeze({
    ...ORACLE_MARI_ASSETS.friendly,
    label: "새로움을 찾는 러너",
  }),
  REFRESH: Object.freeze({
    ...ORACLE_MARI_ASSETS.friendly,
    label: "기분 전환 러너",
  }),
  NEUTRAL: Object.freeze({
    ...ORACLE_MARI_ASSETS.wave,
    label: "나의 러닝 프로필",
  }),
} as const satisfies Readonly<Record<OracleCharacterAssetId, OracleCharacterAsset>>)
