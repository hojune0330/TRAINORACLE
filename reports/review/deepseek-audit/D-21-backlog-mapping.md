# D-21 — 백로그 `B-NN` ↔ `OI-*` 매핑 대조

```yaml
packet: D-21
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: `INCOMPLETE_WORK_BACKLOG.md`에 `OI-*` 참조 **0건** — 백로그 자체에 OI 매핑 컬럼이 없다. B-01~B-18 중 **매핑 존재 8건**(S-1~S-6 재편 6건 + 확정 인용 2건), **매핑 없는 6건**(B-05·B-06·B-07·B-08·B-09·B-10 = "언제 끝났다고 볼지 아무도 모르는 작업"), 완료 3건(B-01·B-02·B-04)은 PR/결정 기준으로만 매핑.

## 1. 방법

지시서 §12 D-21(L971~987)에 따라: (1) `INCOMPLETE_WORK_BACKLOG.md`의 B-01~B-18 전 항목 제목·상태·완료 조건 추출, (2) 백로그 내 `OI-*` 참조 전수 grep(`grep -nE 'OI-[A-Z0-9-]+'` = **0건**), (3) 대응 스펙/오너결정을 백로그 본문 필드("출처", "완료 조건")와 스펙 실재 OI 인덱스에서 대조, (4) 확정 인용 2건(B-17, B-12)은 재조사 없이 인용.

**백로그 내 OI 참조 실측:**

```bash
cd /home/user/webapp
grep -nE 'OI-[A-Z0-9-]+' INCOMPLETE_WORK_BACKLOG.md | wc -l   # → 0
grep -ohE '\bB-[0-9]{2}\b' INCOMPLETE_WORK_BACKLOG.md | sort -u  # → B-01..B-18 (18종)
```

## 2. B-01~B-18 매핑 대장

| B-NN | 제목 | 대응 OI | 대응 스펙 | 대응 오너결정 | 매핑 상태 |
|---|---|---|---|---|---|
| B-01 | UX2 §2~§4 코드 구현 (PR #181) | 없음 | `WORK_ORDER_UX2` §7 | 없음 | ✅ 완료 — 자체 완료조건(§7 grep+테스트) 통과, OI는 미사용 |
| B-02 | UX2 §8-10 경로 B 확정 | 없음 (v0.1 DSB-INV-002·003은 은퇴) | `WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` | OD-SLOT-1·2·7 (2026-08-06) | ✅ 완료 — 은퇴·교체로 스펙-코드 반대말 해소 |
| B-03 | PR #182 본문 "안 된 것" 5건 | 없음 | PR #182 | 없음 | ⚠️ 부분 완료 — Q4 화면 층은 B-12로 분리 |
| B-04 | PR #180 decoration-safety-followup | 없음 | PR #180 | 없음 | ✅ 완료 — main 머지(`d670c23`) |
| B-05 | UX2 §8-11 이동 후 재계획 UI | 🔴 없음 (후보: `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` — fresh 재생성·프레임 연속성만 부분 접촉, UI 자체와는 무관) | `WORK_ORDER_UX2` §8-11 · §8-7 | 없음 | ❌ 미구현 — **매핑 없음** |
| B-06 | UX2 §8 달력 그리드 (9.5-Cycle 캘린더) | 🔴 후보: `OI-DSB-CALENDAR-CROSSWALK-001` (로컬 AM/PM → DOUBLE/FLEX 크로스워크 — 그리드와 별개 함수) | `WORK_ORDER_UX2` §8-3(1)·§8-6 | 없음 | ❌ 미구현 — **매핑 없음** (후보만 존재, 레지스트리 연동 없음) |
| B-07 | D-01 AI 코치 본체 | 🔴 없음 | README "AI 코치 장호준" · UX2 §6 | 없음 | ❌ 미착수 — **매핑 없음** |
| B-08 | D-09 잔여 접근성 + D-11 엔진 배선 | 🔴 없음 | `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | 없음 | ❌ 미착수 — **매핑 없음** |
| B-09 | 30개 DRAFT 수치 템플릿 활성화 | 🔴 후보: `OI-DSB-TEMPLATE-ELIGIBILITY-001` (템플릿 자격 — 활성화와 동일한 관문 성격, B-09와 별개로 등록) | DRAFT·REVIEW_REQUIRED 정책 | ⛔ 활성화 금지 (`canonical_promotion_allowed: false`) | ⛔ 결정 대기 — **매핑 없음** |
| B-10 | Formation 보호 대상 목록 | 🔴 없음 | `FORMATION_DEFERRED_GOALS.md` | ⛔ 게이트 대기 (`*_BLOCKED`/`*_DEFERRED`) | ⛔ 결정 대기 — **매핑 없음** |
| B-11 | §4-1 LogDetail 접근성 | 🔴 없음 (D-17 대상과 일부 중첩) | `WORK_ORDER_UX2` §4-1 · 통합 지시서 §5 | 없음 | ❌ 미완 — **S-5로 통합 발행됨** (지시서 매핑 존재) |
| B-12 | Q4 계정 잠금 해제 화면 | 🔴 없음 | PR #182 Q4 | 없음 | ❌ 범위 밖 — **확정 인용:** 계정 잠금 해제 화면 (`releaseSyncOwner()` 호출 0건 실측은 백로그 :117) |
| B-13 | leaf `sessions` (day,slot) 유일성 | `DSB-INV-004` (leaf refine 부재 — 저장 관문 `plan-beta-schema.ts:76-82`에만 존재) | `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` | 없음 | ❌ 미수정 — **S-6로 통합 발행됨** |
| B-14 | 생성기 오전 고정 해제 (S-2) | `DSB-INV-002`(QUALITY PM 허용) · `DSB-INV-005`(상한 영향 — S-2 반대편 카운터파트가 상한 초과 71%) | `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` · `OI-DSB-FRAME-LOAD-CAP-001` | OD-SLOT-1·2 (2026-08-06) | ❌ 미착수 — S-2, S-1 선행 필수 |
| B-15 | 저장 관문 PM 제약 (S-3) | `DSB-INV-003` (하루 QUALITY 2회 = 명시 지정 + DSB-INV-009 충족 시에만) | 통합 지시서 §4 (G-1~G-10) | OD-SLOT-2·3 · C-4/C-5/C-8/C-9 | ❌ 미착수 — S-3 |
| B-16 | 화면 문구 거짓 약속 (S-4) | 없음 (D-17 거짓 약속과 동일 주제, 별도 OI 없음) | 통합 지시서 §4.8 · `PlanIntake.tsx:201` | OD-SLOT-7 · C-6 | ❌ 미착수 — S-4 |
| B-17 | OD-SLOT-6 계획 수정·최종확정 플로우 | **`DSB-INV-009` — 스펙 수준 전제조건 (확정 인용, C-3·C-4)** | DSB 계약 §(DSB-INV-009) | OD-SLOT-6 · OD-SLOT-8 (2026-08-06) | ❌ 미착수 — 통합 지시서 범위 밖(§12), B-17 전까지 하루 QUALITY 2회는 저장 관문 거부 유지 |
| B-18 | S-1 훈련 시간대 질문 | 🔴 없음 (OD-SLOT-1 실현의 선행 근거 — OI는 별도 미등록) | `WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md` | OD-SLOT-1 (2026-08-06 오너 승인) | ❌ 미착수 — **S-1로 통합 발행됨** |

## 3. 핵심 발견

1. **백로그 파일에 `OI-*` 참조가 0건** — 레지스트리 자체가 "제목·상태·완료 조건" 3컬럼 구조이고, OI·스펙·오너결정을 가리키는 열이 없다. 지시서 출력 형식(`| B-NN | 제목 | 대응 OI | 대응 스펙 | 대응 오너결정 | 매핑 상태 |`)의 컬럼 대부분은 백로그 밖(스펙 본문, 결정 문서)에서 재구성해야 한다.
2. **🔴 매핑 없는 6건 = "언제 끝났다고 볼지 아무도 모르는 작업"**: B-05(재계획 UI), B-06(달력 그리드), B-07(AI 코치), B-08(RVE 배선), B-09(템플릿 활성화), B-10(Formation). 이 중 B-09는 `OI-DSB-TEMPLATE-ELIGIBILITY-001`, B-06은 `OI-DSB-CALENDAR-CROSSWALK-001`이 **성격상 후보**지만 레지스트리에 연동돼 있지 않아 "완료 판정"의 근거가 없다.
3. **완료 3건(B-01·B-02·B-04)도 OI 기준이 아닌 PR/결정 기준으로만 매핑** — "완료"의 의미가 항목마다 다르다(PR 머지 / 오너 결정 반영 / 자체 검증 통과). B-01의 "§4-1 LogDetail 완료" 표시가 B-11 발굴로 반증된 사례(백로그 :255 교훈)가 이를 증명한다.
4. **S-1~S-6 재편 6건(B-18·B-14·B-15·B-16·B-11·B-13)은 지시서로 매핑이 존재** — "백로그 표시가 아니라 고정 좌표 명세"라는 제2의 매핑 체계가 생겼다. 이 6건은 D-21의 🔴 대상이 아니다.

## 4. OD-REQ (결정 요청)

### OD-REQ-D21-001 — 매핑 없는 6건의 "완료 판정 기준" 부재 (B-05·B-06·B-07·B-08·B-09·B-10)
- **사실**: B-05·B-06·B-07·B-08·B-09·B-10은 `OI-*` 매핑이 없고, 완료 조건이 "오너 결정/게이트 대기" 또는 자체 §검증에만 의존한다. 이 6건이 끝났는지 판정할 「열 수 있는 문서 한 군데」가 없다.
- **왜 내가 결정하지 않는가**: 완료 조건의 소유권은 각 항목의 작업지시서 발행자·오너에게 있고, 감사자는 판정 권한이 없다(verdict_authority: NONE).
- **선택지 A**: 매핑 6건 각각을 후보 OI(D-21 §2 참조)와 명시적으로 연동해 백로그에 "대응 OI" 컬럼을 추가하고, 완료 조건을 OI 상태로 바꾼다.
- **선택지 B**: 6건을 "별도 작업지시서로 승격하지 않는 한 OPEN 유지"로 고정하고, 오너가 우선순위를 정할 때까지 B-NN 상태 표시만 남긴다.
- **어느 문서를 함께 봐야 하나**: `INCOMPLETE_WORK_BACKLOG.md`(B-05~B-10), D-19(OI 상태 미표기 91건), `FORMATION_DEFERRED_GOALS.md`(B-10), `RVE_RULE_EVALUATOR_BINDING_SPEC.md`(B-08).

## 5. 인용·판정 누수 점검

- 확정 인용 2건만 재조사 없이 사용: **B-17 = DSB-INV-009 스펙 수준 전제조건 승격(C-3, C-4)**, **B-12 = 계정 잠금 해제 화면**. 둘 다 백로그 본문·DSB 계약 §7 문구와 일치 확인 후 인용.
- "매핑 없음" 판정은 백로그 내 OI grep 0건 + 스펙 실재 OI 인덱스 대조(DSB 계약 4건, PLAN_GENERATOR_SPEC 7건)의 양방향으로 검증 — 스캔 누락이 아니다.
- B-09·B-06의 후보 OI는 "성격상 후보"로만 표기하고 레지스트리 연동 여부는 🔴로 구분해 단정하지 않음.
- 매핑 분류는 4가지(✅ 완료/⚠️ 부분/❌ 미완류/⛔ 결정 대기) + "S-N 발행"을 별도 표기 — B-11~B-18 재편분을 🔴 매핑 없음으로 몰지 않음.

## 6. 재현 명령

```bash
cd /home/user/webapp
grep -nE '^### B-[0-9]{2}' INCOMPLETE_WORK_BACKLOG.md          # B-01~B-18 헤더·상태
grep -nE 'OI-[A-Z0-9-]+' INCOMPLETE_WORK_BACKLOG.md | wc -l    # → 0 (핵심 발견)
grep -ohE '\bB-[0-9]{2}\b' INCOMPLETE_WORK_BACKLOG.md | sort -u  # → 18종
```
