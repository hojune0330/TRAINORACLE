# Formation: Read Now, Decide Later

```yaml
prior_product_direction_status: SUPERSEDED_PRODUCT_DIRECTION
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
product_identity: 9_5_DAY_FORMATION
target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
current_runtime: NOT_ENABLED_PENDING_NAMED_GATES
runtime_summary: no active runtime before named gates
```

> 최신 제품 방향은 [latest owner baseline](reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md)을
> 따른다. 적격 입력에는 결정론적 기본 9.5일 계획 하나를 먼저 선택하는 것이 목표다.
> 실행 확인, 코치 검토·수정, 예외 처리는 선택과 별개이며 현재 runtime은 열리지 않았다.

> **오늘 훈련은 바뀌지 않습니다.**
>
> TRAINORACLE는 지금 일지를 저장하고 추이를 보여 줍니다. Formation의 기본 계획 선택은 제품 방향으로 정해졌지만 아직 실행되지 않습니다. 이름이 지정된 안전·개인정보·사람 검토 gate가 통과되기 전에는 훈련을 지시하거나 일정을 바꾸지 않습니다.

```yaml
status: REVIEW_DRAFT_ONLY
current_runtime: NOT_ENABLED
source_documents:
  - TRAINING_PLAN_METHOD_DECISION.md
  - specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md
```

## What Is Already Decided

| Topic | Current decision |
|---|---|
| Product identity | `9_5_DAY_FORMATION`. The initial runtime pilot remains separately gated. |
| Frame idea | A 9.5-day local-time frame; the 7-day calendar is only a display. |
| MAIN idea | A frame may contain two or three MAIN exposures. A race counts once. Missed MAIN work is never automatically squeezed in later. |
| Complex training | One day can hold several components. The draft must not pretend that every session is only one kind of work. |
| Default selection | Eligible input yields exactly one deterministic primary 9.5-day plan. Execution confirmation, coach review/edit, and exceptions are separate from selection. |
| No eligible candidate | `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`. |
| Private writing | `PRIVATE_SELF_ONLY` is never used for analysis or planning. Raw training-note text is not a plan input. |

These are boundaries for a future pilot, not a formula that has been proven for every athlete.

## What Shadow Mode Would Mean Later

Shadow mode means the app quietly makes a **draft comparison** while the coach keeps using the normal process. The athlete knows it is happening, knows which structured data categories are used, can stop participating, and sees that the draft does not control today's training.

It may later show simple progress such as completed check marks, frame milestones, or non-coercive stickers. It must never reward more training, faster training, hiding pain, or staying enrolled.

Shadow mode is **not turned on now**.

## Before Anything Can Run

1. The coach must approve the actual rule set: recovery, missed MAIN handling, race/taper exceptions, mixed-session treatment, and frame boundaries.
2. The source contracts must protect privacy and safety: only eligible structured data, no raw private notes, clear consent/withdrawal, and a safe opaque handling of note-derived risk.
3. The pilot must define what is being observed, when it stops, who watches it, and what would count as useful without claiming safety or effectiveness first.
4. Only after those decisions can a small, non-executing vertical slice be considered. A separate decision is still required before a real pilot.

## What This Page Does Not Promise

- no active Formation or plan runtime before the named gates pass;
- no injury, fatigue, readiness, safety, or performance prediction;
- no claim that default selection authorizes execution or bypasses coach review/edit and exceptions;
- no server sync, sharing, reward program, or account activation;
- no evidence that 9.5 days is the right answer for everyone.
