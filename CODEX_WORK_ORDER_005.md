# CODEX_WORK_ORDER_005.md

```yaml
work_order_metadata:
  order_id: CODEX_WORK_ORDER_005
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-10"
  supersedes: CODEX_WORK_ORDER_004 (완료)
  decision_basis: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md
  branch_pattern: codex/work-order-005-task{N}
  report_channel: 본 지시서를 발행한 GitHub 이슈 댓글
```

---

## 0. 불변 규칙 (전 지시서 계승 + 유지)

1. 로컬 파일이 진실이다. 존재하지 않는 파일 내용을 추정해 작성하지 않는다.
2. 안전 불변식 변경 금지: D9_ACTIVE→BLOCK, D9_UNKNOWN→BLOCK_OR_HUMAN_REVIEW, CLEARED 하 advisory only(제4처분 신설 금지), 평가기 실패→UNKNOWN fail-safe.
3. §8 memo_policy: 원문 자유텍스트 서버/감사 영속 금지.
4. namespace 규율: `CYCLE_DAY.D-*` / `RULE_SPEC_D1_D9.D-*` / `LEGACY_PHASE_D.D-*` 혼용 금지.
5. 런타임 증거 없이 어떤 open-issue도 OPEN→CLOSED 전환 금지.
6. canonical 승격, ACCEPTED 판정 자기 부여 금지.
7. 완료 보고는 "PR 업로드, 리뷰/병합 대기"까지만 주장.
8. 모든 디자인 파일 수정 금지.
9. **`app/` 디렉토리 수정 금지** (총책임자 전담).
10. 기존 스펙 패치 시 `patched_from: <소스 문서>` 주석 필수 + 패치 후 해당 문서 open-issue 테이블 재계수·선언 수치 갱신.
11. 수식 구현 금지: `METRIC_ALGORITHM_CONTRACT.md` §6 Draft Formula Set은 수용 유보(Round 4 N2, Round 5 §4 재확인). 수식을 코드·타 문서로 전파하지 않는다.
12. **[신규] 구(舊) 킷 참조 금지**: Round 5 처분 결정에 따라 `ui_kits/trainoracle-app/*`은 아이디어 소스로만 존재한다. 이번 지시의 어떤 산출물도 구 킷 파일을 구현 소스로 인용·복제하지 않는다.

---

## 1. Task A — 외부 기록 연동 계약 초안: 애슬리트타임 PB/SB (P1, 신규 스코프)

**산출물**: `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md` (신규)

배경: 사용자·총책임자 결정으로, 시즌기록(SB)·개인 최고기록(PB)은 외부 서비스
"애슬리트타임(AthleteTime)"에서 연동하는 방향을 전제로 개발한다. 현재 앱
Trends의 PB/SB 표는 데모 값이다. 연동 **계약 초안**을 작성하라 (구현 아님):

- **데이터 범위**: 종목별 PB/SB(종목 코드, 기록값, 수립 일자, 대회명/장소는 선택),
  그 외 필드는 명시적 제외 목록으로. 훈련 데이터·통증 데이터·메모는 어떤 방향으로도
  애슬리트타임과 교환하지 않는다 (수신 전용, one-way inbound 원칙 명문화).
- **동의 모델**: 선수(미성년 가능성 포함 — 보호자 동의 여부는 open-issue로 기록)와
  코치의 연동 동의·해제 절차, 동의 상태의 감사 기록 필드.
- **취득·표시 방식**: fetch 방식 후보(수동 가져오기 / 주기 동기화 / 딥링크 조회)를
  옵션 비교로 제시하고 권고 1안 명시 (결정은 총책임자). 표시 시 출처 배지
  (`source: athletetime`, 조회 시각, 신선도 상태) 필수 계약.
- **기존 정책과의 정합성**: `OI-PORP-EXTERNAL-LLM-POLICY-001`(외부 LLM 전송 금지)과
  MEDIA 스펙의 외부 전송 경계에 저촉되지 않음을 절로 명시 — 외부 기록 **수신**은
  LLM 전송이 아님을 구분하되, 수신 데이터에 자유텍스트가 섞여 들어올 경우
  §8 memo_policy 적용 경로(구조화 필드만 영속) 명문화.
- **실패·불일치 처리**: 외부 조회 실패 시 기존 로컬 값 유지 + stale 배지;
  로컬 수기 입력값과 외부값 충돌 시 어느 쪽도 자동 덮어쓰기 금지, 충돌 표시 후
  사람(코치/선수) 확인으로만 해소.
- **안전 경계**: 외부 기록은 어떤 경우에도 D9/Safety Gate 처분에 입력되지 않는다
  (`can_affect_safety_disposition: false`).
- open-issue 테이블 신설: 최소 API 실재성(애슬리트타임에 공개 API가 있는지 미확인 —
  확인 전 구현 착수 금지), 보호자 동의, 동기화 주기 결정을 OPEN으로 기록.
- 문서 지위는 `DRAFT_FOR_REVIEW`. ACCEPTED 자기 부여 금지 (규칙 6).

## 2. Task B — 훈련 구성 균형 기준 계약 초안 (P1, 트리거 Round5 T5-3)

**산출물**: `specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md` (신규)

배경: 앱 Trends에 기간별 구성(강도 분포·거리 증가율)의 부족/과다를 가볍게
표시하는 UI가 들어간다(총책임자 구현, `기준: 데모` 배지 부착 상태). 이 표시의
**기준값 계약 초안**을 작성하라:

- **기준의 근거 구조**: 각 기준(예: 저강도 비중 권장 범위, 주간 거리 증가율 상한,
  고강도 합산 비중 상한)마다 `basis` 필드로 근거 유형을 명시
  (`coach_policy` / `published_guideline_reference` / `placeholder_demo`).
  근거 없는 수치를 확정값처럼 쓰지 않는다 — 미확정이면 `placeholder_demo`로 남긴다.
- **기간 축 차등**: 주간/월간/시즌 각각에서 어떤 기준이 유효·무효인지 표
  (예: 거리 증가율은 주간에서 의미, 시즌 단위에선 다른 해석).
- **선수 수준 차등**: 최소한 `athlete_level` 파라미터(입문/육성/경기력) 자리를
  계약에 두고, 수준별 기준값 차이는 open-issue로 기록 (수치 확정은 코치 몫).
- **안전 무권한 조항(필수)**: 이 기준은 참고 표시 전용이다.
  `is_safety_authority: false`, `can_block_training: false`,
  `can_clear_D9_or_Safety_Gate: false`를 계약 최상단에 명시.
  "과다" 표시가 훈련을 막지 않고, "균형" 표시가 통증 차단을 풀지 않는다.
- **표시 계약**: 상태는 3값(`below_range` / `in_range` / `above_range`)만.
  in_range는 마커 없음(침묵). 근거가 `placeholder_demo`인 동안 UI는
  `기준: 데모` 배지를 유지해야 한다는 요구를 계약에 기록.
- **METRIC 경계**: 규칙 11 준수 — 기준값 비교는 METRIC §6 수식과 무관한
  단순 비율/합산 수준으로 한정하고, CTL/ATL/TSB 등 유보 수식을 끌어오지 않는다.
- open-issue 테이블 신설: 기준 수치 확정(코치 승인 필요), 수준별 차등,
  근거 문헌 검증을 OPEN으로 기록. 문서 지위 `DRAFT_FOR_REVIEW`.

## 3. Task C — 인덱스·현황 소폭 갱신 (P3)

**대상**: `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`

- Round 5 결정문·ORDER_005 발주 사실 반영. PR #28/#30/#31/#32 상태를 `MERGED`로 갱신 (Round 5 노트 N5-1 이행).
- Task A·B 신규 문서를 인덱스에 `DRAFT_FOR_REVIEW`로 등재.
- 재계수 원칙 유지: 선언 수치가 바뀌면 근거 계수를 PR 본문에 첨부.

---

## 4. 실행·보고 절차

- 순서: Task A와 B는 상호 독립 — 병렬 가능. Task C는 A·B PR 업로드 후.
- Task별 개별 브랜치(`codex/work-order-005-task{N}`, N=A→1, B→2, C→3)·개별 PR.
- PR 본문에 신규 문서 요약표 + open-issue 계수 필수.
- 완료 보고는 이 지시서를 발행한 GitHub 이슈에 댓글로. 상태는 "PR 업로드, 리뷰/병합 대기"까지만 주장.

## 5. 명시적 범위 제외

- `app/` 및 모든 디자인 파일 수정 (규칙 8·9).
- 애슬리트타임 연동의 실제 구현·API 호출 코드 (계약 초안만).
- 균형 기준 수치의 확정 (코치/총책임자 몫 — `placeholder_demo`로 남긴다).
- METRIC §6 수식의 코드·문서 전파 (규칙 11).
- `ui_kits/trainoracle-app/*` 파일의 이동·수정·삭제·구현 인용 (규칙 12).
- 어떤 open-issue의 CLOSED 전환, canonical 승격, ACCEPTED 자기 부여.
- 외부 LLM 정책 변경, 안전 처분 체계 변경.

[ORDER_COMPLETE]
