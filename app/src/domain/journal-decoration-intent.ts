/*
 * 홈의 "꾸미기 열기" → 오늘 일지 상세로 이동해 꾸미기 편집기를 바로 여는
 * 1회용 세션 인텐트. (2026-09-01 오너 실기기 리포트: 홈의 레거시 별도 꾸미기
 * 화면이 실제 기록과 "따로 놀아" 제거하고 진짜 일지 편집기로 통합했다.)
 *
 * localStorage 를 쓰지 않는 이유: 새로고침 뒤에도 편집기가 저절로 열리면
 * 사용자가 원하지 않은 모달을 만나게 된다 — 탭 세션 메모리에만 산다.
 *
 * StrictMode 이중 마운트 안전성: 읽기(peek)와 지우기(clear)를 분리했다.
 * 초기 상태 계산은 peek 만 쓰므로 몇 번 호출돼도 결과가 같고,
 * clear 는 마운트 이후 이펙트에서 수행돼 중복 호출이 무해하다.
 */

let pendingDate: string | null = null

export function requestJournalDecorationAutoOpen(date: string): void {
  pendingDate = date
}

export function pendingJournalDecorationAutoOpenDate(): string | null {
  return pendingDate
}

export function clearJournalDecorationAutoOpen(): void {
  pendingDate = null
}
