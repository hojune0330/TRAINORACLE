# CODEX_WORK_ORDER_007.md

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_007
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-10"
  relation_to_006: >
    ORDER_006은 취소되지 않았다. 코덱스가 보고한 착수 차단 조건
    (main에 선행 문서 부재)은 PR #41 병합(merge sha 7351610)으로 해소되었다.
    본 지시서 Part 1이 ORDER_006 재개 지시이고, Part 2가 신규 태스크다.
  decision_basis:
    - 사용자 지시 2026-07-10: "천천히 꼼꼼히 리뷰하도록 지시하고
      여러 페르소나도 쥐여줘. 관점도 다르게."
    - CODEX_WORK_ORDER_006.md (재개 대상)
  branch_pattern: codex/work-order-007-task{N}   # ORDER_006 재개분은 기존 패턴 유지
  report_channel: 본 지시서를 발행한 GitHub 이슈 댓글
```

---

## 0. 불변 규칙 (ORDER_006 규칙 1–13 전부 계승)

1. 로컬 파일이 진실이다. 존재하지 않는 파일 내용을 추정해 작성하지 않는다.
2. 안전 불변식 변경 금지: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, CLEARED 하 advisory only(제4처분 신설 금지), 평가기 실패→UNKNOWN fail-safe.
3. §8 memo_policy: 원문 자유텍스트 서버/감사 영속 금지.
4. namespace 규율: `CYCLE_DAY.D-*` / `RULE_SPEC_D1_D9.D-*` / `LEGACY_PHASE_D.D-*` 혼용 금지.
5. 런타임 증거 없이 어떤 open-issue도 OPEN→CLOSED 전환 금지.
6. canonical 승격, ACCEPTED 판정 자기 부여 금지.
7. 완료 보고는 "PR 업로드, 리뷰/병합 대기"까지만 주장.
8. 모든 디자인 파일 수정 금지.
9. **`app/` 디렉토리 수정 금지** (총책임자 전담). — **리뷰 태스크에서도 동일: 발견은 보고서로만, 코드 수정 금지.**
10. 기존 스펙 패치 시 `patched_from: <소스 문서>` 주석 필수 + open-issue 재계수.
11. 수식 구현 금지 (METRIC §6 수용 유보 유지).
12. 구(舊) 킷(`ui_kits/trainoracle-app/*`) 구현 소스 인용 금지 (아이디어 소스만).
13. 타 저장소 수정 금지: `hojune0330/athletetime`은 범위 밖. 참조·인용만 가능.
14. **[신규] 리뷰 무수정 원칙**: Part 2 리뷰 태스크의 산출물은 `reports/review/` 하위 보고서 파일만이다. 리뷰 중 발견한 문제를 스스로 고치지 않는다 — 문서 오류라도 수정은 별도 지시로 발주된다.

---

## Part 1 — ORDER_006 Task A–D 재개 (P1, 선행)

코덱스가 2026-07-10 보고한 착수 보류 조건 3건에 대한 총책임자 검증·조치 결과:

| 조건 | 상태 | 증거 |
|---|---|---|
| 1. PR #41 병합 | ✅ 완료 | merged=true, merge sha `7351610` |
| 2. main에 선행 파일 4건 존재 | ✅ 확인 | `CODEX_WORK_ORDER_006.md` / `ACCOUNT_FEDERATION_DECISION.md` / `ATHLETETIME_INTEGRATION_REVIEW.md` / `app/src/domain/journal-store.ts` 전부 `origin/main`에서 `git cat-file -e` 통과 |
| 3. Task별 브랜치·PR 생성 가능 | ✅ 허가 | `codex/work-order-006-task{a\|b\|c\|d}`, base=main |

**지시**: ORDER_006 Task A(꾸미기 계약) → B(동기화 계약) → C(SSO 계약) → D(인덱스)를
원문 그대로 재개하라. 지시 내용 변경 없음. 단 한 가지 갱신 — Task D 인덱스 갱신 시
main에 새로 병합된 `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`도 등재 대상에 포함하라.

**우선순위**: Part 1이 Part 2보다 먼저다. 단, Task A–D PR 업로드 후 리뷰 대기 중에는
Part 2를 병행 진행해도 된다 (리뷰 태스크는 다른 브랜치·다른 산출물이므로 충돌 없음).

---

## Part 2 — Task R: 전체 프로젝트 다중 페르소나 정밀 리뷰 (P1)

### R.0 취지 (총책임자 배경 설명)

며칠간 쉼 없이 개발이 진행됐다(스펙 재구축 → 안전 게이트 → app 구현 F0-a~d → 배포).
속도가 빨랐던 만큼 **놓친 것이 있을 수 있다**는 것이 발주 사유다. 이 태스크의 목적은
새 기능이 아니라 **결함·불일치·위험의 발견**이다.

**작업 태도 지시 (사용자 원문 반영)**:
- **천천히, 꼼꼼히.** 빨리 끝내는 것은 이 태스크에서 감점 요인이다. 페르소나 하나당
  독립된 패스(pass)로 처음부터 끝까지 다시 읽어라. 한 번 훑고 여덟 관점을 동시에
  적용하는 방식 금지.
- 발견이 없으면 없다고 쓰되, "확인한 파일 목록 + 확인 방법"을 남겨 침묵이
  '안 봄'이 아니라 '봤는데 없음'임을 증명하라.
- 모든 발견은 **증거 인용 필수**: `파일경로:줄번호` 또는 문서 §섹션. 추정 금지.

### R.1 리뷰 범위

| 영역 | 대상 | 비고 |
|---|---|---|
| 앱 구현 | `app/src/**` 전체 (screens 5, domain 6, components 5, main/AppShell/App) | **읽기 전용** — 규칙 9·14 |
| 스펙 | `specs/reconstruct/*.md` 13건 + 신규 계약 문서(Task A–C 산출물 포함 가능) | 스펙 상호 모순, 스펙↔구현 드리프트 |
| 결정 문서 | `ACCOUNT_FEDERATION_DECISION.md`, `ATHLETETIME_INTEGRATION_REVIEW.md`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`, `DECISION_LOG.md` | 결정 간 정합성 |
| 지시서 이력 | `CODEX_WORK_ORDER_001~007` | 규칙 누적 과정의 누락·모순 |
| 배포물 | GitHub Pages 라이브(https://hojune0330.github.io/TRAINORACLE/) — 접근 가능한 범위에서 | 접근 불가 시 코드 기준으로 판단하고 그 사실을 명시 |

### R.2 페르소나 8종 — 각각 독립 보고서

각 페르소나는 별도 파일 `reports/review/ORDER_007_R_<id>.md`로 작성한다.
페르소나에 몰입하라: 그 사람이 실제로 신경 쓰는 것만 그 사람의 언어로 평가하라.

| id | 페르소나 | 핵심 질문 (예시이며 확장하라) |
|---|---|---|
| `student` | **중학생 육상 선수 (만 14세, 첫 방문자)** | 회원가입 없이 첫 일지를 정말 1분 안에 쓸 수 있나? 용어(RPE, LT, VO2)가 처음 보는 아이에게 설명되나? 빈 화면이 무섭지 않고 초대장처럼 느껴지나? 가이드 탭의 예시가 "나도 하고 싶다"를 만드나? |
| `parent` | **학부모 (자녀의 데이터를 걱정)** | 내 아이의 몸무게·통증·심박이 어디에 저장되나? 그 사실이 화면에서 확인되나? 회원가입 유도가 강압적이지 않나? 14세 미만 처리 공백은 없나? 아이가 통증을 숨기고 훈련하도록 부추기는 요소가 하나라도 있나? |
| `coach` | **입시·전문 코치 (실사용 지도자)** | 기록된 데이터(거리/페이스/RPE/통증)가 실제 훈련 지도에 쓸 만한 단위·형식인가? 주간 집계 로직(월요일 기준 등)이 현장 관행과 맞나? 선수가 거짓 기록할 유인은 없나? 트렌드 화면이 오독을 유발하지 않나? |
| `safety` | **스포츠의학 안전 심사자** | 안전 불변식(D9 BLOCK, advisory-only, fail-safe UNKNOWN)이 스펙과 구현 모두에서 유지되나? 통증 4–5 처리 경로가 실제로 훈련을 막고 있나, 문구만 있나? 훈련량을 부추기는 카피·보상·시각 요소가 있나? streak/집계가 "아파도 뛰어라" 압박이 되는 경로는? |
| `privacy` | **보안·프라이버시 감사자** | localStorage 키·스키마에 민감정보가 어떻게 담기나? uitest 로그가 프로덕션에서 새는 경로는? §8 memo_policy 위반 소지(자유텍스트가 서버로 갈 예정 경로 포함)? SSO 계약의 state/nonce/redirect 검증은 충분한가? XSS·주입 관점에서 사용자 입력 렌더링 경로 점검. |
| `frontend` | **프론트엔드 코드 품질 엔지니어** | 타입 안전성 구멍(as 캐스팅, null 처리), 날짜 연산 버그(시간대·월경계·주경계), aggregates.ts 집계 정확성(파싱 실패 처리 포함), journal-store의 저장 실패/quota 초과 처리, 렌더 성능(엔트리 수천 건일 때), 죽은 코드·중복 코드. |
| `a11y` | **접근성 검토자** | 색상 대비(손글씨 폰트·연한 회색), 터치 타깃 크기, 스크린리더 의미 전달(MoodStrip·PainDot 같은 시각 전용 요소), 폰트 크기 확대 시 레이아웃, 키보드 조작. 코드 기준 판단 + 확인 불가 항목은 UNVERIFIED로 분류. |
| `motivation` | **스포츠 심리 전문가 (동기부여 문구 검토)** | 카피가 자기결정성(자율·유능·관계)을 지지하나, 죄책감 유발형인가? 빈 상태 문구가 초심자를 환영하나? "N일만 더 쓰면" 류 넛지가 건강한 습관 형성인가 압박인가? 가이드의 1일→1년 스토리가 과장 없이 진정성 있나? |

### R.3 발견사항 형식 (전 페르소나 공통)

```yaml
finding:
  id: R-<persona>-<번호>        # 예: R-safety-003
  severity: S1|S2|S3|S4
  # S1 치명(안전 불변식 위반·데이터 유실·법적 위험) — 즉시 보고
  # S2 중대(오동작·오해 유발·프라이버시 약점)
  # S3 개선(품질·UX·유지보수)
  # S4 관찰(취향·제안 수준)
  evidence: "<파일:줄 또는 문서 §>"
  description: "<무엇이 왜 문제인가 — 페르소나의 언어로>"
  suggested_direction: "<수정 방향 제안만. 코드/문서 수정 금지 (규칙 14)>"
  verified_how: "<어떻게 확인했나: 코드 정독 / 문서 대조 / 라이브 확인 / UNVERIFIED>"
```

### R.4 종합 보고서

8개 보고서 완료 후 `reports/review/ORDER_007_R_SUMMARY.md` 작성:
- 심각도별 집계표 (S1~S4 × 페르소나)
- **S1·S2 전체 목록** (id, 한 줄 요약, 증거)
- 여러 페르소나가 중복 지적한 항목 (교차 검증된 발견 = 신뢰도 높음)
- 페르소나 간 **충돌하는 권고**가 있으면 숨기지 말고 명시 (판단은 총책임자)
- 리뷰하지 못한 것(couldn't-review) 목록과 사유

### R.5 진행 규칙

- 브랜치: `codex/work-order-007-taskr`, base=main, PR 1건 (보고서 9개 파일).
- 페르소나별로 커밋을 나눠라 (진행 과정 추적 가능하게).
- S1 발견 시 PR 완성을 기다리지 말고 **즉시 발행 이슈 댓글로 선보고**.
- 완료 보고: 발행 이슈 댓글 — "PR 업로드, 리뷰 대기"까지만 (규칙 7).
- 이 리뷰 결과는 총책임자의 다음 로드맵 기획의 직접 입력이 된다. 발견의 질이 로드맵의 질을 결정한다.

---

## 3. 보고 형식 요약

| 태스크 | 브랜치 | 산출물 | 보고 |
|---|---|---|---|
| 006-A 재개 | codex/work-order-006-taska | JOURNAL_DELIGHT_AND_DECORATION_SPEC.md | PR + 이슈 댓글 |
| 006-B 재개 | codex/work-order-006-taskb | LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md | PR + 이슈 댓글 |
| 006-C 재개 | codex/work-order-006-taskc | FEDERATED_ACCOUNT_SSO_CONTRACT.md | PR + 이슈 댓글 |
| 006-D 재개 | codex/work-order-006-taskd | specs/reconstruct/README.md 갱신 | PR + 이슈 댓글 |
| **007-R 리뷰** | codex/work-order-007-taskr | reports/review/ORDER_007_R_*.md ×9 | PR + 이슈 댓글 (S1은 즉시 선보고) |
