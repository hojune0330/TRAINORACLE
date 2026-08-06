# 발견: 시한폭탄 테스트 (journal-trash.contract.test.ts)

- 실패: "최근에 지운 것이 먼저 온다" — expected [ 'new' ] to deeply equal [ 'new', 'old' ]
- 원인: `moveToTrash(session("old"), "2026-07-01T...")` + `loadTrash()` (now = 실제 현재시각)
        TRASH_RETENTION_DAYS = 30 → 2026-07-31 이후 'old'가 만료되어 사라진다
- 내 변경과 무관: d21610c(기준 커밋)에서도 동일하게 실패함 (검증 완료)
- CI가 통과한 이유: CI 러너 시계가 2026-07-26 (샌드박스는 2026-08-04)
- 즉 **CI는 2026-07-31에 터진다**. 코드 변경 없이 빨간불이 된다.
- 처리: Q2 브랜치(테스트 견고화)에서 고친다. now를 주입해 고정 시각으로 만든다.
