# 페이블 사후 검수 보고서 — PR #263–#270 일괄 감사

- 검수자: 페이블 (독립 검수자)
- 일자: 2026-08-28
- 성격: **사후 검수(post-merge audit)** — 7개 기능/수정 PR이 검수 없이 main에 병합·배포된 상태에서 수행
- 기준 커밋: main `fb171d9` (#270 병합 시점)
- 검증 방법: 전 파일 독립 코드 리딩 + 로컬 전체 스위트 재현 + main CI 확인 + 라이브 번들 검증

---

## 0. 총평

**7개 PR 전부 사후 승인(RETROACTIVE APPROVE).** 차단급 결함 없음. 정직성 불변식(미기록≠0,
EXPLICIT+ACCEPTED만 신호, MIXED_UNALLOCATED 비재배분, 비공개 메모 비사용)이 신규 코드
전반에서 유지되었고, 오너가 선언한 로드맵 순서(#261 → 에너지 누적 분석 → 9.5일 주기 계보)와
"정확한 9.5일 집계는 계약 확정 전 차단" 원칙도 지켜졌다. 특히 #263은 제가 #261 검수에서 남긴
비차단 노트 n1–n3를 전부 해소했다.

비차단 관찰 사항 4건(§10)만 남긴다.

---

## 1. 독립 검증 결과 (main fb171d9)

| 검증 | 결과 |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx vitest run` 전체 | **40 failed / 1722 passed** |
| 실패 40건 분석 | 14개 파일 전부 private-note 암호화·볼트 계열 = **알려진 샌드박스 Web Crypto 환경 이슈** (턴 13에서 main 기준으로 동일 재현 확인, CI에서는 통과). **신규 회귀 0건** |
| main CI (#264–#270 각 push) | 전부 success (deploy-pages 포함) |
| 라이브 번들 | `index-C4wHRMgZ.js` 갱신 확인. 에너지 원장(메인 번들), 오라클(`Trends-Co_TrXqz.js`), 훈련법 리더(`TrainingContent-D6vyeNNL.js`) 문자열 모두 배포본에 존재 |

실패 파일 목록(전부 기존 환경 이슈): private-note-crypto/sync, sync-schema-recovery,
journal-full-export, journal-provenance, journal-store, private-memo-vault ×4,
backup-file, LogEntry/PlanBeta/RestoreBackup 화면 계열.

---

## 2. PR #263 — 에너지 시스템 누적 원장 V1 (0ecf77f)

**판정: 사후 승인.**

- `energy-system-ledger.ts`: 관측 자격 게이트가 정확함 — `SESSION_RESULT_RECORD` + energySystem
  non-null + `fieldProvenance.system === "EXPLICIT"` + `trustState === "ACCEPTED"`.
- **레거시 자동 'base' 배제**: `journal-observation.ts`의 `provenanceOf()`가 provenance 없는
  과거 항목에 `LEGACY_MISSING_PROVENANCE`를 반환 → 과거 자동 기본값이 원장에 유입되지 않음.
  `PostSessionForm.tsx`에서 `system ?? "base"` 기본값 제거 확인 (EXPLICIT일 때만 초기값 복원).
- **내 #261 노트 해소 확인**:
  - n1(미사용 WeeklyDistanceSection) → 파일·테스트 제거됨
  - n2(거리 전용 충돌 서명) → sourceSignature가 loggedOn/energySystem/distance/duration/rpe
    + 전 provenance + trust를 포함하도록 확장됨
  - n3(윈도 범위 충돌 의미론) → 계약 명문화 + 회귀 테스트 추가됨
- 충돌 ID 전체 배제·동일 중복 1회 집계, null 보존 행(durationMinutes/distanceKm/meanRpe),
  `summarizeCurrentPlanEnergy`의 REST 제외(`excludedRestDayCount`)와 완료 표시/일지 사실 분리
  모두 계약대로.
- 분류 체계(`energy-system-taxonomy.ts`): 7키에 MIXED_UNALLOCATED 포함, MIXED_INTENT 매핑 정직.

## 3. PR #264 — CI stale 배포 롤백 방지 (2635d85)

**판정: 사후 승인.**

- `cancel-in-progress: true` + "Verify source is current main" 단계: `$GITHUB_SHA` ≠ 현재
  origin/main HEAD면 Node 설치/빌드/gh-pages publish 전 단계를 `if:`로 건너뜀. 오래된 커밋의
  느린 배포가 최신 배포를 덮어쓰는 롤백 시나리오를 이중으로 차단.
- `.tools/deploy-source-guard.test.mjs`가 워크플로 텍스트를 회귀 고정 — 워크플로 자체를 테스트로
  잠근 접근이 적절.

## 4. PR #265 — 계획-일지 링크 (663e936)

**판정: 사후 승인.**

- `planned-session-link.ts`: sha256 지문(`/^sha256:[a-f0-9]{64}$/`), superRefine이 8필드 투영에서
  plannedSessionId를 재계산해 자기일관성 검증. 저장된 세션 중 콘텐츠 지문 일치가 **정확히 1건**일
  때만 링크 초안 생성(모호성 거부).
- `journal-update.ts`: `samePlannedSessionLink`가 불변 정체성 검사에 포함 → 편집 시 링크 위·변조
  불가.
- `safe-export.ts`: 링크가 safe/analysis 내보내기에 포함, 구조화 신호 존재 판정에도 반영.

## 5. PR #266 — 24주 주기화 계보 (846fa12)

**판정: 사후 승인.**

- 18프레임 × `z.literal(9.5)`일, 3프레임 중주기, 위상 매핑(BASE≤6/DEVELOPMENT≤11/
  COMPETITION_SPECIFIC≤16/TAPER_PEAK)이 superRefine으로 강제.
- 전진 전용(`advancePeriodizationContext`가 frameStartedAt 단조성 강제, 18→1 시
  macrocycleOrdinal+1, source ROLLED_FORWARD).
- **핵심 확인**: 9.5는 계보 스키마 상수로만 존재. 날짜 산술로 9.5일 경계 집계를 계산하는 코드
  없음 — 오너의 "계약 확정 전 억지 집계 차단" 선언이 코드로 유지됨.

## 6. PR #267 — 마라톤까지 계획 확장 (48603fd)

**판정: 사후 승인.**

- 7종목(800–42195)/4그룹으로 확장하되 **신규 페이스 템플릿 발명 없음**:
  `plan-event-breadth.contract.test.ts`가 신규 종목이
  `PACE_TARGET_FALLBACK_NO_EXPLICIT_TEMPLATE` fallback으로만 생성됨을 단언(RPE-시간 계획).
- 후보 ID 정규식·`eventGroupMatchesDistance`(GENERAL_ENDURANCE = 21097|42195) 일관.

## 7. PR #268 — 계획 클라우드 보존 상태 노출 (6791c8f)

**판정: 사후 승인** (상태기계/본문 수준 검토). latest-attempt-wins 의미론과 상태 노출이
정직성 원칙(성공 가장 없음)에 부합.

## 8. PR #269 — 개인 기록 오라클 (99fe43d)

**판정: 사후 승인.**

- `personal-oracle.ts`: 성숙도 3단계(EMPTY/STARTING/DESCRIPTIVE), 통찰 3종 전부 **기술
  전용(descriptive-only)** — 각 통찰이 "자동으로 바꾸지 않아요"/"부족 판정은 아니에요"/"완료
  표시는 실제 일지와 다른 기록" 등 권한 부인 문구를 내장.
- evidence 문자열이 반영/제외/중복 수를 노출 — 신뢰 회계 원칙 준수.
- unknowns가 수행능력·의학·자동조정 권한 및 메모 비사용을 명시적으로 부인.
- `PersonalOraclePanel.tsx`: 도메인 산출물 표시 전용, 자체 해석 로직 없음. 근거·해석 범위가
  `<details>`로 항상 접근 가능.

## 9. PR #270 — 검토된 훈련법 리더 (fb171d9)

**판정: 사후 승인.**

- 콘텐츠 3건이 코드 상수(`training-content-catalog.ts`)로 고정, 전부
  `planEligibility: "NOT_PLAN_ELIGIBLE"` — 계약(TRENDING_TRAINING_CONTENT_CONTRACT.md)의
  "읽을거리는 계획을 바꾸지 않는다"가 타입으로 강제됨.
- 소스 등급(A_OBSERVED/B_TECHNICAL/C_MEDIA)과 소스 상태(원문 확인/추가 검토 중)를 UI에
  그대로 노출 — 출처 정직성 양호.
- `useBoundary`("따라 하기 전에") 섹션이 각 글에 필수 — 청소년/솔로 러너 안전 경계 명시.
- 저장 스토어는 유효 ID 화이트리스트 + Set 중복 제거, 파싱 실패 시 빈 배열 — 견고.
- 포인트 통합은 규칙 확정 전 명시적으로 보류("규칙이 정해진 뒤에 열어요") — 성급한 게임화 회피.

---

## 10. 크로스커팅 검증

| 항목 | 결과 |
|---|---|
| 비공개 메모 경계 | 신규 도메인 모듈 5종(ledger/oracle/link/lineage/catalog)에 memo/note 접근 **0건** (grep 확인) |
| UX §8 (docs/UX_UI_VISUAL_STANDARD.md) | `training-content.css` 및 #263/#268/#269 CSS diff에 box-shadow/cursive/border-left/원시 hex **0건** |
| MIXED_UNALLOCATED 시각적 존재 | EnergySystemLedgerPanel compact 모드에서도 "MIX 복합·미배분 N회" 행 상시 표기 확인 (§4 요구 충족) |
| 미기록≠0 | `metricText()` null → "미기록" 표기; 원장 행 null 보존 |
| 9.5일 집계 차단 | 유지 (§5 참조) |
| 라이브 배포 | 3개 신규 기능 모두 배포 번들에서 확인 |

### 비차단 관찰 (차기 작업 시 참고)

1. **[#264]** `deployment-source` 검증은 push 시점 race를 좁히지만 `git fetch`와 publish 사이의
   짧은 창은 남음. `cancel-in-progress: true`와 조합되어 실용적으로는 충분 — 기록만 남김.
2. **[#269]** ENERGY_COVERAGE 통찰의 "가장 자주 고른 시스템"은 동률일 때 키 순서에 의존.
   현재 표기는 기술 전용이라 무해하나, 동률 명시("BASE·LT 동률") 표기를 고려할 것.
3. **[#270]** 콘텐츠가 코드 상수라 갱신마다 배포 필요 — V1 범위(3건)에선 올바른 선택이나,
   확장 시 검토 파이프라인 계약이 선행돼야 함 (계약 문서에 이미 OI로 인지됨).
4. **[visual-system.contract.test.ts]** CSS 계약 테스트가 `src/styles` 디렉터리 재귀 스캔이므로
   신규 `training-content.css`도 자동 포섭됨을 확인 — 단, 계약 위반을 우회할 수 있는
   컴포넌트 인라인 style 사용은 여전히 수동 검토 영역. 이번 신규 화면들엔 위반 없음.

---

## 11. 결론

| PR | 제목 | 판정 |
|---|---|---|
| #263 | 에너지 시스템 누적 원장 V1 | 사후 승인 (n1–n3 해소 확인) |
| #264 | CI stale 배포 롤백 방지 | 사후 승인 |
| #265 | 계획-일지 링크 | 사후 승인 |
| #266 | 24주 주기화 계보 | 사후 승인 |
| #267 | 마라톤까지 계획 확장 | 사후 승인 |
| #268 | 계획 클라우드 보존 상태 | 사후 승인 |
| #269 | 개인 기록 오라클 | 사후 승인 |
| #270 | 검토된 훈련법 리더 | 사후 승인 |

절차 메모: 이번 7건은 병합 전 독립 검수를 거치지 않았다. 결과적으로 품질은 유지되었으나,
병합 전 검수가 계약 위반을 배포 전에 차단하는 유일한 지점이므로 다음 사이클부터는 병합 전
검수 흐름 복귀를 권장한다.

— 페이블
