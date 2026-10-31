# Apple 운동·건강 상세 화면 및 HealthKit 데이터 대응 조사

- 작성일: 2026-10-31, Asia/Seoul
- 조사 대상: Apple 공개 사용자 가이드, Apple Developer 문서, WWDC 공식 발표
- 작업 기준: `main f6d19aef9cb0635aee77a42c93e97ea8ddc41a36`
- 산출물 수준: 공개 근거에 따른 구현 준비. 제품 구현, 네이티브 실행, 개인 건강자료 조회, API 실수신, 서버 변경, 배포는 수행하지 않았다.
- 방법: agent-reach 지침을 적용했다. Exa 호출은 도구 메타데이터 로딩 오류로 실패하여 내장 웹 검색·읽기로 Apple 공식 원문을 확인했다. agent-reach 업데이트 조회는 실행했지만 설치·업데이트하지 않았다.

## 1. 권고

TrainOracle의 Apple 상세 대응은 **운동 한 건의 요약 → 측정 항목별 상세 → 구간·경로 → 출처·가용성 설명**을 먼저 완성하는 것이 적합하다. 이어서 일지에서 해당 운동을 열고, 같은 의미·같은 출처의 관찰값만 기간 분석으로 넘긴다. Apple 화면과 비슷한 숫자 카드를 만드는 것만으로 데이터 대응이 끝나지 않는다.

공개 API로 읽을 수 있는 값과 Apple 내부 계산값을 구분해야 한다. 심박·러닝 동역학·수면 단계·HRV·effort는 공개 타입 또는 관계 API가 있다. **iOS 27/watchOS 27에는 심박 및 사이클링 파워 구간과 구간별 시간도 공개 API가 추가됐다.** 반면 이번 조사에서는 Apple의 training load 분류, Health의 변화 감지 결과, sleep score 자체를 그대로 받는 전용 getter를 확인하지 못했다. 이러한 미확인 항목은 임의 공식으로 복제하지 않는다. [HealthKit 업데이트](https://developer.apple.com/documentation/updates/healthkit), [WWDC26 운동 구간](https://developer.apple.com/videos/play/wwdc2026/207/)

구현 우선순위는 다음과 같다. 이 순서는 본 조사에 따른 제안이며 현재 제품의 완성도 판정은 아니다.

1. **필수:** 운동 식별자·종목·시각·시간 의미·거리·출처, 요약/시계열의 가용 상태, 일지 연결.
2. **필수:** 심박·페이스·파워·러닝 동역학 차트, 제공된 split/lap/segment, 경로·고도. 존재하는 필드만 표시하고 빠진 이유를 과도하게 단정하지 않는다.
3. **필수:** 항목별 권한 요청, 관찰 가능한 기간, 지연 수신, 변경·삭제·중복 및 출처 표시.
4. **후속:** effort, 수면·HRV·안정시 심박 등 별도 동의 범위의 건강 이력. 원자료 없는 Apple 계산값은 보류한다.

## 2. 근거와 버전의 구분

| 근거 수준 | 이번에 확인한 것 | 확인하지 않은 것 |
|---|---|---|
| 공식 웹 문서 | watchOS 27 러닝 지표·운동 조작·training load, iOS 27 Fitness 요약, 일부 iOS/watchOS 26 고정 가이드, 현재 HealthKit API 문서 | 특정 사용자의 Watch/iPhone에서 실제 표시되는 값 |
| 공식 이미지 관찰 | 코디네이터가 Apple 공식 심박 구간 이미지 440×488 픽셀에서 현재 심박·구간 체류시간·평균 심박의 위계를 확인 | 네이티브 앱 실행, 실제 운동 화면의 전체 조작·애니메이션·오프라인 동작 |
| API 문서 | 타입·query·source·permission·삭제 의미 | 현재 모바일 빌드의 SDK 가용성, 기기별 수신률, 실제 payload |
| 제품 제안 | 아래 상태·데이터 계약·인수 조건 | 이미 구현·시험·출시됐다는 주장 |

공식 한국어 [운동 현황/지표 가이드, watchOS 27](https://support.apple.com/ko-kr/guide/watch/apd1f24d4d35/27/watchos/27)와 [심박수 영역 가이드, watchOS 27](https://support.apple.com/ko-kr/guide/watch/apd897dccddf/27/watchos/27)를 우선 근거로 삼았다. 두 번째 페이지와 [공식 이미지](https://ipcdn-web.apple.com/assets/v2/web/dde97bd8-0518-4809-a2c4-d46709e3a3a0)의 브라우저·픽셀 관찰은 코디네이터가 전달한 결과다. 본 조사 도구에서는 일부 가이드가 리다이렉트 또는 429를 반환했다. 무버전 URL은 다른 언어·시작 페이지로 이동할 수 있어, 버전 고정 URL을 우선 보존한다.

### 최신 API를 구형 OS에도 있다고 가정하지 않기

- 운동 zone API의 iOS 27/watchOS 27 도입은 공식 발표에서 확인했다. OS·SDK 가용성과 개별 운동의 데이터 존재 여부는 각각 검사한다. [WWDC26](https://developer.apple.com/videos/play/wwdc2026/207/)
- 제한된 과거 기간 허용을 확인하는 `getEarliestAuthorizedSampleDate(for:completion:)`가 현재 공식 문서에 있다. 다만 조회 결과에 Beta 표시가 있는 문서와 없는 문서가 함께 나타났고, 이번 조사에서 정확한 최소 OS·최종 SDK availability는 확정하지 못했다. **선택적 capability로 설계하고 네이티브 구현 전에 SDK 선언을 확인해야 한다.** [메서드 문서](https://developer.apple.com/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate%28for%3Acompletion%3A%29)

## 3. 공식 화면에서 가져올 정보 구조

### 3.1 세션 목록과 운동 요약

Fitness는 Summary에서 날짜별 활동을 보고 Sessions에서 운동을 선택해 상세로 들어간다. 요약 카드는 추가·교체·재정렬·삭제할 수 있다. 이는 사용자가 필요한 지표로 들어가는 구조의 근거이며, TrainOracle이 Apple 카드 디자인을 그대로 복사해야 한다는 의미는 아니다. [Fitness 요약, iOS 27](https://support.apple.com/en-asia/guide/iphone/iph4c34a8a95/27/ios/27)

Apple의 운동 요약 안내에는 운동 정보, splits, 심박, effort, 경로가 있고 항목별 Show More로 상세를 연다고 명시돼 있다. 해당 무버전 문서는 웹 검색에서 본문을 확인했으나 직접 열기에서는 리다이렉트·접근 실패가 있어, 정확한 현재 화면 배치까지 확인한 것으로 취급하지 않는다. [운동 종료 및 요약](https://support.apple.com/guide/watch/end-and-view-a-summary-of-your-workout-apd95450de2a/watchos)

**TrainOracle 제안:** 날짜·종목·출처와 기본 요약을 먼저 제공하고, 상세 데이터가 있는 영역에만 진입 동작을 제공한다. 원본 운동과 연결된 일지로 돌아가는 경로를 유지한다. 데이터 없는 섹션을 모두 숨겨 “기능이 없는지, 기록이 없는지” 알 수 없게 하지 말고 가용 상태를 짧게 설명한다.

### 3.2 러닝 지표·구간·고도·파워

공식 watchOS 27 문서는 러닝 화면을 일반 지표, 러닝 동역학, 심박 영역, segment, split, 고도, 파워 등으로 나눈다. 기본 지표와 별개로 cadence·stride length·GCT·vertical oscillation이 있으며, 고도·파워에는 최근 변화 그래프가 있다. segment와 split은 번호·페이스·거리·심박을 보여준다. [운동 지표, watchOS 27](https://support.apple.com/ko-kr/guide/watch/apd1f24d4d35/27/watchos/27)

사용자는 운동 중 표시할 view를 선택·재정렬하고 지표를 편집할 수 있다. Watch에서 segment를 표시하고, 종료 후 iPhone의 Sessions에서 segment 통계를 확인하는 흐름도 문서에 있다. **실시간 view, 종료 후 summary, 저장된 HealthKit 데이터는 서로 다른 층**으로 취급한다. [Run with Apple Watch](https://support.apple.com/en-mt/guide/watch/apd73a43493f/27/watchos/27), [운동 중 조정, watchOS 26](https://support.apple.com/en-gb/guide/watch/apd72879df4d/26/watchos/26)

### 3.3 건강 이력

Health는 항목을 선택해 기간별 그래프·상세 기록·단위·Data Sources & Access로 내려간다. 수면은 일·주·월·6개월, 단계·수면량·비교를 제공한다. **기간 선택 → 그래프 → 원자료·출처**라는 구조를 건강 이력의 기준으로 삼을 수 있다. [Health 데이터 보기, iOS 26](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/26/ios/26), [수면 추적](https://support.apple.com/en-ie/108906)

## 4. 화면 항목과 실제 API의 대응

판정: **직접**은 공개 API 존재, **조건부**는 OS·샘플·메타데이터·관련 권한 확인 필요, **파생**은 TrainOracle이 정의·출처를 붙여 계산할 수 있는 값, **미확인**은 Apple 표시값의 직접 getter를 이번에 확인하지 못했다는 뜻이다. 공개 API 존재는 모든 운동에 값이 있다는 보장이 아니다.

| 항목 | HealthKit 또는 공식 근거 | 판정 및 구현 조건 |
|---|---|---|
| 운동 종목·시작/종료·요약 | `HKWorkout`, `workoutActivities`, `statistics(for:)`, `allStatistics` | **직접.** 멀티스포츠의 전체 운동과 하위 activity를 분리. 거리·에너지는 해당 종목의 통계 타입과 단위를 사용. deprecated `totalDistance/totalEnergyBurned`에 새 계약을 의존시키지 않음. [HKWorkout](https://developer.apple.com/documentation/healthkit/hkworkout) |
| 운동 시간 | `HKWorkout.duration`, `startDate/endDate`, pause/resume 이벤트 | **직접+의미 보존.** 생성자에 따라 duration이 경과시간, 명시값, 이벤트 반영 활동시간일 수 있다. `end-start`와 제공 duration을 별도 보관하고 일괄 MOVING으로 이름 붙이지 않음. [duration](https://developer.apple.com/documentation/healthkit/hkworkout/duration?language=objc) |
| 심박·평균·최고 | `.heartRate`, 운동에 연결된 통계·quantity samples | **직접.** bpm, 샘플 시각, 통계 범위 명시. 같은 시간대의 모든 심박을 무조건 운동에 귀속시키지 않음. [Data types](https://developer.apple.com/documentation/healthkit/data-types), [allStatistics](https://developer.apple.com/documentation/healthkit/hkworkout/allstatistics) |
| 속도·페이스 | `.runningSpeed`, `.distanceWalkingRunning` 및 운동 통계 | 속도 **직접**, 페이스는 제공된 값 또는 **파생**. 평균/순간/rolling pace를 구분하고 같은 시간 기준으로 계산. 0·음수·결측 속도의 역수를 그리지 않음. [runningSpeed](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/runningspeed) |
| 러닝 파워 | `.runningPower` | **직접.** W. 평균·시계열의 범위를 보존. cycling power와 다른 타입·스포츠로 유지. [runningPower](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/runningpower) |
| 러닝 cadence | 공식 Workout UI에는 표시. `CMPedometerData.currentCadence`는 CoreMotion의 steps/s | **조건부/파생.** 이번 조사에서 과거 운동의 전용 `runningCadence` HealthKit quantity type은 확인하지 못함. CoreMotion currentCadence는 과거 query에서 nil이므로 수입 이력의 대체 API가 아님. stepCount/동일 구간시간으로 계산하면 “계산한 평균 케이던스”로 구별. [currentCadence](https://developer.apple.com/documentation/coremotion/cmpedometerdata/currentcadence) |
| 수직 진폭·보폭·지면 접촉시간 | `.runningVerticalOscillation`, `.runningStrideLength`, `.runningGroundContactTime` | **직접/조건부.** UI 단위는 cm·m·ms. strideLength는 한 발걸음의 거리이며 자동으로 두 걸음 거리로 해석하지 않음. 제공되는 샘플의 출처·시간·단위를 보존. [타입 목록](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier), [운동 지표 정의](https://support.apple.com/ko-kr/guide/watch/apd1f24d4d35/27/watchos/27) |
| HR·cycling power zone | `zoneGroupsByType` on `HKWorkout/HKWorkoutActivity`, `HKWorkoutZoneGroup` | **조건부 직접, OS 27+.** 운동 당시 경계·설정 출처·구간별 시간을 함께 읽는다. 해당 운동 데이터가 없으면 미제공 상태. [zone 데이터 읽기](https://developer.apple.com/documentation/healthkit/accessing-workout-zone-data) |
| lap·segment·split | `HKWorkoutEvent`의 lap/segment 및 `dateInterval` | 제공 이벤트는 **직접**. Apple의 화면상 자동 거리 split과 모든 lap 이벤트가 동일하다고 보장하지 않는다. 거리 시계열로 만든 split은 **파생**으로 표기. [lap](https://developer.apple.com/documentation/healthkit/hkworkouteventtype/lap), [dateInterval](https://developer.apple.com/documentation/healthkit/hkworkoutevent/dateinterval) |
| 경로 | `HKWorkoutRoute` + `HKWorkoutRouteQuery` | **조건부 직접.** 좌표·시각·정확도·altitude 등. route 배치를 끝까지 읽고 지연 수신/수정 지원. 지도 없는 운동도 유효. [경로 읽기](https://developer.apple.com/documentation/healthkit/reading-route-data) |
| 고도·누적 상승/하강 | route CLLocation altitude; `HKMetadataKeyElevationAscended/Descended` | **조건부 직접.** 메타데이터 미존재 가능. 좌표 고도 차이를 임의 합산한 누적상승은 제공값과 같지 않으며 별도 알고리즘 검토 필요. [누적 상승](https://developer.apple.com/documentation/healthkit/hkmetadatakeyelevationascended), [Workout metadata](https://developer.apple.com/documentation/healthkit/workout-metadata-keys) |
| effort | `.workoutEffortScore`, `.estimatedWorkoutEffortScore`, 관계 query | **조건부 직접.** 사용자가 평가한 값과 추정값을 분리하고 workout/activity 관계로 결속. 값이 없으면 Apple 추정식을 재현하지 않음. [HealthKit 업데이트](https://developer.apple.com/documentation/updates/healthkit), [workoutEffortScore](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/workouteffortscore) |
| training load | 공식 UI는 최근 7일 강도·시간과 앞선 28일 비교 | 화면 의미는 확인. **Apple의 점수·구간 분류 직접 getter 미확인.** effort×duration 등의 자체 값을 Apple load로 명명하지 않음. [Training load, watchOS 27](https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/27/watchos/27) |
| HRV | `.heartRateVariabilitySDNN` | **직접.** ms의 SDNN, RMSSD가 아님. 샘플별 기간·출처·알고리즘 메타데이터가 있으면 보존. 다른 정의의 타사 HRV와 한 평균으로 혼합하지 않음. [HRV SDNN](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn) |
| 안정시 심박·호흡 등 | `.restingHeartRate`, `.respiratoryRate`, 그 외 요청한 quantity types | **직접/조건부.** 운동 연결과 별개인 건강 이력으로 관리하며 범위별 동의를 요청. 운동 심박을 안정시 심박으로 대체하지 않음. [Data types](https://developer.apple.com/documentation/healthkit/data-types) |
| 수면 단계·시간 | `sleepAnalysis`, `HKCategoryValueSleepAnalysis` | **직접.** awake/core/deep/REM/unspecified/inBed 구분. inBed와 단계가 겹칠 수 있어 단순 합산 금지. [Sleep analysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis) |
| Apple sleep score | 공식 사용자 가이드에 0–100 점수와 구성 설명 | 화면은 확인, **점수 직접 getter 미확인**. 단계·시간을 읽었다고 Apple score를 얻었다고 보고하지 않음. [Sleep score, watchOS 26](https://support.apple.com/en-mo/guide/watch/apded441a669/26/watchos/26) |
| Fitness/Health 추세 | Fitness의 90일/365일 비교와 Health의 변화 감지 UI | 공개 raw/statistics query로 자체 기간 요약은 가능. **Apple trend 결과 자체를 읽는 getter 미확인.** 두 앱의 추세를 같은 알고리즘으로 취급하지 않음. [Fitness 요약](https://support.apple.com/en-asia/guide/iphone/iph4c34a8a95/27/ios/27), [Health 데이터](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/26/ios/26) |

### 4.1 Zone 표시의 필수 조건

운동별 zone configuration은 system/user/app 설정 출처와 실제 경계를 포함한다. 현재 preferred configuration과 과거 운동의 configuration은 다를 수 있다. 같은 “Zone 3”도 경계·구간 수가 다르면 같은 강도가 아니다. **운동 당시 경계를 표시하고 변경된 경계의 운동끼리는 단순 합산을 피한다.** 새로운 기준으로 재분류하려면 원본 샘플과 별도 계산 근거가 있어야 한다. [zone 데이터 읽기](https://developer.apple.com/documentation/healthkit/accessing-workout-zone-data), [WWDC26](https://developer.apple.com/videos/play/wwdc2026/207/)

권한은 관련 workout와 heartRate/cyclingPower 타입이 필요하다. 구형 OS에서 zone API가 없다는 이유만으로 심박 상세 전체를 차단하지 않는다. 원본 심박만 있다면 심박 차트는 제공하고, 승인된 별도 경계·계산 정책이 없는 경우 zone 분류만 보류한다. 이는 TrainOracle의 제안이다. [WWDC26 권한·접근 설명](https://developer.apple.com/videos/play/wwdc2026/207/)

### 4.2 Split/segment의 필수 조건

lap은 거리 구간을 표현하며, segment는 관심 구간을 표현한다. 구형 iOS 11/watchOS 4 이전 기록의 lap은 길이가 0인 종료 마커 형태일 수 있다. 멀티스포츠에서는 경계가 겹치는 이벤트가 둘 이상의 activity에 나타날 수 있다. **이벤트 식별·범위·종류를 보존하고 같은 이벤트를 두 번 집계하지 않는다.** [lap](https://developer.apple.com/documentation/healthkit/hkworkouteventtype/lap), [Activity workoutEvents](https://developer.apple.com/documentation/healthkit/hkworkoutactivity/workoutevents)

TrainOracle에서 “1km split”을 계산하려면 거리·시간 시계열, 중간 경계 보간 정책, 휴식 처리, 짧은 마지막 구간 표시가 필요하다. 요약 거리와 전체 시간만 있는 파일·HealthKit 레코드에 정밀 split을 만들어 넣지 않는다. `PROVIDER_LAP`, `USER_SEGMENT`, `DERIVED_DISTANCE_SPLIT` 등 구분은 **제안 계약**이며 Apple enum 자체는 아니다.

## 5. 권한·누락을 표현하는 상태 모델

### 5.1 Apple에서 확인 가능한 사실

- HealthKit 읽기는 데이터 타입별 요청이다. 운동 읽기 요청만으로 심박·경로·수면 전체에 접근할 수 있다고 가정하면 안 된다. 권한 요청은 필요한 시점에 나눌 수 있다. [권한 요청](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- `HKAuthorizationStatus`는 **쓰기/공유 권한 상태**다. 읽기 허용·거부를 알려주는 값이 아니다. 읽기를 거부해도 해당 query에 결과가 없는 것처럼 보이며 앱 자신이 저장한 값만 보일 수 있다. [HKAuthorizationStatus](https://developer.apple.com/documentation/healthkit/hkauthorizationstatus)
- 현재 문서의 제한기간 API는 제한된 이력 범위가 있을 때 타입별 earliest date를 반환한다. 결과에 타입이 없으면 전체 허용과 거부를 구별할 수 없다. 경계는 샘플 end date 기준일 수 있어 시작이 경계보다 이른 샘플도 올 수 있다. 정확 SDK availability는 별도 확인한다. [제한기간 API](https://developer.apple.com/documentation/healthkit/hkhealthstore/getearliestauthorizedsampledate%28for%3Acompletion%3A%29)
- 지원되지 않는 장치, 관리 제한, 잠긴 DB, 취소, query 오류는 각각 별도 오류다. 읽기 결과 없음에서 `errorAuthorizationDenied`를 추론하면 안 된다. [HKError](https://developer.apple.com/documentation/healthkit/hkerror/errorauthorizationdenied)

### 5.2 TrainOracle 화면 상태 제안

| 상태 | 표시 예시 | 가능한 동작 | 금지할 해석 |
|---|---|---|---|
| 미지원 장치·OS | “이 기기에서는 이 항목을 읽을 수 없습니다.” | 지원 범위 안내, 파일 가져오기 | 서비스 전체 연결 실패로 단정 |
| 아직 요청하지 않음 | “심박 상세를 읽으려면 항목 접근 요청이 필요합니다.” | 해당 타입만 요청 | 모든 건강 데이터 일괄 요청 |
| 읽을 수 있는 결과 없음 | “읽을 수 있는 심박 기록이 없습니다. 기록 또는 접근 설정을 확인하세요.” | Health 설정 안내, 재조회 | “권한 거부됨”, “심박 0”, “운동 안 함” |
| 제한된 기간 확인 | “이 항목은 표시된 날짜 이후의 기록만 확인할 수 있습니다.” | 허용 범위 표시, 기간 선택 제한 | 과거 이력이 존재하지 않는다고 단정 |
| 요약만 수신 | “요약은 확인됐고 상세 시계열은 없습니다.” | 요약 유지, 제공 출처 보기 | 요약으로 가짜 선 그래프 생성 |
| 경로/상세 수신 중 | “세부 기록을 확인하는 중입니다.” | 부분 표시, 완료/갱신 상태 | 첫 빈 query를 영구 결측으로 확정 |
| 잠김/일시 오류 | “기기를 잠금 해제한 뒤 다시 확인하세요.” 또는 구체 재시도 안내 | 재시도, 마지막 확인 시각 | 캐시를 최신 값으로 표시 |
| 원본 변경·삭제 확인 | “원본이 변경/삭제되었습니다.” | 연결된 일지·분석 영향 확인 | 다른 출처의 사본까지 무조건 삭제 |

이는 Apple 문구 복사가 아닌 제품 제안이다. 권한 요청 completion 성공을 “모든 필드 허용”으로 저장하지 않고, **request flow / query 성공 / 관찰 결과 / 이력 범위**를 분리해 모델링한다.

## 6. 출처·우선순위·중복·수정

### 6.1 Health의 표시 우선순위와 원산지는 다르다

Health는 기본적으로 직접 입력, Apple 장치, 앱·Bluetooth 장치 순으로 같은 항목의 출처를 우선하며, 사용자가 Data Sources & Access에서 순서를 바꿀 수 있다. 새 출처가 추가된 순서도 앱·장치 우선순위에 영향을 준다. 이 설명은 Health 화면의 선택 규칙이다. **이번 조사에서 해당 사용자 우선순위 목록을 그대로 돌려주는 공개 getter는 확인하지 못했다.** [Health 데이터 관리](https://support.apple.com/en-au/108779)

`HKObject.sourceRevision`은 그 객체를 HealthKit에 쓴 앱/장치의 버전 정보이며, `HKDevice`는 추가 장치 정보를 담는다. 따라서 HealthKit을 통해 읽었다는 사실만으로 데이터의 최초 제공자가 Apple이라고 확정하면 안 된다. [sourceRevision](https://developer.apple.com/documentation/healthkit/hkobject/sourcerevision)

**TrainOracle 제안:** `transport=HEALTHKIT`, writer source, device, 객체 UUID, 원본 제공자/확인 수준을 별도로 보존한다. Garmin→중계 앱→HealthKit의 원본 제공자를 확인할 수 없다면 미확인 상태를 유지한다. 중계 경로가 원제공자의 AI 허용 범위를 바꾸지 않는다. 기존 provider lineage/grant 규칙을 통과하기 전에는 화면 조회 가능한 값도 AI 입력으로 자동 승격하지 않는다.

### 6.2 동기화 계약

HealthKit의 anchored query는 저장/삭제 변화와 새 anchor를 반환한다. background delivery는 observer query로 변화를 알리고 anchored query로 실제 변경을 읽는 방식이다. 삭제 객체는 영구 보존되지 않을 수 있다. [Anchored queries](https://developer.apple.com/documentation/healthkit/executing-anchored-object-queries), [읽기 방식](https://developer.apple.com/documentation/healthkit/reading-data-from-healthkit), [HKDeletedObject](https://developer.apple.com/documentation/healthkit/hkdeletedobject)

이를 바탕으로 다음을 계약에 포함하는 것이 필요하다. 아래는 구현 제안이다.

1. 타입·query scope별 anchor와 import revision을 저장하고, 변경분을 안전하게 수신한 뒤 checkpoint를 전진시킨다.
2. workout UUID의 반복 수신은 동일 원본의 갱신으로 처리한다. 파일 사본과 HealthKit 사본은 출처가 다른 후보로 연결하고 자동 합산하지 않는다.
3. workout뿐 아니라 연결된 quantity series, route, effort의 늦은 추가·교체도 상세 revision 변경으로 취급한다.
4. 확인된 원본 삭제 이벤트와 단순 빈 결과·권한 변경을 구분한다. 빈 query만으로 서버의 기존 운동을 삭제하지 않는다.
5. 긴 미접속 후 복구는 명시적인 범위 재조회·대조가 필요하다. 재조회에서 보이지 않는 항목을 전체 허용의 증거 없이 삭제로 확정하지 않는다.
6. 출처 사본의 충돌은 사용자가 선택한 대표 운동과 보조 사본을 구분해 보여준다. 거리·시간이 비슷하다는 이유만으로 새 개인 최고·총량에 중복 반영하지 않는다.

### 6.3 상세를 잃지 않기 위한 두 가지 예외

**늦은 route:** route는 workout 뒤에 도착하거나 smoothing 처리로 바뀔 수 있다. `HKWorkoutRouteQuery`는 여러 배치를 반환하며 `done` 전까지 완료가 아니다. `syncIdentifier` 관련 수정도 처리해야 한다. [경로 읽기](https://developer.apple.com/documentation/healthkit/reading-route-data)

**오래된 quantity series:** HealthKit은 오래된 first-party 운동 샘플을 압축된 quantity series로 바꿀 수 있다. 통계 query는 이를 처리하지만, 상세 차트는 `HKQuantitySeriesSampleQuery`로 개별 값들을 읽어야 한다. sample 한 개를 측정 한 점으로 취급하거나 교체된 sample의 삭제를 운동 삭제로 취급하면 상세가 손실된다. [Condensed workout samples](https://developer.apple.com/documentation/healthkit/accessing-condensed-workout-samples)

## 7. 화면별 필수 상태와 상호작용

이 절은 공식 정보 구조를 바탕으로 한 **TrainOracle 구현 제안**이다. 브랜드·내비게이션·기존 기록 UI는 유지하며, 제공되지 않은 Apple 내부 계산값을 새 필수 데이터로 만들지 않는다.

| 화면 | 필수 정보 | 필수 조작 | 필수 상태 |
|---|---|---|---|
| 운동 목록 | 날짜, 종목, 출처, 거리/시간(있을 때), 최신 확인 시각 | 기간·종목·출처 필터, 운동 열기 | 로딩, 빈 결과, 부분 이력, 갱신 실패, 사본 후보 |
| 운동 요약 | 운동/하위 activity, 시간대, 시간 의미, 핵심 측정값, 원본 식별·출처 | 상세 항목 열기, 일지로 이동, 출처 확인 | 요약만 있음, 하위 활동 누락, 값 충돌, 삭제/변경 |
| 지표 상세 | 단위, 통계 범위, 유효 샘플 수/범위, 시간축 또는 거리축, 결측 간격 | 지표 선택, 점/구간 탐색, 요약으로 복귀 | 일부 구간 결측, 압축 시계열 로딩, 현재 값 미지원, 전체 없음 |
| 구간 상세 | 구간 종류, 번호, 시작/끝, 거리·시간·페이스의 의미 | 행 선택→관련 그래프 범위, 제공/계산 구간 구분 | 빈/짧은 마지막 구간, pause, 이벤트 중복, 거리만 있고 시간 없음 |
| route/고도 | 경로·정확도·표본 범위, 제공된 고도/상승값 | 지도 확대, 구간 강조, 상세 닫기 | 없음, 일부 배치, 지연 수신, 수정됨, 정확도 부족 |
| zone | 실제 경계, 설정 출처, 체류시간, 적용 activity | 각 zone 상세, 경계 설명 | OS 미지원, 구성 없음, 경계가 다른 기록, 미계측 구간 |
| effort | 추정/직접평가 구분, 대상 운동, 제공시각 | 설명 보기; 편집은 별도 쓰기 범위 승인 후 | 미제공, 수정됨, activity 관계 없음 |
| 건강 이력 | 수면 단계·HRV 등 정의, 기간, 표본·출처·관찰 범위 | D/W/M 등 기간, 기록 상세, 출처 선택 | 부분 이력, 센서 미제공, 자료 부족, 단위/정의 차이 |
| 연결·데이터 관리 | 요청한 타입, 확인된 이력 제한, 마지막 성공, 제공 경로 | 필요한 타입 요청, 다시 확인, 연결 해제/앱 보관 데이터 관리 | 미지원, 요청 취소, 읽을 결과 없음, 잠김, 동기화 오류 |

차트에는 색만으로 상태를 구분하지 않고 텍스트·범례·수치가 있어야 한다. 선택된 점/구간을 키보드와 터치로 탐색할 수 있게 하고, 작은 화면에서는 여러 y축을 겹쳐 놓기보다 한 지표씩 설명하는 상세를 우선한다. 이는 공개 화면의 픽셀 복제가 아닌 가독성·접근성 제안이다.

## 8. 건강 지표를 훈련 분석으로 넘길 때의 제한

수면 단계는 inBed와 실제 수면이 겹치므로 단순 합계가 아니라 구간별 의미를 처리해야 한다. Apple Watch의 awake 표본은 수면 표본 사이에만 기록될 수 있어 밤 시작·끝에 awake 표본이 없다는 이유로 그 시간을 모두 수면으로 채우면 안 된다. 서로 다른 writer의 수면도 먼저 조정해야 한다. [Sleep analysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)

Fitness의 추세는 최근 90일과 365일을 비교하며 시작에는 180일 활동이 필요하다고 설명한다. Health의 변화 감지 UI는 별도 기능이다. 이 숫자를 TrainOracle의 훈련 처방·부상 위험·회복 기준으로 옮기지 않는다. 수집 범위가 짧으면 기간 관찰 요약만 제공한다. [Fitness 추세](https://support.apple.com/en-asia/guide/iphone/iph4c34a8a95/27/ios/27), [Health 추세](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/26/ios/26)

Apple training load의 7일/28일 화면과 sleep score의 구성 설명은 사용자가 Apple에서 보는 값을 이해하는 참고다. 공개 getter·계산식·가용성 확인 없이 TrainOracle이 같은 결과를 낸다고 주장하지 않는다. 자체 통계를 만든다면 관찰기간·입력·계산 정의를 보여주고 별도 이름을 쓴다. [Training load](https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/27/watchos/27), [Sleep score](https://support.apple.com/en-mo/guide/watch/apded441a669/26/watchos/26)

공개 최신 가이드에는 Readiness 화면도 나타나지만, 이번 요청의 필수 범위와 별도이며 해당 값의 공개 HealthKit getter는 확인하지 못했다. 이를 의료·회복·훈련 가능 여부의 자동 판정 근거로 추가하지 않는다. [Apple Watch Readiness](https://support.apple.com/guide/watch/readiness-flx4gnzby346/watchos)

## 9. 구현 전 결정할 최소 데이터 계약

아래는 기존 공통 모델에 더할 내용을 검토하기 위한 제안이며, 새 스키마를 이번에 작성하거나 확정한 것은 아니다.

| 계층 | 필요한 정보 | 방지하려는 오류 |
|---|---|---|
| 운동 identity | provider/transport, source object UUID, writer revision, device, origin assurance, import revision | 중계 Apple 원산지 오인, 반복 가져오기 중복 |
| 운동 summary | sport/activity, started/ended/timezone, reported duration, wall-clock duration, duration meaning, 단위별 stats | 종목·시간 의미 혼합, 거리/시간만으로 정밀 분석 생성 |
| metric series | metric identifier, unit, timestamp/interval, sample/source ID, workout association, availability, resolution/series 여부 | 가짜 시계열, 다른 운동 자료 결합, 빈 구간 0 처리 |
| events | event kind, interval, provider marker 또는 derived 방법/버전 | lap/segment/split 혼동, pause 중복 포함 |
| route | 별도 보호 범위, batch completion, revision, accuracy, source link | 조기 완료, 부정확한 고도 합산, 위치의 불필요한 노출 |
| zones/effort | 원본 configuration/설정출처/경계, per-activity 관계, 직접/추정 구분 | 과거 경계 덮어쓰기, 수동 평가와 추정값 혼합 |
| health history | definition(SDNN 등), interval, coverage, source choice, raw/derived 구분 | RMSSD 혼합, 수면 이중 계산, 부족한 이력의 안정된 baseline 주장 |
| access/sync | requested types, observed result, earliest-date capability/result, checkpoint, last success, tombstone | 권한 성공 오인, 허용 범위 밖 과거의 부재 확정, 삭제 오판 |

HealthKit query는 네이티브 framework를 통해 수행한다. 이 보고서는 브라우저가 직접 HealthKit 원자료를 읽는 서버 HTTP API를 제안하지 않는다. 모바일에서 읽은 자료를 회사 서버로 전달하는 동작에는 기존 계정 결속·보관 동의·출처·목적 권한이 별도로 필요하다. **HealthKit 읽기 가능과 서버 보관·AI 추론 허용은 같은 승인 사건이 아니다.** [HealthKit 읽기](https://developer.apple.com/documentation/healthkit/reading-data-from-healthkit), [권한·개인정보 보호](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)

## 10. 합성 자료로 먼저 검증할 인수 조건

이번 조사에서는 아래 테스트를 실행하지 않았다. 이후 구현 시 필요한 좁은 인수 조건이다.

| 사례 | 통과 기준 |
|---|---|
| 정상 러닝 | 원본 ID로 운동 1건, 요약과 각 metric의 단위·시각 일치, 상세에서 같은 일지로 돌아감 |
| HR·route 없는 운동 | 기본 운동은 열림. 없는 값은 0·권한 거부로 표시하지 않음 |
| 요약만 있는 파일 또는 HealthKit 기록 | 요약은 표시, 상세 차트/정밀 split은 생성하지 않음 |
| pause 포함 duration | 제공 duration과 wall-clock 구별, 계산 페이스의 시간 기준 표시 |
| 일부 시계열과 낮은 정확도 | 빈 구간 선 연결·정밀 고도/속도 주장 방지 |
| route 다중 배치·늦은 수정 | 완료 플래그 전 부분 상태, 갱신 후 같은 운동 상세만 revision 갱신 |
| 압축 quantity series | 내부 표본을 확장하여 차트 표시, 교체 sample 삭제가 workout 삭제가 되지 않음 |
| 멀티스포츠·겹친 이벤트 | 활동별 metric 분리, 중복 이벤트·전체시간 이중 합산 방지 |
| OS 27 zone / 구형 OS | 지원+존재 시 원본 경계 표시, 미지원 시 심박 자체는 계속 사용 |
| 서로 다른 zone 경계 | “Zone 3” 명칭만으로 기간 합산하지 않음 |
| 직접 effort와 추정 effort | 별도 값·관계 유지, 하나가 없다고 임의 생성하지 않음 |
| read 결과 없음·제한기간 | full/denied 오판 금지, 제한기간 capability가 없을 때 제한 여부를 꾸며내지 않음 |
| 잠긴 DB·query 오류 | 재시도 안내, 오래된 캐시와 최신 조회 성공을 구분 |
| 수면 inBed+stages·복수 출처 | 구간 중복 합산 금지, 미측정 구간 수면 채우기 금지 |
| SDNN과 타사 RMSSD | 별도 정의/계열 표시, 같은 HRV 평균으로 합치지 않음 |
| HealthKit+동일 파일 사본 | 대표 원본/사본·충돌 표시, 일지·총량·AI 입력 중복 방지 |
| 확인된 삭제 vs 빈 query | 명시 삭제만 해당 원본에 반영, 빈 query로 보관자료 파괴 금지 |

**실제 사용 가능 판정은 후속 네이티브 검증에서만 가능하다.** 최소 1개 운동의 summary·series·source·관찰 가능한 범위를 동일 식별자로 추적하고, UI 상세·계정 재조회·일지 링크까지 확인해야 한다. 이것은 현재 개인 자료를 조회하라는 실행 지시가 아니라, 향후 승인된 검증에서 필요한 증거 수준이다.

## 11. 완료와 남은 일

### 이번에 완료

- 공식 화면 흐름과 HealthKit API 대응을 항목별로 정리했다.
- 2026년 zone API와 제한기간 권한 문서를 반영하고 구형 OS와 분리했다.
- read 권한의 비공개 상태, 시간 의미, 시계열 압축, 경로 지연, 중계 출처·중복 문제를 필수 UI 상태와 인수 조건으로 연결했다.
- 관찰·공식 문서·제품 제안·미확인 항목을 구분했다.

### 남은 확인

- 모바일의 실제 deployment target/SDK에서 각 symbol availability와 제한기간 API의 정식 지원 여부.
- 특정 OS·기기·운동종류·원제공자가 실제로 쓰는 각 metric, effort, zone, route payload의 존재·해상도.
- 수입 기록의 러닝 cadence 공급 경로와 파생 평균 정책.
- Apple 내부 계산값 getter의 후속 공식 문서 확인. 미확인 상태를 “API가 영원히 없다”는 단정으로 바꾸지 않기.
- 승인된 네이티브 데이터 경로에서의 상세 수신·저장·재조회·일지 반영 검증.

제품 코드·서버·설정은 이 보고서에서 변경하지 않았다. 공개 문서가 가능한 범위를 보여준 것과 TrainOracle이 실제 데이터를 받은 것은 별도다.
