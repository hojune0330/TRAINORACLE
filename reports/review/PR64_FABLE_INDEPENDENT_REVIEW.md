# PR64_FABLE_INDEPENDENT_REVIEW.md

```yaml
review_metadata:
  review_id: TO-REVIEW-PR64-FABLE-2026-07-14-001
  reviewer: FABLE_총책임자 (UX·접근성·app/ 영역 소유)
  reviewed_pr: 64
  reviewed_commit: 6a07decbb1400838f766c3046bd056eef45ae04f
  reviewed_branch: codex/race-notes-design
  base_at_review: bc96e17 (main, PR #63 병합 후)
  method: 코드 전문 대조 + 로컬 독립 재실행 (Codex 주장 신뢰하지 않음)
  verdict: APPROVE_WITH_NOTES
  merge_blocker_found: false
  rule_14_compliance: 발견 사항은 지적만 하고 자체 수정하지 않음
```

## 1. 독립 재실행 결과 (Codex 주장 검증)

| Codex 주장 | 독립 재실행 결과 | 판정 |
|---|---|---|
| 앱 단위 테스트 57/57 | `npm run test:unit` → **57 passed (8 files)** | ✅ 일치 |
| typecheck 통과 | `npm run typecheck` → 통과 | ✅ 일치 |
| Playwright 6/6 | `npx playwright test` → **6 passed** (desktop/mobile/reduced-motion × 2 spec) | ✅ 일치 |
| production build 통과 | `npm run build` → index-4sRP9144.js (333KB) | ✅ 일치 |
| CI 통과 | commit 6a07dec check-runs: contract-tests **success** ×2 | ✅ 일치 |
| 콘솔 오류 0건 | 로컬 preview + `?app=1&uitest=seed` Playwright 캡처 → 에러 0건, `[JSTORE] roundtrip=true` `[HOMEJ] painReview=1` 정상 | ✅ 일치 |

## 2. 사장님 지정 검수 항목

### ① 개인 메모(PRIVATE_SELF_ONLY)가 분석·보상·동기화·코치 화면에 새지 않는가 → **통과**
- `safe-export.ts`: 분석 projection(`AnalysisJournalEntry`)과 내보내기
  projection(`SafeJournalEntry`) 모두 **타입 수준에서 `memo`/`note`/`memoPurpose`
  를 `Omit`** — 원문이 지나갈 통로 자체가 없음.
- `aggregates.ts`·`Trends.tsx` 전부 `loadEntries()` → `loadAnalysisEntries()`로
  전환 확인. 원본 접근은 표시 계층(LogDetail, DeviceJournal 목록)에만 남음.
- `app/src`에 `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` 호출 0건 —
  동기화·전송 경로 부재를 코드 전수 grep으로 확인.
- 계약 테스트 `does not turn a private-note-only record into an analysis or
  progress row` 직접 실행 통과.

### ② 훈련 메모(ANALYZABLE_TRAINING_NOTE)가 원문 저장 없이 일시 확인만 하는가 → **통과**
- `memo-safety.ts` `assessPurposeScopedMemo`: purpose가
  ANALYZABLE_TRAINING_NOTE일 때만 D9 평가, 반환은 disposition +
  비민감 reasonCodes만 (원문 조각 없음). 평가기 예외 → `D9_UNKNOWN` fail-safe 유지.
- 원문은 종전과 동일하게 localStorage에만 저장(§8 memo_policy와 일치).
  UI 문구도 "이 기기에서만 잠시 검토 · 훈련 계획의 근거로 쓰지 않음"으로 정직함.
- D9 안내 문구가 "결론이 아니에요, 지도자·보호자와 확인"으로,
  Gate 선행 주장 없음 (F0-f-1 원칙과 일관).

### ③ 경기 긴장도·컨디션·목표 페이스가 올바르게 저장되는가 → **통과**
- `journal-schema.ts` zod: tension int 1–10, condition/mood int 1–5 — PR #60
  리뷰 지적 ②의 범위 검증이 **저장(parseJournalEntryForWrite)과
  읽기(parseJournalEntryList) 양쪽**에 적용됨.
- `goalPace`가 자유 문자열이 아니라 **구조화 객체**
  `{schemaVersion:1, unit:"seconds_per_kilometer", secondsPerKm:int>0}` —
  사장님의 "목표 페이스 구조화" 결정을 정확히 구현. `parseTargetPaceInput`이
  분:초 파싱·초≥60 거부까지 처리.
- RaceForm: 탭한 항목만 spread로 포함(부재=미기록) — F0-f-9 무언의 기본값
  금지 원칙 유지. round-trip 계약 테스트 직접 실행 통과.
- 자기점검 4필드는 분석 projection에서 제외(표시·안전 내보내기만) —
  RACE_SELFCHECK_FIELDS_DECISION "표시 전용" 제한 준수.

### ④ 모바일·접근성 → **통과**
- Playwright mobile-chromium(iPhone 뷰포트) + reduced-motion 프로젝트에서
  저장 버튼/하단 내비 겹침·저장 흐름 6/6 통과 (로컬 재실행).
- 내 F0-f 접근성 작업 보존 확인: BodyDiagram 키보드 경로(role/tabIndex/
  onKeyDown), Home 시맨틱 button, Trends `AccessibleTrendTable`(컴포넌트로
  승격), 통증 배너 하향 문구, 가짜 음성 버튼은 **완전 삭제**(잔존 0건).
- 메모 용도 선택기: fieldset/legend + aria-describedby + role=alert
  포커스 이동 — 미선택 시 저장 차단이 아니라 선택 유도(부분 저장 원칙 유지).

## 3. 지적 사항 (병합 차단 아님 — 규칙 14에 따라 수정하지 않음)

- **N1 (관측성 후퇴)**: 구 `loadEntries`의 `[JSTORE] dropped=N` 마커가
  사라져 무효 entry가 무음 폐기됨. uitest 한정 폐기 카운트 복원 권장.
- **N2 (내보내기 UX 후퇴)**: 내 PR #60의 "메모 포함 opt-in confirm"이
  "무조건 제외"로 단순화됨. 프라이버시상 더 보수적이라 수용 가능하나,
  선수가 자기 메모를 자기 파일로 갖는 경로가 사라짐 — 후속 UX 결정 필요.
  또한 `[JEXPORT]` 마커에서 memoIncluded 필드 제거됨.
- **N3 (uitest 시드 프로덕션 잔존)**: `__uiseed_` 경로가 프로덕션 번들에
  포함됨(번들 내 문자열 확인). Codex 로드맵 4단계에서 제거 예정으로 문서화
  되어 있음 — 그 작업까지는 알려진 부채로 관리.
- **N4 (경계 기록)**: PR 본문 "Codex의 Fable 작업 연속 수행(소유자 승인)"은
  rule 9(app/ = Fable 전담)의 1회성 예외로 이해함. 이 PR을 선례로
  app/ 상시 작업 권한이 이전된 것은 아님을 기록으로 남김.
- **N5 (결정 문서 소유 표기)**: RACE_SELFCHECK_FIELDS_DECISION.md가
  `decided_by: COACH_HOJUNE / recorded_by: CODEX`로 재작성됨 — 원 작성자
  (Fable) 이력은 PR #60에 남아 있어 수용. 승인 참조가 채팅 기록이므로
  향후 결정은 저장소 내 결정 문서로 남기는 관행 유지 요망.

## 4. 결론

**병합 승인(APPROVE)을 권고한다.** 사장님 지정 4개 검수 축 모두 코드와
독립 재실행 증거로 통과했고, 병합 차단 결함은 발견하지 못했다.
N1~N3은 후속 이슈로 관리하면 된다. 병합 후 main에서 CI 재통과와
gh-pages 재배포(현 라이브 번들 index-JLxB3p3E.js는 pre-#64) 확인이 필요하다.

[REVIEW_RECORDED]
