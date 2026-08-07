# D-19 — `OI-*` 224건 전수 대장

```yaml
packet: D-19
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)
- **판정 요약**: 유니크 OI **224건 = §3 기준값과 정확히 일치**. 상태 표기 분석: OPEN 182줄 / RESOLVED 1건(단독 `OI-NSR-EXPORT-DRIFT-001` = RESOLVED_SPEC_ONLY) / CLOSED 0건 / **상태 미표기 91건** / canonical blocker `YES` 유니크 67건 / **상태 충돌 0건** (같은 OI가 문서별 OPEN/RESOLVED 상이 표기 — 없음)
- **OD-REQ**: 1건 (OD-REQ-D19-001)

## 1. 방법

지시서 §12 D-19(L913~943)에 따라 단일 패스로: (1) 유니크 OI 수집(`/tmp/d19_oi.txt` — 224줄), (2) (OI, 파일) 쌍 → 문서 수 집계(`/tmp/d19_count.txt` — 224 OI·99 파일), (3) OI 등장 줄(`/tmp/d19_lines.txt` — 674줄)에서 OPEN/미해결·CLOSED/RESOLVED·canonical blocker·상태 미표기 분류.

## 2. 전수 대장 (요약 — 224건 전체는 /tmp 및 파일 원문에서 확인 가능)

### 2-1. 상태 표기 분류

| 상태 표기 | 유니크 OI 수 | 비고 |
|---|---:|---|
| OPEN (어딘가에서) | 182줄(중복 포함) | 대부분의 스펙 OI |
| RESOLVED 단독 | 1 | `OI-NSR-EXPORT-DRIFT-001` = `RESOLVED_SPEC_ONLY` — 유일한 종결 표기 |
| CLOSED | 0 | — |
| **상태 미표기** | **91** | 아래 2-3 참조 |
| canonical blocker `YES` | **67** | `| YES |` 토큰 유니크 수 |

### 2-2. 상태 충돌 검출 — **0건**

같은 OI가 어떤 문서에선 OPEN, 다른 문서에선 RESOLVED/CLOSED로 표기된 케이스: **없음**. OI 별 상태 토큰 집합이 문서 전역에서 일관된다. (단, 상태 자체가 전혀 없는 91건은 "충돌"이 아니라 "부재"다.)

### 2-3. 🔴 상태 미표기 91건 — 영원히 미해결 위험

상태가 어디에도 표기되지 않은 OI 91건은 "미해결 이슈인데 상태가 없는 채 방치"된 것. 주요 계열:

| 이름공간 | 건수 | 대표 예 |
|---|---:|---|
| `OI-AIB-*` (APP_IMPLEMENTATION_BRIDGE) | 다수 | AIB-CONSENT-LEGAL-BASIS-001, AIB-DB-VENDOR-001, AIB-ENCRYPTION-KEY-MGMT-001, AIB-GUARDIAN-CONSENT-001… |
| `OI-SC-*` (SESSION_CLASSIFIER) | 다수 | SC-SPORT-TYPE-EXPANSION-001, SC-EPOC-BAND-THRESHOLD-001… |
| `OI-MTC-*`, `OI-RHR-*`, `OI-TEST-DATA-ANONYMIZATION-*` 등 | 다수 | reconstruct 문서군 |

> ⚠️ 재현 주의 (2026-08-07 Round 3 종결 점검): 위 표의 `OI-TEST-DATA-ANONYMIZATION-*`는 **이 보고서가 예시로 쓴 토큰이며 저장소 어디에도 실존하지 않는다** — `git grep` 전역 OI 카운트(§3 기준 224)를 오염시키므로, 기준값 재현 시 `git grep ... HEAD -- '*.md' ':!reports/review/deepseek-audit/*'`로 자기 산출물을 제외해야 한다 (2026-08-07 실측: 제외 시 OI=224 정확 일치).

**주의:** 이름공간이 스펙 자기 소속(`OI-AIB-*`라면 APP_IMPLEMENTATION_BRIDGE가 소속)이라면 미표기 OI는 해당 스펙 본문에 `| YES/NO | OPEN |` 형태 표 없이 나열만 된 것. D-20의 신고값 대조와 연결해 D-20 보고서에서 심화 확인.

### 2-4. 등장 문서 수 상위 (교차 참조 밀도)

| OI | 등장 문서 수 |
|---|---:|
| `OI-PG-RULE-SAFETY-GATE-BINDING-001` | 25 |
| `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | 21 |
| `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` | 16 |
| `OI-RVE-RULE-EVALUATOR-BINDING-001` | 13 |
| `OI-PG-OPTION-RATIONALE-PRIVACY-001` | 13 |

등장 문서 수가 많은 OI는 cross-doc 인용이 많다는 뜻으로, 상태가 어디 한 곳이라도 바뀌면 여럿이 함께 낡을 위험이 크다.

### 2-5. 알려진 1건 (인용만)

| OI ID | 상태 | canonical blocker? | 소속 |
|---|---|---|---|
| `OI-DSB-FRAME-LOAD-CAP-001` | OPEN | no | `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` §8 — D-14/D-18에서 상세 인용(71% 상한 초과 측정 기록 포함) |

## 3. 핵심 발견

1. **유니크 OI 224건 — §3 기준값과 1건 오차 없이 일치.** 인벤토리 자체는 완결.
2. **상태 충돌 0건**은 긍정 신호지만, **상태 미표기 91건(41%)** 이 실질 위험: "상태 없는 미해결 이슈는 영원히 미해결"이라는 지시서 경고가 그대로 적용된다.
3. **종결 표기가 사실상 부재**: RESOLVED 단독 1건뿐. 즉 **전체 OI의 99.6%가 미해결 상태** — 이는 도큐먼트 랜드스케이프 전체가 "진행 중/미결"임을 반영하며, D-20 자기신고값 실측과 함께 신뢰성 판단에 쓴다.
4. canonical blocker 67건은 발행 후 반드시 해소돼야 하는 게이트 — D-22 종합에서 상위 위험 항목으로 연결.

## 4. OD-REQ (결정 요청)

### OD-REQ-D19-001 — 상태 미표기 OI 91건에 상태 부여 규칙
- **사실**: 224건 중 91건이 어느 문서에도 OPEN/RESOLVED/CLOSED 상태를 갖지 않는다.
- **왜 내가 결정하지 않는가**: 각 OI의 실제 진행 상태(미착수/진행/철회)는 스펙 소유자(오너·작성자)만 정확히 알 수 있고, 추측으로 상태를 부여하면 D-20 자기신고 대조까지 오염시킨다.
- **선택지 A**: 이름공간별 소속 스펙에 상태 표를 강제하고 91건 전부 채운다.
- **선택지 B**: 상태 부재 OI를 "미해결로 간주"하는 규칙을 문서화하고, 실제 종결(철회/해소)만 표기한다.
- **어느 문서를 함께 봐야 하나**: D-05(상태 어휘), D-04(메타데이터 스키마), D-20(신고값 대조), 각 소속 스펙의 OI 표.

## 5. 인용·판정 누수 점검

- §3 기준값(224)과 단일 패스 결과를 정확히 대조해 일치 확인.
- 상태 충돌 검출 로직을 (OI, 상태 토큰) 단위로 명시 — 빈 결과가 스캔 오류가 아님을 보증.
- 알려진 1건(OI-DSB-FRAME-LOAD-CAP-001)은 재조사 없이 인용.
