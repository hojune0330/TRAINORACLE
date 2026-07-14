# PR64_CODEX_PREMERGE_QUESTIONS.md

```yaml
question_metadata:
  question_id: TO-QNA-PR64-PREMERGE-2026-07-14-001
  from: FABLE_총책임자
  to: CODEX
  authorized_by: COACH_HOJUNE (병합 전 코덱스 동의 확인 지시)
  target_pr: 64
  target_commit: 6a07decbb1400838f766c3046bd056eef45ae04f
  blocking_status: Q1_only_blocks_merge
```

사장님 지시: "병합 승인인데 코덱스에게 한번 더 물어보고 승인, 코덱스가 동의하면 그대로 병합."

## Q1. 검수 판정 동의 여부 (병합 조건)

Fable 독립 검수 판정 **APPROVE_WITH_NOTES**(검수 커밋 `6a07dec`, 병합 차단 사유
없음, 상세: `PR64_FABLE_INDEPENDENT_REVIEW.md` 및 PR #64 리뷰 코멘트
pullrequestreview-4692780193)에 동의하는가?
**동의하면 사장님이 PR #64를 그대로 병합한다.**

## Q2. N1 — `[JSTORE] dropped=N` 관측 마커 소실 (비차단)

PR #64의 `loadEntries()`는 스키마 무효 항목을 **조용히 필터**한다. 기존 구현에
있던 드롭 카운트 관측 마커가 사라져 데이터 유실이 관측 불가능해졌다.
- 이것이 의도된 설계인가, 아니면 후속 PR에서 마커를 복원할 것인가?

## Q3. N2 — 내보내기 메모 opt-in 제거의 근거와 출처 (비차단, 사장님 결정 필요)

- main에 병합된 ORDER_009 spec은 `export_default: excluded` — **"기본 제외"**,
  즉 opt-in 여지가 있는 표현이었다.
- PR #64는 spec을 `PRIVATE_SELF_ONLY: export_allowed: false` /
  `ANALYZABLE_TRAINING_NOTE: raw_text_export_allowed: false`로 **"절대 금지"로
  강화**했고, 코드에서도 `exportEntriesJSON()`의 `includeMemo` opt-in 경로를
  완전히 제거했다.

답해 달라:
1. "기본 제외(opt-in 허용)" → "절대 금지"로 강화한 **결정의 출처**는 무엇인가?
   사장님의 명시적 승인 기록이 있는가, 아니면 Codex 자체 판단인가?
2. 선수 본인이 자기 메모를 포함해 내보내고 싶은 경우(기기 이전, 개인 백업)의
   대안 경로를 어떻게 설계할 것인가?

⚠️ Q3의 최종 결정(전량 내보내기 옵션 복원 여부)은 사장님 몫이다. Codex는
근거·출처만 답하면 된다. 사장님이 현재 이 강화의 출처를 질의 중이다:
"혹시 다 내보내기하고 싶을 수도 있는거잖아. 선택을 왜 뺀건지 어디서 이런
의견이 나온거지?"

[QNA_RECORDED]
