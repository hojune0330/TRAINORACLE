# WORK_ORDER_C - 문서 지도 생성

```yaml
work_order:
  id: WO-C-DOC-INDEX
  revision: SOL_REPRODUCIBLE_INDEX_2026-07-28
  status: READY_FOR_TERRA
  purpose: 문서를 삭제하지 않고 찾을 수 있게 기계적으로 색인한다
  target_worker: Terra High
  implementation_branch: codex/document-map
  allowed_change: DOCUMENT_MAP.md only
  code_change: forbidden
  file_delete_or_move: forbidden
```

## 0. 수정 이유

이전 지시서는:

- 실제 개수를 고정값으로 적음
- `.omo/evidence/`만 제외하여 다른 `.omo/` 작업 메모를 포함
- 43%가 `기타`로 떨어지는 파일명 단일 분류
- 다중 주제 66건의 우선순위 미정
- `HANDOFF` 대소문자와 날짜 동점 처리 미정
- 작업 중 이상이 생기면 `git checkout -- .`로 다른 작업까지 되돌리게 함
- `main`에 직접 push하도록 지시

수정본은 실측값, 경로 기반 문서군, 복수 주제, 비파괴 중단, 브랜치 PR 방식으로
바꾼다.

## 1. 절대 규칙

1. 어떤 기존 파일도 수정, 삭제, 이동, 이름 변경하지 않는다.
2. 새 파일은 저장소 루트의 `DOCUMENT_MAP.md` 하나뿐이다.
3. `.omo/` 아래 파일은 전부 작업 내부 산출물이므로 색인 대상에서 제외한다.
4. 문서 가치를 판단하지 않는다. `검토필요`는 쓸모없다는 뜻이 아니다.
5. 예상하지 못한 변경이 보이면 되돌리지 말고 중단하여 경로를 보고한다.
6. `main`에 직접 push하지 않는다. 전용 브랜치와 Draft PR을 사용한다.
7. 숫자는 지시서에서 가져오지 않고 실행 시점의 git 추적 파일을 센다.

## 2. 대상 목록

Git Bash에서:

```bash
git ls-files '*.md' | awk '!/^\.omo\//' | sort > /tmp/trainoracle-doclist.txt
git ls-files '*.md' | awk '/^\.omo\//' | wc -l
wc -l < /tmp/trainoracle-doclist.txt
```

두 숫자를 `DOCUMENT_MAP.md` 머리말에 각각 다음 이름으로 기록한다.

- 대상 문서 수
- 제외한 `.omo/` 문서 수

과거의 "약 N개"를 복사하지 않는다.

## 3. 열과 분류 축

전체 표는 정확히 다섯 열이다.

```text
수정일 | 상태 | 문서군 | 주제(복수 가능) | 경로
```

### 3.1 수정일

각 파일의 마지막 git commit 날짜를 사용한다.

```bash
git log -1 --format=%cs -- "$file"
```

날짜가 비어 있으면 추정하지 않고 `UNKNOWN`으로 적는다.

### 3.2 상태

아래 순서대로 첫 매칭에서 멈춘다. 대소문자 비교가 필요한 파일명 조건은
case-insensitive다.

| 순서 | 조건 | 상태 |
|---:|---|---|
| 1 | 정확히 `PRODUCT_NORTH_STAR.md`, `README.md`, `TRAINORACLE_SPEC_INDEX.md` | `현재-길잡이` |
| 2 | 파일명에 `handoff` 포함, 현행 인계 1건 | `현재-인계` |
| 3 | 파일명에 `handoff` 포함, 나머지 | `과거-인계` |
| 4 | `specs/active/` | `현재-스펙` |
| 5 | `specs/reconstruct/` | `재구성-초안` |
| 6 | `specs/legacy-reference/` | `레거시-참고` |
| 7 | `specs/test-packages/` | `테스트-패키지` |
| 8 | 루트 파일명이 `WORK_ORDER_` 또는 `CODEX_WORK_ORDER_`로 시작 | `작업지시` |
| 9 | `reports/` | `작업기록` |
| 10 | `app/` 또는 `impl/` 아래 Markdown | `구현-인접문서` |
| 11 | 그 외 | `검토필요` |

현행 인계 1건 선정:

1. `.omo/` 제외 대상 중 파일명에 `handoff`가 있는 문서를 case-insensitive로 찾음
2. 마지막 commit timestamp 내림차순
3. timestamp 동점이면 경로 사전순 오름차순
4. 첫 문서 1건만 `현재-인계`

timestamp는 날짜 문자열이 아니라 아래 Unix timestamp를 사용한다.

```bash
git log -1 --format=%ct -- "$file"
```

경로가 `reports/`에 있어도 파일명에 handoff가 있으면 인계 규칙이 먼저다.

`PROPOSAL_ONLY`, `SUPERSEDED`, `[DRAFT_COMPLETE]` 같은 본문 문자열만으로 상태를
단정하지 않는다. 문장 인용에 같은 문자열이 들어갈 수 있기 때문이다.

### 3.3 문서군

상태와 별개로 소속을 나타낸다. 아래 순서대로 첫 매칭:

| 순서 | 경로 | 문서군 |
|---:|---|---|
| 1 | `specs/active/` | `SPEC_ACTIVE` |
| 2 | `specs/reconstruct/` | `SPEC_RECONSTRUCT` |
| 3 | `specs/legacy-reference/` | `SPEC_LEGACY` |
| 4 | `specs/test-packages/` | `SPEC_TEST` |
| 5 | `reports/` | `REPORT` |
| 6 | `app/` | `APP_DOC` |
| 7 | `impl/` | `IMPL_DOC` |
| 8 | 루트 `WORK_ORDER_*` 또는 `CODEX_WORK_ORDER_*` | `WORK_ORDER` |
| 9 | 저장소 루트의 그 외 문서 | `ROOT_GUIDE_OR_RECORD` |
| 10 | 그 외 | `OTHER` |

문서군이 있어야 주제가 `기타`여도 어디에서 생긴 문서인지 찾을 수 있다.

### 3.4 주제

주제는 파일 경로 전체를 대문자로 바꾼 뒤 `/`, `.`, `_`, `-`, 공백으로 나눈
**토큰**을 검색한다. 짧은 문자열을 부분검색하지 않는다. 예를 들어 `GUIDE`의
`UI`, `SERVER`의 `RVE`는 일치가 아니다. 한 문서가 여러 주제와 일치하면 하나를
버리지 않고 아래 표 순서대로 쉼표로 연결한다.

| 순서 | 키워드 | 주제 |
|---:|---|---|
| 1 | `RULE`, `SAFETY`, `D9`, `RVE` 또는 연속 토큰 `D1`+`D9` | `안전규칙` |
| 2 | `NOTE`, `SIGNAL`, `LOG`, `JOURNAL`, `CHECKIN`, `MEMO` | `일지·위험신호` |
| 3 | `ANALYSIS`, `METRIC`, `VISUALIZATION`, `TREND`, `STATISTIC` | `분석·시각화` |
| 4 | `PLAN`, `FORMATION`, `MICROCYCLE`, `CALENDAR`, `CYCLE` | `훈련계획` |
| 5 | `PRESCRIPTION`, `TEMPLATE`, `ENERGY`, `SESSION`, `PACE` | `처방·템플릿` |
| 6 | `ACCOUNT`, `SYNC`, `PRIVACY`, `EXPORT`, `FEDERAT`, `SSO`, `CONSENT` | `계정·프라이버시` |
| 7 | `RESEARCH`, `EVIDENCE`, `SOURCE`, `PHYSIO` | `연구근거` |
| 8 | `DESIGN`, `UI`, `UX`, `SCREEN`, `ACCESSIBILITY` | `디자인·접근성` |
| 9 | 연속 토큰 `WORK`+`ORDER`, `CODEX`+`WORK`+`ORDER`, `HANDOFF`, `DECISION`, `READINESS`, `ROADMAP`, `WO` 뒤 숫자 토큰 | `작업관리` |

한 개도 일치하지 않을 때만 `기타`다.

주제별 개수는 복수 주제를 각각 센 비배타적 통계다. 따라서 주제별 개수 합계는
대상 문서 수보다 클 수 있다. `기타`는 다른 주제가 0개인 문서만 센다.

## 4. `DOCUMENT_MAP.md` 구조

```markdown
# DOCUMENT_MAP.md - 문서 지도

이 지도는 git 경로, 파일명, 수정 이력으로 만든 기계적 색인입니다.
문서의 승인·정본·폐기 여부를 새로 판정하지 않습니다.

- 작성 기준 main SHA: `<full sha>`
- 작성일: `<YYYY-MM-DD>`
- 대상 문서 수: `<실측>`
- 제외한 `.omo/` 문서 수: `<실측>`
- 분류 규칙: `WORK_ORDER_C_DOC_CLEANUP.md`

## 먼저 읽을 문서

| 순서 | 문서 | 용도 |
|---:|---|---|
| 1 | PRODUCT_NORTH_STAR.md | 제품 최고 지침 |
| 2 | README.md | 저장소 안내 |
| 3 | `<현행 인계 문서>` | 현재 상태와 다음 작업 |
| 4 | TRAINORACLE_SPEC_INDEX.md | 스펙 색인 |

## 상태별 개수

...

## 문서군별 개수

...

## 주제별 개수

주제는 복수 집계이므로 합계가 대상 문서 수와 같지 않을 수 있습니다.

...

## 전체 목록

| 수정일 | 상태 | 문서군 | 주제(복수 가능) | 경로 |
|---|---|---|---|---|
...
```

전체 목록 정렬:

1. 수정일 내림차순, `UNKNOWN`은 마지막
2. 같은 수정일은 경로 사전순 오름차순

## 5. 검증

반드시 실제 산출물에서 다시 센다.

### 5.1 합계

- 전체 목록 행 수 = 대상 문서 수
- 상태별 합계 = 대상 문서 수
- 문서군별 합계 = 대상 문서 수
- `기타` + 하나 이상 주제 보유 문서 수 = 대상 문서 수
- 주제별 합계는 복수 분류라 일치 조건에서 제외

### 5.2 유일성·누락

- 대상 경로가 전체 목록에 정확히 1번씩 존재
- `.omo/` 경로 0건
- `현재-인계` 정확히 1건
- 허용하지 않은 상태·문서군·주제 0건
- 표 데이터 행은 파이프 기준 5열

### 5.3 변경 범위

작업 전 `git status --short`를 저장한다. 작업 후 새 변경은
`DOCUMENT_MAP.md` 하나뿐이어야 한다.

다른 변경이 보이면:

1. 아무 파일도 되돌리지 않는다.
2. 커밋하지 않는다.
3. 예상하지 못한 경로와 상태를 보고한다.
4. 사용자 또는 상위 작업자 지시를 기다린다.

`git checkout -- .`, `git reset --hard`, 재귀 삭제를 사용하지 않는다.

## 6. 제출

```bash
git switch -c codex/document-map
git add DOCUMENT_MAP.md
git commit -m "docs: add reproducible document map"
git push -u origin codex/document-map
```

그 다음 Draft PR을 만든다. `main`에 직접 push하지 않는다.

PR 본문:

- 기준 main SHA
- 대상·제외 실측 수
- 상태·문서군 개수
- 복수 주제 처리 방식
- `기타` 개수
- 삭제·이동·기존 파일 수정 0건
- 검증 명령과 결과
- 판단하지 않은 영역

## 7. 완료 기준

- `DOCUMENT_MAP.md` 한 파일만 추가
- 기존 파일 수정·삭제·이동 0건
- 숫자는 현재 git 기준 실측
- `.omo/` 전체 제외
- 현행 인계 선정 재현 가능
- 모든 문서가 상태·문서군 정확히 하나
- 모든 문서가 주제 하나 이상 또는 `기타`
- 다중 주제를 잃지 않음
- 비파괴 검증 완료
- Draft PR 발행

이 작업은 문서를 찾기 위한 색인이다. 정본 승격, 이슈 종결, 중복 파일 삭제를
수행하지 않는다.
