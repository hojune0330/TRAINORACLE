# PR84_FABLE_INDEPENDENT_REVIEW.md

```yaml
review_metadata:
  review_id: TO-REVIEW-PR84-FABLE-2026-07-18-001
  reviewer: FABLE_총책임자 (UX·접근성·app/ 영역 소유)
  reviewed_pr: 84
  reviewed_commit: cf7ee32b2c7afe48e8f0d8134f2dc206ce8f0383
  reviewed_branch: codex/intensity-entry-feedback
  base_at_review: f5d6bb1 (main, PR #82·#83 병합 후)
  origin: Fable PR #82 검수 지적 n1(오류 필드 미지목)·n2(페이스 방향 비직관) 후속 구현
  method: 코드 전문 대조 + 로컬 독립 재실행
  verdict: APPROVE
  merge_blocker_found: false
  note: PR이 draft 상태 — 병합 전 ready 전환 필요
```

## 1. 독립 재실행

| Codex 주장 | 독립 재실행 결과 | 판정 |
|---|---|---|
| 단위·계약 테스트 87/87 | 87 passed (13 files) | ✅ |
| intensity e2e 12/12 (4뷰포트) | 12 passed — desktop/mobile/320px/reduced-motion × 3 spec | ✅ |
| typecheck / typecheck:e2e | 둘 다 통과 | ✅ |
| production build | index-Ct33xTrA.js (353.18 kB) | ✅ |
| CI 통과 | cf7ee32 check-runs: contract-tests success ×2 | ✅ |
| (추가) 전체 e2e 회귀 | 74 passed · 18 skipped(뷰포트 조건부) · 실패 0 | ✅ |

## 2. 검수 내용

### n1 해소 — 오류 필드 직접 지목 → **정확히 구현됨**
- `buildComponent`가 null 대신 `{success:false, invalidKeys}`를 반환. zod issue path를
  `FIELD_KEY_BY_SCHEMA_PATH`로 입력 필드 키에 매핑, union 오류는 kind가 일치하는
  branch만 골라 매핑(17개 스키마 경로 전수 등록 확인).
- 오류 문구: `다시 확인: 반복 페이스 · 선택` — 해당 입력에 `aria-invalid=true` 부여
  (스크린리더 사용자에게도 전달). 해당 필드를 수정하면 invalid 표시 즉시 해제.
- **초안 보존**: 실패 시 setFields 미호출 — 입력값이 지워지지 않음. 계약 테스트 +
  e2e(3:99 페이스, -1 %1RM)로 고정.
- 매핑 실패 시 폴백 문구("필수 숫자와 범위를…") 유지 — 무오류 침묵 없음.

### n2 해소 — 페이스 방향 라벨 → **정확히 구현됨**
- `paceComparison()`: ratio>100 → "N% 빠름 (ratio%)", <100 → "N% 느림", =100 → "같음".
  기준초/실제초 비율이므로 실제가 빠르면(초가 작으면) ratio>100 = 빠름 — 방향 수학 검산 일치.
- 기존 백분율과 파생 규칙 ID(INTENSITY_*_PACE_RATIO_V1)·derivedFrom 불변 — 표시 문자열만 변경.
- 달리기·인터벌 두 곳 모두 적용. 단위 테스트 기대값 갱신, e2e가 "5% 빠름 (105%)" 직접 단언.

### 경계 불변 확인
- 피로도 점수·판정·처방 코드 추가 없음. 도메인 변경은 표시 문자열 1개 함수뿐.
- 저장 스키마·분석 경계·메모 경로 무변경(6개 파일 diff 전수 확인).
- spec에 두 행동(필드 지목·방향 라벨) 명문화 — 코드와 문서 일치.

## 3. 지적 사항
- 없음 (차단·비차단 모두). PR #82 검수 지적 2건이 지적 취지 그대로, 범위 확장 없이 구현됨.
- 절차 참고: PR이 **draft** 상태이므로 병합 전 "Ready for review" 전환 필요.

## 4. 결론
**승인(APPROVE) — ready 전환 후 그대로 병합 가능.**

[REVIEW_RECORDED]
