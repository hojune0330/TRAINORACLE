/** Entry copy describes the shipped rules, not planned multiplayer features. */
export type LoungePlay = 'solo' | 'friends'
export const GAME_CATALOG = [
  { id: 'tour', name: '러닝 투어', category: '달리기', goal: '장애물을 넘고 도시를 완주해요',
    solo: '도시마다 90초', friends: false, outcome: '세 구간을 완주하면 다음 도시가 열려요.',
    rules: ['화면을 누르고 달려요. 손을 떼면 에너지가 차지만 뒤로 밀려요.', '위로 쓸어 점프하고 두 번 눌러 대시해요. 뒤로 떨어지면 이번 도전은 끝나요.', '구간마다 강화 하나를 선택해요. 충돌을 줄일수록 완주 별이 늘어요.'],
    art: 'seoul-v1/shoe.webp', extra: 'seoul-v1/tower.webp' },
  { id: 'push', name: '밀어내기', category: '대결', goal: '대시로 상대를 트랙 밖으로!',
    solo: '90초 × 2라운드', friends: true, outcome: '더 많이 밀어낸 쪽이 이겨요. 같으면 덜 떨어진 쪽이 이겨요.',
    rules: ['꾹 눌러 달리고 상대가 가까울 때 두 번 눌러 밀쳐요.', '위로 쓸어 점프하면 장애물과 상대의 공격을 피할 수 있어요.', '떨어져도 2초 뒤 돌아와요. 제한 시간까지 계속 대결해요.'],
    art: 'run-party-v3/track-island.webp', extra: 'image-library-v1/fx/fx-hit-burst.webp' },
  { id: 'survival', name: '장애물 생존', category: '회피', goal: '연속 장애물을 넘고 끝까지 버텨요',
    solo: '90초 × 2라운드', friends: true, outcome: '덜 떨어진 쪽이 이겨요. 같으면 점프로 더 많이 피한 쪽이 이겨요.',
    rules: ['화면을 누르고 달리며 위로 쓸어 장애물을 넘어요.', '두 번 누르면 대시해요. 이 종목에서는 서로 밀리지 않아요.', '떨어져도 2초 뒤 다시 출발해요. 마지막까지 낙하를 줄여 보세요.'],
    art: 'image-library-v1/world/world-jump-hurdle.webp', extra: 'image-library-v1/world/world-bounce-pad.webp' },
  { id: 'defense', name: '타워 디펜스', category: '전략', goal: '타워를 배치해 몰려오는 적을 막아요',
    solo: '6웨이브', friends: false, outcome: '기지 체력을 지키며 6웨이브를 막으면 승리해요.',
    rules: ['번호가 있는 지점을 누르고 연사·포격·냉각 타워를 지어요.', '웨이브를 시작하면 타워가 자동으로 공격해요. 처치 골드로 강화해요.', '기지 체력이 0이 되면 끝나요. 웨이브 사이에는 저장하고 나갈 수 있어요.'],
    art: 'image-library-v1/defense/td-cannon-tower.webp', extra: 'image-library-v1/defense/td-enemy-scout.webp' },
] as const
export type LoungeGameId = typeof GAME_CATALOG[number]['id']
export const loungeGame = (id: LoungeGameId) => GAME_CATALOG.find(game => game.id === id)!
