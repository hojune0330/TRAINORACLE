export type OracleGuideAsset = Readonly<{
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
} as const satisfies Readonly<Record<string, OracleGuideAsset>>)
