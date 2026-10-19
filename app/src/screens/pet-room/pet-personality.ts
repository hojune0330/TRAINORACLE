import type { CareAction, PetId } from './pet-catalog'
import { NEW_VOICES } from './pet-new-friends'

type Voice = Record<Exclude<CareAction, 'bed'>, readonly [string, string]>
  & { bed: string; wake: string; adopted: string; favorite: CareAction }

// Short, authored reactions: personality lives in the interaction, not just the profile.
export const PET_VOICES: Record<PetId, Voice> = {
  ...NEW_VOICES,
  otter: {
    pet: ['볼도 살짝 만져 줘. 헤헤.', '네 손에 내 손도 올려 볼래.'],
    feed: ['두 손으로 꼭 잡고 먹을게!', '오물오물. 다 먹으면 공놀이할까?'],
    play: ['데굴데굴! 이번엔 내가 보낼게.', '잡았다! 네 쪽으로 다시 굴릴게.'],
    bed: '공은 여기 둘게. 우리도 쉬자.', wake: '으아암. 공도 우리 옆에서 잤네 ㅎㅎ', adopted: '내 공도 여기 두고 살래!', favorite: 'play',
  },
  seal: {
    pet: ['토닥토닥… 아, 졸려 ㅎㅎ', '조금만 더. 네 손이 따뜻해.'],
    feed: ['한 입 먹고 다시 누울래.', '잘 먹었어. 배가 동글해졌네.'],
    play: ['굴러오는 공을 배로 받았어!', '엉금엉금. 내가 보내 줄게.'],
    bed: '내 옆에 누워. 자리 데워 놨어.', wake: '으응… 조금만 더 뒹굴자.', adopted: '이 푹신한 자리, 이제 내 자리야?', favorite: 'pet',
  },
  'red-panda': {
    pet: ['꼬리까지 쓱쓱 해 줘.', '헤헤. 꼬리가 자꾸 움직여.'],
    feed: ['내가 좋아하는 간식이다!', '천천히 먹을게. 한 입씩 오물오물.'],
    play: ['꼬리로 공을 막았지!', '이번엔 안 놓칠 거야. 얍!'],
    bed: '꼬리 덮고 잘게. 너도 이불 덮어.', wake: '어? 꼬리가 이불 밖으로 나왔네.', adopted: '내 꼬리까지 쉴 자리가 생겼어!', favorite: 'feed',
  },
  duck: {
    pet: ['삐약! 머리 위가 간질간질해.', '눈 감고 가만히 있을게.'],
    feed: ['콕콕. 작은 것부터 먹을래.', '삐약! 잘 먹었어.'],
    play: ['종종종! 공 따라간다!', '부리로 톡! 너한테 간다!'],
    bed: '삐약… 목소리 작게 하고 잘게.', wake: '삐약! 눈 뜨니까 네가 있네.', adopted: '종종종. 이제 여기가 우리 집!', favorite: 'play',
  },
  hedgehog: {
    pet: ['천천히… 응, 이제 괜찮아.', '손이 익숙해졌어. 조금 더 해 줘.'],
    feed: ['네 옆에서 먹어도 되지?', '작은 한 입. 맛있네.'],
    play: ['살살 굴려 줘. 잡아 볼게.', '받았어! 나도 조금씩 잘하지?'],
    bed: '동그랗게 말고 잘게. 옆에 있어 줘.', wake: '쭈욱… 이제 몸을 펴 볼까?', adopted: '여기서는 몸을 펴고 쉬어도 되겠다.', favorite: 'pet',
  },
  mouse: {
    pet: ['손가락 하나로 살살 해 줘.', '수염은 간지러워! ㅎㅎ'],
    feed: ['이 작은 조각도 두 손 가득이야.', '볼에 넣지 않고 꼭꼭 씹을게.'],
    play: ['공 뒤로 숨었다! 나 찾아 봐.', '쪼르르! 이번엔 내가 먼저 잡았어.'],
    bed: '작은 이불만 있으면 돼. 잘 자.', wake: '쭉쭉! 작은 발도 기지개 켰어.', adopted: '내 작은 이불, 여기 펴도 되지?', favorite: 'play',
  },
  rabbit: {
    pet: ['귀 옆을 살살… 응, 거기.', '네 손 쪽으로 고개를 기댈게.'],
    feed: ['앞니로 조금씩 먹을게.', '오물오물. 네 옆에서 먹으니 좋아.'],
    play: ['폴짝! 공 옆으로 뛰었어.', '앞발로 톡. 천천히 받아 줘.'],
    bed: '귀를 내려놓고 잘게. 내일 보자.', wake: '귀부터 쫑긋! 너도 일어났어?', adopted: '이제 매일 네 옆에서 쉴 수 있네.', favorite: 'pet',
  },
  puppy: {
    pet: ['꼬리가 멈추질 않아! ㅎㅎ', '배도 쓰다듬어 줘. 발라당!'],
    feed: ['앉아서 기다렸어. 이제 먹을게!', '냠! 다 먹었으니 손도 핥아 줄까?'],
    play: ['물고 왔어! 또 던져 줘!', '이번엔 네 발 앞에 놓을게. 톡.'],
    bed: '네 옆에서 동그랗게 말고 잘게.', wake: '일어났어? 꼬리는 벌써 깼어!', adopted: '나 진짜 여기서 살아? 꼬리가 바빠!', favorite: 'play',
  },
  chinchilla: {
    pet: ['등이 폭신폭신하지? 살살 해 줘.', '눈이 스르르 감겨… 기분 좋아.'],
    feed: ['작게 잘라 줘서 고마워.', '두 손으로 꼭 잡고 냠냠.'],
    play: ['통통! 공보다 내가 더 높이 뛰었네.', '꼬리로 균형 잡고 톡!'],
    bed: '폭신한 꼬리 옆에서 같이 쉬자.', wake: '자고 나니 털이 삐죽 섰어 ㅎㅎ', adopted: '내 폭신한 자리가 생겼다!', favorite: 'pet',
  },
  'guinea-pig': {
    pet: ['등을 쓱쓱. 몸이 나른해졌어.', '네 손 옆에 턱을 놓을게.'],
    feed: ['킁킁! 이 냄새 좋아해.', '오물오물… 맛있어서 천천히 먹는 중!'],
    play: ['공 쫓아가다가 한 바퀴 돌았어.', '짧은 발로도 잡을 수 있지!'],
    bed: '간식은 다 먹었어. 이제 코 잘까?', wake: '킁킁. 아침이네! 잘 잤어?', adopted: '우리 집에서 같이 냠냠하자!', favorite: 'feed',
  },
  penguin: {
    pet: ['머리 위를 토닥이면 눈이 감겨.', '날개도 살짝 펴 볼게.'],
    feed: ['부리로 쏙! 잘 먹었어.', '한 입 먹고 뒤뚱뒤뚱 인사!'],
    play: ['뒤뚱뒤뚱! 공 좀 기다려!', '날개로 받았다! 다시 네 쪽으로.'],
    bed: '날개를 접고 잘게. 너도 편히 누워.', wake: '날개 쭉! 오늘도 옆에 있네.', adopted: '뒤뚱뒤뚱. 이 방이 내 집이 됐네!', favorite: 'play',
  },
  tortoise: {
    pet: ['천천히 해 줘서 좋아.', '고개를 조금 더 내밀어 볼게.'],
    feed: ['꼭꼭. 다 먹을 때까지 옆에 있어 줘.', '한 입 더 먹었어. 고마워.'],
    play: ['공이 멈추면 내가 가서 밀게.', '느려도 네 쪽으로 잘 보냈지?'],
    bed: '서두르지 말고 쉬자. 나도 눈 감을게.', wake: '눈부터 천천히 떴어. 잘 잤어?', adopted: '천천히 오래, 여기서 같이 살자.', favorite: 'bed',
  },
}

export function careVoice(id: PetId, action: Exclude<CareAction, 'bed'>, turn: number) {
  return PET_VOICES[id][action][turn % 2]!
}
