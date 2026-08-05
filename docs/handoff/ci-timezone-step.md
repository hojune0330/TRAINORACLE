# CI 시간대 단계 추가 요청 (에이전트 권한 밖)

## 요약
`.github/workflows/ci.yml`의 `app-quality` 잡에 **KST로 유닛 테스트를 한 번 더
돌리는 단계**를 넣어야 합니다. 에이전트 GitHub App에 `workflows` 권한이 없어
푸시가 거부됐습니다(`refusing to allow a GitHub App to create or update workflow`).
그래서 코드로 반영하지 못하고 패치만 남깁니다.

## 왜 필요한가 (결함 주입으로 확인)
`app/src/domain/dates.ts`의 `isoToDate`를 `new Date(iso)`(UTC 파싱)로 바꾸는
회귀를 주입해 시간대별로 돌린 결과:

| TZ | 결과 |
|---|---|
| UTC | **통과 (회귀를 놓침)** |
| Asia/Seoul | 실패 (잡음) |
| America/New_York | 실패 (잡음) |

GitHub 러너는 UTC입니다. UTC에서는 UTC 자정과 로컬 자정이 같은 순간이라 두
구현의 결과가 **실제로 동일**해서, 이 회귀를 원리적으로 잡을 수 없습니다.
즉 지금 CI는 이 회귀를 그대로 통과시킵니다.

사용자는 KST에서 씁니다. 날짜가 하루 밀리면 일지가 다른 주에 붙어 주간 거리
합계가 조용히 틀어집니다.

## 이 단계가 기존 CI를 깨지 않는지 먼저 측정함
전체 스위트를 시간대별로 돌려 실패 테스트 **이름**을 기준선과 대조(`comm -13`):

| TZ | 실패 수 | 기준선 대비 신규 |
|---|---|---|
| UTC (기준선) | 24 | — |
| Asia/Seoul | 24 | **0** |
| America/New_York | 24 | **0** |

24건은 전부 샌드박스 Node 20의 WebCrypto 미지원 탓이며 CI(Node 24)에서는
통과합니다. 따라서 이 단계는 새 실패를 만들지 않습니다.

## 적용할 패치
`app-quality` 잡의 `Run app unit tests` 단계 **바로 뒤**에 추가:

```yaml
      # 날짜 계산 회귀는 UTC에서 원리적으로 안 잡힌다.
      # `isoToDate`를 `new Date(iso)`(UTC 파싱)로 바꾸는 결함을 주입해 확인:
      #   TZ=UTC        -> 통과 (UTC 자정 == 로컬 자정이라 결과가 동일)
      #   TZ=Asia/Seoul -> 실패
      # 러너가 UTC라 위의 `npm test`만으로는 이 회귀가 main까지 들어온다.
      # 실제 사용자 시간대(KST)로 한 번 더 돌려서 막는다.
      - name: Run app unit tests (KST — 시간대 의존 회귀 차단)
        working-directory: app
        env:
          TZ: Asia/Seoul
        run: npm test
```

YAML 파싱은 검증했고, `TZ`는 해당 단계에만 적용됩니다.

## 왜 vitest.config.ts에 넣지 않았나
설정 파일에 TZ를 박으면 개발자 로컬 시간대까지 덮어써서, 각자 실제 환경에서
뭐가 깨지는지 못 보게 됩니다. CI에서 "UTC + KST 둘 다" 돌리는 편이 실제
커버리지가 넓습니다.

## 한계 (덮지 않고 밝힘)
이걸로 모든 시간대 회귀가 막히지는 않습니다. UTC+9에서도 안 걸리는 회귀는
여전히 통과합니다. 전 시간대 매트릭스가 아니라 "사용자가 실제로 있는 시간대
하나 추가"입니다.

## 이 패치 없이도 확보된 것
`app/src/domain/dates.contract.test.ts`의 D-13·D-14가 "로컬 자정에 놓인
Date인가"를 직접 검사합니다. 개발자가 로컬(KST)에서 테스트를 돌리면 잡힙니다.
막지 못하는 건 **CI만 믿고 머지하는 경로**입니다.
