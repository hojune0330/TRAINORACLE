import type { DecorationPageItem } from "./decorations"

/*
 * 일지 날짜를 옮겨도 유지되는 세션 메모리 복사판이다.
 * 새로고침, 브라우저 종료, 로그아웃 뒤에는 남지 않으며 OS 클립보드에도 접근하지 않는다.
 */
let copiedJournalDecoration: DecorationPageItem | null = null

function cloneItem(item: DecorationPageItem): DecorationPageItem {
  return { ...item, transform: { ...item.transform } }
}

export function copyJournalDecorationToSession(item: DecorationPageItem): void {
  copiedJournalDecoration = cloneItem(item)
}

export function readJournalDecorationFromSession(): DecorationPageItem | null {
  return copiedJournalDecoration === null ? null : cloneItem(copiedJournalDecoration)
}

export function clearJournalDecorationSessionClipboard(): void {
  copiedJournalDecoration = null
}
