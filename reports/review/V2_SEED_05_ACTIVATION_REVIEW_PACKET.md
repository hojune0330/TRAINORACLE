# V2_SEED_05_ACTIVATION_REVIEW_PACKET.md

```yaml
packet_id: TO-V2-SEED-05-ACTIVATION-REVIEW-2026-08-16
status: HUMAN_REVIEW_PACKET_READY
template_id: V2-SEED-05
runtime_activation: FORBIDDEN
canonical_promotion: false
issue_closure: false
approval_manifest_entries: 0
owner: COACH_HOJUNE
source_reopened_at: 2026-08-16
```

## 1. 쉬운 결론

`V2-SEED-05`는 현재 30개 연구 시드 중 기계 표기로 읽을 수 있는 유일한
비스프린트 후보다. 그러나 출처는 `5×1000m @5000m RP · r150″`를 모든
선수에게 그대로 적용하라고 승인하지 않으며, 준비운동·정리운동·청소년 정책과
사람 검토도 아직 비어 있다. 따라서 이 패킷은 검토를 시작할 수 있게 사실과
결정 항목을 한곳에 모으지만, 템플릿을 활성화하지 않는다.

## 2. 현재 파일에서 확인한 고정 사실

| 항목 | 확인값 | 근거 |
|---|---|---|
| 원문 표기 | `5×1000m @5K RP · r2′30″` | `ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md` `V2-SEED-05` |
| 기계 표기 | `5×1000m @5000m RP · r150″` | 같은 항목의 `machineNotation` |
| 구조 합계 | 1세트, 5회, 질주 5,000m, 반복 회복 4회·총 600초 | 카탈로그와 파서 계약 |
| 현재 상태 | `DRAFT` / `REVIEW_REQUIRED` | 카탈로그 |
| 런타임 승인 레코드 | 0개 | `detailed-prescription-approvals.ts` |
| 자동 연결 | 금지 | 카탈로그 공통 불변조건 |

표기 변환은 `5K`를 `5000m`로, `2분 30초`를 `150초`로 바꾼 것뿐이다.
반복 수·거리·회복량을 줄이거나 늘린 변환이 아니다.

## 3. 출처가 말하는 것과 말하지 않는 것

공식 VDOT 계산기 페이지의 2026-08-16 재확인 범위:

- Interval 훈련의 한 반복은 보통 3~5분이며 800m와 1000m가 흔하다고 설명한다.
- 반복 뒤에는 비슷한 길이의 조깅 회복을 둘 수 있다고 설명한다.
- 예시로 `5×3분 I, 2분 조깅`을 제시한다.
- 단순히 `hard`라고만 적힌 훈련은 보수적으로 5K 경기 페이스 감각을 떠올릴 수
  있다고 설명한다.

출처 URL: <https://vdoto2.com/calculator/>

이 출처만으로 확정할 수 없는 내용:

- 모든 5K 선수에게 1000m를 정확히 5회 주는 보편 처방
- 모든 선수에게 반복 회복을 정확히 150초 주는 보편 처방
- 청소년에게 같은 양을 그대로 적용해도 된다는 주장
- 준비운동·정리운동의 정확한 구성과 중단 기준
- 현재 5K 기록을 다른 종목 페이스로 바꾸는 환산

따라서 `sourceVerificationStatus: SOURCE_ADAPTED`는 유지한다. 사람 검토가
출처의 빈 부분을 근거 없이 채워서는 안 된다.

## 4. 첫 검토 범위 제안

```yaml
proposed_scope:
  event_groups: [FIVE_K]
  experience_bands: [EXPERIENCED]
  planning_intent: VO2_INTENT
  anchor_kind: [RECENT_RESULT, PB, SB]
  anchor_event_distance_m: 5000
  anchor_freshness: CURRENT
  anchor_purpose: [CURRENT_CAPABILITY, SEASON_CONTEXT]
  goal_as_current_capability: FORBIDDEN
  cross_event_conversion: FORBIDDEN
  minor_policy: PENDING_YOUTH_REVIEW_AND_ATHLETE_SPECIFIC_CONFIRMATION
```

이 범위는 승인값이 아니라 검토 시작점이다. `MIDDLE_DISTANCE`, `TEN_K`,
`GENERAL_ENDURANCE`, `NEW_TO_RUNNING`, `DEVELOPING`으로 넓히려면 각 범위의
별도 전이 근거와 검토가 필요하다.

## 5. 활성화 전에 반드시 해결할 차단 항목

| 코드 | 현재 문제 | 완료 증거 |
|---|---|---|
| `BLOCK-SOURCE-TRANSFER` | 공식 자료가 정확한 5회·150초를 보편 처방으로 승인하지 않음 | 코치·스포츠과학 검토가 적용 범위와 감량 규칙을 서명 |
| `BLOCK-WARMUP` | 카탈로그가 `WU-QUALITY-REVIEW-REQUIRED`이고 런타임 참조가 없음 | 승인된 준비운동 구성요소 ID |
| `BLOCK-COOLDOWN` | 카탈로그가 `CD-QUALITY-REVIEW-REQUIRED`이고 런타임 참조가 없음 | 승인된 정리운동 구성요소 ID |
| `BLOCK-RECOVERY-MODE` | 카탈로그는 `150 sec JOG`, 현재 표기 런타임은 회복 방식을 `STAND`로 보존 | 조깅 회복을 잃지 않는 타입·파서·테스트 |
| `BLOCK-MINOR-POLICY` | 카탈로그는 `minorAllowed: false`; 현재 계획 입력은 미성년 여부와 개별 동의를 처방 게이트에 전달하지 않음 | 청소년 검토 + 보호자 동의 + 지정 사람 확인을 모두 실패 폐쇄로 검증 |
| `BLOCK-EVENT-MAPPING` | 연구 카탈로그 종목명과 앱 `FIVE_K`가 아직 수용된 매핑으로 고정되지 않음 | 명시적 매핑 결정 |
| `BLOCK-HUMAN-REVIEWS` | 네 검토 기록이 모두 비어 있음 | 아래 네 검토의 이름·근거·결정 |

## 6. 사람 검토 기록

```yaml
review_decisions:
  owner_review: PENDING
  coach_review: PENDING
  sports_science_review: PENDING
  youth_review: PENDING
```

각 검토자는 다음을 남겨야 한다.

| 검토 | 반드시 답할 질문 |
|---|---|
| 오너 | 첫 공개 범위와 유료/베타 표시, 자기 선택 권한을 승인하는가 |
| 코치 | 5회·150초 조깅, 감량 선택지, 준비·정리운동, 기술 저하 중단 기준이 실제 지도에 타당한가 |
| 스포츠과학 | 출처가 지지하는 범위와 TrainOracle이 추가한 적응값을 분리했고 성인·경험자 전이 한계를 과장하지 않았는가 |
| 청소년 | 미성년 허용 범위, 보호자 동의, 지정 사람 확인, 성장·훈련연령에 따른 제외·감량 규칙이 충분한가 |

검토 기록은 `reviewerName`, `evidenceRef`, `decision: APPROVED`를 포함해야 한다.
AI 초안 검토는 사람 자격 검토를 대신하지 않는다.

## 7. 활성화 체크리스트

- [ ] `BLOCK-SOURCE-TRANSFER` 해결
- [ ] `BLOCK-WARMUP` 해결
- [ ] `BLOCK-COOLDOWN` 해결
- [ ] `BLOCK-RECOVERY-MODE` 해결
- [ ] `BLOCK-MINOR-POLICY` 해결
- [ ] `BLOCK-EVENT-MAPPING` 해결
- [ ] 오너 검토 승인
- [ ] 코치 검토 승인
- [ ] 스포츠과학 검토 승인
- [ ] 청소년 검토 승인 또는 성인 전용 제외 결정
- [ ] D9 `ACTIVE`와 `UNKNOWN` 차단 회귀 테스트
- [ ] 같은 종목·현재 기록만 수치 페이스를 내는 회귀 테스트
- [ ] 후보 비교·저장·재열기에서 동일 처방 ID와 근거 보존
- [ ] 별도 활성화 PR에서 오너 최종 승인

하나라도 비어 있으면 `DRAFT`, `REVIEW_REQUIRED`, 승인 레지스트리 0개를
유지한다.

## 8. 승인 후 구현 순서

1. 승인된 준비운동·정리운동 구성요소와 조깅 회복 방식을 구조화한다.
2. 계획 입력에 미성년 여부와 개별 확인 상태를 민감정보 최소화 방식으로 전달한다.
3. 승인 레지스트리에 `V2-SEED-05` 한 건만 별도 PR로 추가한다.
4. `FIVE_K`·`EXPERIENCED`·같은 종목 `CURRENT` 앵커에만 후보를 결합한다.
5. 후보 화면에 5회, 1000m, 개인 목표 반복 시간, 150초 조깅, 근거 기록,
   준비운동·정리운동·감량·중단조건을 함께 표시한다.
6. 저장·재열기·다음 주기 연속성까지 같은 버전과 근거를 보존한다.

이 패킷의 병합만으로 3번 이후를 실행하지 않는다.

## 9. 기계 검증

```bash
node --test specs/test-packages/validate-v2-seed-05-activation-packet.test.mjs
node specs/test-packages/validate-v2-seed-05-activation-packet.mjs
```

검증기는 이 패킷의 완료 표식, `V2-SEED-05`의 비활성 상태, 빈 승인
레지스트리, 네 사람 검토의 `PENDING` 상태를 함께 확인한다.

[DRAFT_COMPLETE]
