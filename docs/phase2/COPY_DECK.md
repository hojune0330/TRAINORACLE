# 2차 문구 덱

> 자동 생성: `node docs/phase2/copy/build-copy-deck.mjs` (원본 `copy/phase2.ko.json`). 이 파일을 직접 고치지 말고 JSON을 고친다.

규칙
- 해요체로 쓰고 행동을 먼저 말한다. `{변수}`는 개발 담당이 채운다.
- 한도는 360px 한 줄 기준 권장 최대 글자 수다(변수는 4자로 센다).
- P 숫자는 쉼표를 넣어 `1,250P`처럼 쓴다. 원 환산은 잔액과 가격 옆에만 `(125원)`으로, 내림해서 붙인다(POINT_STANDARD §5).
- 메달 문구에는 원·P 가치를 붙이지 않는다.
- `pending` 표시가 있는 문구는 오너·법률 승인 전에는 화면에 넣지 않는다.

키 106개 · 검사 결과: 통과

## point

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `point.migration.title` | 포인트가 10배가 됐어요 | 16 |  |
| `point.migration.body` | 가치는 그대로예요. 1P를 0.1원으로 계산하기 쉽게 숫자만 바꿨어요. | 60 |  |
| `point.migration.example` | 기존 {before}P → {after}P ({won}원) | 30 |  |
| `point.migration.offline` | 연결되면 바뀐 잔액을 보여드릴게요. | 30 |  |
| `point.migration.list.rate` | 1P = 0.1원으로 계산해요 | 20 |  |
| `point.migration.list.use` | 지금은 일지 꾸미기에만 써요 | 20 |  |
| `point.migration.list.earn` | 일지 40P · 방문 10P를 받아요 | 22 |  |
| `point.migration.confirm` | 확인 | 6 |  |
| `point.migration.more` | 포인트 지갑 보기 | 12 |  |
| `point.upgrade` | 포인트 표시 방식이 바뀌었어요. 앱을 새로고침하면 바른 잔액을 볼 수 있어요. | 60 |  |

## wallet

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `wallet.title` | 포인트 | 8 |  |
| `wallet.balance.label` | 사용 가능 | 8 |  |
| `wallet.balance.a11y` | 사용 가능 {points}포인트, {won}원 가치 | 40 |  |
| `wallet.rate` | 1P = 0.1원으로 계산해요 | 20 |  |
| `wallet.month` | 이번 달 적립 {earned}P · 사용 {spent}P | 30 |  |
| `wallet.cta.journal` | 일지 쓰고 40P 받기 | 14 |  |
| `wallet.cta.decorate` | 꾸미기 둘러보기 | 12 |  |
| `wallet.earn.title` | 포인트 받는 방법 | 12 |  |
| `wallet.earn.journal` | 일지를 남긴 날 40P | 18 |  |
| `wallet.earn.journal.hint` | 하루 한 번, 오늘 날짜 일지만 | 22 |  |
| `wallet.earn.visit` | 앱을 연 날 10P | 18 |  |
| `wallet.earn.visit.hint` | 하루 한 번 | 12 |  |
| `wallet.earn.streak7` | 기록 7일째 100P | 18 | ⚠️ 오너 승인 필요(POINT_STANDARD §7-1) |
| `wallet.earn.streak30` | 기록 30일째 300P | 18 | ⚠️ 오너 승인 필요 |
| `wallet.ledger.title` | 최근 내역 | 10 |  |
| `wallet.ledger.all` | 전체 내역 | 8 |  |
| `wallet.ledger.empty` | 아직 내역이 없어요. 일지를 남기면 40P가 쌓여요. | 40 |  |
| `wallet.ledger.reason.journal` | 일지 기록 | 10 |  |
| `wallet.ledger.reason.visit` | 방문 | 10 |  |
| `wallet.ledger.reason.streak` | 기록 {days}일 연속 | 12 |  |
| `wallet.ledger.reason.decoration` | {item} 열기 | 16 |  |
| `wallet.ledger.reason.bundle` | {collection} 모두 열기 | 18 |  |
| `wallet.ledger.reason.migration` | 포인트 10배 전환 | 12 |  |
| `wallet.ledger.balanceAfter` | 잔액 {points}P | 14 |  |
| `wallet.note` | 포인트는 지금 일지 꾸미기에만 써요. 다른 사람에게 보내거나 현금으로 바꾸는 기능은 아직 없어요. | 70 |  |
| `wallet.guest` | 이 기기에 쌓인 포인트예요. 로그인하면 다른 기기에서도 볼 수 있어요. | 50 |  |
| `wallet.guest.login` | 로그인 | 6 |  |

## home

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `home.strip.available` | 사용 가능 {points}P | 16 |  |
| `home.strip.visitAwarded` | +10P | 6 |  |
| `home.decoration.note` | 오늘 일지 위에서 바로 꾸며요. 포인트는 1P = 0.1원으로 계산하고, 지금은 꾸미기에만 써요. | 60 |  |
| `home.decoration.noteEmpty` | 일지를 하나 남기면 그 페이지 위에서 바로 꾸밀 수 있어요. | 44 |  |

## rewards

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `rewards.visit.awarded` | 오늘 방문 +10P가 반영됐어요. | 24 |  |
| `rewards.visit.already` | 오늘 방문 10P는 이미 반영돼 있어요. | 28 |  |
| `rewards.visit.ineligible` | 오늘 날짜를 확인하지 못해 방문 포인트를 반영하지 않았어요. | 40 |  |
| `rewards.visit.saveFailed` | 방문 포인트를 이 기기에 저장하지 못했어요. | 30 |  |
| `rewards.visit.pending` | 계정 방문 포인트를 확인하고 있어요. | 26 |  |
| `rewards.journal.awarded` | 일지를 남겨서 +40P | 16 |  |

## decoration

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `decoration.price` | {points}P | 8 |  |
| `decoration.buy` | {points}P로 열기 | 12 |  |
| `decoration.bought` | 열었어요: {item} | 20 |  |
| `decoration.insufficient` | {missing}P 더 필요해요 · 일지 {journals}번이면 돼요 | 30 |  |
| `decoration.bundle.buy` | {collection} 모두 열기 · {points}P | 24 |  |

## faq

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `faq.points.cash.q` | 포인트를 돈으로 바꿀 수 있나요? | 24 |  |
| `faq.points.cash.a` | 아직은 안 돼요. 포인트는 1P를 0.1원 가치로 계산하지만, 지금은 테마·스티커·아바타처럼 일지를 꾸미는 데만 써요. 다른 사람에게 보내거나 현금으로 바꾸는 기능은 없어요. 바뀌면 미리 알려 드릴게요. | 140 |  |
| `faq.points.rate.q` | 1P는 얼마인가요? | 16 |  |
| `faq.points.rate.a` | 1P는 0.1원으로 계산해요. 10P가 1원이에요. 일지를 남긴 날 40P(4원), 앱을 연 날 10P(1원)를 받아요. | 90 |  |
| `faq.medal.q` | 미니게임 메달도 포인트인가요? | 22 |  |
| `faq.medal.a` | 아니요. 메달은 미니게임 꾸미기에만 쓰는 게임 재화예요. 포인트나 현금으로 바꿀 수 없고, 게임 점수와도 상관없이 한 판에 1개씩 받아요. | 100 |  |

## legal

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `legal.points` | TrainOracle 포인트는 1P를 0.1원 가치로 계산합니다. 현재는 앱 안 꾸미기에만 사용할 수 있으며, 양도하거나 현금으로 바꿀 수 없습니다. | 120 | ⚠️ 법률 확인 후 open-source.html 생성기·약관에 반영(WORK_SPLIT O-2) |

## game

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `game.medal.earned` | 메달 +{n} | 8 |  |
| `game.medal.left` | 오늘 {n}번 더 받을 수 있어요 · 결과와 상관없이 한 판에 1개 | 40 |  |
| `game.medal.capped` | 오늘 받을 메달을 다 받았어요 | 20 |  |
| `game.medal.capped.hint` | 내일 다시 받을 수 있어요 | 16 |  |
| `game.medal.notCash` | 메달은 게임 꾸미기에만 쓰고 포인트(P)·현금으로 바꿀 수 없어요. | 44 |  |
| `game.ad.button` | 광고 보고 메달 +2 | 14 |  |
| `game.ad.button.left` | 오늘 {n}번 남음 | 12 |  |
| `game.ad.done` | 메달 +2를 받았어요 | 14 |  |
| `game.ad.skipped` | 광고를 끝까지 보지 않아 메달은 받지 않았어요 | 30 |  |
| `game.ad.failed` | 지금은 광고를 불러오지 못했어요. 게임은 그대로 할 수 있어요. | 40 |  |
| `game.stamp.tab` | 스탬프 | 6 |  |
| `game.stamp.progress` | 스탬프 {n}/{total} | 14 |  |
| `game.stamp.empty` | 도시를 완주하면 스탬프가 찍혀요 | 22 |  |
| `game.stamp.earned` | {city} 스탬프를 받았어요 | 18 |  |
| `game.season.done.ribbon` | 시즌 완주 | 8 |  |
| `game.season.done.title` | {season} 완주! | 20 |  |
| `game.season.done.stars` | 모은 별 {n}/{total} | 14 |  |
| `game.season.done.next` | 다음 시즌이 열렸어요: {season} | 22 |  |
| `game.season.done.cta` | 다음 시즌 지도 보기 | 14 |  |
| `game.season.done.last` | 모든 시즌을 완주했어요. 다음 시즌을 준비하고 있어요. | 36 |  |
| `game.character.same` | 모습만 달라요. 속도·점프·판정은 모두 같아요. | 30 |  |
| `game.character.unlock` | 여는 조건: {condition} | 20 |  |

## ad

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `ad.consent.title` | 광고를 보기 전에 확인할게요 | 18 |  |
| `ad.consent.age.q` | 만 14세 이상인가요? | 16 |  |
| `ad.consent.age.yes` | 만 14세 이상이에요 | 12 |  |
| `ad.consent.age.no` | 14세 미만이에요 | 12 |  |
| `ad.consent.under14` | 14세 미만은 광고 없이 게임을 해요. 메달은 한 판마다 그대로 받아요. | 44 |  |
| `ad.consent.points.1` | 광고를 끝까지 보면 게임 메달만 받아요. 포인트·현금은 받지 않아요. | 44 |  |
| `ad.consent.points.2` | 맞춤 광고는 따로 켤 때만 써요. 기본은 꺼져 있어요. | 34 |  |
| `ad.consent.points.3` | 게임 메뉴 › 설정 › 광고에서 언제든 끌 수 있어요. | 34 |  |
| `ad.consent.personalized` | 맞춤 광고 보기 (선택) | 14 |  |
| `ad.consent.agree` | 동의하고 광고 보기 | 12 |  |
| `ad.consent.later` | 나중에 | 6 |  |
| `ad.consent.close` | 닫기 | 4 |  |
| `ad.settings.title` | 광고 | 4 |  |
| `ad.settings.enabled` | 광고 보고 메달 받기 | 14 |  |
| `ad.settings.personalized` | 맞춤 광고 | 8 |  |
| `ad.settings.age` | 나이 확인 다시 하기 | 12 |  |
| `ad.settings.record` | {date}에 동의했어요 (버전 {version}) | 30 |  |
| `ad.settings.off` | 광고를 끄면 광고 버튼이 사라져요. 메달은 한 판마다 그대로 받아요. | 44 |  |

## state

| 키 | 문구 | 한도 | 비고 |
|---|---|---|---|
| `state.offline` | 오프라인 · 이 기기에 저장돼요 | 20 |  |
| `state.saveFailed` | 저장하지 못했어요. 이 기기에는 남아 있어요. | 30 |  |
| `state.retry` | 다시 시도 | 6 |  |
| `state.syncing` | 확인 중 | 6 |  |
| `state.upgrade` | 새 버전이 있어요. 새로고침하면 이어서 쓸 수 있어요. | 34 |  |
| `state.refresh` | 새로고침 | 6 |  |
| `state.empty.wallet` | 아직 포인트가 없어요 | 14 |  |
