# Garmin 상세 데이터·화면 역설계 조사

- 조사일: **2026-10-31 KST**. Garmin 공식 공개 문서와 공식 게시 이미지만 사용.
- 문서 지위: **구현 준비를 위한 연구·제안**. 제품 계약의 신규 채택, 코드 구현, 개인 계정 연결, API 권한, 배포 완료 증거가 아니다.
- 작업 기준: 통합 담당자가 최신화한 `main f6d19aef`. 이 작업에서는 제품 코드를 수정하지 않았다.
- 목표: 거리·시간 요약을 넘어, 실제 제공받은 운동·건강 자료를 사용자가 읽고 비교하며 근거 기록으로 되돌아갈 수 있는 상세 화면의 필수 범위를 정한다.
- 방법: agent-reach 검색 경로를 적용했다. Exa 사용 불가로 웹 검색·원문 열기와 CUA 공개 이미지 관찰을 사용했다. 로그인·개인 활동 조회·건강 파일 접근·약관 동의·전송은 하지 않았다.
- 이전 `tools/rea-aside/GARMIN-PUBLIC-UX-REVIEW-20261030.md`의 가져오기 흐름 조사에 상세 지표·차트·건강 영역을 보완한다. 기존 저장·출처·권한 계약을 대체하지 않는다.

## 1. 결론과 확인 수준

**운동 상세, 기간 보고서, 하루 건강 상세를 각각 구현 단위로 나누고, 제공자가 실제로 보낸 값·구간·시계열만 표시하는 것이 적절하다.** Garmin Connect에서 보이는 모든 값이 Activity API, Health API 또는 TCX 한 파일에 들어오는 것은 아니다. API 개요는 수신 가능한 범주를 설명하며 개별 계정의 권한이나 모든 필드의 제공을 보증하지 않는다.

| 표기 | 이번에 한 일 | 증명하지 않는 것 |
|---|---|---|
| **이미지 관찰** | Garmin 공식 글에 연결된 공개 화면 이미지 3개를 브라우저에서 직접 봄 | 현재 설치 앱의 버전, 클릭 결과, 개인 계정 수신 |
| **문서 확인** | 공식 FAQ·매뉴얼에 명시된 의미와 사용 절차를 읽음 | 해당 동작의 현재 실기기 재현 |
| **API 개요 확인** | 공개 개발자 문서가 명시한 데이터 범주·전달 형식 확인 | 승인 계정의 상세 스키마·scope·실제 응답 |
| **제안** | TrainOracle에 필요한 구조·결측 처리·수용 기준 도출 | 현재 구현 완료 또는 새 산식 채택 |
| **미확인** | 공개 자료만으로 결정할 수 없는 항목을 남김 | 지원 불가 또는 권한 거절로 단정 |

## 2. 실제 본 공개 화면

공식 글 [S1]은 **2026-06-03** 게시일을 표시한다. 아래 이미지 주소의 업로드 경로에는 `2022/04`가 있지만 이것으로 이미지의 실제 제작일·앱 버전을 확정하지 않았다. 문서 갱신일과 이미지 버전은 별개다.

| 이미지 | 직접 관찰한 배치 | 구현에 쓸 정보 구조 / 관찰 한계 |
|---|---|---|
| [운동 개별 요약 이미지](https://s22637.pcdn.co/en-GB/blog/wp-content/uploads/2022/04/running-image.webp) | 상단 Running, Overview/Stats/Laps/Charts 탭, 경로와 속도 색상 범례, 운동 날짜·종목, 큰 거리, 평균 HR·평균 pace·시간·칼로리 | 주 요약 → 상세 분류 → 차트/경로. 탭을 누른 결과는 관찰하지 않음. 이미지에 보이는 건강 수치는 공개 예시이며 사용자 데이터가 아님 |
| [달리기 기간 보고서 이미지](https://s22637.pcdn.co/en-GB/blog/wp-content/uploads/2022/04/gc4-redo-redo-1.webp) | All Running, 7d/4w/1y, 전후 기간 화살표, 명시된 날짜 범위, Distance/Time/Ascent 등의 지표, 일별 막대, 총거리·일평균·주평균 | 필터·기간·집계의 분모를 화면에 드러냄. 이 기간 선택지가 모든 건강 지표에 공통이라는 근거는 아님 |
| [기간 비교 대시보드 이미지](https://s22637.pcdn.co/en-GB/blog/wp-content/uploads/2022/04/cg5-3-1-954x1024-1.webp) | Cycling Summary, 날짜 범위, 여러 차트 카드, 범례와 서로 다른 축, 종목별 경과 시간 비중 | 비교 화면에서는 각 지표 축·단위·기간을 보존해야 함. 이미지의 축/범례 조합을 검증된 산식으로 복사하지 않음 |

공개 예시를 관찰한 범위는 위 세 이미지다. 터치 영역 크기, 드래그 감도, 접근성 트리, 오프라인 상태, 현재 한국어 문구와 실제 상세 화면의 모든 스크롤 영역은 미확인이다. Garmin 이미지·로고·색상 자산을 제품에 복제하는 제안이 아니다.

## 3. 운동 상세 필수 데이터 목록

아래의 “보관·표시 제안”은 제공자 응답/파일에 값과 정의가 존재할 때 적용한다. 결측은 0이 아니다. `총 시간` 한 필드에 여러 시간 의미를 덮어쓰지 않는다.

| 범주 | 필수 표시 후보와 의미 | 보관·표시 제안 | 공식 근거 |
|---|---|---|---|
| 정체성 | 종목/세부 종목, 시작 시각, 날짜, 기록 기기·센서, 원천 활동 참조 | 원천 제공자와 전달 경로를 분리. 시간대 미확정 시 기기·서버 시간대로 조용히 보정하지 않음 | FIT의 Activity/Session/Device Info [S7] |
| 거리 | 세션 거리와 각 랩 거리; 필요 시 누적 거리 시계열 | 원본 단위와 정규화 단위를 보존. 스포츠별 지원 차이 표시 | [S7][S8] |
| 타이머 시간 | 타이머가 작동한 동안의 움직임·정지 포함 시간 | `타이머 시간` 이름을 유지. Auto Pause/수동 정지와 구분 | [S2] |
| 이동 시간 | 움직인 시간만 포함 | 원천이 제공한 의미를 확인. 타이머 시간과 동일시하지 않음 | [S2] |
| 경과 시간 | 최초 시작에서 활동 저장까지의 전체 시간 | 요약·랩의 경과 시간과 타이머 시간을 함께 보유 | [S2][S7] |
| 페이스·속도 | 평균, 이동 평균, 최고, 시점별 pace/speed | 평균 종류·시간 기준·단위 표시. 가장 빠른 순간값을 구간 평균 최고로 바꾸지 않음 | [S2] |
| 랩·인터벌 | 번호, 시작/끝, 거리, 시간, 평균 pace, 평균/최대 HR 등 실제 제공 항목 | 수동 랩·자동 랩·운동 단계·계산 split을 다른 종류로 둠. 워밍업/휴식/쿨다운 이름은 원천 단계가 있을 때 표시 | [S3][S7] |
| 심박수 | bpm 시계열, 평균·최대, 랩별 값 | 관측 없는 구간을 연결해 HR로 만들지 않음. 광학/외부 센서 정보가 있을 때 표시 | [S8] |
| 심박 구간 | 원천 zone별 시간과 정의, 제공된 bpm 경계 | 당시 zone 정의 보존. 현재 프로필로 과거 운동 재분류 금지. zone1 미만 시간이 빠져 전체 시간과 다를 수 있음 | [S4] |
| 케이던스 | 달리기 양발 합산 steps/min; 사이클 crank rpm | `spm`/`rpm`, 스포츠·측정 방식을 명시. 반쪽 케이던스의 자동 2배 처리 금지 | [S8][S9] |
| 파워 | W 시계열, 평균·최대, 파워 구간 시간, 제공 시 바람 반영 여부 | 러닝/사이클·손목/센서/Connect IQ 계열 구분. 최고값·zone이 없는 기기도 정상 | [S10] |
| 고도 | 고도 시계열, 상승·하강 누계 | 원본·보정·산출 여부가 확인될 때 구분. 직접 GPS로 Garmin 상승고도를 재현했다고 표시하지 않음 | [S8] |
| GPS | 위도·경도와 시각, 지도 경로 | 좌표 없는 실내 운동도 정상 상세로 처리. 샘플 결손/휴식/개인정보 가림 구간을 직선 보간하지 않음 | [S5][S7] |
| 러닝 다이내믹스 | 보폭 m, 수직 진폭 cm, 수직 비율 %, 지면 접촉 ms, 좌우 접촉 균형 % | 세션 평균/랩/시계열을 분리. 센서·종목 미지원은 결측. 걷기 구간의 접촉 데이터를 발명하지 않음 | [S9] |
| 추가 기기별 값 | step speed loss 등 최신 기기에 나타나는 확장 필드 | 필드 사전·단위·출처가 확인될 때 기능을 확장. 모든 Garmin 기기 공통 필수값으로 강제하지 않음 | Forerunner 970 data fields [S8] |

### 3.1 구간과 계산에서 지켜야 할 구분

- **원본 랩**과 **1km/1mile 계산 split**은 별개다. 거리 경계 보간은 신규 계산 기능이며, 원본 랩을 바꾸거나 보간값을 기기 제공값으로 표시하지 않는다.
- Live pace와 lap average pace는 계산 창이 다르므로 overlay의 모양이 달라도 곧바로 오류라고 판정하지 않는다. [S6]
- 심박/파워 zone은 설정값·분류 시점·종목을 함께 보존한다. zone 시간이 전체 운동 시간과 같아야 한다는 검사는 잘못된 오류를 만든다. [S4]
- `SOURCE_DEFINED`처럼 시간 의미가 불명확한 원본은 보존한다. 사용자 확인과 원본 정의를 별도 표시하고, 허용된 기존 계산 계약을 충족하기 전 pace·비교 계산은 보류한다. 이는 TrainOracle 적용 원칙이며 Garmin의 내부 규칙을 추정한 것이 아니다.
- Training Effect, VO2max, recovery time, load, stamina 같은 제공자 계산 결과는 일반 거리·시간과 별도 `providerReported` 지표로 취급할 후보이다. 이번 조사는 이들 모든 필드의 API 제공·수학적 정의를 확정하지 않았다.

## 4. 건강·회복 상세

운동 상세는 한 활동의 시간축, 건강 상세는 하루·밤 또는 기간의 시간축이다. 자정이 활동·수면의 경계가 된다고 가정하지 않는다. 아래 점수는 Garmin이 전달한 값과 의미를 표시하며, TrainOracle가 새로 산출하거나 동일성을 주장하지 않는다.

| 지표 | 공개 문서에서 확인한 의미·범위 | 상세 화면 제안 | 외부 수신 판단 |
|---|---|---|---|
| 수면 | 시작/종료·총시간, Light/Deep/REM/Awake, 지원 기기에서 야간 HR·HRV·호흡·Pulse Ox 등. Sleep Score 0–100 | 밤별 구간 타임라인 + 단계별 시간 + 수면 점수. 원천 날짜/구간 보존, 수정된 잠든 시각은 출처 구분 | Health API가 sleep 범주 명시. 모든 부속 필드·Sleep Score의 구체 스키마는 계정 문서/응답 확인 필요 [S11][S15] |
| HRV Status | 수면 중 HRV를 이용하며 상태 표시까지 일관된 수면 데이터 약 3주 필요. 7일 평균과 개인 baseline의 관계를 사용 | 야간 값, 7일 평균, baseline 범위, 상태를 서로 다른 필드로 표시. 자료 부족은 정상 상태 | Health API 개요의 enhanced beat-to-beat interval과 HRV Status 점수/상태는 동일 상품이 아님. 정확한 필드 미확인 [S12][S15] |
| Body Battery | HRV·stress·sleep·activity 기반 잔여 에너지 추정, 5–100. 기기 매뉴얼은 하루 추세와 stress 병합 그래프 설명 | 해당 시각 값·하루 추세·제공 시 충전/소모. 날짜·기기·마지막 수신 시각 표시 | Health API 개요가 Body Battery 명시. 실제 시계열/요약 필드와 허용 scope는 별도 확인 [S13][S15] |
| Training Readiness | 1–100 및 상태. 전날 수면, recovery time, HRV status, acute load, 최근 3밤 수면/3일 stress를 반영하며 하루 중 갱신 | 점수와 측정 시각을 함께 표시. 입력요인별 상세는 받은 경우만 제공. 과거 점수와 현재 점수를 섞지 않음 | 공개 API 개요에서 정확한 제공 필드를 확인하지 못함. 표시 가능한 제품 기능과 API 기능을 구분 [S14][S15] |
| 스트레스 | 0–100 추정치. Connect 표시값은 하루 전체 값이며 기기 live 값과 다름. 활동 중 측정불가 구간이 있을 수 있음 | 하루 timeline·하루 평균·기간 평균을 구분. `측정 불가`를 낮은 stress/0으로 바꾸지 않음 | Health API stress 범주 명시 [S16][S15] |
| 다른 웰니스 | 걸음·강도 분·칼로리·HR·Pulse Ox·체성분·호흡·혈압 | 각 단위·관측 구간·기기 능력에 따라 독립 카드. 미수신 지표는 이유를 표시 | 공개 Health API의 범주 수준 확인. 개인 계정 전체 수신을 확인한 것은 아님 [S15] |

수면 단계는 의료 진단명이 아니며, 수면/회복 점수의 색을 이유로 계획 강도·안전 게이트를 자동 변경하는 제안은 포함하지 않는다. HRV의 측정 방식·시간창이 다른 제공자 값을 하나의 평균으로 혼합하지 않는다. Garmin 고유 점수가 없는 다른 제공자의 기록에 이를 추정해서 채우지 않는다.

## 5. 차트·기간·탐색 동작

| 영역 | 공식 문서/이미지로 확인한 동작 | TrainOracle 제안과 남은 검증 |
|---|---|---|
| 개별 활동 접근 | 앱 More → Activities → All Activities → 해당 운동. 웹 목록에서 활동 제목 선택 [S17] | 목록→상세→원래 목록에서 필터·선택·스크롤 보존. 사용자 소유 기록 ID/revision에 묶인 링크 |
| 활동 차트 | Charts에서 차트 탭, double tap/pinch 확대, 길게 눌러 한 시점 확인, 가로 회전, 다른 지표 overlay [S6] | 확대·초기화 버튼과 키보드/터치 조회 제공. 축·단위·현재 선택 시점 표시. 제스처만 강제하지 않음 |
| 웹 차트 | 차트 확장, No Overlay 메뉴에서 추가 지표 선택. 지역별 FAQ에는 drag 확대/reset 설명도 있음 [S6] | 공통 시간축 두 지표까지 시작하되 축을 분리. 실제 수신 시계열이 없으면 차트 전환을 제안하지 않음. 현재 버전 drag 동작은 직접 미재현 |
| 지도 overlay | Run/Walk/Hike/Cycling에서 지원 값에 따라 pace/HR/elevation/power 등 선택. 기본 pace/speed [S5] | 경로와 색상 범례, 선택 지표·단위. GPS 가림·비공개 설정을 유지. 모든 종목에서 같은 옵션 강제 금지 |
| 활동 목록 | 웹에서 종목별 표시 열 선택·순서 변경; 기록하지 않는 값은 `--` [S18] | 필수 열 최소화, 사용자 선택 세부 지표. 결측 원인·단위를 상세에서 확인 |
| 기간 보고서 | 공개 이미지의 7d/4w/1y. 공식 보고서 내보내기는 항목에 따라 7일/4주/6개월/1년 [S1][S19] | 실제 시작·끝 날짜와 시간대, 스포츠·시간 의미 필터 표시. 모든 지표에 동일 기간/집계 함수를 강제하지 않음 |
| 스트레스 기간 | 하루 timeline 및 장기 평균. 웹 보고서 기간 7일/4주/6개월/1년 [S16] | 일별 값과 기간 평균의 분모·결측일 수 구분. 관측 없는 날을 0으로 넣지 않음 |
| 사용자 대시보드 | Connect+는 유료 기능으로 맞춤 차트·기간 비교를 제공. 앱 메뉴에서 휴대폰 브라우저로 여는 경로 [S20] | 고급 비교는 후속 구현 후보. 기본 활동 상세를 이 유료 기능의 복제/재현 목표와 혼동하지 않음 |

### 5.1 차트를 실제로 쓸 수 있게 하는 최소 조건 — 설계 제안

1. 시간축: 시작 시각·타이머/경과 기준·정지 구간을 일관되게 표시한다. 불규칙 샘플을 일정한 간격의 값으로 오인하지 않도록 한다.
2. 샘플 조회: 선택 시각의 실제 값/미관측 상태와 단위가 읽혀야 한다. 확대하더라도 원본 요약값은 바뀌지 않는다.
3. 결측: 센서 끊김, 제공자 미지원, 권한 없음, 수신 대기, 분석 보류를 구분한다. 0과 결측은 다른 값이다.
4. 분류: 활동/랩/계산 split/하루/밤/주를 구분하고, 운동 종목과 시간 정의가 다른 값을 한 합계로 만들지 않는다.
5. 접근성: 색 외에 지표 이름·범례·선 스타일/텍스트, 차트의 요약 표, 포커스 가능한 상세 진입을 제공한다.
6. 비교: 같은 지표·단위·기간 정의일 때만 비교하고, 제공자/기기/측정법이 바뀌면 표시한다. 동시 변화가 인과관계나 훈련 처방의 근거가 되지는 않는다.

## 6. 원천 데이터와 API 범위

| 경로 | 이번 공식 자료로 확인됨 | 아직 확정하지 못함 / 구현 관문 |
|---|---|---|
| Activity API | 활동 세부 파일 FIT/GPX/TCX, JSON summary 또는 FIT 전달, 사용자 동의 후 Garmin Connect 동기화 자료 접근. REST·push 또는 ping/pull. 일부 관리 기능 Enterprise 전용 [S21] | 현재 승인 계정의 사용 가능한 API/scope, endpoint/schema, 개별 필드·기기별 값, 실제 수신. 공개 개요만으로 모든 그래프 완성 약속 불가 |
| Health API | JSON 요약과 명시된 웰니스 범주. 지원 기기 동기화·사용자 동의·프로그램 승인 절차. enhanced beat-to-beat interval 등 별표 기능 Enterprise 전용 [S15] | HRV Status/Training Readiness/Sleep Score 등의 정확한 필드, 역사 조회 범위·주기·라이선스와 목적별 허용 |
| 활동 원본 FIT | Session 요약, Lap 구간, Record 시계열, Event, Device Info 등을 표현할 수 있음. 다종목은 여러 Session. 샘플 간격은 불규칙할 수 있음 [S7] | 모든 FIT가 모든 지표를 포함한다는 보장 없음. FIT 사양 지원과 TrainOracle 파서 구현·권한은 별개 |
| TCX/GPX/CSV 내보내기 | 공식 Connect가 TCX·GPX·원본 활동·splits CSV를 제공. 전체 활동 CSV는 요약 파일 [S19] | 변환에서 빠지는 센서/고유 지표, 실제 내보낸 파일의 필드 확인 필요. CSV 요약으로 시계열을 복원하지 않음 |
| 웰니스 일별 내보내기 | 공식 안내는 하루 웰니스 원본 FIT를 ZIP으로 내보내며 수면·stress·HRV 등을 예로 듦 [S19] | 앱의 운동 TCX 처리와 다른 데이터 모델·형식이다. ZIP/FIT 경로 구현 및 목적 권한을 별도로 확인. 내보내기 가능하다고 AI 사용 가능하지 않음 |
| FIT SDK / Connect IQ | 사양·SDK는 파일 구조를 해석하는 기술 경로 [S7][S22] | Connect 계정 API 권한을 대신하지 않음. 앱/데이터필드 설치나 파일 작성 권한이 서버 건강자료 수신 권한은 아님 |

### 6.1 파서 설계에서 잃지 않아야 할 정보

FIT에는 제조사·제품과 센서 정보를 표현하는 구조가 있고, 요약/시점/이벤트 메시지의 의미가 다르다. 구조가 요약 먼저/나중 두 방식일 수 있어 완전한 파일 해석 후 관계를 연결해야 한다. 원본이 잘렸을 때 SDK 예제의 복구값을 실제 기기 제공 요약으로 승격하지 않는다. [S7][S22]

제안 모델은 다음 정보를 분리한다. 아래 이름은 Garmin API 필드명의 주장이나 즉시 확정된 저장 스키마가 아니다.

- `activity identity`: 원천 참조·revision, sport/subsport, 시작/끝과 시간대, 소유자 경계.
- `summary`: 거리, timer/moving/elapsed, HR/pace/power 등의 제공 요약. 필드마다 값·단위·원천 정의·관측 구간.
- `laps / intervals`: 원천 구간의 시작/끝·종류·반복/휴식 단계·요약. 계산 split은 별도 파생 엔터티.
- `series`: timestamp, metric, value/unit, 샘플 유효성, 원천 필드/센서. unknown developer field는 임의 단위 변환하지 않음.
- `events`: timer start/stop, 세션 전환 등 수신한 이벤트. 이벤트가 없으면 정지 시간을 추정해 원본으로 저장하지 않음.
- `wellness`: 원천 local date 또는 night interval, 지표별 시점·집계 창, providerReported score/status/baseline.
- `lineage`: 원래 제공자, 전달 경로, 원천 필드·기기, 변경/파생 관계, 삭제/정정 식별. 사용자 확인은 출처 재작성이나 사용권한 발급이 아님.
- `availability`: 관측됨 / 결측 / 미지원 / 권한 없음 / 아직 수신 안 됨 / 해석 보류. 실제 증거가 없으면 원인을 단정하지 않음.

이 구조를 계정 저장에 추가하려면 기존 엄격 스키마에서 메타데이터가 제거되지 않는지, 버전·옛 문서 읽기·export·삭제·수정 흐름을 함께 검토해야 한다. UI만 늘리고 저장에서 시계열/출처를 잃는 상태는 완료가 아니다.

## 7. 권한과 고유 점수 표시 정책 제안

1. **받기·보관·화면 표시·일반 분석·AI 추론·모델 학습·계획 전송을 각각 판단한다.** 프로그램 승인/파일 선택/사용자 확인 어느 하나로 다른 목적을 승인하지 않는다.
2. 파일 또는 Apple/Android 등 중간 경로로 들어와도 Garmin 원천이면 그 출처를 유지한다. unknown/mixed origin을 일반 사용자 직접 입력으로 바꾸지 않는다.
3. Garmin 점수는 `Garmin 제공`과 시각·기기를 붙여 원래 값으로 표시한다. 점수 누락을 자체 모델로 보충하거나 동일한 명칭으로 새 점수를 만들지 않는다.
4. AI는 허용된 필드·목적·보관 정책·회사 관리 자체 호스팅 범위가 실제 승인된 경우에만 기존 서버 권한 판단을 통과시킨다. 그래프 표시 가능성과 AI 입력 허용은 별개다.
5. Garmin Connect+의 AI/insight 기능이 존재한다는 사실은 TrainOracle의 AI 권한 근거가 아니다. 이 조사에서는 회사의 기존 Garmin 문의·답변 상태를 갱신하지 않았다.
6. 수치 설명은 제공자 사실과 TrainOracle 해석을 구분한다. 기존의 채택된 훈련·안전·출처 계약 밖으로 새 처방 산식을 도입하지 않는다.

## 8. 구현 우선순위와 완료 기준

이 문서가 정하는 것은 **준비해야 할 필수 범위**다. 실제 UI/파서/API 완성도를 이번에 재검사하지 않았다. 현재 main의 상세 기능은 통합 담당자가 따로 대조한다.

| 순서 | 결과물 | 완료로 볼 수 있는 증거 |
|---|---|---|
| P0: 손실 없는 공통 관측 계약 | 시간 종류·원천·summary/lap/series 구분·결측 상태 | 서로 다른 시간/불규칙 샘플/멀티세션/원천 불명 자료의 의미 보존. 구버전 계정 문서 왕복 |
| P1: 개별 운동 상세 | 요약·통계·원본 랩·가능한 센서 차트·GPS | 실제로 수신한 대표 기록이 목록→상세→일지에서 같은 ID/revision으로 열림. 없는 센서를 만든 차트가 없음 |
| P1: 차트 상호작용 | 확대/복귀·시점 조회·두 지표 overlay·단위·결측 표시 | 터치·키보드·320/375px에서 조회 가능. 정지·센서 끊김·좌표 가림 반례 통과 |
| P2: 건강 상세 | 수면 단계, 야간 HRV/상태, Body Battery, stress, 제공 시 readiness | 지표마다 실제 허용된 샘플·기간·날짜 의미 확인. 운동 자료만 있는 경우 건강 차트를 표시하지 않음 |
| P2: 기간 비교 | 종목·지표·범위·집계 정의·원천 기록 링크 | timezone/결측일/다른 기기/다른 시간 종류 때문에 합계·평균이 바뀌는 반례를 설명 가능 |
| P3: 코칭 연결 | 승인된 관측 사실에서 설명·다음 읽기 행동으로 연결 | 개인화 가능한 실제 근거, 필드별 사용권, 모델 경로 증거. 고유 점수 재계산·일지 원문 모델 전송·미채택 처방이 없음 |

### 다음 검증에 필요한 최소 표본·질문

- **API 담당**: 실제 승인된 Activity/Health 항목과 공개 범주 대비 응답 필드 목록, 날짜·단위·time 의미, 고유 점수의 제공 여부. 허용된 비식별 개발 샘플로 먼저 대조한다.
- **파일 담당**: 같은 운동의 원본 FIT와 TCX/GPX 변환에서 보존/누락 필드 비교가 필요하다. 이 문서는 그러한 파일을 취득하거나 검사하지 않았다.
- **UI 담당**: 현재 Garmin 모바일/웹의 실제 버전에서 Stats/Laps/Charts 전체 필드 및 확대/시점/기간 전환을 확인할 필요가 있다. 공개 이미지 관찰을 그 실검증으로 대체하지 않는다.
- **계정 저장 담당**: 상세 자료의 크기·암호화·스키마·원본-파생 삭제 범위 확인. 새 저장 대상의 승인이 필요한지는 기존 승인 범위와 대조한다.
- **권한 담당**: 고유 점수와 파생값, 원본 필드의 AI 추론 허용 범위를 실제 서면 답변과 맞춘다. 오늘의 공식 제품 설명만으로 이를 결론내리지 않는다.

## 9. 공식 출처

모두 2026-10-31 확인. 별도 표기가 없으면 페이지에 게시/수정일·앱 빌드가 표시되지 않거나 이번 확인 범위에서 확인하지 못했다. FAQ 중 일부는 직접 `open` 시 자바스크립트 껍데기만 반환했으며, 같은 공식 URL의 검색 색인 본문을 사용했다. 그런 항목의 동작은 “문서 확인”이고 실행 증거가 아니다.

- **S1** [Garmin Connect 활용 안내](https://www.garmin.com/en-GB/blog/unlocking-the-potential-of-garmin-connect/) — 2026-06-03. 본문과 연결 이미지 3개 확인.
- **S2** [Time/Pace/Speed 정의](https://support.garmin.com/en-IN/?faq=k5TPjwyAWi5f4hnObUAVf7) — 공식 FAQ 본문 색인.
- **S3** [Workout Steps Shown in Activity Splits](https://support.garmin.com/en-IN/?faq=NiyNdddfq4118YjC9JKVj9) — 기기·UI 경로 일부 구형 표현 존재. 현재 버튼 위치는 미확인.
- **S4** [Heart Rate Zones와 Time in Zones](https://support.garmin.com/et-EE/?faq=w8qlOr7BQ16Z82HVrevpw9&productID=552962&tab=) — 공식 FAQ 본문 색인, 기기별 표시 차이 포함.
- **S5** [GPS Track Data Overlays](https://support.garmin.com/id-ID/?faq=TldUa5u9Mj67FFw4usMcX7) — 공식 FAQ 본문 색인.
- **S6** [Activity Chart Details](https://support.garmin.com/en-PH/?faq=V0T9hu0HIa8uj2gi0ea9aA) · [지역판의 웹 확대 설명](https://support.garmin.com/ro-RO/?faq=V0T9hu0HIa8uj2gi0ea9aA) — 공식 FAQ 본문 색인, 지역판 문구 차이 기록.
- **S7** [FIT Activity File 구조](https://developer.garmin.com/fit/articles/file-types/activity.html) — 공식 개발 문서.
- **S8** [Forerunner 970 Data Fields](https://www8.garmin.com/manuals-apac/webhelp/forerunner970/EN-SG/GUID-3DDC9966-40B4-4071-92DD-4797C5EA44BB-7545.html) — 특정 기기의 필드 의미이며 Connect 전체/API 전체 목록 아님.
- **S9** [Running Dynamics Pod 매뉴얼](https://www8.garmin.com/manuals/webhelp/runningdynamicspod/EN-GB/Running_Dynamics_Pod_Instructions_EN-US.pdf) — 기본 6개 다이내믹스 의미/단위. 최신 모든 기기 지원표 아님.
- **S10** [Running Power on Garmin Watches](https://support.garmin.com/en-IE/navionics/faq/bEu4VJxddU2ZcgFgDyifp7) — Garmin 공식 FAQ; 검색 결과는 Navionics 지원 URL에서 동일 Garmin running power 본문 제공.
- **S11** [Garmin Sleep Tracking](https://support.garmin.com/en-IN/?faq=mBRMf4ks7XAQ03qtsbI8J6) — 공식 FAQ 본문 색인.
- **S12** [HRV Status 매뉴얼](https://www8.garmin.com/manuals/webhelp/GUID-3B607AEB-9EB5-4BF3-A38D-1F9926BB9F65/EN-US/GUID-9282196F-D969-404D-B678-F48A13D8D0CB.html) — 상태·baseline·기간 의미.
- **S13** [Body Battery 매뉴얼](https://www8.garmin.com/manuals/webhelp/GUID-5D183A14-BB43-4A9B-B441-5F824214CE40/EN-US/GUID-87E1392B-2C55-40B7-A1FF-3AB9252DA0A0.html) — vívoactive 5 설명; 시계 glance의 동작과 Connect는 구분.
- **S14** [Training Readiness 매뉴얼](https://www8.garmin.com/manuals/webhelp/GUID-F41EAFB3-6CC9-42DE-9C6C-9E358DBB0671/EN-GB/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html) — Forerunner 265 매뉴얼 v9, 2025-06 표기.
- **S15** [현재 Health API 개요](https://developer.garmin.com/gc-developer-program/enterprise/health-api/) — 직접 원문 확인. Business 메뉴와 Enterprise 한정 별표 기능 구분.
- **S16** [Stress Level 설명·화면 경로](https://support.garmin.com/en-HK/?faq=WT9BmhjacO4ZpxbCc0EKn9) — 공식 FAQ 본문 색인.
- **S17** [저장한 운동 상세 보기](https://support.garmin.com/cs-CZ/?faq=6Dk3BHgLzs13iYV90WX4B9) — 공식 FAQ 본문 색인.
- **S18** [활동 테이블 열 편집](https://support.garmin.com/en-US/?faq=UNiiMuOI8J20he59aw5gP9) — 공식 FAQ 본문 색인.
- **S19** [Garmin Connect 내보내기](https://support.garmin.com/in-ID/?faq=W1TvTPW8JZ6LfJSfK512Q8) — 공식 FAQ 본문 색인. 웰니스 일별 FIT/ZIP 안내 포함.
- **S20** [Connect+ Performance Dashboard](https://www.garmin.com/en-CA/blog/fitness/what-is-the-garmin-connect-performance-dashboard/) — 2026-05-14, 직접 원문 확인.
- **S21** [현재 Activity API 개요](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/) — 직접 원문 확인.
- **S22** [FIT Activity decoding](https://developer.garmin.com/fit/articles/cookbook/decoding_activity_files.html) — 공식 개발 문서, 손상/요약 순서/다중 세션 관련 주의.

## 10. 이번 작업 종료 상태

- 완료: 공개 자료 기반 운동/건강 지표 목록, 차트·기간 행동, 3개 공식 화면 이미지 관찰, API 개요와 UI 범위의 차이, 수신 후 표시 정책·구현 검수 항목 정리.
- 미완료: 현재 실앱 전체 화면 재현, 실제 승인 API 스키마·개인 수신 자료 대조, 코드·스키마 구현, 성능·접근성 실검수, 회사 자체 호스팅 모델 운영·배포.
- 변경: 이 연구 문서 1개만 작성. 어떤 자료도 개인 연결 성공 또는 고유 점수 API 접근 권한 확보로 보고하지 않았다.
