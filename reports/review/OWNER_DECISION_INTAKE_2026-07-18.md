# 책임자 결정 접수 기록 (2026-07-18)

```yaml
intake_id: TO-OWNER-DECISION-INTAKE-2026-07-18-01
recorded_by: FABLE_CHIEF_OF_STAFF
owner: COACH_HOJUNE
recorded_at: 2026-07-18T00:00:00+09:00 (수신 시각 기준, 정확 시각은 대화 로그)
status: SUPERSEDED_MAPPING_CONFIRMED
superseded_by: reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md
confirmed_mapping: "1=부하 구성, 2=개인별 최소 근거, 3=CA-02 경기 정체성 분리, 4=CA-03 수정(같은 현지 달력 날짜당 MAIN 최대 1회), 5=선택 내보내기·OS 공유 우선, 6=내부 비처방 QA 승인·파일럿은 전문가 검토 후"
decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
runtime_authority: false
packet_status_mutation: NONE (매핑 확정 전 패킷 결정란 변경 금지)
```

## 1. 사장님 지시 원문 (verbatim)

> 1 승인
> 2 승인
> 3 승인
> 4 수정안 승인: 경기별 기록 분리, 같은 대회일 MAIN 1회
> 5 A
> 6 내부 그림자 테스트 승인, 실제 파일럿은 전문가 검토 후

## 2. 접수자(Fable) 대조 결과

- Fable의 직전 보고(2026-07-18, PR #81·#84 검수 보고)는 번호 매긴 6개 안건
  목록을 포함하지 않았다.
- 저장소 내 결정 대기 목록과 번호가 1:1로 일치하는 문서를 찾지 못했다:
  - `FORMATION_RESEARCH_OWNER_BRIEF_KO.md`의 결정 대기 표는 5행
    (Load / Minimum Evidence / Competition Anchor / 정본 권한 정렬 / 메모 이동권 정렬).
  - 결정 패킷은 3건. `A/B` 선택지를 명시한 6문항 목록은 저장소에 없음.
- 따라서 이 번호는 **코덱스가 별도 채널로 제시한 목록**에 대한 응답일
  가능성이 높다. 원본 목록이 확정되기 전에는 아래 매핑은 **잠정(PROVISIONAL)**
  이며, 어떤 결정 패킷의 결정란도 변경하지 않는다.

## 3. 잠정 매핑 (내용 기반 추정 — 사장님 확인 필요)

| 번호 | 응답 원문 | 내용상 가장 근접한 안건 (잠정) | 확신도 |
|---|---|---|---|
| 1 | 승인 | Load Components 결정 패킷 (LC-01..09) | 낮음–중간 |
| 2 | 승인 | Minimum Evidence 결정 패킷 (ME 계열) | 낮음–중간 |
| 3 | 승인 | (미상 — 정본 권한 정렬 또는 메모 이동권 정렬 후보) | 낮음 |
| 4 | 수정안 승인: 경기별 기록 분리, 같은 대회일 MAIN 1회 | Competition Anchor 패킷 (CA-02/03/05 관련) | **높음** — 문구가 bout 분리·MAIN 노출 counting과 직접 대응 |
| 5 | A | A/B 선택형 질문 (원본 미확인; G0 provenance 또는 메모 export 복원안 후보) | 낮음 |
| 6 | 내부 그림자 테스트 승인, 실제 파일럿은 전문가 검토 후 | Shadow Protocol(WO014) 합성 테스트 vs 실제 파일럿 게이트 | **높음** — 기존 SHADOW/파일럿 구조와 정확히 대응 |

### 4번의 실질 내용 (매핑과 무관하게 유효한 방향 결정)

사장님의 4번 응답은 안건 번호와 무관하게 그 자체로 방향 결정을 담고 있다:

1. **경기별 기록 분리**: 예선·결승·복수 종목의 실제 경기 bout를 각각 기록으로
   분리 보존한다. (CA-02 권고와 일치)
2. **같은 대회일 MAIN 1회**: 같은 대회일(같은 competition day)의 완료 노출은
   MAIN 1회로 계산한다. 이는 현행 패킷 권고(CA-03/05: bout별 완료 노출 보존)의
   **수정안**이다 — 기록은 bout별로 분리하되, MAIN 노출 counting은 대회일당
   1회로 캡한다는 해석이 자연스럽다.
   - 이 해석이 맞는지, "같은 대회 이벤트당 1회"인지 "같은 달력일당 1회"인지는
     패킷 개정 시 코덱스가 정의를 고정하고 사장님이 재확인해야 한다.

### 6번의 실질 내용

- **내부 그림자(합성/synthetic) 테스트**: 승인. 단, 기존 계약대로 실제 계획·
  달력에 쓰기 금지(SP-05), 실제 참가자 등록 불가(SYNTHETIC_READINESS_ONLY) 유지.
- **실제 파일럿**: 전문가 검토(스포츠과학·청소년 safeguarding·개인정보 게이트)
  통과 전까지 열리지 않는다. 이는 기존 게이트 구조와 일치하며 새 권한을 만들지
  않는다.

## 4. 이 접수로 바뀌지 않는 것 (효력 경계)

- `runtime_authority: false` 유지. 자동 처방 런타임은 켜지지 않는다.
- 결정 패킷 3건의 `owner_decision`/`status`는 **매핑 확정 전까지 NOT_REVIEWED
  유지**. (검증기 `validate-formation-decision-packets.mjs`가 NOT_REVIEWED를
  고정 검사하므로, 상태 갱신은 패킷 개정·검증기 갱신과 함께 코덱스 작업으로
  진행한다.)
- 전문가 게이트(sport_science / statistics / privacy_safeguarding)와 인간 선별
  0/167은 이 결정으로 대체되지 않는다. 사람 검토 attestations는 여전히 0건.
- 숨겨진 ME/LC 세부 규칙 자동 승인 아님, 자동 처방 권한 개방 아님
  (사장님이 앞서 명시한 한계 유지).

## 5. 다음 절차

1. **사장님**: 아래 확인 질문에 답하여 매핑을 확정한다.
   - 이 1–6번은 어떤 목록(코덱스의 어떤 메시지/문서)에 대한 답변인가?
   - 4번 "같은 대회일 MAIN 1회"의 단위는 (a) 같은 달력일, (b) 같은 대회
     이벤트, 중 무엇인가?
   - 5번 "A"가 가리키는 질문과 선택지 A의 내용은 무엇인가?
2. **코덱스**: 매핑 확정 후 — 해당 패킷 결정란 기입, 4번 수정안 반영한
   Competition Anchor 패킷 개정(V2), 검증기 상태 검사 갱신을 한 PR로 제출.
3. **Fable**: 코덱스 PR을 독립 검수(원문 대비 반영 충실도, 검증기 무결성,
   효력 경계 유지)한 뒤 판정.

[END_INTAKE]
