# PERSONALIZED_PRESCRIPTION_V2_PROVENANCE_CHAIN_2026-08-24.md

```yaml
doc_id: PERSONALIZED_PRESCRIPTION_V2_PROVENANCE_CHAIN_2026_08_24
status: WORKING_PROVENANCE_RECORD
owner: COACH_HOJUNE
baseline_head: 5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa
branch: codex/personalized-prescription-algorithm-v2-20260823
commit_created: false
push_performed: false
deployment_claimed: false
canonical_promotion: false
```

## 목적

개인화 처방 알고리즘 v2 작업에서 오너 결정, 계획 파일, 구현 진행표, 런타임 상태가 서로 다른 시점의 자료라는 사실을 고정한다. 이 문서는 과거 승인본을 복원했다는 주장이 아니며, 서로 다른 자료를 하나의 승인으로 합치지 않는다.

## 계보

| 층 | 실제 로컬 자료 | SHA-256 또는 기준 | 해석 |
|---|---|---|---|
| 오너 결정 | `reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json` | 파일 `a5cf9f874a37a1a813a0bcd07dde8bf60d1dc27bc3fff7400f55948fd4a8b2dc`; canonical payload `sha256:e5a1a8ca8ea7c6301239292ba7a6db4de289feea6a477d195b847893fcbd66be` | `1A/2A/3A/B`의 의미 권한 |
| 승인 기록이 가리키는 계획 | `.omo/plans/personalized-prescription-algorithm-v2.md`라는 경로와 선언 해시 | `3f081ebbd8d8fa456ff33f01a037942e618cf13f9e549ff3feb83789df590d6b` | 선언은 존재하지만 이 정확한 바이트의 원문은 현재 로컬에서 발견하지 못함 |
| 보존 작업트리 계획 | `D:/admin/Documents/트레인 오라클 진도/.worktrees/personalized-prescription-algorithm-v2-impl/.omo/plans/personalized-prescription-algorithm-v2.md` | `71d92dd6378db4ec4ec464ebe04497bfd56a4caf55ab7ec804d1ba9e78423e4f` | Todo 1-6 완료, Todo 7-9 미완료인 보존 시점 |
| 현재 실행 원장 | `.omo/plans/personalized-prescription-algorithm-v2.md` | `bb82c455afd5253488c3e713bc16fc6ab02a1e57b59970337b60bd0e3765c104` | 보존본에서 Todo 7, 8, 9와 F2, F3, F4 체크가 완료로 바뀐 현재 진행표; F1은 미완료 |

`71d92d...` 보존본과 `bb82c4...` 현재본의 관찰된 내용 차이는 Todo 7, 8, 9 및 F2, F3, F4 체크박스 여섯 개뿐이다. 이것은 현재본이 선언된 `3f081e...` 승인본과 바이트 단위로 같다는 증거가 아니다.

## 권한 해석

- 제품 의미의 기준은 오너 결정 JSON에 적힌 `1A/2A/3A/B`다.
- 현재 계획은 구현 진행 원장이다. 계획 체크 갱신은 새 제품 권한을 만들지 않는다.
- 자동화 검증기의 하드코딩된 과거 계획 해시는 현재 계획 파일의 승인 증거로 사용할 수 없다.
- `3f081e...` 원문을 찾기 전에는 `원 승인 계획 복원` 또는 `정확한 승인 계획과 동일`이라고 주장하지 않는다.
- 현재 복구 브랜치 사용은 dirty 작업 보존을 위한 실행 예외다. `main에서 작업` 조건을 소급 충족했다고 간주하지 않으며, 병합·커밋은 별도 오너 게이트로 남긴다.

## 현재 런타임 상태

- 저장 계획: v3.
- 활성 적응 간선: `BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY`, `CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY` 두 개.
- 두 간선 모두 기존 후보 쌍 안의 `VOLUME` 보조훈련 시간만 바꾼다.
- `FREQUENCY`, `INTENSITY`, 스프린트/ATP-PC, 수치형 테이퍼 권한은 열리지 않았다.
- 상세 처방 전이 검토는 `youthTransfer`와 `femaleSexTransfer`를 별도 필드로 요구하며, `NO_YOUTH_MULTIPLIER`, `NO_SEX_MULTIPLIER` 제한을 보존한다.
- 경기일 저장은 미승인이고 배치 행 활성 수는 0개다.

## 역사 자료 사용 규칙

- `CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md`는 Todo 1 당시 v2/단방향 상태를 설명하는 역사 자료다.
- `CURRENT_IMPLEMENTATION_HANDOFF_2026-08-24.md`가 현재 v3/양방향 상태의 실행 인수문서다.
- 과거 증거는 당시 판정의 보존 자료로만 사용하고, 현재 런타임 수와 권한은 현재 소스·검증기·최종 증거에서 다시 확인한다.
- AI 리뷰 기록은 자동화 검토 기록이며 코치, 스포츠과학자, 법률·의료 전문가의 사람 승인으로 표시하지 않는다.

## 남은 사람 결정

최종 통합 전에 오너가 현재 복구 브랜치의 변경 묶음을 검토 대상으로 수용하고, 현재 실행 원장을 `1A/2A/3A/B`의 상태 갱신본으로 취급할지 확인해야 한다. 이 확인 전에는 F1 전체 승인, 커밋, 푸시, 병합, 배포를 선언하지 않는다.

[DRAFT_COMPLETE]
