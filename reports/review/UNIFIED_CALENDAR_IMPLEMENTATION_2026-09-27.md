# UNIFIED_CALENDAR_IMPLEMENTATION_2026-09-27.md

```yaml
doc_id: trainoracle-unified-calendar-implementation-20260927
status: LOCAL_IMPLEMENTATION_VERIFIED
owner: COACH_HOJUNE
base_commit: 7ee3196282b72a31099790e2f5ae9768e88f2107
canonical_promotion_allowed: false
training_engine_changed: false
storage_schema_changed: false
external_calendar_connected: false
production_deployed: false
```

## 1. 사용자가 보는 변화

날짜를 나열하던 화면을 실제 연월·요일에 맞는 같은 달력으로 통일했다.
달력은 작게 훑어보고, 날짜를 누르면 전체 화면에서 해당 날짜의 내용을 읽는다.
날짜 탐색은 훈련계획 수정이나 기록 작성으로 처리하지 않는다.

| 화면 | 변경 |
|---|---|
| 일반 계획 후보·확정 계획 | 실제 월간 달력, 오전·오후, 주기 범위, 날짜 전체 화면 |
| 수치 조정 계획 V4·V5·V6 | 같은 달력과 확대 리더를 적용. 기존 처방·안전 안내·쓰기 콜백 유지 |
| 빠른 추천 계획 | 텍스트 날짜 목록 대신 실제 달력. 확대 화면에도 선택 전 후보임을 명시 |
| 계획 입력 중 미리보기 | 임의의 1~9 숫자 그림 대신 실제 날짜. 펼쳐 보기, 배치 예시 표시, 처방 아님 |
| 월간 일지 | 기록 없는 달도 탐색. 앞뒤 달의 날짜·실제 기록 표시 |
| 9.5일 주기 일지 | 월간 달력 위에 해당 구간 표시. 주기 이동과 월 이동을 분리 |
| 날짜 상세 | 예정 훈련과 실제 일지를 별도 영역으로 표시. 체중·수면·통증·경기 등 구조화 항목 |

공통 조작: 이전/다음 달, 오늘, 연월 제목을 눌러 연월·날짜로 이동,
일~토 요일, 토·일 구분, 오늘 표시와 선택 표시 분리.
키보드 화살표 및 Home/End 탐색은 선택·저장을 발생시키지 않는다.
자정·화면 복귀 시 오늘을 갱신하되 사용자가 선택한 날짜는 유지한다.

## 2. 날짜 상세와 일지

- 예정된 오전·오후 훈련의 방법·처방·기록 동작을 기존 컴포넌트로 표시한다.
- 큰 화면 안에서도 이전/다음 날짜로 이동하고, 닫으면 선택 날짜와 달력 위치로 돌아간다.
- 실제 기록은 직접 기록한 시간대만 사용한다. 저장한 시각으로 운동 시간대를 추정하지 않는다.
- 거리·시간뿐 아니라 반복·세트·회복·근력 중량·점프 등 운동 구성도 표시한다.
- 하루 마무리의 체중·안정시 심박·수면·기분·통증, 경기 전후 기록도 해당 날짜에 표시한다.
- 통증 부위 코드를 사용자에게 그대로 출력하지 않고 입력 화면과 같은 한글 명칭을 사용한다.
- 메모·일지 원문은 기존 원문 리더를 명시적으로 열어 확인한다. 비밀 메모 접근·공유 정책을 바꾸지 않는다.
- 작은 달력에는 기록 종류·건수만 보이며 건강 수치와 메모 원문은 펼치기 전 노출하지 않는다.

## 3. 계약 정합성

대조한 기준:

- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md`
- `specs/active/PLAN_GENERATOR_SPEC.md`
- `specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md`
- `DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md`
- `FORMATION_PRIVACY_GOVERNANCE_DECISION.md`
- `docs/UX_UI_VISUAL_STANDARD.md`

유지한 경계:

1. 월간 달력은 표시 방식이다. 훈련을 7일 단위로 재생성하거나 강도·양·빈도를 바꾸지 않는다.
2. 기존 9.5일 일지 보기는 10일/9일 날짜 구간의 교대 표시다. 정확한 9.5일 시간 엔진으로 승격하지 않는다.
3. 24주 진행표는 아직 생성되지 않은 미래 처방의 달력이 아니다. 미래 훈련 날짜를 발명하지 않는다.
4. 날짜가 같다고 일지와 계획을 자동 연결하거나 수행 완료로 만들지 않는다.
5. MISSING 수치는 0으로 바꾸지 않고 표시에서 제외한다. 출처 없는 과거 값은 출처 미확인으로 구분한다.
6. 안전 판정·상세 처방 수치·메모 분석 권한·저장 스키마·계정 격리 계약은 변경하지 않는다.
7. 달력 이동·확대·조회 중 저장된 계획과 일지의 원문이 바뀌지 않는지 브라우저에서 대조한다.

## 4. 발견 후 수정한 결함

- 개발 StrictMode에서 상세 리더의 history entry가 중복되어 뒤로가기를 두 번 해야 하는 경로 수정.
- native dialog를 닫기 전에 외부 날짜 버튼으로 초점을 복원하려던 순서를 수정.
- 상세 리더에서 날짜를 넘긴 후 닫을 때 바깥 훈련 카드도 해당 날짜를 유지하도록 수정.
- 다른 달의 셀에 실제 기록이 있는데 비어 있다고 표시하던 월별 요약 범위 문제 수정.
- 작은 화면의 주기 달력 여백, 계획 달력의 격자선 추가 후 44px 미달 클릭 폭을 조정.
- 기존 빈 주기 화면의 오늘 기록하기 경로와 내보내기 이력 검사를 유지.

## 5. 검수 증거

- 관련 단위·계약 검사: 127/127 PASS.
- 앱 typecheck 및 프로덕션 build: PASS.
- e2e TypeScript 검사: PASS.
- 브라우저: 빌드 결과를 로컬에서 실행해 월 이동, 날짜 상세, 원문 열기, 뒤로가기,
  오전·오후, 계획 연결 일지 작성, 320/375/1024px, 200% 글자 확대, 모션 감소를 검사.
- 합성 기록만 사용. 테스트의 외부 요청 차단. 실제 계정·건강 데이터 업로드 없음.
- 브라우저 최종 결과: 5개 시나리오를 데스크톱·320px 터치·모션 감소 환경에서 확인, 총 15/15 PASS.
  최초 빌드 검사에서 12개 통과 후 계획 달력 클릭 폭 3건이 실패했다. 해당 여백을 고치고
  관련 3건을 같은 빌드 방식으로 다시 실행해 통과했다. 실패를 성공으로 합산한 것이 아니다.
- 개발 모드에서도 중첩 상세 → 뒤로가기 → 달력 초점 복원을 재현·수정 후 통과했다.
- 전체 앱 테스트·외부 계정 연결·Safari 실기기 검증을 수행했다는 의미는 아니다.
- 빌드의 기존 경고(일부 큰 청크, 폰트 상대 경로의 런타임 해석)는 남아 있다.

로컬 실행 명령:

```text
npm run build
npm run typecheck:e2e
vitest run [변경 관련 13개 파일] --maxWorkers=2
playwright test calendar-month-navigation plan-day-reader calendar-record-details journal-calendar journal-archive
```

## 6. 아직 하지 않은 것

- Google Calendar/iCloud 연동과 외부 공개·구독 주소 발급: 기존 준비 계획을 유지하며 미연결.
- 미래 목표 경기일의 새 영속 저장: 기존 authority 파일이 NOT_AUTHORIZED이므로 활성화하지 않음.
  이미 작성된 경기 전·후 일지는 해당 날짜에서 볼 수 있다.
- 일지 탭에 모든 예정 계획을 중첩하는 통합 필터: 이번에는 같은 달력 체계를 공유하고,
  계획 탭은 예정+실제, 일지 탭은 실제 기록을 중심으로 유지한다.
- 새로운 메모 저장소, 건강 데이터 공개, 시합 결과 크롤링은 추가하지 않았다.
- 커밋·PR·병합·공개 배포는 이번 로컬 구현 완료와 별개다.

## 7. 캡처

- [주기 달력 375px](evidence/calendar-20260927/cycle-375.png)
- [하루 기록 상세 320px](evidence/calendar-20260927/health-detail-320.png)
- [오전·오후 훈련 상세 375px](evidence/calendar-20260927/plan-day-375.png)
- [훈련 달력 320px](evidence/calendar-20260927/plan-calendar-320.png)
- [훈련 달력 글자 200%](evidence/calendar-20260927/plan-calendar-200-percent.png)

## 8. 후속 검수와 개선

[루나 20개 페르소나 검수·개선 보고서](CALENDAR_20_PERSONA_REVIEW_AND_IMPROVEMENTS_2026-09-27.md)에
이후 발견한 초점·같은 탭 갱신·통증 답변·경기 출처·날짜 갱신 문제와 개선 결과를 기록했다.
이 문서의 127개/15개 검사는 선행 구현 시점이며, 후속 결과는 연결된 보고서를 기준으로 확인한다.

[DRAFT_COMPLETE]
