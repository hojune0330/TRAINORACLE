# PLAN_ACCOUNT_ISOLATION_IMPLEMENTATION_2026-08-25.md

```yaml
doc_id: TRAINORACLE-PLAN-ACCOUNT-ISOLATION-IMPLEMENTATION-2026-08-25
status: IMPLEMENTED_VERIFIED_PUSHED
owner: Codex
branch: codex/account-local-journal-isolation
base_head_before_work: 2f09528de9817008a6d3adfd0a6144f5f6ee8624
implementation_commit: 62f17458a2059a0fac049b164a391893f7ec5fef
commit_created: true
remote_pushed: true
```

## 1. 목적

일지는 계정별로 분리됐지만 활성 훈련계획, 다음 계획 조정 데이터, 개인 최고·시즌 최고 기록, 꾸미기, 오늘 상태와 피로 실험 설정은 기기 공용 키를 사용하고 있었다. 같은 기기에서 계정 A와 B를 바꾸면 계획 근거와 결과가 노출되거나 덮일 수 있으므로 계정별 로컬 저장 경계를 함께 분리했다.

## 2. 구현 범위

- 비로그인 계획은 기존 기기 키를 그대로 사용한다.
- 로그인 계획은 계정 ID를 URL 인코딩한 별도 키에 저장한다.
- 활성 계획, 계획 이력, 이전 입력, 적응 후보, 적응 컨텍스트, 후속 계획 활성화 영수증을 같은 계정 경계로 묶었다.
- 개인 최고, 시즌 최고, 최근 경기, 목표 기록을 같은 계정 경계로 분리했다.
- 후속 계획의 기록 근거 재검증은 작업 시작 시 고정한 계정의 기록만 읽는다.
- 인증 상태가 바뀌면 계획·선수 기록 화면을 다시 구성해 이전 계정의 메모리 상태를 제거한다.
- 홈도 계정 변경 시 다시 구성해 이전 계정의 일지 집계, 포인트, 꾸미기, 오늘 상태가 메모리에 남지 않게 했다.
- 비동기 계획 작업 도중 계정이 바뀌면 저장하지 않고 fail-closed 한다.
- 로그인 전에 만든 계획과 선수 기록은 자동으로 계정에 넣지 않는다. 계정 화면에서 두 번 확인한 뒤에만 연결한다.
- 계정에 이미 계획 또는 기록이 있으면 해당 종류는 덮어쓰지 않고 기기 원본도 보존한다. 계획과 기록은 독립적으로 처리한다.
- 연결하는 계획은 활성 계획만이 아니라 이력, 이전 입력, 조정 후보, 조정 컨텍스트, 후속 계획 활성화 영수증까지 한 묶음으로 옮긴다.
- 연결 중 쓰기 또는 원본 제거가 실패하면 해당 묶음의 원래 바이트를 복구한다.
- 꾸미기 선택과 구매 상태, 오늘 기분·몸 상태, 피로 실험 선택을 계정별로 분리했다. 비로그인 기기 꾸미기는 자동 귀속하지 않고 그대로 보존한다.
- 비로그인 꾸미기는 계획·선수 기록과 같은 2단계 확인 화면에서 명시적으로만 옮긴다. 계정에 실제 꾸미기 이력이 있으면 덮어쓰지 않으며, 자동 생성된 빈 기본 상태만 있으면 충돌로 보지 않는다.
- 레거시 꾸미기 V1은 검증된 V2 형식으로 정규화해 계정에 저장하고, 대상 쓰기와 읽기 확인 뒤에만 기기 원본을 제거한다.
- 꾸미기 포인트를 새로 지급하거나 환불하지 않고 사용한 포인트와 소유 항목을 그대로 보존한다. 획득 포인트는 계정에 보이는 유효 일지에서 다시 계산한다.
- 참여 포인트는 별도 누적값이 아니라 현재 계정에서 보이는 유효 일지 날짜로 매번 재계산되므로 일지 계정 경계를 그대로 따른다.
- 장기 프로필 원문은 로컬 저장 대상이 아니며 서버 요청이 사용자 ID로 분리되어 있어 별도 로컬 복제를 추가하지 않았다.
- 동기화 동의와 나만의 메모 복구 코드를 계정별로 분리했다. 계정을 바꿔도 이전 사용자의 동의나 복구 코드가 보이지 않는다.
- 동기화 중단 복구 지점도 계정별로 분리했다. 다른 계정의 동기화 시도가 이전 계정의 복구 지점을 폐기하지 않는다.
- 화면 오류 시 제공하는 비상 일지 백업도 현재 계정과 미연결 기기 일지만 포함한다. 소유권 장부가 손상돼 확인할 수 없으면 공용 원문을 내보내지 않는다.
- 기기 전체 데이터 삭제 시 모든 계정별 계획·선수 기록·꾸미기·오늘 상태·피로 실험 키와 세션의 이전 입력 키를 제거한다.
- 기기 전체 삭제에서 빠져 있던 가입 완료 표시와 15분 임시 가입 정보도 제거 대상에 포함했다.
- 기존 비로그인 저장 형식과 공개 상수는 유지했다.
- 상세 처방 전체 사용자 흐름 테스트는 기능 실패 없이 5회 연속 통과했지만 기본 5초 상한 때문에 병렬 전체 검사에서 한 번 시간 초과가 발생했다. 검증 단언은 유지하고 해당 장거리 시나리오의 상한만 15초로 명시했다.

## 3. 검증

```yaml
focused_plan_contracts:
  files: 6
  tests: 136
  result: PASS
focused_record_and_prescription_contracts:
  files: 7
  tests: 113
  result: PASS
full_vitest_default:
  files: 194
  tests: 1616
  result: PASS
full_vitest_kst:
  files: 194
  tests: 1616
  result: PASS
release_environment:
  tests: 11
  result: PASS
typecheck: PASS
typecheck_e2e: PASS
production_build: PASS
adaptive_next_frame_browser:
  tests: 4
  viewports:
    - 320x568
    - 375x667
    - 768x1024
    - 1440x900
  result: PASS
record_and_personalized_prescription_browser:
  tests: 14
  result: PASS
full_browser_suite:
  projects: 4
  passed:
    desktop_chromium: 77
    mobile_chromium: 93
    touch_narrow_320px: 93
    reduced_motion: 75
  result: PASS
```

## 4. 남은 경계

- 실제 Supabase 계정 A/B와 브라우저 프로필 두 개를 사용한 운영 증거는 아직 없다.
- 계정 연결 화면은 컴포넌트 계약과 프로덕션 빌드로 검증했지만 실제 Supabase 로그인 세션을 사용한 브라우저 증거는 아직 없다.
- 새 범위의 서버 테이블과 실제 왕복은 아직 구현하지 않았다. 일지 → 선수 기록·꾸미기 → 훈련 계획 순서와 금지선은 `ACCOUNT_TRAINING_DATA_SYNC_SCOPE_DECISION_2026-08-26.md`에 승인 범위로 기록했다.
- 실제 계정 A/B 시험에 필요한 두 로그인 계정과 시험 환경 설정은 이 작업 폴더에 주입돼 있지 않아, 합성 계정으로 실제 증거를 대신하지 않았다.

## 5. 다음 권장 순서

1. 실제 Supabase 계정 A/B 브라우저 격리 검증
2. 실제 로그인 상태에서 기기 계획·선수 기록·꾸미기 2단계 연결 브라우저 검증
3. 선수 기록·꾸미기 서버 스키마와 RLS를 별도 변경으로 구현

[DRAFT_COMPLETE]
