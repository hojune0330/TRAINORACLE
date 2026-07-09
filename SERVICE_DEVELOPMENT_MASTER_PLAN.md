# SERVICE_DEVELOPMENT_MASTER_PLAN.md

```yaml
doc_id: TRAINORACLE_SERVICE_DEVELOPMENT_MASTER_PLAN
title: "TRAINORACLE 실서비스 개발 마스터플랜 v1"
version: "1.0"
issued_date: "2026-07-09"
owner: COACH_HOJUNE
plan_author: PROJECT_LEAD_AI (총책임/기획/디자인/구현)
status: ACTIVE
role_split:
  PROJECT_LEAD_AI: [기획, 디자인, 화면 구현, 안전 체인 통합, 리뷰, 병합 승인]
  CODEX: [스펙 검증, 플로우 감사, 문서 정비]  # CODEX_WORK_ORDER_002
```

---

## 0. 현재 자산 스냅샷 (2026-07-09, main 기준 — 전부 파일 검증됨)

| 계층 | 자산 | 상태 |
|---|---|---|
| 계약 | 소스 SPEC 4종 수용 (Gate/RVE/Physio/DailyLog) + Wave D 바인딩 패치 3건 | Round 1·2 결정 완료 |
| 계약(잔여) | reconstruct 4종 미수용 (Analysis/DailyBrief/Microcycle/RationalePrivacy) | Round 3 대기 (Codex 패킷 준비 중) |
| 코드 | `impl/` D9→RVE→Gate→Generator 수직 슬라이스 | vitest 7/7 PASS |
| 코드 | `runtime-evidence/d9-evaluator/` D9 평가기 | vitest 11/11 PASS |
| CI | `.github/workflows/ci.yml` | PR마다 vitest |
| 디자인 | v3 실행형 앱(9파일) + v2 앱(10) + preview 30 + 디자인 문서 | main 이식 완료, §8 고지 보강 |
| 가시성 | `dashboard/` 현황판, 루트 `index.html` 허브 | 동작 |

## 1. 제품 정의 (v1 출시 범위)

**한 문장**: 중·장거리 러너를 위한 **일지(journal) 우선** 훈련 기록 앱 — 안전 체인이 뒤에서 지키고, AI는 한 줄로만 말한다.

### v1 IN (출시 필수)
1. 일지 작성: post-session / evening / race 3모드 (구조화 필드 + 휘발성 메모)
2. 일지 열람: 인쇄 가능한 저널 페이지 (A5)
3. 추세: 스파크라인 + 주간 강도 스택
4. 안전 표시: 통증·증상 신호 시 Review 상태 표시 (차단/해제는 표시만, 판정은 안전 체인)
5. 로컬 우선 저장: 원문 메모는 기기에만, 구조화 필드만 동기화 대상
6. AI 각주: 신뢰도% + 출처 참조가 붙은 1줄 (끄기 가능)

### v1 OUT (명시적 제외 — NEGATIVE_SPACE 계승)
- 소셜/피드/좋아요, AI 채팅(코치 페르소나 v2 전용), 훈련 계획 자동 생성 UI(안전 체인 미완결 시 미노출), 웨어러블 실시간 연동(수동 입력 우선), 푸시 알림

### 안전 불변식 (모든 Phase에서 위반 불가)
- D9 ACTIVE→BLOCK, UNKNOWN→BLOCK_OR_HUMAN_REVIEW, 평가기 실패→UNKNOWN
- 계획 관련 기능은 Safety Gate PASS 없이는 UI에 노출 자체가 안 됨
- 원문 자유 텍스트 서버/감사 저장 금지 — 타입 수준에서 필드 부재로 강제

## 2. 아키텍처 결정 (ADR 요약)

| # | 결정 | 근거 |
|---|---|---|
| A1 | **프론트: Vite + React + TypeScript**로 v3 JSX를 정식 빌드로 승격 | 현 in-browser Babel은 프로토타입용. 기존 컴포넌트 구조(Home/LogEntry/LogDetail/Trends) 재사용 |
| A2 | **로컬 우선 저장: IndexedDB** (원문 메모 포함 전부 로컬) → 동기화는 구조화 필드만 | §8 memo_policy를 아키텍처로 강제 |
| A3 | **안전 체인: `impl/` 패키지를 프론트가 직접 import** (모노레포 워크스페이스) | 검증된 7/7 PASS 코드 재사용, 이중 구현 금지 |
| A4 | **백엔드는 v1에서 최소화**: 정적 호스팅 + (선택) 구조화 필드 동기화 API 1본 | 프라이버시 표면적 최소화, 배포 단순화 |
| A5 | **CYCLE_DAY 네임스페이스 준수**: 캘린더 기능은 MICROCYCLE 스펙 수용(Round 3) 전 미착수 | 미수용 계약 위 구현 금지 원칙 |

## 3. Phase 계획

### Phase 1 — 기반 승격 (예상 1~2 세션) 【총책임 AI】
- `app/` 워크스페이스 신설: Vite+React+TS, `impl/`을 의존성으로 연결
- v3 JSX → TSX 포팅 (Home, LogEntry 3모드, LogDetail, Trends, JournalPrimitives, MobileFrame)
- `colors_and_type*.css` → 토큰 CSS로 정리 (design-v3/tokens와 단일화)
- 완료 기준: `npm run build` 성공 + 기존 7화면 시각적 동등성 + CI에 빌드 추가

### Phase 2 — 데이터 계층 (예상 1~2 세션) 【총책임 AI】
- DailyCheckInRecord 타입을 DAILY_LOG_AND_CHECKIN_SPEC에서 1:1 도출
- IndexedDB 저장소 (원문 메모 = 로컬 전용 스토어 분리, 동기화 대상 스토어와 물리 분리)
- LogEntry 폼 ↔ 레코드 바인딩, LogDetail/Trends를 실데이터로 구동
- 완료 기준: 작성→저장→열람→추세 E2E가 실데이터로 동작 + "원문이 동기화 스토어에 없음" 테스트
- **입력 의존**: Codex Task 2 매트릭스의 GAP/CONFLICT 목록 (필드 누락·초과 확정)

### Phase 3 — 안전 체인 결선 (예상 2 세션) 【총책임 AI】
- 일지 저장 시 구조화 신호(통증 4~5, 증상 플래그)를 `impl/` RVE→Safety Gate로 전달
- 결과 상태를 UI에 표시: CLEARED(무표시)/advisory(각주)/UNKNOWN·ACTIVE(Review 배너)
- 원문 텍스트는 런타임 경계 내 transient 처리만 (D9 평가기 verbatim 사용)
- 완료 기준: 3종 disposition 각각의 UI 상태 스냅샷 테스트 + fail-safe UNKNOWN 시나리오 E2E
- **이 Phase가 제품의 존재 이유** — 여기서 스펙과 코드와 화면이 처음으로 한 몸이 됨

### Phase 4 — AI 각주 + 마감 품질 (예상 1~2 세션) 【총책임 AI】
- AI 1줄 컴포넌트: 신뢰도% + 출처 참조 + 끄기 토글 (RationalePrivacy 스펙 수용 후 계약 준수 형태로)
- 인쇄(A5) 품질 마감, 모바일 실기기 점검, 접근성(포커스/대비/스크린리더 라벨)
- 완료 기준: Lighthouse 접근성 90+ / 인쇄 미리보기 검수 / AI 끄기 상태 영속화

### Phase 5 — 배포 + 베타 (예상 1 세션) 【총책임 AI】
- 정적 배포 (Cloudflare Pages 또는 GitHub Pages) + PWA(오프라인 일지 작성)
- 베타 체크리스트: 코치님 실사용 1주 → 피드백 수집 → v1.1 백로그
- 완료 기준: 공개 URL + 설치 가능한 PWA + 오프라인 작성/열람 동작

### 병행 트랙 【Codex, ORDER_002】
- Round 3 심사 패킷 → (총책임 AI 결정) → Microcycle 수용 시 Phase 6(캘린더) 해금
- 추적성 매트릭스 → Phase 2·3의 요구사항 입력
- 문서/대시보드 정비 → 매 Phase 종료 시 현황 동기화

## 4. 게이트 규칙 (Phase 전환 조건)

| 전환 | 조건 |
|---|---|
| → Phase 2 | Phase 1 빌드 그린 + Codex Task 2 매트릭스 수령·리뷰 |
| → Phase 3 | Phase 2 E2E 그린 + 원문 격리 테스트 통과 |
| → Phase 4 | Phase 3 disposition 3종 UI 테스트 + CI 그린 |
| → Phase 5 | Round 3 중 RationalePrivacy 수용 (AI 각주 계약 근거) — 미수용 시 AI 각주 기본 OFF로 출시 |
| Phase 6(캘린더) 해금 | MICROCYCLE 스펙 Round 3 수용 |

## 5. 리스크 대장

| 리스크 | 영향 | 대응 |
|---|---|---|
| JSX→TSX 포팅 중 시각 회귀 | 중 | 화면별 스크린샷 비교, 프로토타입은 참조용으로 보존(삭제 금지) |
| 미수용 스펙 4종에 결함 발견 | 중 | Round 3에서 CONFLICT 발견 시 해당 기능 Phase 보류 (게이트 규칙) |
| IndexedDB 원문 격리 실수 | **상** | 동기화 직전 스키마 필터 + "원문 필드 부재" 타입 강제 + 전용 테스트 |
| CDN 의존(폰트) 오프라인 실패 | 저 | Phase 5에서 폰트 셀프호스팅 |
| Codex 산출 지연 | 저 | Phase 1은 Codex 무의존이므로 즉시 착수 가능 |

## 6. 다음 액션 (즉시)

1. 【Codex】 ORDER_002 Task 2 착수 (Issue #12)
2. 【총책임 AI】 Phase 1 착수: `app/` 워크스페이스 + 첫 화면(Home) TSX 포팅 — 사용자 승인 시
3. 【사용자】 마스터플랜 승인 / 수정 지시

[ACTIVE]
