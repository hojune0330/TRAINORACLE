export const fileNumber = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 3 }).format(value)
export function fileDuration(seconds: number | null): string {
  if (seconds === null) return "미기록"
  if (seconds > Number.MAX_SAFE_INTEGER / 1000) return `${fileNumber(seconds)}초`
  const rounded = Math.round(seconds * 1000) / 1000
  const whole = Math.floor(rounded / 60)
  const rest = Math.round((rounded % 60) * 1000) / 1000
  return whole > 0 ? `${whole}분${rest > 0 ? ` ${fileNumber(rest)}초` : ""}` : `${fileNumber(rest)}초`
}
export const filePace = (seconds: number | null) => seconds === null ? "계산하지 않음" : `${fileDuration(seconds)}/km`
export const signedFileDifference = (value: number | null, unit: string) => value === null ? "비교 안 함" : `${value > 0 ? "+" : ""}${fileNumber(value)}${unit}`
