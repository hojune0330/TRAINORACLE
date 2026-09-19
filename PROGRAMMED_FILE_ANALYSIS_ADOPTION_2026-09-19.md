# PROGRAMMED_FILE_ANALYSIS_ADOPTION_2026-09-19.md

```yaml
doc_id: trainoracle-programmed-file-analysis-adoption-20260919
title: 확인한 파일 기록의 설명형 분석과 계정 보관 채택
version: "1.0"
status: OWNER_APPROVED_SCOPED_IMPLEMENTATION
owner: COACH_HOJUNE
approval_basis: "2026-09-19: 지금 높은 모델로 지시서를 수행해."
implementation_status: IN_PROGRESS
production_activation: false
canonical_promotion: false
issue_closure_claimed: false
```

## 1. 승인 범위

파일 우선 분석·비교·기존 다음 훈련 선택까지의 지시서와 Terra/Luna 종합 보완안을 실행한다.
새 과학적 공식, 외부 AI 처리, 공급자 인증, 새 처방 용량을 채택하지 않는다.
기존 EXPLICIT 필드 분석을 유지하고 아래 확인된 FILE_UPLOAD 관측만 별도 투영한다.
공급자 준비 구조의 analysisEligible:false와 라이브 기기 연동 상태는 변경하지 않는다.

## 2. 용도별 채택표

| 프로필 | 필드 | 계산 용도 | 필수 조건 | 제외 용도 | 버전 |
|---|---|---|---|---|---|
| TCX_ACTIVITY_V1 | 날짜·미터 | 본인 활동 요약·러닝 주월 거리·이전 기간 비교 | 유효 날짜, 비음수 유한값, 러닝 종목, 사용자 확인, 현재 계정 수정본 | PB/SB 인증·자동 증량·위험 해제 | FILE_ANALYSIS_V1 |
| TCX_ACTIVITY_V1 | 초·시간 의미 | 같은 의미의 합계·페이스·과거 비교 | 명시된 TIMER/MOVING/ELAPSED, 양의 거리/시간과 같은 표본 | SOURCE_DEFINED/UNKNOWN을 이동 시간으로 취급 | FILE_ANALYSIS_V1 |
| TCX_ACTIVITY_V1 | SOURCE_DEFINED/UNKNOWN 초 | 원천 시간 참고·부분합과 누락 수 | 의미 보존, 값이 없으면 null | 통합 페이스·시간 준수 판정 | FILE_ANALYSIS_V1 |
| TCX_ACTIVITY_V1 | 명시적 랩 | 원순서 목록·확인한 계획 구간과 비교 | 원계획 정체성, 관측 지문, 사용자 대응 확인 | 자동 본운동 추론·성공 점수·RPE 추론 | FILE_ANALYSIS_V1 |
| CSV_COLUMNS_V1 / JSON_COLUMNS_V1 / GPX_TRACK_V1 | 위 프로필에서 실제 제공되는 필드 | 동일 설명형 분석 | R2 형식별 검수·공개 조건, 의미별 자격 확인 | 다른 형식의 없는 랩/정밀도 발명 | FILE_ANALYSIS_V1 |

일지 직접 입력 RPE·목적·적격 경기 기록의 현행 자격은 그대로다. 가져오기 확인만으로
DERIVED를 EXPLICIT로 바꾸지 않는다. 시간 의미 확인은 원값과 별도 메타데이터다.
비밀/일반 메모·Notes·파일명·GPS 경로·토큰은 관측, 지문, 분석에 포함하지 않는다.

## 3. 호환·정정·식별·운영

- 기존 V2는 그대로 읽고 일반 편집 시 V2 저장 가능. 새 근거/비교 관계가 필요한 명시적
  쓰기에만 V3을 사용한다. 구형 클라이언트의 V3 읽기/손실 쓰기는 명시적으로 실패하며
  기존 projection·초안·outbox를 지우지 않는다. 기존 페이지 나눔을 유지한다.
- `journalEntryId`, `sourceObservationKey`, `contentRevisionFingerprint`를 분리한다.
  원본 식별자가 없으면 모호한 별도 재가져오기는 사용자 확인을 받는다. 날짜/유사 수치만으로 합치지 않는다.
- 정정은 같은 계정·일지 ID·날짜, expectedRevision과 이전 지문, 명시한 변경 필드를 확인한다.
  메모·직접 입력 RPE·계획 링크·완료 상태는 보존한다. 이전 비교는 오래된 근거로 남는다.
- 새 구조화 근거 쓰기를 서버에서 별도 제한한다. 비활성/불명확 상태는 새 쓰기를 막되
  정상 기존 일지 보관을 막지 않는다. V3이 있으면 V2-only 서버로 롤백하지 않는다.
- 확인 오류는 해당 필드/항목에 한정한다. 시간 의미가 불명확해도 유효 날짜·거리는 보존한다.
  계정·인증·호환 오류는 관련 새 쓰기를 중단하고 이미 확인된 저장은 유지한다.

## 4. 기존 계약과의 관계

이 결정은 `DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md`와
`ANALYSIS_INTEGRITY_ADOPTION_2026-09-04.md`의 imported 제외 규칙에 위 FILE_UPLOAD
용도만 좁게 추가한다. `EXTERNAL_RECORD_INTEGRATION_SPEC.md`의 공급자 OAuth·수신·
안전 권한은 열지 않는다. 분석·지표·누적거리 계약의 초안 수식은 여전히 미채택이다.
기존 계획 해설·메모 프라이버시·안전·적응 한도는 유지한다. 비교는 표시 근거이며 처방 권한이 아니다.

## 5. 완료 증거

원지시서 P0~P9의 11개 묶음과 27개 시험을 유지한다. 문서 작성으로 실행 검증을
대체하지 않는다. 형식별 구현/실행/독립 검수/배포를 별도로 기록한다. 이 결정 자체는
운영 활성·테스트 통과·이슈 종결·독립 전문가 승인 증거가 아니다.

[DRAFT_COMPLETE]
