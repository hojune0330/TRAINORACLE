# APPT-05 사람 문헌 선별·추출·평가 검토

```yaml
packet_id: TRAINORACLE_APPT_05_V1
status: READY_FOR_NAMED_REVIEWER
reviewer: UNASSIGNED
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

AI가 준비한 논문 선별·추출·비뚤림 평가를 실제 사람이 논문별로 확인한다. 연구 기록의
수용은 런타임, 처방, 정본 승격 또는 안전성 입증이 아니다.

## 먼저 읽을 원문

- `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`
- `reports/research/evidence/FORMATION_SCREENING_LEDGER.csv`
- `reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv`
- `reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv`
- `reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv`
- `specs/test-packages/formation-research-integrity.test.mjs`

## 검토자가 답할 질문

1. 각 `source_id`의 원문·정정·철회·중복 여부가 확인됐는가?
2. 포함·제외와 full-text/abstract 제한이 프로토콜과 일치하는가?
3. 두 AI 레인의 불일치가 사람 판정 없이 합의로 바뀌지 않았는가?
4. 추출 값·인용·대상군·결과 시점이 원문과 일치하는가?
5. 직접성·비뚤림·불확실성이 적절하게 기록됐는가?
6. `ABSTRACT_LIMITED`·간접 근거가 최종 주장으로 승격되지 않았는가?
7. 한 논문을 9.5일·72시간·안전·회복의 보편 근거로 과장하지 않았는가?

## Terra High 사전확인

- 선별 원장은 AI 레인과 `PENDING_HUMAN` 상태를 분리한다.
- 사람 검토 증명 원장은 헤더만 있고 사람 서명 행은 0개다.
- 자동검사는 임의의 `CONFIRMED` 텍스트만으로 수용되는 것을 거부한다.
- 사람 수용에는 자격 참조, 해시, 시간대, 서명과 신뢰 키가 필요하다.

## 사람이 남길 기록

```yaml
reviewer_id_and_legal_name: REQUIRED
qualification_ref_and_conflict: REQUIRED
review_type: SCREENING | EXTRACTION | APPRAISAL
source_ids_and_scope: REQUIRED
raw_and_canonical_sha256: REQUIRED
record_ref_key_id_and_ed25519_signature: REQUIRED
decision: APPROVE | REVISE | REJECT | UNRESOLVED
reviewed_at_with_timezone: REQUIRED
```

## 차단 조건

사람 확인이 `PENDING_HUMAN`이거나 자격·서명·해시가 없으면 수용하지 않는다. 원문 접근
한계를 넘는 추출, 미해결 충돌, AI 결과를 사람 수용으로 세는 행위도 차단한다.

[DRAFT_COMPLETE]
