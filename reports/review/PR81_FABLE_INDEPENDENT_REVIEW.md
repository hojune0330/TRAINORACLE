# PR81_FABLE_INDEPENDENT_REVIEW.md

```yaml
review_metadata:
  review_id: TO-REVIEW-PR81-FABLE-2026-07-18-001
  reviewer: FABLE_총책임자 (UX·접근성·app/ 영역 소유)
  reviewed_pr: 81
  reviewed_commit: 6acc26c9cf025b2b22b92bb33dcdaaef870cc409
  reviewed_branch: codex/formation-followup-research-plan
  base_at_review: f5d6bb1 (main)
  scope: 문서·검증기·회귀 테스트만 (154 files +23,675) — 연구 준비 패키지
  method: 금지 범위 전수 검증 + 검증기·테스트 독립 재실행 + 권한 경계 문서 검토
  verdict: APPROVE
  merge_blocker_found: false
  note: PR이 draft 상태 — 병합 전 ready 전환 필요
```

## 1. 금지 범위 검증 (가장 중요한 축) → **통과**
- 154개 변경 파일 전수 확인: `app/`·`impl/`·`.github/`·`d9-evaluator/`·런타임 스키마·
  마이그레이션·배포 변경 **0건**. 변경 위치는 `.omo/evidence`(90), `specs/test-packages`(24),
  `reports/research·review`(34), `.omo` 계획·장부(6)뿐.
- 수정(M)된 기존 파일은 3건뿐(.omo/boulder.json, ledger.jsonl,
  validate-formation-p1-target-plans.mjs) — 나머지 전부 신규 추가(A).

## 2. 검증기·테스트 독립 재실행 → **Codex 주장과 일치**

| Codex 주장 | 독립 재실행 결과 | 판정 |
|---|---|---|
| Node 회귀 테스트 28/28 | 5개 test.mjs 합계 **28 pass / 0 fail** (6+7+13+1+1) | ✅ |
| 준비 검증기 11/11 | validate-*.mjs 17개 전부 exit=0 (11개 formation 준비 + 기존 WO 검증기) | ✅ |
| 승인-상태 검증기 3/3 fail-closed | `--accepted` 모드에서 appraisal/screening/extraction **전부 exit=1** — "acceptance blocked pending_human=167" | ✅ |
| CI 통과 | 6acc26c check-runs: contract-tests success ×4 | ✅ |

- fail-closed 로직 코드 검토: `acceptedMode && pending>0 → error` — 사람 확인
  (human_confirmation=CONFIRMED + 서명 attestation) 없이는 승인 상태로 전환 불가.
  검증기 자체에 자동 승인·자기 승인 우회 경로 없음(attestation 헬퍼 grep 확인).

## 3. 권한 경계 검토 → **통과**
- 모든 protocol/report 헤더에 `runtime_authority: false`, `prescription_activation: false`,
  `medical_authority: false`, `scientific_optimality/safety: UNKNOWN` 명시.
- 승인 카운트가 문서에 정직하게 0으로 기록: canonical 인적 스크리닝 0/167, 보조 0/18,
  전문가 검토 0/6, 결정 패킷 0/3 (NOT_REVIEWED), P1 계획 승인 0/10.
- 원칙 명문화: "owner identity cannot upgrade evidence, establish safety, or bypass a
  rule-specific gate" — 9.5일 프레임은 제품 결정으로 기록될 뿐 과학적 최적·안전 주장 없음.
- 한국어 책임자 브리핑(FORMATION_RESEARCH_OWNER_BRIEF_KO.md)이 "연구가 지지하지 않는 것"
  (72시간 회복 허가, 보편 피로점수, ACWR 안전구간 등)을 별도 절로 정직하게 나열.

## 4. 지적 사항 (전부 비차단)
- **p1 (검증 불가 범위 고지)**: 167개 출처의 서지·추출값의 **내용적 정확성**(실제 논문과의
  대조)은 이 검수에서 검증하지 않았고 할 수도 없음. 패키지 자체가 이를 인정하고
  인적 스크리닝 0/167로 기록하므로 정합 — 다만 사장님이 "연구 승인"이 아니라
  "준비 패키지 병합"임을 인지하고 병합해야 함.
- **p2 (결정 대기 항목)**: 결정 패킷 3건(Load Components / Minimum Evidence /
  Competition Anchor)이 NOT_REVIEWED로 사장님 결정 대기. 병합은 결정을 대체하지 않음.
- **p3 (메모 백업 교차 참조)**: 사용자 관점 수정 제안 2번("개인 메모 로컬 전체 백업과
  선택 공유 허용")이 PR #64 검수 지적 N2 및 사장님의 "다 내보내기하고 싶을 수도"
  질의와 같은 방향 — 별도 결정으로 처리하면 됨.

## 5. 결론
**승인(APPROVE) — ready 전환 후 그대로 병합 가능.**
병합의 의미: 연구 *준비물*의 저장소 고정. 과학적 승인·런타임 권한·자동 처방 개방이 아님.
ME/LC 세부 규칙 자동 승인으로 확대 해석되지 않음(fail-closed 검증기가 이를 기계적으로 차단).

[REVIEW_RECORDED]
