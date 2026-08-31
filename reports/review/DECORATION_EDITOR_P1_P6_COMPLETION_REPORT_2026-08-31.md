# 꾸미기 편집기 상용화 로드맵 P1~P6 완결 보고

- 작성: 페이블 (독립 리뷰어)
- 날짜: 2026-08-31
- 근거 문서: `reports/review/DECORATION_EDITOR_COMMERCIAL_GRADE_MASTER_PLAN_2026-08-31.md` (PR #294로 승인)
- 결론: **승인된 P1~P6 로드맵 전체 이행 완료.** 모든 페이즈가 독립 PR + CI 전 항목 통과 후 main에 머지되었습니다.

## 1. 페이즈별 이행 내역 (전부 머지 완료)

| 페이즈 | 내용 | PR | main 커밋 |
| --- | --- | --- | --- |
| 계획 | 격차 리뷰 + P1~P6 마스터 플랜 승인 | [#294](https://github.com/hojune0330/TRAINORACLE/pull/294) | 45da17f |
| P1 | 조작 기반 — @use-gesture 도입, rAF 60fps 파이프라인, 44px 손잡이, 캔버스 삭제·선택 해제 | [#295](https://github.com/hojune0330/TRAINORACLE/pull/295) | 9192133 |
| P2 | 핀치 크기(0.3~3)·비틀기 회전 + 중앙 가이드 자석 + 15° 회전 스냅 + 더블탭 리셋 | [#296](https://github.com/hojune0330/TRAINORACLE/pull/296) | 634d034 |
| P3 | Undo/Redo 스택(20) + Ctrl+Z/Y + 복제 손잡이(+4%/+4% 오프셋) | [#297](https://github.com/hojune0330/TRAINORACLE/pull/297) | 10f632e |
| P4 계약 | 스키마 v3 마이그레이션 계약 문서 (구현 선행) | [#298](https://github.com/hojune0330/TRAINORACLE/pull/298) | 820f5d7 |
| P4 구현 | 스키마 v3 — 자유 배치 `pages[].items[]`, v2 무손실 마이그레이션, 백업 v3 | [#299](https://github.com/hojune0330/TRAINORACLE/pull/299) | 796dc9d |
| P5 계약 | 텍스트 스티커 계약 문서 (T1~T10 / U1~U7) | [#300](https://github.com/hojune0330/TRAINORACLE/pull/300) | 5c1033e |
| P5 구현 | 텍스트 스티커 — 20자 입력 시트, 전용 잉크 6색, 더블탭 재편집, 복제 보존 | [#301](https://github.com/hojune0330/TRAINORACLE/pull/301) | 50d7b50 |
| P6 | 마감 디테일 — 40ms 릴리즈 관성, 스냅 햅틱 `vibrate(10)`, 회전 인지 AABB 경계, CPU 4배 스로틀 30fps 성능 게이트 | [#302](https://github.com/hojune0330/TRAINORACLE/pull/302) | e14d8d3 |

## 2. 마스터 플랜 §0 합격선 대비 최종 검증

- **조작감**: 드래그/핀치/회전 전부 rAF 단일 파이프라인, 릴리즈 관성(40ms, 2t−t² 감쇠, 스냅 시 생략), prefers-reduced-motion에서 관성 비활성. 스냅 "걸림" 순간에만 햅틱 1회.
- **디테일 3종 (삭제·수정·붙여넣기)**: 캔버스 삭제 손잡이, 텍스트 스티커 연필 재편집(더블탭 동일), 복제 손잡이 — 텍스트 스티커도 text/inkId 보존 복제 (P5 T8).
- **데이터 안전**: v2→v3 무손실 마이그레이션, 항목 단위 드롭(전체 초기화 없음), 백업 full-backup.v3 왕복, 텍스트는 텍스트 노드 렌더로 XSS 차단 (e2e 스모크 통과).
- **경계 보정**: 회전 인지 AABB로 클램프를 좁히기만 함(never-widen) — 초과 크기 항목은 스키마 4~96 폴백.
- **성능 게이트**: CDP CPU 4배 스로틀 하에 60스텝 드래그 — 평균 프레임 간격 ≤33.4ms AND 90% 프레임 ≤50ms. CI desktop-chromium에서 상시 실행.

## 3. 테스트·CI 증적

- 최종 상태(#302 머지 시점): 단위/계약 63/63 통과 (gesture-math 9/9, 텍스트 스티커 17/17 포함), e2e 37 passed / 3 skipped (성능 게이트는 desktop-chromium 전용), lint·tsc·build 클린.
- CI 3게이트(contract-tests / app-quality / app-browser) 전 페이즈 PR에서 전부 green 후에만 머지. #301의 box-shadow 위반(visual-system 계약)은 outline으로 수정 후 재통과 — 계약 테스트가 실제로 회귀를 잡은 사례.
- 알려진 로컬 한정 실패: backup-file 계약의 Web Crypto 케이스는 샌드박스 환경 기저 이슈(main에서도 재현, CI 통과) — 본 로드맵과 무관.

## 4. 명시적 보류 항목 (마스터 플랜 §3 그대로)

- **펜/그리기 도구**: 스코프 외로 승인 시점에 보류.
- **사진 붙이기**: 저장 용량·프라이버시 설계 선행 필요로 보류.
- 필요 시 별도 계약 문서 → 승인 → 구현 사이클로 진행 권고.

## 5. 이월 사항

- PR #271: 오너 판단 대기 중 (본 로드맵과 별개).
- 마스터 플랜 §3-21의 "최종 시연 영상": 성능 e2e의 trace/video는 retain-on-failure 정책이라 성공 시 산출물이 없음. 시연 영상이 필요하면 별도 캡처 작업으로 지시 바랍니다.
