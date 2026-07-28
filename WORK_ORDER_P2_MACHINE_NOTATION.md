# WORK_ORDER_P2 — 카탈로그에 기계용 표기 추가

```yaml
work_order:
  id: WORK_ORDER_P2
  issued_by: TOTAL_RESPONSIBILITY_HOLDER
  issue_date: "2026-07-27"
  decision_basis:
    - PERSONAL_PACE_DECISION_2026-07-27.md (오너 결정 4·6)
  선행필독:
    - PRODUCT_NORTH_STAR.md
    - PERSONAL_PACE_DECISION_2026-07-27.md
  branch: codex/work-order-p2-machine-notation
  선행조건: 없음 — P1과 병행 가능
  대상작업자: 문서 작업 에이전트 (토큰 중간)
  코드수정: 금지
```

---

## §0-Z 공격 리뷰 결과 — 🔴 치명 1 · 중대 1 · 보통 2 (D1~D4)

**리뷰:** [`reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md`](./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md) · 2026-07-28

**착수 금지.** §5 의 검증(`PARSE` 나오면 통과)은 **틀린 값에도 통과한다** —
회복 150초를 `r1″` 로 잘못 옮긴 표기도 PARSE 된다. 즉 §2 가 보장한다는
단위 변환의 정확성을 §5 는 전혀 검증하지 않는다. §5 의 `npx tsx` 는
`impl/package.json` 에 없는 실행기다.

**착수 전 반드시 위 리뷰의 §0-A(결함표)·§0-B(고칠 것)를 읽고 지시서를 먼저 고친다.**

---

## 0. 이 작업의 성격

**문서 작업이다. 코드를 쓰지 않는다.**

카탈로그의 `notationPattern`은 **코치가 읽는 표기**다. 파서는 그걸 못 읽는다.
그래서 **기계가 읽을 표기를 옆에 추가**한다.

**원본은 절대 지우거나 고치지 않는다.** 오너 지침:

> "문서들은 정리하라는게 구분하고 실제 활용하기위한 작업을 하는 거지
> 지우거나 하라는 게 아니야"

## 1. 이미 조사된 사실 (다시 조사 금지)

카탈로그 30개 표기를 **전부 파서에 넣어 확인했다.** 결과는 아래가 정확하다.

### 1-1. 파서가 받는 유일한 형식

`impl/src/prescription/notation.ts:6`

```
[세트수×(] 반복수 × 거리m [)] @ 종목거리m RP [· r회복초″] [· R세트회복분′]
```

통과 예시 (**실제로 확인함**):

```
5×1000m @5000m RP · r150″
2×(10×400m) @5000m RP · r60″ · R3′
10×400m @5000m RP · r60″
```

### 1-2. 표기 유형별 분류 (실측)

| 유형 | 개수 | 기계 표기 가능? |
|---|---|---|
| 강도구역 (`@T`/`@I`/`@E`) | 13 | ❌ 종목거리가 없음 → **P4(환산 모델) 대기** |
| 강도 표기 없음 (스프린트·회복) | 13 | ❌ 해당 없음 |
| 경기 페이스 (`RP`) | **2** | ⭕ **이 작업의 대상** |
| 기타 (`@95% vVO2max` 등) | 2 | ❌ 모델 필요 |

**이 작업에서 기계 표기를 붙일 템플릿은 2개다.**

## 2. 작업 대상 — 정확히 2개

### 대상 1: `V2-SEED-05`

```yaml
notationPattern: "5×1000m @5K RP · r2′30″"    # ← 원본, 그대로 둔다
```

문제: `5K`(숫자+m 아님), `2′30″`(분·초 복합) → 파서 거부

추가할 필드:

```yaml
machineNotation: "5×1000m @5000m RP · r150″"
machineNotationBasis: "5K=5000m, 2′30″=150초 단위 환산만 적용. 훈련량 변경 없음."
```

**이건 단위 표기 변환일 뿐 훈련 내용을 바꾸지 않는다.** 5000m는 5K와
같은 거리이고, 150초는 2분 30초와 같은 시간이다.

### 대상 2: `GL-SEED-01`

```yaml
notationPattern: "3~4×500m @GOAL 1500m RP · r2~3′"   # ← 원본, 그대로 둔다
```

문제 셋:
1. `3~4` — **범위. 하나로 정해야 한다**
2. `r2~3′` — **범위**
3. `@GOAL` 접두어 — 파서 문법에 없음

**⚠️ 여기서 멈춘다. 범위값을 정하지 말 것.**

오너 결정 4: **범위는 오너·코치가 정한다. 코드도 작업자도 정하지 않는다.**

따라서 이 템플릿은 `machineNotation`을 **비워 두고** 이렇게 적는다.

```yaml
machineNotation: PENDING_OWNER_RANGE_DECISION
machineNotationBlockers:
  - "반복수 3~4 중 확정값 필요 (오너·코치 결정)"
  - "반복 회복 2~3분 중 확정값 필요 (오너·코치 결정)"
  - "@GOAL 표기 처리 방침 필요 — 목표기록 앵커는 2단 표시 대상(결정 2)"
```

> 왜 이렇게 하는가: `3~4`를 임의로 `3`으로 정하면 그게 훈련량 결정이다.
> 근거 없이 정한 훈련량은 근거 없는 처방이고, 선수에게 위험하다.
> **모른다고 적는 것이 틀리게 적는 것보다 낫다.**

## 3. 나머지 28개는 어떻게 하나

**아무것도 추가하지 않는다.** 대신 왜 못 하는지 사유를 남긴다.

```yaml
machineNotation: NOT_APPLICABLE_INTENSITY_ZONE   # @T/@I/@E 13개
machineNotation: NOT_APPLICABLE_NO_PACE_TARGET   # 스프린트·회복 13개
machineNotation: PENDING_CONVERSION_MODEL        # @95% vVO2max 등 2개
```

**이 표시가 P4(환산 모델)의 작업 목록이 된다.** 그래서 지우지 않고 남긴다.

## 4. 문서에 추가할 설명

카탈로그 §3(`Common field semantics`)에 새 필드 뜻을 적는다.

| 필드 | 뜻 |
|---|---|
| `notationPattern` | **코치가 읽는 원본 표기. 정본이다.** |
| `machineNotation` | 파서가 읽는 표기. 원본에서 단위만 환산한 것 |
| `machineNotationBasis` | 어떤 환산을 적용했는지 |
| `machineNotationBlockers` | 확정하지 못한 이유 (사람 결정 대기) |

**반드시 적을 문장:**

> `machineNotation`은 `notationPattern`을 대체하지 않는다. 원본이 정본이며,
> 둘이 어긋나면 원본이 이긴다. `machineNotation`은 단위 표기 환산만 허용하고
> 훈련량(반복수·거리·회복)을 바꾸지 않는다. 범위를 하나로 좁히는 것은
> 훈련량 결정이므로 사람의 승인 기록 없이 수행하지 않는다.

## 5. 검증 (필수)

`machineNotation`이 실제로 파서를 통과하는지 **직접 돌려서 확인한다.**
눈으로 보고 판단하지 말 것.

```bash
cd impl && mkdir -p tmpcheck && cat > tmpcheck/verify.ts <<'EOF'
import { parsePrescriptionNotation } from "../src/prescription/notation"
const cases = [
  "5×1000m @5000m RP · r150″",     // V2-SEED-05
]
for (const c of cases) {
  const r = parsePrescriptionNotation(c)
  console.log(r.kind === "parsed" ? "PARSE " : "REJECT", c)
}
EOF
npx tsx tmpcheck/verify.ts; rm -rf tmpcheck
```

**`PARSE`가 안 나오면 제출하지 않는다.**

## 6. 하지 말 것

- `notationPattern` 원본 수정·삭제 — **절대 금지**
- 범위값(`3~4`, `2~3′`)을 임의로 확정 — **금지** (오너 결정 4)
- `lifecycleStatus`를 `DRAFT`에서 바꾸기 — **금지** (P3/오너 승인 사항)
- `eligibilityStatus` 변경 — **금지**
- `minorAllowed` 변경 — **금지**
- `allowedEventGroups`·`allowedExperienceBands` 채우기 — **금지**
- 강도구역 표기를 페이스로 추정 변환 — **절대 금지** (환산 모델 미승인)
- 코드(`app/`, `impl/`) 수정 — **금지**
- 카탈로그 항목 삭제 — **금지**

## 7. 완료 기준

- [ ] `V2-SEED-05`에 `machineNotation` 추가, **파서 통과 확인됨**
- [ ] `GL-SEED-01`은 `PENDING_OWNER_RANGE_DECISION` + 블로커 3건 명시
- [ ] 나머지 28개에 사유 표시 추가
- [ ] §3에 새 필드 의미와 "원본이 정본" 문장 추가
- [ ] `notationPattern` 원본 30개가 **한 글자도 안 바뀜** (`git diff`로 확인)
- [ ] `lifecycleStatus`·`eligibilityStatus`·`minorAllowed` 변경 0건
- [ ] `app/`, `impl/` 변경 0건

원본 불변 확인:

```bash
git diff specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md \
  | grep "^-" | grep -E "notationPattern|lifecycleStatus|eligibilityStatus|minorAllowed"
# → 아무것도 안 나와야 한다 (지운 줄이 없어야 함)
```

## 8. 보고

`reports/review/WORK_ORDER_P2_REPORT.md`

- 추가한 필드와 그 근거
- 파서 통과 확인 결과 (실행 출력 붙일 것)
- **오너 결정이 필요한 범위값 목록** (P4 입력이 된다)
