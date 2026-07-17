# Formation Supplemental Search Log 2026-07-17

```yaml
status: SUPPLEMENTAL_CANDIDATES_PENDING_HUMAN_SCREENING
search_date: 2026-07-17
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
canonical_source_ledger_changed: false
canonical_claim_matrix_changed: false
runtime_authority: false
```

## 목적

정본 167개 패키지가 준비된 뒤 발견한 비주간 주기 직접성, 청소년 복합훈련, 개인내
최소근거, 대회 앵커 자료의 검색 흔적을 별도로 보존한다. 이 파일과 보충 후보 원장은
근거 승격이 아니다. 사람의 중복 확인, 선별, 추출, 평가를 통과하기 전에는 정본 claim의
상태나 자동 처방 규칙을 바꾸지 않는다.

## 검색 실행

| ID | 영역 | 데이터베이스·경로 | 검색식 또는 검색 묶음 | 결과 | 현재 판정 |
|---|---|---|---|---:|---|
| `SUP-A-PM-01` | 7일 대 비주간 직접 비교 | PubMed | `runner/running AND (7-day/weekly) AND (9-day/9.5-day/10-day/nonweekly) AND (microcycle/periodization/training cycle)` | 1 | 프로축구 5-9일 microcycle 관찰 1건. 러너 직접 비교 0건 |
| `SUP-A-PM-02` | 주기 길이 개인맞춤 비교 | PubMed | `runner/middle-distance/distance runner AND (microcycle length/extended microcycle/training cycle length) AND (comparison/randomized/individualized)` | 0 | 직접 비교 미발견 |
| `SUP-A-WEB-01` | 9일·10일 실제 사용 | 선수·코치·프로그램 공식 페이지 | `9-day` 또는 `10-day`와 선수·코치 이름 교차 검색 | 도구 분모 미보고 | Meb Keflezighi·Michael Ko·Sara Hall 9일과 Emma Bates·Sarah Jamieson·Hansons-Brooks 10일 사용 확인. 효능·보급률 아님 |
| `SUP-C-PRIMARY-01` | 청소년 복합 세션 | PubMed·PMC·출판사·기관 저장소 | 기존 RQ-C 결과에서 adolescent/junior middle-distance primary trials 원문 추적 | 17개 1차 자료 | 직접 비교는 없음. 좁은 구성요소 template만 후보 |
| `SUP-E-METHOD-01` | 개인내 최소근거 | PubMed·PMC·공식 지침·출판사 | N-of-1·SCED·측정오차·자기상관·추세·이월·결측·스포츠 적용 원문 추적 | 대상 추적 집합 | 보편 최소 n·신선도 미발견. 방법·지표별 승인 필요 |
| `SUP-K-PM-01` | 중거리 대회·taper | PubMed | middle-distance + competition/race + taper/recovery/scheduling/microcycle | 17 | 직접 후보 추적. 보편 taper/간격 없음 |
| `SUP-K-PM-02` | 중장거리 taper 구성 | PubMed | middle/long-distance runner + taper/precompetition + training variables | 8 | 성인 소표본·관찰 중심 |
| `SUP-K-PM-03` | 중거리 잔류 피로 | PubMed | middle-distance + residual fatigue/recovery kinetics + HIIT/sprint/interval | 1 | Yang 2026. 48시간까지만 측정 |
| `SUP-K-PM-04` | 800/1500 다중 라운드 | PubMed | 800/1500/middle-distance + heats/semifinals/successive days/rounds + performance/fatigue/recovery | 28 | 경기 구조는 지지. 회복 허가 시간은 지지하지 않음 |
| `SUP-K-OFFICIAL-01` | 청소년·회복 원칙 | IOC/BJSM/World Athletics 공식 페이지 | youth athlete + recovery + competition load + consensus | 도구 분모 미보고 | 개별화·모니터링 원칙만 사용. 수치 임계값 생성 금지 |

## 접근 한계

- SPORTDiscus, Scopus, Web of Science, Cochrane의 인증형 전수 검색은 수행하지 못했다.
- 일부 출판사 원문은 자동 접근에서 403을 반환했다. DOI 이동과 PubMed 공식 초록을
  대조했지만, 전문 미확인 자료에는 초록 밖의 결과를 추가하지 않았다.
- `NOT_FOUND_IN_THIS_SEARCH`는 전세계 부재 선언이 아니다.
- 웹에서 확인한 주기 사용 사례는 선수·코치·프로그램의 직접 진술만 남겼지만 여전히
  사용 사례일 뿐 비교효과나 보급률 자료가 아니다.

## 다음 게이트

1. `FORMATION_SUPPLEMENTAL_SOURCE_CANDIDATES_20260717.csv` 중복 확인.
2. 두 명의 인간 선별자 결정과 제외 이유 기록.
3. 포함 자료의 독립 추출과 충돌 해결.
4. 대상·설계·편향·직접성 평가.
5. 정본 claim 추가·변경 여부를 별도 승인.

이 순서를 통과하지 않으면 보충 자료는 설명과 결정 준비용 후보에 머문다.

## 식별자 재검증

18개 후보의 PMID·DOI·제목은 2026-07-17 NCBI PubMed ESummary로 다시 대조해
`FORMATION_SUPPLEMENTAL_IDENTITY_AUDIT_20260717.csv`에 고정했다. 후보 원장과 이 감사표가
어긋나면 `validate-formation-supplemental-evidence.mjs`가 실패한다. 이 확인은 서지 식별만
검증하며 선별·추출·편향평가를 대신하지 않는다.
