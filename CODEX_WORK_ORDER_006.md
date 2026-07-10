# CODEX_WORK_ORDER_006.md

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_006
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-10"
  supersedes: CODEX_WORK_ORDER_005 (완료 — #36/#37/#38 병합)
  decision_basis:
    - ACCOUNT_FEDERATION_DECISION.md (DECIDED)
    - ATHLETETIME_INTEGRATION_REVIEW.md
    - 사용자 지시 2026-07-10: "일지만 쓰고 싶어서 들어오게", "다이어리 꾸미기처럼 재미 요소"
  branch_pattern: codex/work-order-006-task{N}
  report_channel: 본 지시서를 발행한 GitHub 이슈 댓글
```

---

## 0. 불변 규칙 (ORDER_005 규칙 1–12 전부 계승)

1. 로컬 파일이 진실이다. 존재하지 않는 파일 내용을 추정해 작성하지 않는다.
2. 안전 불변식 변경 금지: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, CLEARED 하 advisory only(제4처분 신설 금지), 평가기 실패→UNKNOWN fail-safe.
3. §8 memo_policy: 원문 자유텍스트 서버/감사 영속 금지.
4. namespace 규율: `CYCLE_DAY.D-*` / `RULE_SPEC_D1_D9.D-*` / `LEGACY_PHASE_D.D-*` 혼용 금지.
5. 런타임 증거 없이 어떤 open-issue도 OPEN→CLOSED 전환 금지.
6. canonical 승격, ACCEPTED 판정 자기 부여 금지.
7. 완료 보고는 "PR 업로드, 리뷰/병합 대기"까지만 주장.
8. 모든 디자인 파일 수정 금지.
9. **`app/` 디렉토리 수정 금지** (총책임자 전담).
10. 기존 스펙 패치 시 `patched_from: <소스 문서>` 주석 필수 + open-issue 재계수.
11. 수식 구현 금지 (METRIC §6 수용 유보 유지).
12. 구(舊) 킷(`ui_kits/trainoracle-app/*`) 구현 소스 인용 금지 (아이디어 소스만).
13. **[신규] 타 저장소 수정 금지**: `hojune0330/athletetime` 저장소는 이번 지시 범위 밖이다. 참조·인용은 가능하나 그쪽 코드를 변경하는 산출물을 만들지 않는다.

---

## 1. 배경 (신규 확정 사항 — 산출물 전제)

- **계정 구조 확정**: 애슬리트타임 = 계열사 로그인 제공자. TRAINORACLE은 분리 운영,
  "AthleteTime으로 계속하기" 버튼 + 동의 1회 = 즉시 연동/간편가입.
  상세: `ACCOUNT_FEDERATION_DECISION.md` (DECIDED — 이 문서가 이번 지시의 최상위 전제).
- **로컬 우선 저장 가동**: `app/src/domain/journal-store.ts` 구현·배포 완료.
  일지는 비로그인으로 기기(localStorage)에 저장되고, 계정 연동 후 서버 승격(`syncState: local → synced`) 예정.
- **제품 방향(사용자 원문)**: ① "나중에는 일지만 쓰고 싶어서 들어오게 해주고 싶어" —
  훈련 관리가 아니라 **일지 그 자체가 목적지**인 사용자를 1급 시민으로. ② "일지를 마치
  다이어리 꾸미기처럼 재미 요소도 주고 싶고" — 꾸미기/수집형 재미 요소.

## 2. Task A — 일지 꾸미기·재미 요소 계약 초안 (P1)

**산출물**: `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` (신규)

"다이어리 꾸미기" 방향의 **제품·데이터 계약 초안**을 작성하라 (구현 아님, UI 시안 아님 — 규칙 8·9):

- **꾸미기 요소 카탈로그 구조**: 스티커/스탬프/마스킹테이프/속지 테마/필기체 잉크 색 등
  요소 유형(taxonomy)과 각 유형의 데이터 스키마(`decoration_item: {id, type, placement, unlock_condition?}`).
  구체 아이템 목록은 예시 3개 이내로만 (디자인은 총책임자 영역).
- **획득/수집 모델 옵션 비교**: (a) 전부 무료 즉시 사용, (b) 기록 꾸준함으로 잠금해제
  (연속 기록 N일 등), (c) 혼합. 각 옵션의 동기부여 효과와 위험을 비교하고 권고 1안 제시
  (결정은 총책임자). **단, 과훈련을 부추기는 잠금해제 조건 금지 조항 필수** — 예:
  "주간 거리 X km 달성 시 해제" 같은 훈련량 연동 보상은 안전 원칙 위배로 명시적 금지 목록에.
- **연속 기록(streak) 설계의 안전 조항**: streak가 "아파도 기록해야 한다"는 압박이 되지 않도록,
  휴식일·부상일 기록도 streak로 인정하는 규칙을 계약에 명문화.
- **저장 위치 계약**: 꾸미기 데이터는 일지와 동일하게 로컬 우선(`journal-store` 네임스페이스 확장),
  서버 승격 시에도 TRAINORACLE 전용 DB. 애슬리트타임으로 전송 금지.
- **일지-단독 사용자(journal-only) 경로**: 훈련 계획·안전 게이트를 쓰지 않고 일지만 쓰는
  사용자 모드의 데이터 경계 — 이 모드에서 안전 불변식이 어떻게 유지되는지(계획 기능이 없으면
  BLOCK 대상 행위 자체가 없음을 명시), 추후 훈련 기능 활성화 시 전환 규칙.
- open-issue 테이블: 아이템 카탈로그 확정(디자인), 잠금해제 수치, 수익화 여부(무료/유료 아이템)를 OPEN으로.
- 문서 지위 `DRAFT_FOR_REVIEW`.

## 3. Task B — 로컬→서버 동기화·승격 계약 초안 (P1)

**산출물**: `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` (신규)

`journal-store.ts`의 `syncState` 모델을 서버 동기화로 확장하는 **계약 초안**:

- **승격 흐름**: 계정 연동 완료 시점에 로컬 항목 일괄 업로드 → 성공 항목만 `synced` 전환.
  부분 실패 시 재시도 규칙, 어떤 경우에도 로컬 원본을 업로드 성공 확인 전에 지우지 않는다.
- **충돌 규칙**: 같은 date+kind 항목이 서버에 이미 있으면(다기기) 자동 병합 금지 —
  양쪽 보존 + 사용자 확인. EXTERNAL_RECORD_INTEGRATION_SPEC의 충돌 원칙과 정합 유지.
- **§8 memo_policy 적용 경로(필수)**: memo/note 자유텍스트 필드의 서버 영속 여부를
  명시적으로 다뤄라. 현재 정책(원문 자유텍스트 서버/감사 영속 금지)과 "온라인 보관" 요구의
  긴장 관계를 옵션 비교로 정리: (a) 메모는 로컬 전용 유지, (b) E2E 암호화 저장,
  (c) 정책 개정. 권고 1안 + 결정은 총책임자. **이 결정 전까지 메모 서버 전송 구현 착수 금지**를 계약에 명시.
- **오프라인 우선 순서**: 저장은 항상 로컬 먼저 성공 → 백그라운드 업로드. 서버 불가용이
  일지 작성을 절대 막지 않는다.
- **삭제·탈퇴**: 연동 해제/탈퇴 시 서버 사본 삭제와 로컬 사본 유지의 기본값.
- open-issue: 백엔드 실재(F2 Workers+D1 미구축), 암호화 방식, 보존 기간.
- 문서 지위 `DRAFT_FOR_REVIEW`.

## 4. Task C — 계열사 SSO 연동 계약 정밀화 (P2)

**산출물**: `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md` (신규)

`ACCOUNT_FEDERATION_DECISION.md` §3(기술 계약)을 실행 가능한 상세 계약으로 확장:

- authorize/token 엔드포인트의 요청·응답 스키마, `state`/`nonce`/redirect_uri 검증 규칙,
  id_token claims 표(§3.1의 최소 집합 유지 — email 미포함 재확인).
- 동의 화면 필수 표기 항목(제공 정보 3종, 철회 방법), `oauth_consents` 스키마.
- 토큰 수명·갱신·철회 전파(애슬리트타임에서 철회 시 TRAINORACLE 세션 처리).
- 14세 미만 차단 지점이 애슬리트타임 가입 단계임을 명시하고, 미해결이면
  OI-ERI-GUARDIAN-CONSENT-001과 연결된 open-issue로 유지.
- 규칙 13 준수: 애슬리트타임 쪽 구현 코드는 작성하지 않는다 — 요구사항 명세까지만.
- 문서 지위 `DRAFT_FOR_REVIEW`.

## 5. Task D — 인덱스·현황 갱신 (P3, 마지막)

Task A~C 산출물 반영하여 `specs/reconstruct/README.md` 인덱스와 문서 카운트 갱신.
ORDER_005 Task C와 동일 형식. 신규 결정 문서 2건(ACCOUNT_FEDERATION_DECISION,
ATHLETETIME_INTEGRATION_REVIEW)도 인덱스에 등재.

---

## 6. 보고 형식

- Task별 별도 브랜치·별도 PR (`codex/work-order-006-task{a|b|c|d}`).
- 각 PR 본문: 산출물 경로, 신설 open-issue ID 목록과 개수, 준수한 규칙 중 해당 항목 명시.
- 완료 보고는 발행 이슈 댓글로. "PR 업로드, 리뷰 대기"까지만 (규칙 7).
