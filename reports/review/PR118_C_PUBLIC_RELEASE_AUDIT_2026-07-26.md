# PR #118 C 공개 베타 독립 감사

```yaml
doc_id: pr118-c-public-release-audit-2026-07-26
audited_commit: f70de8a3bbcb4bb19d487d67f49c69a7fd289a42
target_scope: C_PUBLIC_ACCOUNT_AND_SERVER_SYNC
review_mode: independent_read_only
critical_findings: 0
high_findings: 6
merge_gate_at_audit: REQUEST_CHANGES
```

## 쉬운 결론

PR #118의 파일 가져오기·백업·휴지통 기능은 작동했지만, 계정과 서버
동기화를 일반 공개하기에는 위험한 경로가 남아 있었다. 키를 넣는 것만으로
계정 기능을 켜지 않도록 공개 스위치를 분리했고, 즉시 수정할 수 있는 삭제와
동기화 문제는 이 후속 패치에서 고쳤다.

공용 브라우저의 로컬 데이터 격리, PR #114 수정 시각, 공개 정책과 실제
Supabase 검증은 아직 출시 차단 상태다.

## 발견과 조치

| ID | 발견 | 조치 | 현재 |
|---|---|---|---|
| C-01 | 같은 브라우저에서 다른 계정이 이전 사용자의 로컬 일지를 자기 계정으로 올릴 수 있음 | 최초 동기화 계정 소유자를 기록하고 다른 계정 업로드를 차단 | PARTIAL_FIXED |
| C-02 | tombstone 저장 실패를 무시하고 삭제 성공으로 표시 | tombstone 저장 성공 전에는 본문을 지우지 않도록 변경 | FIXED_BY_TEST |
| C-03 | tombstone 서버 조회 실패 후에도 병합·업로드를 계속해 삭제가 부활할 수 있음 | 조회 실패 시 로컬·서버 변경 없이 동기화 중단 | FIXED_BY_TEST |
| C-04 | 메모 서버 전송 안내가 화면마다 모순되고, 메모 제외로 바꿔도 메모 전용 서버 사본이 남음 | 안내 정정, 안전 투영이 없는 메모 전용 행은 서버에서 제거 | FIXED_BY_TEST |
| C-05 | PR #114 수정 저장이 기존 `savedAt`을 유지해 다른 기기의 오래된 사본이 이길 수 있음 | PR #114 병합 전에 모든 수정 저장이 새 시각을 쓰도록 재작업 필요 | OPEN |
| C-06 | 정책·미성년자·보유기간·처리업체·DB 실행 증거가 없음 | 별도 공개 게이트와 배포 스위치로 차단 | OPEN |

## C-01의 남은 범위

현재 패치는 다른 계정으로 서버 업로드되는 사고를 막는다. 그러나 로컬
저장소 자체는 아직 계정별로 분리되어 있지 않다. 공용 브라우저에서 이전
사용자의 일지를 다음 사람이 화면으로 볼 가능성은 남아 있다.

따라서 다음 중 하나를 구현하고 실제 브라우저에서 검증하기 전에는 계정 공개
스위치를 켜지 않는다.

1. 로컬 일지·휴지통·동의·tombstone을 계정별 저장공간으로 분리한다.
2. 계정 전환 때 이전 계정의 로컬 자료를 잠그고, 원래 계정 로그인이나 명시적
   기기 데이터 삭제 전에는 열지 않는다.

## PR #114 병합 조건

PR #114는 지난 일지 수정과 과거 날짜 추가를 제공하므로 제품에 필요하다.
다만 현재 PR #118과 `AppShell.tsx`, `journal-store.ts`, `LogDetail.tsx`,
`LogEntry.tsx`, `EntryChooser.tsx`가 겹친다.

병합 시 아래를 지킨다.

- PR #118의 휴지통·백업·출처 표시를 유지한다.
- 이 후속 패치의 앱 내부 삭제 확인창을 유지한다.
- 수정 저장은 원래 `savedAt`을 재사용하지 않고 저장 시점의 새 ISO 시각을 쓴다.
- 수정 후 다른 기기와 동기화했을 때 최신 수정본이 남는 계약 테스트를 추가한다.
- 충돌을 해결한 결과에 대해 지난 일지 수정·추가와 삭제·되돌리기 E2E를 함께 실행한다.

## 공개 판정

```yaml
local_journal_and_plan_beta: CONTINUE
account_and_server_sync_public: BLOCKED
reason:
  - shared_browser_local_isolation_open
  - PR114_edit_timestamp_open
  - legal_and_operator_facts_open
  - live_supabase_migration_and_RLS_evidence_missing
```

이 판정은 C 방향을 취소하지 않는다. C를 안전하게 켜기 위한 현재 상태를
정확히 표시한다.
