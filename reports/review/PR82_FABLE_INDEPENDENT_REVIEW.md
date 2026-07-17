# PR82_FABLE_INDEPENDENT_REVIEW.md

```yaml
review_metadata:
  review_id: TO-REVIEW-PR82-FABLE-2026-07-18-001
  reviewer: FABLE_총책임자 (UX·접근성·app/ 영역 소유)
  reviewed_pr: 82
  reviewed_commit: 16aced782231569049928c98a717756583020d36
  reviewed_branch: codex/intensity-assessment
  base_at_review: 0bc9f3e (main, PR #80 병합 후)
  method: 코드 전문 대조 + 로컬 독립 재실행 (Codex 주장 신뢰하지 않음)
  verdict: APPROVE
  merge_blocker_found: false
  rule_14_compliance: 발견 사항은 지적만 하고 자체 수정하지 않음
```

## 1. 독립 재실행 결과 (Codex 주장 검증)

| Codex 주장 | 독립 재실행 결과 | 판정 |
|---|---|---|
| 단위 테스트 87/87 | `npm run test:unit` → **87 passed (13 files)** | ✅ 일치 |
| typecheck / typecheck:e2e | 둘 다 통과 | ✅ 일치 |
| intensity e2e 8/8 (4개 뷰포트) | `npx playwright test e2e/intensity-assessment.spec.ts` → **8 passed** (desktop/mobile/320px touch-narrow/reduced-motion × 2 spec) | ✅ 일치 |
| production build | index-CQac9ERL.js (351.91 kB) | ✅ 일치 |
| CI 통과 | commit 16aced7 check-runs: contract-tests **success** ×2 | ✅ 일치 |
| (추가) 전체 e2e 회귀 | 88개 중 **70 passed, 18 skipped(뷰포트 조건부 skip, 정상)**, 실패 0 | ✅ 회귀 없음 |

## 2. 사장님 지정 검수 5개 축

### ① 선수 입장에서 예상 강도·실제 체감·객관 기록이 이해되는가 → **통과**
- 예상 강도: 기존 RPE와 동일한 1–10 탭 스케일, 재탭 시 해제(강요 없음), 라벨 "예상 강도 (미선택)" 정직.
- 요약 패널: "예상 7/10 / 실제 체감 8/10"을 나란히 표시, 미기록은 "미기록"으로 표기 — 값 대체 없음.
- 커버리지 라벨 4종("주관 + 객관 함께 기록" / "주관 기록만 있음" / "객관 기록으로만 표시" / 자료 없음)이 평문 한국어.
- 파생 표시("운동 비중 40%", "평소 접지 수 대비 125%", "개인 기준 페이스 대비 %")는 전부 선수가 직접 넣은 값에서만 계산되고 출처 필드+규칙 ID가 달림.

### ② 복합 훈련이 여러 구성으로 제대로 남는가 → **통과**
- 6개 종류(달리기/인터벌/근력/플라이오/언덕/대체유산소) discriminated union, 세션당 최대 6개, componentId 중복 거부(superRefine).
- e2e "인터벌+근력 혼합 저장 후 재열람" 4개 뷰포트 전부 통과. localStorage 왕복을 계약 테스트로 확인.

### ③ 주관 평가를 빼먹었을 때 값을 지어내지 않는가 → **통과**
- `summarizeIntensityAssessment`: rpe=0(레거시 미기록 마커)은 undefined로 정규화, plannedRpe 0이면 필드 자체 부재(conditional spread). 커버리지 OBJECTIVE_ONLY로만 표기.
- e2e가 객관 기록만 저장한 화면에서 `RPE \d` 텍스트 0건임을 직접 단언.
- 페어 규칙: 인터벌 실제/기준 페이스는 둘 다 있어야만 허용(한쪽만 있으면 스키마 거부) — 반쪽 데이터로 비율을 지어내지 않음.

### ④ 나만의 메모가 분석·강도 계산에 절대 섞이지 않는가 → **통과**
- intensity-assessment.ts / intensity-summary.ts / 3개 UI 컴포넌트 전체에 `memo`/`note` 참조 **0건** (전수 grep).
- 계약 테스트 "projects explicit intensity evidence without exposing a private memo": 개인 메모가 들어있는 항목에서 강도 데이터만 분석·내보내기에 나가고 메모 원문은 `JSON.stringify` 어디에도 없음을 직접 단언 — 재실행 통과.
- app/src 전체에 네트워크 호출(fetch/XHR/sendBeacon/WebSocket) 여전히 0건.

### ⑤ 범용 피로도 점수·자동 처방으로 과장되지 않았는가 → **통과**
- 종목 간 합산·가중치·단일 점수 코드 부재. intensity 코드에 피로도/readiness/처방 관련 어휘 0건 (전수 grep).
- `REGISTERED_DERIVATION_RULE_IDS = []` 그대로 — INTENSITY_* 파생 규칙 ID는 영구 분석 파생 레지스트리에 **의도적으로 미등록**(표시 전용 유지). spec 문구("intentionally absent")와 코드가 일치.
- spec 헤더: `universal_fatigue_score: FORBIDDEN`, `plan_authority: false`, `safety_authority: false` 명문화. Deferred 절이 컷오프·가중치·자동 계획 변경을 명시적으로 후속 연구로 미룸 — 로드맵과 일치.

## 3. 경계·회귀 추가 확인
- **provenance**: plannedRpe/objectiveComponents가 explicitOrMissing으로 기록 — G0(채택) 결정 준수. 레거시 항목은 추론으로 분석화되지 않음.
- **분석 경계**: `toAnalysisPostSessionEntry`가 provenance 적격일 때만 intensity를 투영. 경기 자기점검 필드는 여전히 분석 제외.
- **입력 방어**: 페이스 "3:99" 같은 오입력은 조용히 버리지 않고 role=alert 오류 표시(계약 테스트로 고정) — PR #64 때 지적한 N1 계열 침묵-폐기 함정을 회피함.
- **기존 저장 스키마 하위 호환**: `intensityAssessment`는 optional — 구버전 항목 그대로 읽힘(단위 테스트로 확인).

## 4. 지적 사항 (전부 비차단, 규칙 14에 따라 수정하지 않음)
- **n1 (문구)**: 객관 구성 추가 실패 오류가 "필수 숫자와 범위를 확인해 주세요." 한 줄로 어느 필드가 문제인지 지목하지 않음. 필드 수가 많은 근력/인터벌에서 선수가 헤맬 수 있음 → 후속 문구 개선 후보.
- **n2 (표시)**: 페이스 비율은 기준보다 느리면 100% 미만으로 나오는데, "개인 기준 페이스 대비 93%"가 빠른 건지 느린 건지 선수가 즉시 직관하기 어려울 수 있음 → 후속 라벨 연구 후보(6단계/개인 기준선 연구와 함께).
- **n3 (범위)**: 근력 `loadPercent1Rm` 상한 150% — 밴드/보조기구 초과부하 케이스는 드물지만 존재. 현재로선 합리적 방어값이므로 기록만 남김.

## 5. 결론
**승인(APPROVE) — 그대로 병합 가능.** 실제 데이터 오류·개인정보 누출·저장 오류에 해당하는 차단 문제 없음.
병합 후 필요 작업: ① main에서 CI 재통과 확인 ② gh-pages 재배포(라이브 번들 갱신).

[REVIEW_RECORDED]
