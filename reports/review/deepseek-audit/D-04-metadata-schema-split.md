# D-04 — 문서 metadata 스키마 이원화 조사 (`spec_id` vs `doc_id`)

```yaml
packet: D-04
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 496      # git ls-files '*.md' 전체 (전체 스코프) · 2폴더 스코프 40
findings_total: 3
owner_decision_required: 1
```

## 실행한 명령

```bash
cd /home/user/webapp
grep -rln '^spec_id:' --include='*.md' . | sort            # 전체 spec_id 문서
grep -rln '^doc_id:'  --include='*.md' . | sort            # 전체 doc_id 문서
comm -12 <(grep -rln '^spec_id:' --include='*.md' . | sort) \
         <(grep -rln '^doc_id:' --include='*.md' . | sort)  # 둘 다
comm -23 <(grep -rln '^spec_id:' --include='*.md' . | sort) \
         <(grep -rln '^doc_id:' --include='*.md' . | sort)  # spec_id만
comm -23 <(grep -rln '^doc_id:' --include='*.md' . | sort) \
         <(grep -rln '^spec_id:' --include='*.md' . | sort)  # doc_id만
for f in specs/active/*.md specs/reconstruct/*.md; do
  grep -qE '^(spec_id|doc_id):' "$f" || echo "$f"
done                                                       # 둘 다 없는 2폴더 문서
grep -rn 'spec_id' --include='*.md' AGENTS.md TRAINORACLE_SPEC_INDEX.md \
  PRODUCT_NORTH_STAR.md WORK_ORDER_C_DOC_CLEANUP.md        # 규약 정의 문서 프로브
```

## 결과

### 1. 전체 스코프 (md 496건) — 이원화 전수

| 항목 | 결과 |
|---|---|
| `spec_id`만 | **7건** — 전부 `specs/reconstruct/` (ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL · CALENDAR_VERSION_AND_SYNC_CONTRACT · FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT · FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT · FORMATION_RECORD_GOVERNANCE_CONTRACT · HUMAN_REVIEW_AND_SHARING_WORKFLOW · NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT) |
| `doc_id`만 | **13건** — 전부 작업지시서/마스터플랜/게이트 계열 (CODEX_WORK_ORDER_001~003 · FABLE_CODEX_JOINT_PLANNING_BRIEF · LAUNCH_READINESS_2026-07-25 · SERVICE_DEVELOPMENT_MASTER_PLAN · WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT · WORK_ORDER_PM_QUALITY_GENERATOR_C3A · WORK_ORDER_SLOT_INTENSITY_FULL_RUN · WORK_ORDER_SLOT_TYPE_EXTENSION_B · WORK_ORDER_TRAINING_TIME_QUESTION_C3A0 · docs/ACCOUNT_PUBLIC_RELEASE_GATE · reports/review/PR118_C_PUBLIC_RELEASE_AUDIT_2026-07-26) |
| 둘 다 | **30건** (SPEC_* 루트 문서 18 · specs/active 5 · specs/reconstruct 7 · TRAINORACLE_SPEC_INDEX — 목록은 아래) |
| 둘 다 없음 (specs/ 한정) | **21건** (specs/active 4 · specs/reconstruct 17) |
| 규약 정의 문서 | **미발견** |

**패턴 관찰 (사실 수집 — 판정 아님):** `spec_id`만 쓰는 문서는 전부 `specs/reconstruct/`(재구성 계약), `doc_id`만 쓰는 문서는 전부 루트 작업지시서/계획/게이트 문서다. `TRAINORACLE_SPEC_INDEX.md:3-4`는 `doc_id:`와 `spec_id:`를 **둘 다** 1줄 간격으로 갖는다(공존 예).

### 2. 2폴더 스코프 (active 9 + reconstruct 31 = 40) — §3.3 재현

| 항목 | §3.3 v1.1 기준값 | 본 실측 | 일치? |
|---|---:|---:|---|
| `spec_id` 쓰는 문서 | 19 | 19 (spec만 7 + 둘다 12) | ✅ |
| `doc_id` 쓰는 문서 | 12 | 12 (둘다 12) | ✅ |
| 둘 다 | 12 | 12 | ✅ |
| 둘 다 없음 | 21 (비교 대상 아님) | 21 | ✅ |

### 3. 규약 정의 문서 조사

- `AGENTS.md:243` — "문서 식별자 규약 | `spec_id`(19)와 `doc_id`(12) **공존** | **어느 쪽이 규약인지 정의 문서 미발견**" (선행 감사자도 동일 결론 기록)
- `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:154` — "`spec_id`(19)와 `doc_id`(12)가 공존한다. **어느 쪽이 정본 규약인지 문서화돼 있지 않다.** → D-04"
- 프로브 대상(AGENTS.md · TRAINORACLE_SPEC_INDEX.md · PRODUCT_NORTH_STAR.md · WORK_ORDER_C_DOC_CLEANUP.md)에서 **두 식별자의 우선순위/용법을 정의한 문장을 찾지 못했다.** TRAINORACLE_SPEC_INDEX.md는 값 자체(`spec_id: TRAINORACLE.SPEC_INDEX`)만 갖고 규약 설명은 없다.

## 발견 요약

| # | 발견 | 근거 |
|---|---|---|
| 1 | **규약 정의 문서 미발견** — spec_id/doc_id 중 어느 쪽이 정본인지 공식 정의 없음 | AGENTS.md:243 · WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md:154 · 전역 프로브 |
| 2 | **용법 패턴 분리**: spec_id만 = 재구성 계약 7건, doc_id만 = 작업지시서/마스터플랜 13건 | 위 목록 |
| 3 | **§3.3 재현 성공**: 2폴더 spec_id 19 / doc_id 12 / 둘다 12 — v1.1 기준값과 정확 일치 | 집계 명령 |

## 조사하지 못한 것과 이유

1. **각 문서에서 spec_id/doc_id 값의 형식 규칙**(점/하이픈 구분자, 대소문자) 전수 대조 — 이 패킷의 목적은 "어느 쪽이 규약인가"이며 형식 규칙은 D-01(규칙 ID) 범위와 겹치므로 이중 조사를 피했다.
2. **두 식별자의 값이 서로 충돌하는지(같은 개념에 다른 값)** — "충돌" 정의가 먼저 필요하고 그것은 규약 문서가 있어야 판정 가능하다. 규약이 없으므로 조사 불가 → OD-REQ로 이관.

---

## §14 오너 결정 요청 항목 (OD-REQ)

### OD-REQ-D04-001. 문서 식별자 규약(`spec_id` vs `doc_id`)을 어느 한쪽으로 통일/문서화할 것인가

- **사실:** 전체 md 496건 중 spec_id만 7건(전부 specs/reconstruct), doc_id만 13건(전부 작업지시서/계획), 둘 다 30건. AGENTS.md:243 "어느 쪽이 규약인지 정의 문서 미발견".
- **왜 내가 결정하지 않는가:** 식별자 규약은 이 저장소 전체 문서 체계의 기반이며, 기계 검증(스키마 검사·고아 ID 검사)의 입력이 된다. 감사자(verdict_authority: NONE)는 어느 쪽이 "맞다"고 판정할 권한이 없다.
- **선택지 A:** `spec_id`를 정본으로 문서화하고 doc_id는 레거시/보조로 이관 → 결과: reconstruct 계열 7건을 spec_id로 통일, 작업지시서 13건에 spec_id 부여 필요(마이그레이션 작업 발생)
- **선택지 B:** `doc_id`를 정본으로 문서화 → 결과: spec_id만 쓰는 reconstruct 7건에 doc_id 부여 필요, 기존 OI-* 스펙 식별(TRAINORACLE.XXX 점 구분자) 체계와 정렬 필요
- **어느 문서를 함께 봐야 하나:** AGENTS.md(문서 식별자 규약 행) · TRAINORACLE_SPEC_INDEX.md(공존 예) · SPEC_DOCUMENTATION_REPORT.md · WORK_ORDER_C_DOC_CLEANUP.md
