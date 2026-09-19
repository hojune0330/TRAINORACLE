# PROGRAMMED_ANALYSIS_LUNA_FAILURE_SCENARIO_REVIEW_2026-09-17.md

## 검토 성격

- 검토일: 2026-09-17
- 검토 대상: reports/research/PROGRAMMED_TRAINING_ANALYSIS_AND_EVIDENCE_PRODUCT_REVIEW_2026-09-17.md
- 대조 기준: TRAINORACLE-private-memo-save-hotfix-20260913
- 로컬 기준 SHA: 4b1a0834cbd53276db6f3cd4b47c090f106692c3
- 판정: 정적 적대적 검토. 가상 페르소나와 합성 입력을 사용한 실패 경로 분석이며 실제 사용자 연구나 전문가의 독립 승인으로 볼 수 없다.
- 제한: 코드 구현, 배포, Git 변경, 실제 선수 자료, 비밀 파일, 외부 AI API 호출을 수행하지 않았다. 테스트도 실행하지 않았다.

이 문서는 제안서를 다시 요약하지 않는다. 제안서가 말한 방향을 실제 코드·현재 스펙의 경계에 대입했을 때, 파서가 성공해도 분석이 거짓이 되거나 일부 데이터가 사라질 수 있는 지점을 우선한다. 확인된 결함은 현재 코드 또는 현재 계약에서 직접 확인되는 구조적 누락이다. 설계상 가능성은 현재 기능이 아직 연결되지 않았지만 제안된 확장 방식에서 재현될 수 있는 실패다. 아래의 추가 계약과 검증법은 검토 조건이며 새 기능이나 스펙을 채택할 권한을 부여하지 않는다.

## 기준 확인

- AGENTS.md와 PRODUCT_NORTH_STAR.md를 먼저 읽었다. 두 문서는 안전 게이트, 출처·provenance, 계획과 실제 수행의 분리, private memo의 분석 제외, 불확실할 때 판단보류, 외부 데이터의 자동 채택 금지를 기준으로 둔다.
- 기준 checkout의 HEAD가 위 SHA와 일치하고 검토 시점 working tree에 변경이 없음을 확인했다. 이는 현재 로컬 파일의 기준일 뿐, 배포 상태나 런타임 동작의 증거가 아니다.
- 제안서 자체도 REVIEW_PROPOSAL_NOT_IMPLEMENTED, canonical_promotion: false, runtime_tests_executed_for_this_review: 0, remote_or_deployed_state_verified: false를 명시한다. 이 문서도 그 경계를 유지한다.
- .env, 백업 폴더, 실제 선수 자료는 열지 않았다.

## 사실·가설·미확인 구분

- 사실: 기준 checkout의 현재 코드와 현재 스펙에 존재하는 자료형, 분기, 저장 식별자, 공개된 상태 문구, OPEN 항목을 파일:줄로 인용했다. 현재 imported 값이 분석에서 제외되는 경계와 계획 완료 표시가 실제 수행이 아니라는 계약도 사실로 취급했다.
- 가설: “파서는 성공했지만 의미가 틀린 분석”, 향후 provider·분석·공유·reward가 연결될 때의 이중 집계·과다 노출·권한 혼동은 합성 시나리오로 제시한 재현 가능성이다. 실제 계정이나 provider에서 이미 발생했다고 주장하지 않는다.
- 미확인: 런타임 UI, 배포 상태, provider 승인·OAuth, 실제 파일의 provider별 시간 의미, 현재 import 경로의 reward hook 호출 여부, 실제 사용자·보호자·운영자 반응은 확인하지 않았다. 따라서 이 항목들에 대해 PASS, 완료, 승인 또는 실사용 증거를 쓰지 않는다.

## 고가치 발견

### F1. 출처·행 단위 식별자가 없어 동일 훈련이 중복된다

- 판정: **확인된 식별 범위 결손 + 설계상 가능성**. 계정 저장 경로에는 같은 parsed file의 같은 순서·같은 내용 재수입을 위한 안정 ID와 sameImportedSnapshot 재사용이 있다. 따라서 멱등성 자체가 전혀 없다고 판정하지 않는다. 다만 그 ID가 provider identity가 아니고 sourceIndex에 의존하므로, 행 순서 변경·다른 provider·파일 내 반복 행의 동일성은 별도 문제다.
- 우선순위: **P1**
- 근거: app/src/domain/import/activity-file.ts:7-23의 ImportedActivity에는 provider, 원본 activity ID, payload digest가 없다. app/src/domain/import/import-draft.ts:69-87은 각 행을 기존 저장값과만 비교하고 같은 파일의 다른 행끼리는 비교하지 않는다. app/src/screens/ImportActivities.tsx:84-95는 기존 중복·reconciliation 후보가 없는 같은 파일의 행을 모두 자동 선택할 수 있다. 계정 경로 app/src/domain/import/account-import.ts:40-43은 sourceIndex를 붙이고, :79-87은 format·sourceIndex·activity로 안정 ID를 만든 뒤 sameImportedSnapshot이면 기존 내용을 재사용한다. 반면 일반 local 저장 app/src/domain/import/import-draft.ts:191-216은 새 local ID를 만든다. 누적 집계는 app/src/domain/cumulative-distance.ts:56-146에서 로컬 sourceKind:sourceId만 묶는다.
- 시나리오/피해: 같은 파일을 같은 순서·같은 내용으로 계정 모드에서 재수입하면 안정 ID와 snapshot 재사용으로 추가 기록이 생기지 않는 경로가 있다. 그러나 행 순서를 바꾸면 sourceIndex가 바뀌어 같은 활동이 새 ID가 될 수 있고, 같은 CSV에 동일 행을 두 번 넣으면 서로 다른 sourceIndex로 두 행이 선택될 수 있다. 다른 provider가 같은 format·위치·정규화된 값을 내보내면 provider namespace가 없어 같은 ID로 재사용될 수도 있고, format이나 값이 다르면 별도 ID가 된다. 현재는 imported 값이 통계에서 제외되지만, 이후 provider 데이터나 분석 허용 범위가 넓어지면 누적이 중복되거나 서로 다른 provider 기록을 한 출처로 오인할 수 있다. 날짜와 거리만 같은 오전·오후의 실제 두 세션은 반대로 중복으로 잘못 표시될 수 있다.
- 현재 검토안이 잡는지: **부분 포착**. 제안서 :231-243, :277-289가 중복과 provider update를 문제로 적지만 provider namespace, sourceRecordId, 같은 파일 내부 비교, 충돌 승자 금지를 계약으로 고정하지 않는다.
- 수정 방향: 현재 계정 경로의 안정 ID·snapshot 재사용은 유지하되 이것을 provider identity로 부르지 않는다. provider namespace와 immutable sourceRecordId를 별도로 보존하고, 파일-only 행에는 파일 digest·행 fingerprint·원본 행 번호를 보조 식별자로 둔다. exact_duplicate, likely_duplicate, conflict, distinct를 분리하고 자동 merge·overwrite·winner 선택은 금지한다. sourceIndex가 바뀌어도 같은 파일 행을 추적할 수 있는지 확인하며, 오전·오후와 시간 의미가 다른 세션은 분리한다.
- 장점/비용: 중복 집계와 재수입 불일치를 줄이고 출처 추적이 가능해진다. 대신 기존 local ID와의 migration, 사용자 선택 화면, provider별 identity 매핑 비용이 생긴다.
- 검증법: 계정 모드에서 동일 parsed file의 동일 순서·내용 재수입은 같은 ID와 sameImportedSnapshot 재사용으로 추가 행 0인지 확인한다. 이어서 행 순서 변경, 같은 파일의 반복 행, 같은 format·위치·내용의 다른 provider, format·값이 다른 provider, 동일 거리의 AM/PM 두 세션을 합성한다. 기대값은 안정 ID가 성립하는 경우를 보존하면서도 provider가 없는 동일성은 자동 확정하지 않고, 충돌은 두 값을 보존한 REVIEW_REQUIRED다. 일반 local 모드의 반복 저장은 별도 동작으로 표시한다.

### F2. 파서는 성공하지만 elapsed·moving·timer 의미를 잃어 잘못된 비교를 만든다

- 판정: **확인된 구조적 결함**. 실제 잘못된 비교가 발생하는지는 provider 파일의 시간 의미에 달린 설계상 가능성이지만, 현재 자료형이 그 의미를 표현하지 못하는 것은 확인됐다.
- 우선순위: **P1**
- 근거: app/src/domain/import/activity-file.ts:61-78은 거리 또는 시간 하나만 있어도 활동을 만들고, :92-116은 TCX lap의 TotalTimeSeconds를 합산하지만 moving/timer/elapsed 의미를 보존하지 않는다. :130-167의 GPX는 첫 timestamp와 마지막 timestamp 차이를 duration으로 만들고 중간 정지·시간 공백을 별도 상태로 남기지 않는다. 결과 타입 :7-23에는 duration semantics, lap boundary, source timezone가 없다. 구조화 파일도 app/src/domain/import/structured-activity-file.ts:1-12에 의미 필드가 없다.
- 시나리오/피해: 시계가 일시정지를 포함한 elapsed 30분과 moving 20분을 모두 내보냈는데 현재 흐름이 elapsed를 운동 시간으로 표시하면 pace가 느려지고 계획 대비 수행이 나빠 보인다. GPX의 두 점 사이 25분 공백이 회복·정지였어도 한 구간의 운동 시간으로 합쳐질 수 있다. 파싱은 정상이고 숫자도 유한하지만, 사용자는 잘못된 훈련 해설을 사실로 읽는다.
- 현재 검토안이 잡는지: **부분 포착**. 제안서 :126-157, :192-205가 계획·실제 및 시간 의미를 구별하라고 하지만, 현재 importer에는 의미 불명 상태와 pace 계산 차단 조건이 없다.
- 수정 방향: duration을 moving, elapsed, timer, unknown으로 분리하고 원본 필드명·provider mapping·timezone을 보존한다. 의미가 unknown이거나 provider 의미가 충돌하면 pace, 계획 비교, 에너지 시간 해설을 판단보류로 둔다. lap/rest/시간 공백은 요약에 숨기지 말고 coverage와 함께 표시한다.
- 장점/비용: 숫자 자체가 맞아도 해석이 틀리는 경로를 막고 설명의 출처가 선명해진다. 사용자가 “시간은 있는데 왜 비교가 안 되나”를 확인해야 하는 추가 검토 비용이 있다.
- 검증법: moving과 elapsed가 다른 TCX, pause가 포함된 활동, GPX의 큰 timestamp gap, timestamp 없는 거리 파일, 서로 다른 timezone의 자정 경계 파일을 합성한다. 기대값은 의미가 확정된 경우에만 pace·비교가 생성되고, 그렇지 않으면 INSUFFICIENT 또는 REQUIRES_REVIEW다.

### F3. distanceKm라는 헤더만 믿어 오래된 Excel·CSV의 단위를 오해한다

- 판정: **확인된 현재 importer 결함 + 설계상 가능성**. 이미 알려진 canonical distanceKm 필드에 순수 숫자가 들어오는 경우마다 단위 질문을 강제해야 한다는 뜻은 아니다. 알려진 형식의 순수 숫자와, 레거시 mapping 또는 접미사가 붙은 모호한 입력을 분리해야 한다.
- 우선순위: **P1**
- 근거: app/src/domain/import/structured-activity-file.ts:1-12의 행 타입에는 unit 또는 column mapping version이 없다. :18-21의 parseFloat는 “5 miles”를 5로 읽을 수 있고, :104-116은 distanceKm라는 헤더 이름만 요구한다. app/src/screens/import-activities/ImportStages.tsx:151-156은 결과를 km로 표시한다. 제안서 :80-93은 낯선 CSV와 Excel에 사용자가 date/distance/time을 매핑한다고 하지만 단위 선택·변환 미리보기·애매함 중단 조건을 정하지 않는다.
- 시나리오/피해: 알려진 canonical distanceKm 형식의 순수 숫자라면 기존 contract가 km를 뜻하는 것으로 처리할 수 있다. 문제는 레거시 파일을 distanceKm로 잘못 매핑했거나, “5 miles”처럼 필드명과 값의 의미가 충돌하는 경우다. 현재 parseFloat는 파싱 오류를 내지 않고 5를 만들며 화면은 km로 표시하므로, 사용자는 정상 숫자로 보이는 5를 5km로 오해한다. 혼합 단위 행은 한 파일 안에서 일부만 틀릴 수 있다.
- 현재 검토안이 잡는지: **부분 포착**. 제안서의 mapping 절차는 알려진 형식의 반복 질문을 줄일 수 있지만, 접미사·레거시 mapping·혼합 단위를 모호함으로 멈추는 규칙은 미포착이다. 현재 xlsx 자동 import가 구현됐다는 주장은 하지 않는다.
- 수정 방향: canonical distanceKm처럼 계약상 단위가 이미 확정된 순수 숫자에는 추가 질문을 반복하지 않는다. 반대로 Excel 또는 낯선 CSV에서 열을 매핑할 때 단위가 unknown이면 그때만 원 단위와 변환식을 선택하게 하고 mapping version을 저장한다. 헤더 이름을 단위의 유일한 증거로 삼지 말고, 숫자 토큰은 엄격히 파싱해 접미사·로케일·혼합 단위를 별도로 처리한다. 모호한 행은 저장 여부와 무관하게 분석 입력에서는 제외하고 변환 전후 샘플을 확인하게 한다.
- 장점/비용: 알려진 형식의 마찰은 늘리지 않으면서 레거시 단위 오류를 걸러낸다. mapping 상태와 모호한 행 처리를 추가해야 하고, 기존 파일 재수입 시 mapping을 다시 확인할 수 있다.
- 검증법: canonical distanceKm의 순수 숫자, 1 mile, 1 km, 1000 m, “5 miles”, 소수점·천 단위·쉼표 로케일, 한 파일 혼합 단위, 잘못된 mapping을 각각 합성한다. 기대값은 canonical 순수 숫자는 불필요한 질문 없이 유지되고, 모호한 값은 원 단위가 확인되기 전 km로 가장하지 않으며 분석 대상이 아니다.

### F4. 수동 import와 provider 정정·삭제·동의 철회의 경계를 분리해야 한다

- 판정: **현재 scope 경계 + 설계상 가능성**. 수동 파일 import가 원본 서비스의 삭제를 자동으로 알 수 없다는 점 자체는 현재 약속되지 않은 기능이며, 현행 코드의 버그라고 확정하지 않는다. 확인된 것은 외부 source lineage가 없다는 사실이고, provider 연결을 향후 추가할 때 update/delete/revocation 계약이 별도로 필요하다는 점이다. 동의 철회가 과거 기록을 즉시 삭제해야 한다는 정책은 이 검토에서 발명하지 않는다.
- 우선순위: **P1**
- 근거: app/src/domain/import/activity-file.ts:7-23에 source activity ID/version이 없고, app/src/domain/journal-observation.ts:42-50,195-207의 sourceRef는 local sourceId를 사용하며 sourceVersion은 null이다. 계정 import 식별은 app/src/domain/import/account-import.ts:79-87에서 format·행 순서·현재 내용에 묶인다. app/src/domain/import/import-draft.ts:191-216의 저장은 새 local entry를 만들 뿐 원본 서비스의 정정·삭제를 수신하는 기능을 만들지 않는다. 외부 연동 스펙 specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md:241-258,300-315도 provider update/delete와 revocation runbook을 OPEN으로 남긴다.
- 시나리오/피해: 현재 수동 파일 흐름에서는 사용자가 provider에서 10km 활동을 8km로 정정하거나 원본을 삭제해도 TrainOracle에 자동 통지가 온다고 가정할 수 없다. 사용자가 다시 가져오면 old/new가 별도 행으로 보일 수 있다는 것은 향후 중복·stale 해석의 가능성이다. provider 연결을 나중에 붙이면서 이 경계를 명시하지 않으면, 어떤 local row가 source의 정정·삭제와 관계있는지 모른 채 pending 재시도나 분석 채택을 처리할 위험이 생긴다.
- 현재 검토안이 잡는지: **수동 import의 미약속 기능을 결함으로 잡지는 않는다.** 제안서 :203, :241, :260-275, :277-289가 update/delete를 미래 검증 항목으로 적은 것은 포착한다. 다만 provider 연결을 위한 source lineage, 상태 전이, 보존·삭제 의미는 여전히 미정이다.
- 수정 방향: 수동 파일 import에는 “원본 서비스 변경을 자동 추적하지 않음”을 사실대로 표시한다. provider 연결을 별도 검토할 때만 source identity, correction lineage, revoked 또는 purge 관련 상태와 보존 의미를 정한다. local 휴지통, 계정 연결 해제, provider 동의 철회를 같은 상태로 묶지 않으며, 그 어느 것도 자동으로 안전 게이트를 낮추거나 과거 기록의 즉시 삭제를 의미하게 하지 않는다.
- 장점/비용: 현재 기능의 약속 범위를 정직하게 유지하면서 provider 확장 때 필요한 결정 지점을 드러낸다. provider별 lineage·철회·정리 정책을 별도 설계하고 운영해야 하므로 향후 비용이 생긴다.
- 검증법: 수동 파일 재import, provider 연결이 없는 상태의 원본 정정·삭제, provider 연결을 가정한 동일 source ID 정정, pending 중 연결 해제, local trash 뒤 재import를 분리해 합성한다. 기대값은 수동 import가 외부 삭제를 안다고 표시하지 않고, 미래 provider 경로에서는 source 관계와 미정 상태가 숨겨지지 않는다.

### F5. 계획 완료 표시가 실제 수행으로 읽힌다

- 판정: **설계상 가능성**. 현재 스펙은 분리를 요구하고 코드도 일부 분리하지만, day/slot 진행 표시와 실제 기록의 결합 방지가 충분히 고정되지 않았다.
- 우선순위: **P1**
- 근거: app/src/domain/energy-system-ledger.ts:255-293의 summarizeCurrentPlanEnergy는 sessionDay:sessionSlot 진행 상태에서 COMPLETED를 세며 실제 journal record와 연결하지 않는다. app/src/domain/personal-oracle.ts:141-146은 “예정 회수 중 완료 표시 회수”를 별도 문구로 만들지만, 제안서 :126-157,211-219는 실제·계획·비교를 한 결과 흐름에 놓는다. 현재 계약 specs/reconstruct/PERSONAL_ORACLE_EXPLANATION_CONTRACT.md:60-72는 완료 표시가 실제 adherence가 아님을 명시한다.
- 시나리오/피해: 사용자가 세션을 하기 전에 계획을 완료 표시하거나, 실제 journal 없이 표시만 남기면 보고서의 완료 수는 증가한다. 계획이 수정된 뒤 같은 day/slot에 남은 표시가 새 계획과 합쳐지면 더 나쁜 사례다. 코치용 한 페이지에서 “완료”가 실제 수행으로 축약되면 사용자는 잘못된 순응도 판단을 받는다.
- 현재 검토안이 잡는지: **계약상 경계는 포착하지만 제품 오인 경로는 미포착**. :126-157의 분리 의도만으로는 UI·집계 join을 막지 못한다.
- 수정 방향: PLANNED, PROGRESS_MARK, OBSERVED_SESSION, LINKED_AS_PLANNED를 데이터와 화면에서 분리한다. actual record가 없으면 완료율이나 adherence를 만들지 않고, 연결은 명시적인 plannedSessionLink와 처방 fingerprint가 있을 때만 허용한다. 날짜·slot만으로 두 사실을 합치지 않는다.
- 장점/비용: 사용자가 자신의 표시와 실제 기록을 즉시 구분한다. KPI가 덜 단순해지고, link 상태와 처방 revision을 추가로 설명해야 한다.
- 검증법: 완료 표시만 존재, actual이 부분 저장, 같은 day/slot의 AM/PM 두 세션, 계획 수정 후 이전 표시, 실제 기록이 다른 날인 경우를 합성한다. 기대값은 progress와 observed count가 별도로 보이고, 연결되지 않은 표시는 수행 증거가 아니다.

### F6. 부분 파싱·부분 저장·네트워크 중단의 상태가 이어지지 않는다

- 판정: **확인된 parser/UI 상태 세분화 결손**. 계정 저장이 탭 종료 뒤 사라진다고 확정하지 않는다. account-import에는 선택 행을 고정하고 안정 ID·sameImportedSnapshot·acknowledged·pending/conflict/fail를 처리하는 경로가 있으며, 현재 정적 근거만으로 durable account store의 재로딩 결과를 판정할 수 없다.
- 우선순위: **P1**
- 근거: app/src/domain/import/activity-file.ts:19-27,170-191의 결과는 activities, skipped, format뿐이며 malformed XML이나 unknown 입력은 EMPTY로 돌아갈 수 있다. app/src/screens/ImportActivities.tsx:60-95는 전체 텍스트를 동기적으로 파싱하고 0건이면 generic empty/unreadable 경로로 보낸다. app/src/screens/import-activities/read-file.ts:1,13-49도 10MB 파일을 한 번에 읽는다. 계정 저장은 app/src/domain/import/account-import.ts:58-140에서 선택 행을 고정하고 안정 ID를 만든 뒤 snapshot 재사용, acknowledged, pending/conflict/fail를 처리한다. 화면의 confirmation 참조는 app/src/screens/ImportActivities.tsx:115-135에 있지만, 이것만으로 계정 저장이 재로딩 뒤 소실된다고 결론낼 수는 없다.
- 시나리오/피해: 10,000행 중 9,999행이 정상이어도 현재 parser result의 skipped 숫자만으로는 행별 coverage와 누락 원인을 알 수 없다. 반대로 malformed XML 한 곳 때문에 전체가 0건이 되어 사용자는 파일이 비었다고 생각할 수 있다. 계정 저장 중 network drop이 발생하면 현재 화면에서 pending/conflict/fail를 구분할 수 있지만, 같은 parsed file의 같은 순서·내용 재수입은 account-import의 안정 ID·snapshot 재사용 경로가 있다. 행 순서가 바뀌거나, 일반 local 저장을 반복하거나, durable retry 경계가 별도로 연결되지 않은 경우의 중복·재개 동작은 미확인이다.
- 현재 검토안이 잡는지: **부분 포착**. 제안서 :93, :260, :266, :284가 부분 성공과 오류 가시화를 언급하지만 import batch ID, 행별 상태, resume 경계, server-confirmed coverage를 정의하지 않는다. 다만 계정 저장의 멱등성이 전혀 없다고 말할 근거도 없다.
- 수정 방향: 파일 digest와 안정적인 row identity를 가진 import batch와 read, validated, reviewed, accepted, saved, pending, rejected, stale의 행별 상태가 필요한지 별도 계약으로 결정한다. malformed parser는 skipped 0과 empty를 구분하고, 재시도는 이미 존재하는 account-import 안정 ID와 충돌하지 않도록 batch identity를 명시한다. 화면에는 seen/accepted/saved/pending/rejected 분모·분자를 같이 보인다. 오프라인 초안 보호와 계정 정본 저장·server-confirmed 상태를 서로 다른 상태로 표시한다.
- 장점/비용: 저사양·불안정 네트워크에서도 실제 확인된 저장 범위를 설명할 수 있고, 지원자가 저장 여부를 추측하지 않는다. 로컬 보류 데이터의 정리·암호화·보존 기간과 retry UI를 별도 결정해야 한다.
- 검증법: 합성 파일의 한 행 malformed, 중간 abort, 탭 종료 후 재개, 동일 파일의 동일 순서·내용 재수입, 행 순서 변경, 일반 local 모드 반복 저장, 저장 400행 뒤 network failure, pending 중 account logout을 분리해 검증한다. 기대값은 server-confirmed가 아닌 행이 저장 완료로 표시되지 않고, account-import의 안정 ID가 성립하는 재시도는 추가 행을 만들지 않는다. 탭 종료 후 durable 복구 여부는 실제 저장 계약이 정해진 뒤에만 판정한다.

### F7. “코치용 한 페이지”가 보호자·선수의 공유 범위를 넘을 수 있다

- 판정: **설계상 가능성**이며, 현재 권한·필드 모델이 가진 범위 불일치는 **확인된 설계 경계**다.
- 우선순위: **P1**
- 근거: app/src/domain/account/relationships.ts:10-34의 기본 sharedFields 후보에는 TRAINING_NOTE, PAIN, MOOD, BODY_STATE가 포함된다. app/src/domain/account/profile.ts:7-23,53-83은 보호자 권한을 ACCOUNT_SYNC, FIRST_LINK, SHARE_EXPANSION, SEASON_RENEWAL로 나누지만, 새 분석 한 페이지의 field-level audience 계약은 아니다. app/src/domain/safe-export.ts:41-70도 구조화된 painParts 등을 유지한다. 제안서 :219는 구조·실제·비교·source range를 공유하되 memo/health raw를 제외한다고 하나, 현재 specs/reconstruct/PERSONAL_ORACLE_EXPLANATION_CONTRACT.md:91-96과 specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md:128-150,455-485가 요구하는 선택 필드·철회·만료·redaction/App Bridge binding은 완료되지 않았다.
- 시나리오/피해: 부모는 거리와 날짜만 보고 싶어 했는데 코치용 공용 projection이 pace, RPE, pain/body state까지 포함할 수 있다. under-14 사용자가 확대 공유를 원하지 않아도 기존 support connection의 넓은 후보 필드와 한 페이지가 결합될 수 있다. public profile이나 링크 열람을 Oracle 비교 동의로 오해하면 선수·보호자가 철회할 경로를 찾지 못한다.
- 현재 검토안이 잡는지: **부분 포착**. “범위 확인” 문구는 있지만 athlete/coach/guardian/audit별 허용 필드, default deny, TTL·revoke, screenshot/export까지 같은 redaction을 적용하는 계약이 없다.
- 수정 방향: audience별 immutable projection을 따로 만들고 기본값은 최소 구조 필드로 둔다. 공유 전 선택 필드, 보호자 권한 scope, 만료·철회·열람 audit를 함께 저장한다. private memo, raw symptom, raw provider payload는 이 분석 경로에서 제외하며 새 allowlist로 해제할 대상으로 취급하지 않는다. public profile은 comparison consent가 아니다.
- 장점/비용: 공유의 예측 가능성과 보호자 신뢰가 높아진다. 같은 내용을 재사용하지 못하고 audience별 테스트·문구·철회 처리가 늘어난다.
- 검증법: parent가 sharing을 거부한 계정, coach만 허용한 계정, 한 필드만 확장한 계정, revoke 직후 link 열람, export·screenshot·tooltip, private memo와 pain 입력을 각각 합성한다. 기대값은 허용하지 않은 필드가 projection·export·preview 어디에도 나타나지 않는다.

### F8. 파일의 그럴듯한 메타데이터와 과도한 좌표가 사용자-facing 사실을 만든다

- 판정: **확인된 입력 검증 결손**. 현재 imported 값이 분석에서 제외되므로 즉시 공식 통계를 오염시킨다고 말할 수는 없지만, 가짜 preview·저장과 향후 채택은 **설계상 가능성**이다.
- 우선순위: **P1**
- 근거: app/src/domain/import/structured-activity-file.ts:18-21은 숫자 뒤의 단위를 검증하지 않고 prefix를 읽는다. app/src/domain/import/activity-file.ts:119-167의 GPX 경로는 좌표 범위와 point 수를 제한하지 않고 haversine을 누적한다. app/src/screens/ImportActivities.tsx:46-78의 10MB 제한은 파일 크기일 뿐 파싱 복잡도·메모리·렌더링 행 수 제한이 아니다. app/src/domain/field-provenance.ts:78-94,121-144는 provenance를 검증하지만 외부 파일의 metadata가 진짜 provider가 작성했다는 인증은 하지 않는다.
- 시나리오/피해: 파일 이름이나 name에 COROS·공식이라는 문자열을 넣고, 실제 값은 사용자가 만든 거리·시간으로 넣어도 파싱 결과는 정상일 수 있다. 유효 범위 밖 좌표나 반복 point가 거리와 pace를 그럴듯하게 만들고, 작은 모바일 화면에서는 매우 큰 행 목록이 멈춤·브라우저 종료를 부를 수 있다. 사용자는 “파서가 성공했으니 기록이 진짜”라고 오해한다.
- 현재 검토안이 잡는지: **부분 포착**. 제안서 :192-205, :277-289가 provenance와 tampering test를 말하지만, local file parser가 metadata를 신뢰하지 않아야 한다는 규칙, 좌표·point·lap 예산, 실패 시 REVIEW_REQUIRED가 없다.
- 수정 방향: 파일명·표시명·deviceName은 신뢰하지 않는 표시용 값으로만 둔다. 숫자 문법, 위경도 범위, point/lap/row 수, 누적 거리·시간 및 CPU/메모리 예산을 제한하고, 초과는 즉시 부분 성공 또는 검토 필요로 보인다. 원본 digest와 parser version을 보존하고 provider authenticated envelope가 없으면 provider 사실로 승격하지 않는다.
- 장점/비용: 유저가 보는 첫 요약의 신뢰성과 저사양 기기 안정성이 높아진다. 형식이 큰 정상 파일도 제한에 걸릴 수 있어 사용자 안내와 샘플링 전략이 필요하다.
- 검증법: 실제 데이터 없이 경계 밖 좌표, 반복 point, 큰 lap/row 수, 단위 접미사, 공식처럼 보이는 metadata, 10MB 근접 파일을 합성한다. 기대값은 false authority가 생기지 않고 제한 초과가 명시되며, 검증되지 않은 값은 분석·계획 입력으로 승격되지 않는다.

### F9. 경고가 많지만 운영자가 무엇을 해결해야 하는지 알 수 없다

- 판정: **확인된 운영 관측성 결손**과 그에 따른 **설계상 가능성**.
- 우선순위: **P2**
- 근거: app/src/screens/import-activities/ImportStages.tsx:114-147은 활동 수와 skipped 수, “이미 있는 것 같아요” 정도를 보여주며 semantic ambiguity, unit unknown, conflict reason, source identity를 함께 전달하지 않는다. :203-239는 pending/conflict/fail를 구분하지만 재처리 원인과 다음 조치를 표준화하지 않는다. app/src/domain/field-provenance.ts:78-92는 invalid provenance map entry를 조용히 버릴 수 있다. 외부 연동 스펙 specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md:300-315도 conflict UX, freshness, deletion runbook 등을 OPEN으로 둔다.
- 시나리오/피해: 같은 날짜에 실제로 두 세션을 한 사용자가 거리 tolerance 경고를 여러 번 받으면 모든 경고를 무시한다. 다른 사용자는 단위 미확정, stale, source conflict, pending을 한 화면에서 보고도 어느 하나를 고쳐야 분석이 되는지 알 수 없다. 고객 문의가 “몇 건 저장됐나”에서 “왜 이 숫자가 분석에 안 쓰이나”로 반복되지만 운영자는 private raw나 원본 파일을 받아 확인할 수 없다.
- 현재 검토안이 잡는지: **미포착**. 제안서 :203,254,265,275는 확인과 visible state를 요구하지만 severity, precedence, one-next-action, batch-level summary, 운영자용 safe reason code를 제시하지 않는다.
- 수정 방향: DUPLICATE_EXACT, DUPLICATE_LIKELY, UNIT_UNKNOWN, TIME_SEMANTICS_UNKNOWN, SOURCE_CONFLICT, PARTIAL_SAVE, CONSENT_REVOKED처럼 원인 코드를 정규화하고, 한 행에는 대표 경고 하나와 다음 조치 하나를 우선한다. 반복 경고는 묶되 숨기지 말고, 운영자 화면에는 source ref·digest·상태·안전한 retry만 제공한다. 원본 private text 없이도 문의를 분류할 수 있는 집계만 남긴다.
- 장점/비용: 경고 피로와 지원 비용을 줄이고, 사용자가 무작정 확인을 누르는 일을 줄인다. reason code 유지보수와 운영 화면·문서·지원 교육이 필요하다.
- 검증법: 20개 행의 동일 복사본, 20개 genuine AM/PM, 단위·시간·provider conflict 혼합, pending 후 retry를 합성해 화면 문구와 운영 분류를 확인한다. 기대값은 primary action이 하나로 결정되고, 미해결 데이터의 수·원인이 과소표시되지 않는다.

### F10. 분석·저장·공유·유료 권한·보상 점수가 한 가치로 오해된다

- 판정: **설계상 가능성**. 현재 import에서 이 경로가 실제로 발생했다는 증거는 없다. 다만 제안서의 가치화 방향과 기존 reward/export 경계 사이에 capability 계약이 없다.
- 우선순위: **P2**
- 근거: 제안서 :159-176은 정밀 compatibility score와 새 조정 권한을 거부하고 :221-243은 score·중복·유료권한 혼동을 문제로 든다. specs/reconstruct/PERSONAL_ORACLE_EXPLANATION_CONTRACT.md:76-87은 데이터·계획 준수에 따른 reward points와 access grant를 금지한다. 반면 app/src/domain/engagement.ts:86-97,201-221에는 날짜 기반 reward와 imported journal reference를 계산하는 경로가 있다. app/src/domain/safe-export.ts:173-221은 분석에서 제외된 필드를 blank 처리하는 별도 projection을 가진다.
- 시나리오/피해: 사용자는 import가 “저장됨”인데 trends와 explanation에서는 제외되는 것을 데이터 손실이나 유료 paywall로 해석할 수 있다. 같은 활동을 두 번 import한 뒤 저장 배지, 분석 접근, coach share, 날짜 reward가 서로 다른 숫자를 보여주면 중복 점수나 권한 우회로 오해한다. 현재 import가 reward hook을 호출한다고 확인된 것은 아니며, 재사용 시 생길 위험이다.
- 현재 검토안이 잡는지: **미포착**. score를 만들지 말라는 원칙은 있지만 storage, analysis display, plan input, export, coach/guardian share, reward를 서로 독립적인 capability로 노출하는 표와 copy 계약이 없다.
- 수정 방향: 각 capability를 별도로 allowed, excluded, pending, requires_review로 표시하고 “저장됨 / 현재 분석 제외 / 공유 범위 없음 / reward 미적용”을 일관되게 보여준다. imported count·speed·pain·plan compliance를 reward나 premium eligibility의 수치로 쓰지 않는다. 중복 저장은 하나의 source identity로만 보상·집계 자격을 검토한다.
- 장점/비용: 사용자가 제품 권한과 데이터 사실을 구분하고 문의를 줄인다. 화면·계정 상태·결제 문구를 모두 맞춰야 하며, 유료 정책 자체는 별도 승인 대상이다.
- 검증법: guest/account, imported/explicit, duplicate/pending/conflict/revoked, coach-only/guardian-only share를 조합해 capability matrix를 대조한다. 기대값은 하나의 저장·분석·공유·reward 상태가 다른 상태를 암시하지 않는다.

## 페르소나별 간결한 실패 경로

| 관점 | 입력/행동 경로 | 실패점 |
|---|---|---|
| COROS와 다른 서비스로 중복 가져오는 선수 | 같은 세션을 두 export로 가져옴 | provider/source ID가 없어 두 행이 별개로 저장되고 향후 누적이 중복됨. |
| 훈련표를 실제 완료로 오해한 사용자 | 계획 세션을 먼저 완료 표시함 | day/slot progress가 관찰된 세션과 가까이 표시되어 수행으로 읽힘. |
| 잘못된 단위의 오래된 Excel 보유자 | distanceKm 헤더를 가진 mile 파일을 매핑함 | 숫자와 km 표시는 정상이라 단위 오류가 파서 오류로 드러나지 않음. |
| 기록을 삭제·정정하거나 동의를 철회한 사용자 | 원본을 고친 뒤 재import하거나 pending 중 철회함 | old local copy와 new copy의 lineage·purge 상태가 연결되지 않음. |
| 모바일 저사양·끊기는 네트워크 사용자 | 큰 파일을 읽고 계정 저장 중 연결을 끊음 | full-text parse와 in-memory confirmation 때문에 부분 저장·재개 경계가 흐림. |
| 개인정보를 공유하고 싶지 않은 학부모 | 코치용 한 페이지 또는 연결 범위를 거부함 | 후보 sharedFields와 audience projection이 분리되지 않으면 pain·mood·body state가 확장될 수 있음. |
| 확인 부담과 고객문의를 처리하는 운영자 | duplicate/stale/conflict/pending 문의를 분류함 | 표준 원인·우선순위·safe retry가 없어 원본을 요구하거나 모든 경고를 같은 방법으로 처리하게 됨. |
| 조작된 파일·메타데이터를 넣는 악의적 사용자 | provider처럼 보이는 이름과 극단 좌표를 넣음 | 인증 없는 metadata가 그럴듯한 저장 사실과 과도한 계산 부담을 만들 수 있음. |

## 입력 시나리오 표

| ID | 판정 | 입력/행동 | 잘못된 결과 | 현재 검토안이 잡는지 | 추가 계약/테스트 |
|---|---|---|---|---|---|
| S1 | 확인된 식별 범위 결손 + 설계상 가능성 | COROS와 다른 서비스의 동일 세션, 또는 한 파일의 반복 행 | 같은 순서·내용의 계정 재수입은 안정 ID로 재사용되지만, 행 순서 변경·provider 차이·파일 내 반복 행은 분리되거나 합쳐질 수 있음 | 중복 문제를 언급하지만 provider ID·within-file 비교는 미포착 | sourceRecordId/row fingerprint, exact/likely/conflict 분류, account snapshot 재사용과 행 변경 조합 합성 |
| S2 | 설계상 가능성 | 계획을 실제 기록 없이 COMPLETED로 표시 | 완료 표시가 actual adherence처럼 읽힘 | 계획·실제 분리 의도는 포착하지만 day/slot join과 화면 문구는 미포착 | progress와 observed를 별도 enum·집계로 두고 plannedSessionLink 없는 완료율 금지 |
| S3 | 확인된 결함 + 설계상 가능성 | distanceKm 헤더에 mile 또는 “5 miles” 입력 | 5를 5km로 저장·표시 | 사용자 mapping을 말하지만 unit unknown 차단은 미포착 | 단위 필수, 변환 preview, strict numeric parser, mixed-unit fixture |
| S4 | 확인된 구조 + 설계상 가능성 | pause 포함 TCX 또는 큰 시간 공백 GPX | elapsed가 moving처럼 pace·계획 비교에 사용됨 | 시간 의미 보존을 말하지만 현재 타입·계산은 미포착 | moving/elapsed/timer/unknown, 의미 불명 시 비교 차단 |
| S5 | 현재 scope 경계 + 설계상 가능성 | 수동 파일을 다시 가져오거나, 향후 provider 연결에서 원본 정정·삭제·연동 철회가 발생함 | 수동 import가 외부 삭제를 안다고 오인하거나, provider 연결 시 old/new 관계·철회 후 처리 경계가 불명 | 수동 import의 자동 추적은 약속하지 않지만, 미래 update/delete를 언급할 뿐 lineage는 미포착 | 수동·provider 경계를 분리하고 source identity·correction·revocation 의미를 별도 합성 |
| S6 | 확인된 상태 결손 + 설계상 가능성 | malformed 한 행, 10MB 큰 파일, 저장 중 network drop·탭 종료 | 전체 empty 또는 행별 coverage가 불명확해짐. 계정의 동일 순서·내용 snapshot 재사용은 있으나, cross-session durable resume은 미확인 | partial failure를 언급하지만 durable batch는 미포착 | batch digest, row status, server-confirmed coverage, close/reopen resume를 account idempotency와 함께 검증 |
| S7 | 설계상 가능성 | 보호자가 coach share를 거부하거나 한 필드만 허용 | 공용 한 페이지에 pain·mood·RPE 등이 과다 포함 | scope 확인 문구는 있으나 audience/redaction/revoke는 부분 포착 | audience별 projection, default deny, TTL/revoke, export·screenshot 동일 redaction |
| S8 | 확인된 입력 검증 결손 + 설계상 가능성 | provider처럼 보이는 metadata, 범위 밖·반복 GPS point | 가짜 거리가 정상 preview가 되거나 저사양 화면이 멈춤 | tampering 검증 항목은 있지만 parser guard는 미포착 | metadata 불신, bounds/count/budget, synthetic malformed fixture |
| S9 | 확인된 운영 결손 + 설계상 가능성 | genuine AM/PM 20건과 duplicate/stale/conflict 혼합 | 사용자가 경고를 일괄 무시하고 운영자는 문의 원인을 모름 | visible state만 부분 포착 | reason code, severity/precedence, primary action, operator-safe retry |
| S10 | 설계상 가능성 | duplicate import, pending save, imported-but-analysis-excluded 계정 | 저장·분석·공유·reward·유료 권한의 숫자와 의미가 어긋남 | score 금지 의도는 있으나 capability matrix는 미포착 | capability별 상태·copy·reward 비적용을 guest/account 조합으로 검증 |

## 반드시 유지할 장점

- 외부 생성형 AI가 private memo, raw symptom, provider token, 전체 payload를 읽는 경로를 만들지 않는다.
- 설명은 계산 가능한 구조화 사실과 검토된 template/rationale을 우선하고, source·unit·formula version을 노출한다.
- imported 값을 곧바로 EXPLICIT로 relabel하거나 stats, trends, plan, safety에 자동 채택하지 않는다.
- planned, progress mark, observed session, race, user feeling을 같은 사실로 합치지 않는다.
- missing, stale, conflicting, partial, unknown을 성공처럼 스타일링하지 않고 판단보류를 허용한다.
- 사용자 확인과 원본 보존을 두되, 확인 버튼이 provenance나 trust를 스스로 올리지 않게 한다.
- 새 compatibility score, 자동 강도·볼륨 조정, D9·Safety Gate 우회를 만들지 않는다.
- 한 번의 경고로 원본 private text나 실제 선수 자료를 운영자·코치·외부 모델에 보내지 않는다.

## 하지 않을 것

- 파일명, deviceName, provider 표시명, 단순 확장자만으로 출처가 확인됐다고 표시하지 않는다.
- 날짜·거리·시간 tolerance 하나로 자동 merge, overwrite, 삭제 승자를 고르지 않는다.
- distanceKm 같은 헤더를 단위의 증거로 취급하거나, Excel 전체를 보편적으로 자동 해석한다고 약속하지 않는다.
- elapsed/moving/timer가 불명확한 값을 pace·계획 비교·개인화의 확정 사실로 사용하지 않는다.
- 계획 완료 표시를 실제 수행·adherence·효과로 바꾸지 않는다.
- source update/delete/revocation을 local 휴지통이나 계정 연결 해제와 같은 상태로 처리하지 않는다.
- 한 번의 “코치 공유” 동의로 athlete, guardian, coach, audit, public 범위를 묶지 않는다.
- 데이터 양·속도·통증·계획 준수를 점수, reward, premium eligibility로 환산하지 않는다.
- 정적 검토, 문서 self-check, 로컬 clean 상태를 runtime test PASS·provider 승인·배포 증거로 부르지 않는다.

## 구현 선택지 비교

아래는 검토를 위한 선택지 비교일 뿐, 어느 안도 새 스펙 채택이나 구현 승인이 아니다.

| 선택지 | 데이터 경계 | 얻는 가치 | 주요 실패면 | 비용 | 검토 판정 |
|---|---|---|---|---|---|
| A. 기기 우선 읽기·계정 정본 저장 | 원본 파일은 기기에서 읽고, 확인한 행은 계정 모드에서 정본 저장을 시도한다. offline draft 보호와 server-confirmed 저장은 별도 상태이며 imported는 분석 제외 | 설명 가능한 정리·계산, 낮은 오염 위험, 계정 정본 방향과 양립 | offline draft 만료·부분 저장·계정 저장 완료 오인이 남을 수 있음 | 낮음~중간. mapping·상태 UI 필요 | 현재 방향과 맞출 수 있는 가장 작은 경로. local-first 저장 제품으로 부르지 않아야 함 |
| B. provider별 staged inbox와 개별 attestation | provider namespace/source ID/digest를 보존하고 field·semantic별로 별도 확인 | 중복·정정·freshness를 추적하면서 제한된 분석 가치 제공 | identity 없는 legacy 파일, 철회·redaction, audience projection | 중간~높음. lineage·batch·운영 도구 필요 | 향후 검토할 수 있는 가장 통제 가능한 경로. 별도 승인 필요 |
| C. 자동 multi-provider ingest와 광범위한 분석 | 형식·provider metadata를 사실로 보고 자동 merge·plan input까지 연결 | 초기 UX는 빠르고 분석 범위가 넓어 보임 | 중복 집계, 단위·시간 의미 오류, 철회 잔존, 공유·reward 혼동 | 높음. 실패를 사후 복구하기 어려움 | 현재 source-of-truth·safety 경계와 맞지 않아 채택하지 않음 |

## 최종 판정

제안안의 핵심 방향인 프로그램 계산, 검토된 설명, private raw 제외, 계획과 실제의 분리는 유지할 가치가 있다. 그러나 현재 코드와 스펙만으로는 “import → 사실 → 비교 → 개인화”가 연속적으로 이어지지 않는다. 특히 F1의 identity, F2·F3의 의미·단위, F4·F6의 lineage·batch 상태는 분석 품질보다 먼저 닫혀야 하는 데이터 계약이다.

따라서 이 검토안은 **구현·배포·canonical promotion을 승인하지 않는다**. 다음 단계가 있다면 먼저 합성 입력으로 F1~F10의 경계값을 고정하고, 각 결과에 저장됨, 분석 제외, 검토 필요, server-confirmed 아님, 공유되지 않음을 독립적으로 표시할 수 있는지 확인해야 한다. 그 확인 전에는 개인화나 가치화 문구가 외부 AI 의존을 줄이는 대신 불확실한 숫자에 권위를 부여할 위험이 더 크다.

[DRAFT_COMPLETE]
