/*
 * 한국어 조사 선택 유틸.
 * 꾸미기 알림처럼 아이템 이름 뒤에 조사가 붙는 문장에서
 * "결승선 스티커을" 같은 받침 무시 오류(감사 2026-08-27 F2)를 막는다.
 */

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const JONGSEONG_COUNT = 28
const RIEUL_JONGSEONG_INDEX = 8

function finalConsonantIndex(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const code = word.charCodeAt(i)
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      return (code - HANGUL_BASE) % JONGSEONG_COUNT
    }
    if (/[0-9A-Za-z]/.test(word[i] ?? "")) {
      // 숫자·라틴 꼬리는 관용 발음으로 근사: 받침 있는 소리로 끝나는 것들.
      return /[013678lLmMnNrR]/.test(word[i] ?? "") ? 1 : 0
    }
  }
  return null
}

function hasFinalConsonant(word: string): boolean {
  const index = finalConsonantIndex(word)
  return index !== null && index > 0
}

/** "을" | "를" */
export function eulReul(word: string): string {
  return hasFinalConsonant(word) ? "을" : "를"
}

/** "으로" | "로" — ㄹ 받침은 "로" */
export function euroRo(word: string): string {
  const index = finalConsonantIndex(word)
  if (index === null || index === 0 || index === RIEUL_JONGSEONG_INDEX) return "로"
  return "으로"
}

/** "이" | "가" */
export function iGa(word: string): string {
  return hasFinalConsonant(word) ? "이" : "가"
}

/** 단어 + 조사 결합 헬퍼 */
export function withJosa(word: string, josa: "을/를" | "으로/로" | "이/가"): string {
  if (josa === "을/를") return `${word}${eulReul(word)}`
  if (josa === "으로/로") return `${word}${euroRo(word)}`
  return `${word}${iGa(word)}`
}
