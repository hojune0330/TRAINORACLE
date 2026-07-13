# PLAN_F0F_TASKR_HARDENING — Task R 리뷰 결과 기반 차기 작업 기획안

```yaml
plan_metadata:
  plan_id: PLAN_F0F_TASKR_HARDENING
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-13"
  status: PLAN_AWAITING_OWNER_APPROVAL
  inputs:
    - reports/review/ORDER_007_R_SUMMARY.md (S1:0 / S2:13 / S3:19 / S4:2 — PR #50 병합)
    - reports/review/ORDER_007_R_{safety,privacy,a11y,student,parent,coach,frontend,motivation}.md
    - SPEC_TAP_FIRST_LOGGING.md v2 + CODEX_WORK_ORDER_008 (진행 중 — 산출물 PR 미도착)
    - 총책임자 발굴 잔여 findings: ④ assessMemoTransient 미연결, ⑦ 메모 백업 정책 미결,
      ⑩ app/ CI 빌드 잡 부재 (Issue #21 연계)
  constraint: ORDER_006 규칙 9 — app/ 구현은 총책임자 전담. 코덱스는 스펙/문서/테스트 패키지.
```

---

## 1. 전체 그림 — 세 트랙 병행

| 트랙 | 담당 | 내용 | 선행 조건 |
|---|---|---|---|
| **T1. F0-f 앱 하드닝** | 총괄 (app/) | Task R S2 앱 영역 8건 수정 | 없음 — 즉시 착수 가능 |
| **T2. 퀵 로그 P1 구현** | 총괄 (app/) | 잉크 스택 퀵 로그 훈련 후 모드 | ORDER_008 Task A(스펙 패치) 병합 |
| **T3. 문서·설계 후속** | 코덱스 | ORDER_008 A/B/C 계속 + **ORDER_009** (Task R 문서 후속) | ORDER_008 우선, 009 병행 허용 |

우선순위 논리: T1은 **이미 라이브에 나가 있는 결함**(과대 주장 문구, export 프라이버시, 접근성)의
수리라서 신규 기능(T2)보다 앞선다. T2는 코덱스 스펙 패치가 병합돼야 스키마·예산 기준이 확정되므로
자연히 T1 다음이 된다.

## 2. T1 — F0-f 앱 하드닝 (총괄 전담, 단일 PR 목표)

Task R S2 중 app/ 영역 전부 + 발굴 잔여 ④를 커버한다.

| # | 항목 | 근거 finding | 방침 |
|---|---|---|---|
| F0-f-1 | **통증 배너 문구 하향** | R-safety-002 | "코치 확인 전까지 고강도 훈련 계획이 보류됩니다" → "높은 통증은 사람이 확인해야 하는 기록이에요. 지도자·보호자와 꼭 상의해 주세요." 게이트 구현 시 원문 복귀 (주석으로 명시) |
| F0-f-2 | **음성 메모 정직화** | R-student-001, R-safety-003 | 버튼 비활성 + "준비 중 — 녹음 기능은 아직 없어요" 표기. 가짜 약속("30초 자동 변환") 제거 |
| F0-f-3 | **export 프라이버시 옵션** | R-privacy-001, R-parent-002 | 내보내기 시 선택지 2개: "메모 제외(기본)" / "메모 포함". 포함 선택 시 경고 문구. format 필드에 redaction state 기입 (`memoIncluded: false`) — **사용자 결정 포인트 D1** |
| F0-f-4 | **loadEntries shape 검증** | R-privacy-002 | 수동 파서(외부 라이브러리 금지 유지): kind별 필수 필드 타입 검사, 불합격 entry는 건너뛰고 `[JSTORE] dropped=N` 마커. Zod 미도입 (번들 최소 유지) |
| F0-f-5 | **a11y 트리오** | R-a11y-001/002/003 | ① BodyDiagram: 부위별 숨김 button 목록 병행(aria-label="왼 무릎, 현재 4단계, 누르면 5단계") ② Home 최근 목록 div→button ③ Trends 차트 아래 접힘 텍스트 표 + aria-label |
| F0-f-6 | **race 직전 state 연결·저장** | R-coach-001 + SPEC_TAP_FIRST §1 "state 연결 필수" | 긴장도·컨디션 탭 그리드를 state에 연결, 저장 포함. 스키마 필드는 기존 race entry 내 선택 필드로 (스키마 불변 원칙 내에서 추가 여부는 ORDER_008 Task A 패치 결과와 정합 확인 후 확정) |
| F0-f-7 | **D9 transient 연결 (1단계)** | R-safety-001, 발굴 ④ | evening/session 메모 저장 직전 `assessMemoTransient` 호출 → reasonCodes만 entry에 비민감 코드로 부착 (원문 파생 저장 금지). ORDER_009 Task A 설계 스펙과 정합 — 스펙 선행이 원칙이므로 **ORDER_009 Task A 병합 후 착수** |
| F0-f-8 | **[DRAFT_COMPLETE] 등 사소 정리** | S3/S4 중 앱 영역 | 여유 시 포함, 아니면 이월 |

수용 기준: `tsc --noEmit` + build 통과, 라이브 배포 후 Playwright 콘솔 증거
(`[JSAVE]`, `[JEXPORT] memoIncluded=…`, `[JSTORE] dropped=…`), 키보드 탭 순회 확인.

## 3. T3 — CODEX_WORK_ORDER_009 (문서 후속)

| Task | P | 내용 |
|---|---|---|
| A | P1 | **free-text D9 transient 연결 계약** — DAILY_LOG_AND_CHECKIN_SPEC 패치: 저장 전 평가 시점, reasonCodes만 보존, 원문·파생문 저장 금지, UNKNOWN fail-safe 시 UI 동작 |
| B | P2 | **SSO 문서 상태 정렬** — ACCOUNT_FEDERATION_DECISION / LAUNCH_BACKEND_AND_ACCOUNT_PLAN / FEDERATED_ACCOUNT_SSO_CONTRACT 상단에 동일한 상태 문장 1개씩 |
| C | P3 | **[DRAFT_COMPLETE] literal 혼동 제거** — 마커 사용처 전수 조사 보고서 + 정리 방안 제안 (수정은 총괄 승인 후) |

ORDER_008(A/B/C) 산출이 우선. 009는 008 완료 후 또는 병행.

## 4. 사용자(사장님) 결정 포인트

| # | 질문 | 총괄 권고 |
|---|---|---|
| **D1** | 내보내기 파일에 메모 원문을 기본 포함? | **기본 제외**, 포함은 명시적 선택 + 경고 |
| **D2** | 메모 백업 정책 (이월 안건): 기기 전용 유지 / 종단암호화 백업 / 정책 변경 | 당분간 **기기 전용 유지** — 백엔드 착수 시 재론 |
| **D3** | `?uitest=seed`가 라이브에서 시드 데이터를 만드는 것 (R-privacy-004, S3) | 유지 (증거 수집 도구) — 정식 출시 빌드에서 차단 예약 |
| **D4** | app/ 구현을 코덱스에게 개방할지 (규칙 9 해제) | **유지** — 품질 게이트가 사람 확인 1단계뿐이라 시기상조 |

## 5. 실행 순서 요약

```
지금       : F0-f-1~6 착수 (T1) ─┐ 코덱스: ORDER_008 A/B/C 계속, ORDER_009 접수
T1 배포 후  : ORDER_008 Task A 병합 → T2 퀵 로그 P1 착수
ORDER_009 A 병합 후 : F0-f-7 (D9 연결) 구현
```
