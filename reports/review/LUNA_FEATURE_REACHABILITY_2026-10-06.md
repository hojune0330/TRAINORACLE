# LUNA 기능 발견·도달 경로 검토 - 2026-10-06

중학생 첫 사용자가 기능 이름만 보고 목적지를 찾는 상황을 가정한 독립 정적 검토다. `4ce25ed4` 체크아웃의 작업 중 소스를 읽었으며 main이 같은 시간에 통합 중이므로 아래 줄 번호는 조회 시점 기준이다. OracleV2 경로를 추적했고 계정·공개 프로필의 빌드 플래그 값은 확인하지 않았다.

소스 참조의 기본 폴더는 `app/src/screens/`다. `AppShell.tsx`는 `app/src/AppShell.tsx`, `domain/`은 `app/src/domain/`이며 `app/public/`은 저장소 루트 기준으로 표기했다.

이번 검토에서 브라우저 조작과 테스트 실행은 하지 않았다. 아래 12개 과제는 합성 검증 설계이며 성공한 사용자 사례가 아니다. 기존 테스트 수나 이전 합성 경로 수를 사용성 완료 근거로 사용하지 않는다. 실제 일지·계정 자료를 읽지 않았고 이 보고서 외 파일을 수정하지 않았다.

## 판단

검토한 기능이 전부 삭제되거나 모든 진입 경로가 끊겼다고 확인되지는 않았다. 그러나 기능이 설명·읽을거리 뒤에 남아 있다는 것만으로 발견 가능하다고 판단할 수 없다. 특히 이전 Profile 변경은 설명과 실제 기능 버튼을 함께 접었다. 이전 보고서의 P2 '완화됨' 판단은 기능을 다시 열 수 있다는 사실에 치우쳤으며, 발견성 문제는 아래 F4로 다시 연다. 정적 근거로 확정할 P1 차단은 없고, 우선 검토할 P2 발견성 문제는 6개다.

## 현재 기능 지도

화살표는 코드에 연결된 경로다. 직접 조작으로 도착을 확인했다는 뜻은 아니다.

| 기존 기능 | 현재 보이는 진입 경로 | 실제 목적지·조건 |
|---|---|---|
| 내 러닝 프로필·취향 결과 | 하단 오라클 → 러닝 취향 → 러닝 취향 보기 | `running-profile` overlay → `OracleProfileV2(initialView=result)` → `OracleProfileExperience`. 게스트 경로가 있다. `AppShell.tsx:1031`, `:1128`. Home/More에는 이 이름의 직접 항목이 없다. |
| 이름·소개·공개 프로필 | Home 로그인/내 계정 → 계정 설정의 '친구에게 보여줄 내 프로필' | `Account` → `AccountNetworkSettings` → `PublicProfileSettings`. 인증 및 `features.publicProfile` 조건부. `Account.tsx:515`, `account/AccountNetworkSettings.tsx:48`, `account/PublicProfileSettings.tsx:182`. 러닝 취향 프로필과 다른 기능이다. |
| 친구 비교·공유 | Oracle Profile 읽을거리 → 함께 → E01~E06 등 → 친구와 비교하기 | `FRIENDS`와 `SHARE_PREVIEW` 모두 `friendsOpen` 선택 화면. 직접 입력 비교는 계정 없이 가능하며 로컬 공유 미리보기도 있다. 초대 비교는 계정에 저장된 응답 등이 필요하고 연결 비교의 공유 사실 확인은 별도 선택·동의를 거친다. 공개 프로필의 '친구에게 보내기'는 또 다른 계정 경로다. `OracleProfileV2.tsx:166`, `:237`, `:240`; `OracleFriendComparisonV2.tsx:122`; `OracleConnectedComparison.tsx:162`; `account/PublicProfileSettings.tsx:254`. |
| 경기 기록 저장·수정 | 훈련 입력 → 기록 관리·훈련표 읽기 → 내 경기 기록. 또는 Oracle 읽을거리 → 경기 기록 → 해당 풀이 → 경기 기록 보기 | `AthleteRecords`. 활성 계획도 `onManagePaceRecords` 경로가 있다. `PlanBeta.tsx:803`, `:1052`; `OracleLinkedDestination.tsx:39`. Trends의 '최고기록으로 풀이하기'는 별도 임시 입력 도구 `RecordReadingOracle`이다. |
| 페이스 계산 | Home → 더보기 → 페이스 계산. Oracle/Trends에도 페이스 계산 진입이 연결됨 | `pace` overlay → `PaceCalculator`; `More.tsx:51`, `AppShell.tsx:847`, `:1038`, `:1095`. 이름 있는 진입은 유지된다. |
| 훈련 읽기 | Home '훈련 배우기' / More '요즘 주목받는 훈련법'; Oracle '읽을거리 살펴보기' | 앞의 둘은 `TrainingContent`, 뒤는 `OracleProfileV2(initialView=library)`. 서로 다른 목록이며 Oracle 주제에서 `METHODS`로 훈련법을 여는 연결도 있다. `AppShell.tsx:845`, `:899`, `:1032`; `OracleLinkedDestination.tsx:37`. |
| 일지 꾸미기 | Home '일지 꾸미기' / More '일지 꾸미기·포인트' | `openDecorationStudio` → `JournalRewards` → `LogDetail(decorationStudio)`. 빈 기록도 오늘 날짜로 진입하는 코드가 있다. `home/TrainingHome.tsx:87`, `More.tsx:56`, `AppShell.tsx:548`, `JournalRewards.tsx:73`, `:81`. 실제 저장 동작은 이번에 실행하지 않았다. |
| 일지 백업·복원 | Home → More → 계정·기록 관리 → 내 일지 데이터 내려받기 / 메모 포함 파일 내보내기 / 내려받은 백업 되돌리기 | `SafeJournalExport`, `home.restoreOpen` → `RestoreBackup`. 버튼은 설명 접힘 밖에 있다. `More.tsx:60`, `home/DeviceJournal.tsx:141`, `:163`, `:172`, `AppShell.tsx:769`, `:822`. |
| 워치 파일 가져오기 | 하단 기록 → 기록 방식 선택 → 워치 기록 불러오기. 또는 계정 화면의 기기 데이터 가져오기 → 파일 고르기 | `log.importOpen` → `ImportActivities`. More의 '기기 연동 상태'는 새 탭의 `support.html`이며 이 도구를 열지 않는다. `log-entry/EntryChooser.tsx:77`, `Account.tsx:535`, `AppShell.tsx:786`, `:981`; `More.tsx:74`. |

## 우선 발견사항

### F1. P2 - '전체 메뉴'에서 프로필을 찾을 수 없고 두 프로필의 역할도 갈린다

Home의 더보기는 `title="전체 메뉴"`지만 More 목록에는 러닝 프로필이나 공개 프로필 항목이 없다. 러닝 취향은 Oracle 아래에, 이름·소개·공개 설정은 계정 아래에 있다. '내 프로필을 보자'라는 과제에는 어느 분기를 골라야 하는지 알려주는 이름이 부족하다. 근거: `home/TrainingHome.tsx:50`, `More.tsx:49`, `Trends.tsx:164`, `account/AccountNetworkSettings.tsx:48`.

**최소 수정:** More에 '내 러닝 프로필'이라는 이름 있는 행을 두고 기존 `running-profile/result` 목적지에 연결한다. 공개 프로필이 지원되는 상태에서는 '계정·공개 프로필'을 별개 목적지로 식별한다. 계정 조건을 러닝 취향 전체의 제한처럼 표현하지 않는다. 새 개인정보 수집이나 공개 동작은 필요 없다.

### F2. P2 - 친구 기능이 읽을거리로 분류되고 공유 진입도 비교 버튼으로 바뀐다

현재 친구 기능은 읽을거리의 '함께' 그룹과 개별 글을 거쳐야 발견된다. 더구나 E06 '공유 전에 확인하기'는 `SHARE_PREVIEW`인데 CTA와 처리기가 다른 친구 글과 동일해 공유 미리보기가 아니라 비교 방법 선택으로 간다. 기능은 존재하지만 글을 읽는 기능과 친구 도구를 구분하기 어렵다. 근거: `domain/oracle-content-catalog.ts:38`, `:43`; `OracleProfileExperience.tsx:197`, `:205`; `OracleProfileV2.tsx:166`, `:235`.

**최소 수정:** Oracle 또는 More에 '친구와 비교하기' 진입을 드러내고 기존 `friendsOpen` 선택 화면을 재사용한다. 직접 입력 비교와 계정 초대 비교를 현재 조건대로 구분한다. E06은 실제 목적지에 맞는 '친구 비교·공유 설정 열기' 등으로 이름을 맞춘다. 직접 입력 비교의 '공유 미리보기'(`OracleFriendComparisonV2.tsx:127`)와 연결 비교의 공유 문항 선택·별도 동의(`OracleConnectedComparison.tsx:162`)를 모두 보존하고 동의를 건너뛰는 바로가기는 만들지 않는다. 공개 프로필 공유와 응답 비교 공유도 같은 기능으로 안내하지 않는다.

### F3. P2 - 경기 기록 관리가 러닝 취향·풀이·훈련 입력 사이에 숨어 있다

Trends의 경기 관련 버튼은 '러닝 취향' 섹션 안의 '최고기록으로 풀이하기'이며 `RecordReadingOracle`을 연다. 여기에 넣은 기록은 저장되지 않는다. 실제 기록을 추가·수정하는 `AthleteRecords`는 훈련 입력의 접힘이나 Oracle 개별 글을 거치는 별도 경로다. 학교 대회 기록을 보관하려는 사용자가 임시 풀이 입력으로 들어갈 여지가 있다. 근거: `Trends.tsx:166`, `:168`; `AppShell.tsx:1030`; `RecordReadingOracle.tsx:123`, `:179`; `PlanBeta.tsx:1051`; `OracleLinkedDestination.tsx:39`.

**최소 수정:** More 또는 Trends에 '경기 기록 추가·수정'을 명시하고 기존 `AthleteRecords`로 연결한다. '최고기록으로 풀이하기'도 독립 도구로 유지하되, 진입 전에 임시 풀이임을 짧게 식별한다. 기록 관리와 풀이를 한 버튼으로 합치지 않는다.

### F4. P2 - Profile에서 설명용 접힘이 기능 메뉴까지 감춘다

'마리 안내와 다른 풀이' 안에 '내 훈련 해설', '내 기록 해설', '계획·수행 비교'가 함께 들어갔다. '훈련·대회 맥락 추가'도 실제로는 달리기·함께·보조 운동·대회·시간/장소 입력의 입구다. 닫힌 제목만 읽으면 어떤 기능이 들어 있는지 충분히 알 수 없다. 근거: `OracleProfileExperience.tsx:181`, `:184`, `:190`; `OracleContextEditor.tsx:47`, `:49`, `:51`. 목적지는 각각 C02/B02/C07 Reader와 `onContext` → `OracleContextEditor`다.

**최소 수정:** 세 풀이 기능은 이름이 보이는 간결한 메뉴 행으로 유지하고 매니저 설명만 접는다. 추가 입력도 '달릴 시간·장소·대회 정보'처럼 실제 내용을 식별하는 진입을 제공한다. 하나의 주 행동을 강조하면서 나머지 기능의 이름까지 감출 필요는 없다. 점수(`OracleProfileExperience.tsx:171`)와 저장·대기 상태(`:153`, `:163`), 미완성 입력 이어가기(`:154`)의 직접 표시는 유지한다.

### F5. P2 - 읽을거리 진입 이름과 도착 화면이 서로 다른 범위를 가리킨다

Home의 '훈련 배우기'와 More의 '요즘 주목받는 훈련법'은 같은 `TrainingContent`로 간다. Oracle의 '읽을거리 살펴보기'는 다른 카탈로그로 이동하지만 도착한 상단 제목은 '내 러닝 프로필'이고 초기 그룹은 '취향'이다. 훈련법을 찾던 사람이 잘못 들어왔다고 판단할 수 있는 이름 불일치다. 근거: `home/TrainingHome.tsx:86`, `More.tsx:55`, `Trends.tsx:174`; `AppShell.tsx:1032`; `OracleProfileExperience.tsx:84`, `:150`, `:197`.

**최소 수정:** `TrainingContent` 진입은 '훈련법 읽기', Oracle 카탈로그는 '오라클 읽을거리' 등 같은 목적지에 같은 이름을 쓴다. library로 직접 들어온 경우 화면 제목도 그 목적지에 맞춘다. 두 목록은 기능을 유지한 채 서로 구별할 수 있는 항목명으로 제공한다.

### F6. P2 - 가져오기 입구와 기기 안내·백업이 연결되지 않는다

More의 '기기 연동 상태' 설명에는 파일 가져오기가 나오지만 클릭하면 새 탭의 안내문으로 간다. 실제 파일 선택은 하단 기록의 선택 화면 또는 계정 화면에 있고, Home의 주 기록 버튼은 선택 화면을 건너뛰어 `quick-session`을 연다. 백업·복원 버튼은 살아 있지만 워치 가져오기와 어떤 파일을 각각 여는지 한 곳에서 구별하기 어렵다. 근거: `More.tsx:74`, `app/public/support.html:31`, `home/TrainingHome.tsx:98`; `LogEntry.tsx:26`, `log-entry/EntryChooser.tsx:77`; `AppShell.tsx:786`, `:1002`.

**최소 수정:** More에 '워치 파일 가져오기' 행을 추가해 기존 `openImport`에 연결한다. 기존 안전·확인 흐름은 그대로 쓰고 '일지 백업·복원'을 별도 묶음으로 이름 붙인다. 기기 연동 안내 링크는 실제 가져오기 버튼의 대체물이 되지 않도록 보조 위치에 둔다. 목적지는 `ImportActivities`와 `RestoreBackup`으로 구별한다.

## 합성 과제 12개와 성공 조건

모두 미실행 과제다. 중학생 사용자 조사를 대체하지 않으며 아래 성공 조건을 충족했는지도 이번에는 판정하지 않았다. 계정 관련 과제는 허용된 나이·기능 상태의 합성 fixture로만 검증하고 실제 계정 연결·초대 발송·공개는 하지 않는다.

| ID | 첫 사용자 과제 | 찾아야 할 목적지와 후속 성공 조건 |
|---|---|---|
| T01 | 게스트가 '내가 좋아하는 달리기' 프로필을 찾아본다. | Home/More/Oracle의 이름 있는 진입에서 `OracleProfileV2/result`에 도달한다. 로그인 없이 3문항 시작과 읽을거리 선택을 식별한다. |
| T02 | 내 이름·소개를 친구에게 보여주는 설정을 찾는다. | 지원되는 합성 계정 상태에서 `PublicProfileSettings`에 도달하고 러닝 취향과 다른 기능임을 안다. 공개를 누르기 전에도 설정 위치와 현재 조건을 확인한다. |
| T03 | 내 경기 기록이 있는 게스트가 친구 계정 없이 친구의 같은 종목 기록을 직접 입력해 비교 위치를 찾는다. | 합성 내 기록 fixture에서 `friendsOpen` → manual 비교 입력에 도달한다. 초대 비교의 계정 조건이 직접 입력 경로를 막지 않는다. |
| T04 | 친구와 러닝 취향 응답을 비교할 초대 기능을 찾는다. | 합성 READY 프로필에서 연결 비교의 초대 준비 단계에 도달한다. 저장이 덜 된 fixture에서는 이유와 복귀 경로를 알 수 있다. 실제 초대를 만들지 않는다. |
| T05 | '공유 전에 확인하기'를 열어 무엇이 공유되는지 알아본다. | 버튼 이름이 실제 비교·공유 설정 목적지와 일치한다. 비교 동의와 외부 공유 동의를 구분하고, 허용된 사실 확인 전에는 외부로 보내지 않는다. |
| T06 | 학교 대회 기록을 추가하거나 잘못 쓴 기록을 고칠 위치를 찾는다. | `AthleteRecords`의 관리 화면에 도달한다. 훈련 계획 생성이나 임시 풀이 완료가 선행 조건이 아니며 뒤로 가면 진입 화면으로 돌아온다. |
| T07 | 기록을 보관하지 않고 최고기록 풀이만 시험해 본다. | `RecordReadingOracle`에 도달하고 화면을 닫으면 입력이 유지되지 않는다는 안내를 식별한다. T06의 기록 관리와 혼동하지 않는다. |
| T08 | 페이스·트랙 통과 시간을 계산한 뒤 원래 화면으로 돌아간다. | More 또는 Trends의 '페이스 계산'에서 `PaceCalculator`를 열고, 뒤로 가기로 실제 진입 화면에 복귀한다. |
| T09 | 훈련 방법 글을 찾아 읽는다. | Home과 More의 같은 이름이 같은 `TrainingContent`를 열고, Oracle 읽을거리와 어느 목록인지 제목으로 구별한다. |
| T10 | 내 훈련 해설과 계획·수행 비교를 찾는다. | Profile에서 C02/C07 기능 이름을 발견할 수 있고 해당 Reader로 간다. 매니저 소개문을 먼저 펼쳐야 기능 존재를 알게 되는 구조를 피한다. |
| T11 | 빈 일지의 게스트가 꾸미기 편집기를 연다. | Home/More의 꾸미기에서 `LogDetail(decorationStudio)`에 도달하고 날짜와 닫기 동작을 확인한다. 포인트 설명을 읽거나 계정 초대를 해야 편집기를 발견하는 구조가 아니다. |
| T12 | 워치 파일 하나와 앱 백업 파일 하나의 입력 위치를 구별한다. | More에서 각각 `ImportActivities`와 `RestoreBackup`의 파일 선택 화면을 찾는다. 안내 웹페이지로 이동한 것을 파일 가져오기 완료로 오인하지 않으며, 합성 파일 외 실제 자료를 선택하지 않는다. |

main의 후속 브라우저 검증은 T01/T03/T06/T12의 이름 있는 진입, T05/T09의 목적지 일치, T08/T11의 돌아오기 동작을 우선 확인하면 된다. 라우트가 연결됐다는 결과와 실제 중학생이 설명 없이 기능을 찾았다는 결과는 별도 증거로 남긴다.
