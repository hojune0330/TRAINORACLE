/*
 * 꾸미기 컬렉션 레지스트리.
 *
 * 기본 재료(TrainOracle 자체 그림, 브리프 §2.2 문구용품 톤)와 별개로, 각자의 아트 디렉션을
 * 갖는 "컬렉션"(귀여운 스티커·시즌·굿즈·라이선스 캐릭터)을 데이터 한 덩어리로 추가한다.
 *
 * 설계 원칙
 *  1. 컬렉션 = `DecorationCollection` 한 항목. 툴바·상점·법적 고지·자산 장부는 이 레지스트리에서 파생한다.
 *  2. retire-never-delete: 시즌 종료·라이선스 만료 시 아이템을 카탈로그에서 빼지 않고
 *     `availability: "RETIRED"`로 남긴다. 상점 노출만 멈추고, 이미 보유·배치된 것은 계속 렌더된다.
 *  3. 획득 경로(`acquisition`)는 포인트 구매만이 아니라 보상·시즌·번들을 구분한다.
 *  4. 라이선스는 `LICENSES` 레지스트리 하나로 관리하고, 상용 계약은 `validUntil`/`contractRef`를 기록한다.
 *  5. 컬렉션 자산은 `collections/<id>/` 아래에 두고 SW 프리캐시에서 제외한다(처음 열 때 lazy fetch).
 */

/* ── 라이선스 레지스트리 ── */

export type LicenseKind = "OPEN" | "COMMERCIAL" | "IN_HOUSE"

export type DecorationLicense = {
  readonly id: string
  /** 사람이 읽는 권리자/프로젝트 이름. */
  readonly holder: string
  readonly kind: LicenseKind
  /** SPDX 식별자 또는 계약 명칭. */
  readonly terms: string
  readonly attributionRequired: boolean
  readonly sourceUrl?: string
  /** 원본 리비전/패키지 버전 등 재현 정보. */
  readonly revision?: string
  /** 라이선스 전문 파일(public 기준 상대 경로). */
  readonly licenseFile?: string
  /** 가공 방식(파생물 표기 의무 대응). */
  readonly modification?: string
  /** 상용 계약: 신규 판매 종료일(ISO). 지나면 컬렉션을 RETIRED로 전환해야 한다. */
  readonly validUntil?: string
  /** 상용 계약 식별자(감사 대응). 저장소에는 계약 내용 자체를 넣지 않는다. */
  readonly contractRef?: string
}

export const LICENSES = [
  {
    id: "TRAINORACLE_IN_HOUSE",
    holder: "TrainOracle",
    kind: "IN_HOUSE",
    terms: "TrainOracle 자체 제작",
    attributionRequired: false,
    modification: "브리프 §2.2 문구용품/리소그래프 스타일로 직접 제작한 그림을 WebP로 내보냄",
  },
  {
    id: "FLUENT_EMOJI_FLAT_MIT",
    holder: "Microsoft Fluent Emoji",
    kind: "OPEN",
    terms: "MIT",
    attributionRequired: true,
    sourceUrl: "https://github.com/microsoft/fluentui-emoji",
    revision: "1ffb34c752ecf5d402f04cfb4b392c77f57c54bc",
    licenseFile: "licenses/fluentui-emoji-MIT.txt",
    modification: "공식 Flat SVG를 투명 256×256 WebP로 렌더",
  },
  {
    id: "OPEN_PEEPS_CC0",
    holder: "Open Peeps by Pablo Stanley (DiceBear 패키지)",
    kind: "OPEN",
    terms: "CC0 1.0 (디자인) · MIT (패키지 코드)",
    attributionRequired: false,
    sourceUrl: "https://www.openpeeps.com/",
    revision: "@dicebear/open-peeps@9.4.2 (73e2dd6cfb471a36871851cf0707b5f2f6b48c32)",
    licenseFile: "licenses/dicebear-open-peeps-LICENSE.txt",
    modification: "Open Peeps 파츠를 결정적으로 조합해 투명 256×256 WebP로 렌더",
  },
] as const satisfies readonly DecorationLicense[]

export type LicenseId = (typeof LICENSES)[number]["id"]

export function licenseById(id: string): DecorationLicense | undefined {
  return LICENSES.find((license) => license.id === id)
}

/* ── 획득 경로 ── */

/**
 * 아이템을 손에 넣는 방법. 포인트 차감 검증(`spentPoints`)에는 POINTS/BUNDLE만 포함되고,
 * REWARD/SEASON은 "조건 충족 시 자동 지급"이라 spentPoints를 늘리지 않는다.
 */
export type DecorationAcquisition =
  | { readonly kind: "STARTER" }
  | { readonly kind: "POINTS"; readonly cost: number }
  /** 컬렉션 단위로 한 번에 받는다. 개별 구매 가격은 `cost`, 컬렉션 일괄 가격은 컬렉션 `bundle`에 있다. */
  | { readonly kind: "BUNDLE"; readonly cost: number }
  /** 활동 보상. 규칙은 `REWARD_RULES`에서 평가한다. */
  | { readonly kind: "REWARD"; readonly ruleId: RewardRuleId }
  /** 기간 한정 무료 지급. 기간 밖에서는 신규 지급이 멈추고 보유분은 유지된다. */
  | { readonly kind: "SEASON"; readonly from: string; readonly to: string }

/** 컬렉션 아이템은 기본 제공(STARTER)이 될 수 없다 — 시작 재료는 기본 카탈로그 소관. */
export type CollectionAcquisition = Exclude<DecorationAcquisition, { readonly kind: "STARTER" }>

export type DecorationAvailability = "ACTIVE" | "RETIRED"

/** 획득 경로에서 포인트 차감액. 보상·시즌·기본 제공은 0. */
export function acquisitionCost(acquisition: DecorationAcquisition): number {
  return acquisition.kind === "POINTS" || acquisition.kind === "BUNDLE" ? acquisition.cost : 0
}

/** 사용자에게 보여 주는 획득 방법 한 줄. 툴바 타일·확인 행에서 공통으로 쓴다. */
export function acquisitionLabel(acquisition: DecorationAcquisition): string {
  switch (acquisition.kind) {
    case "STARTER": return "기본 제공"
    case "POINTS":
    case "BUNDLE": return `${acquisition.cost}P로 받기`
    case "REWARD": return rewardRuleById(acquisition.ruleId)?.description ?? "활동 보상"
    case "SEASON": return `${acquisition.to.slice(5).replace("-", "/")}까지 무료`
  }
}

/* ── 보상 규칙 ── */

/** 보상 판정에 쓰는 활동 신호. engagement 요약에서 그대로 나온다. */
export type RewardSignals = {
  readonly journalDays: number
  readonly visitDays: number
}

export type RewardRule = {
  readonly id: string
  readonly label: string
  /** 사용자에게 보여 주는 달성 조건 문장. */
  readonly description: string
  readonly satisfied: (signals: RewardSignals) => boolean
}

export const REWARD_RULES = [
  { id: "FIRST_JOURNAL", label: "첫 기록", description: "일지를 처음 남기면 받아요.", satisfied: (s: RewardSignals) => s.journalDays >= 1 },
  { id: "JOURNAL_7_DAYS", label: "기록 7일", description: "일지를 7일 남기면 받아요.", satisfied: (s: RewardSignals) => s.journalDays >= 7 },
  { id: "JOURNAL_30_DAYS", label: "기록 30일", description: "일지를 30일 남기면 받아요.", satisfied: (s: RewardSignals) => s.journalDays >= 30 },
  { id: "VISIT_14_DAYS", label: "방문 14일", description: "14일 방문하면 받아요.", satisfied: (s: RewardSignals) => s.visitDays >= 14 },
] as const satisfies readonly RewardRule[]

export type RewardRuleId = (typeof REWARD_RULES)[number]["id"]

export function rewardRuleById(id: string): RewardRule | undefined {
  return REWARD_RULES.find((rule) => rule.id === id)
}

/* ── 컬렉션 정의 ── */

export type CollectionGroup = { readonly id: string; readonly label: string }

export type CollectionItemDefinition = {
  readonly id: string
  readonly name: string
  readonly description: string
  /** 컬렉션 자산 디렉터리 기준 파일명. */
  readonly fileName: string
  readonly group: string
  readonly licenseId: LicenseId
  /** 생략 시 컬렉션 `defaultAcquisition`. */
  readonly acquisition?: CollectionAcquisition
  /** 생략 시 컬렉션 `availability`. */
  readonly availability?: DecorationAvailability
  /** 장부용: 원본 자산 식별자와 SHA-256. */
  readonly sourceAsset?: string
  readonly sha256?: string
}

export type DecorationCollection = {
  readonly id: string
  readonly title: string
  /** 상점 진입 카드 부제(예: "28종 · 한 개 4P"). 비우면 자동 생성. */
  readonly subtitle?: string
  /** 브리프와 다른 아트 디렉션을 한 줄로. 검수·문서에 쓴다. */
  readonly artDirection: string
  /** 사용자에게 보이는 출처 안내 한 줄. */
  readonly sourceNote: string
  /** public 기준 자산 디렉터리. SW 프리캐시 제외 대상. */
  readonly assetDir: string
  readonly render: { readonly width: number; readonly height: number; readonly transparentBackground: boolean }
  readonly groups: readonly CollectionGroup[]
  readonly items: readonly CollectionItemDefinition[]
  readonly defaultAcquisition: CollectionAcquisition
  /** 컬렉션 전체를 한 번에 받는 가격. 없으면 개별 구매만. */
  readonly bundle?: { readonly cost: number }
  readonly availability: DecorationAvailability
  /** 상점 진입 카드에 보여 줄 미리보기 4장(아이템 id). 프리캐시에 포함된다. */
  readonly entryPreviewItemIds: readonly string[]
  /** 시즌 컬렉션: 노출 기간. 지나면 RETIRED와 동일하게 취급한다. */
  readonly season?: { readonly from: string; readonly to: string }
  /** 라이선스 검토일(ISO). 법적 고지 페이지의 "확인일"로 출력된다. */
  readonly licenseReviewedOn: string
}

const CUTE_GROUPS = [
  { id: "RUNNING_TOOLS", label: "달리기·도구" },
  { id: "MOOD_RECOVERY", label: "기분·회복" },
  { id: "WEATHER_TIME", label: "날씨·시간" },
  { id: "CHEER_ACHIEVEMENT", label: "응원·성취" },
  { id: "DOODLE_FRIENDS", label: "낙서 친구" },
] as const

const F = "FLUENT_EMOJI_FLAT_MIT" as const
const P = "OPEN_PEEPS_CC0" as const

export const OPEN_CUTE_V1 = {
  id: "OPEN_CUTE_V1",
  title: "귀여운 스티커",
  licenseReviewedOn: "2026-09-01",
  artDirection: "이모지풍 플랫 일러스트 — 기본 재료의 문구용품 톤과 대비되는 밝고 동글동글한 컬렉션(의도된 예외).",
  sourceNote: "Microsoft Fluent Emoji Flat과 Open Peeps의 오픈 라이선스 그림을 사용했어요.",
  assetDir: "collections/open-cute-v1",
  render: { width: 256, height: 256, transparentBackground: true },
  groups: CUTE_GROUPS,
  defaultAcquisition: { kind: "POINTS", cost: 4 },
  bundle: { cost: 80 },
  availability: "ACTIVE",
  entryPreviewItemIds: ["CUTE_FLUENT_RUNNING_SHOE", "CUTE_FLUENT_RED_HEART", "CUTE_FLUENT_SUN", "CUTE_PEEP_HUMMING"],
  items: [
    { id: "CUTE_FLUENT_RUNNING_SHOE", name: "알록달록 러닝화", description: "달린 날을 가볍게 표시하는 러닝화예요.", fileName: "cute-fluent-running-shoe.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Running shoe/Flat/running_shoe_flat.svg", sha256: "80b23e4157be94de4e6cb245274ca51532452276a833e0bf2db40ce0b86952fe" },
    { id: "CUTE_FLUENT_STOPWATCH", name: "동글 스톱워치", description: "기록을 재거나 반복 훈련을 한 날에 붙여요.", fileName: "cute-fluent-stopwatch.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Stopwatch/Flat/stopwatch_flat.svg", sha256: "fad1b138f9f38462a7243161dbc410c1dc4dcb676c94994be83fb24c0517da97" },
    { id: "CUTE_FLUENT_RUNNING_SHIRT", name: "러닝 셔츠", description: "러닝복을 챙긴 날의 일지에 붙여요.", fileName: "cute-fluent-running-shirt.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Running shirt/Flat/running_shirt_flat.svg", sha256: "5ed9c93883d39128145847f698bd818d03d1b255a7923a097e1ab76f008567d4" },
    { id: "CUTE_FLUENT_FINISH_FLAG", name: "결승 깃발", description: "경기나 중요한 훈련을 마친 날에 붙여요.", fileName: "cute-fluent-finish-flag.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Chequered flag/Flat/chequered_flag_flat.svg", sha256: "873a85c61544feaaa88f304b8494d5295e48b3c9dbb736b888e2ac20b76317f6" },
    { id: "CUTE_FLUENT_SPORTS_MEDAL", name: "반짝 메달", description: "완주나 기억하고 싶은 성취를 표시해요.", fileName: "cute-fluent-sports-medal.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Sports medal/Flat/sports_medal_flat.svg", sha256: "aa4a2ad03143d73a6e57bc964c724761f54dc3f0dd028a339d0bb89cdaccf2e7" },
    { id: "CUTE_FLUENT_MOUNTAIN", name: "초록 산", description: "언덕이나 트레일을 달린 날에 붙여요.", fileName: "cute-fluent-mountain.webp", group: "RUNNING_TOOLS", licenseId: F, sourceAsset: "assets/Mountain/Flat/mountain_flat.svg", sha256: "d7db486b21b01bcd44fe46c37b1a64d271325ba88d7ed7aa584a907e27c7068a" },
    { id: "CUTE_FLUENT_RED_HEART", name: "빨간 하트", description: "좋았던 순간을 하트로 남겨요.", fileName: "cute-fluent-red-heart.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Red heart/Flat/red_heart_flat.svg", sha256: "351c43c50c394c380722764c011b8b18531ba59022361410994e55d56ec3c2a3" },
    { id: "CUTE_FLUENT_DROPLET", name: "파란 물방울", description: "수분 보충이나 땀 흘린 날을 표시해요.", fileName: "cute-fluent-droplet.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Droplet/Flat/droplet_flat.svg", sha256: "c3030e908c587848552da655e7facee20dd9b4e3fcfb929559f68b2304ea7e9f" },
    { id: "CUTE_FLUENT_BANDAGE", name: "파란 반창고", description: "몸을 돌보고 회복한 날에 붙여요.", fileName: "cute-fluent-bandage.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Adhesive bandage/Flat/adhesive_bandage_flat.svg", sha256: "9381f5764b80e4e4f3700e4778128423ef5a630c4019715dac087375cfe77194" },
    { id: "CUTE_FLUENT_HOT_BEVERAGE", name: "따뜻한 한 잔", description: "훈련 뒤 천천히 쉬어 간 날에 붙여요.", fileName: "cute-fluent-hot-beverage.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Hot beverage/Flat/hot_beverage_flat.svg", sha256: "5c87ab9f418555c9303d50c28cd950306a499674f16f63b7527d00db25d7be85" },
    { id: "CUTE_FLUENT_HERB", name: "초록 새싹", description: "회복하거나 다시 시작한 날을 표시해요.", fileName: "cute-fluent-herb.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Herb/Flat/herb_flat.svg", sha256: "bc4dfd5101e18f8426ea5d44d491c3ee29400f222d8db24507fc3dbb63afd6ff" },
    { id: "CUTE_FLUENT_BLUE_HEART", name: "파란 하트", description: "차분했던 하루의 기분을 남겨요.", fileName: "cute-fluent-blue-heart.webp", group: "MOOD_RECOVERY", licenseId: F, sourceAsset: "assets/Blue heart/Flat/blue_heart_flat.svg", sha256: "1531433d769dcabf31ad84018f42c9f412d6ad7dd3321b1d06ea675c8cc0488f" },
    { id: "CUTE_FLUENT_SUN", name: "웃는 해", description: "맑고 밝았던 날에 붙여요.", fileName: "cute-fluent-sun.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Sun with face/Flat/sun_with_face_flat.svg", sha256: "03b75bad84ec230a69f4549ab4a5b90bfa04c73d4ec26931263f5ce920141e62" },
    { id: "CUTE_FLUENT_RAIN_CLOUD", name: "비구름", description: "비 오는 날의 훈련이나 하루를 표시해요.", fileName: "cute-fluent-rain-cloud.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Cloud with rain/Flat/cloud_with_rain_flat.svg", sha256: "60f79360109bb2112642c9541a9a480bba0591452fd85a9529a539de3e995b49" },
    { id: "CUTE_FLUENT_MOON", name: "노란 초승달", description: "밤에 달리거나 늦게 기록한 날에 붙여요.", fileName: "cute-fluent-moon.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Crescent moon/Flat/crescent_moon_flat.svg", sha256: "54b32c3f9c2ce23732f1b8a83ad45425f6642b61926724585074efb0023f5447" },
    { id: "CUTE_FLUENT_SPARKLES", name: "반짝이", description: "기억하고 싶은 부분을 반짝이로 꾸며요.", fileName: "cute-fluent-sparkles.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Sparkles/Flat/sparkles_flat.svg", sha256: "83e54be4e16b6a6036d97f755839f5f581151b1d5842a1e5ee878e1d0674b818" },
    { id: "CUTE_FLUENT_FIRE", name: "활활 불꽃", description: "열심히 해낸 순간을 표시해요.", fileName: "cute-fluent-fire.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Fire/Flat/fire_flat.svg", sha256: "73188d97868e7011a6bbaf5908fae611255fbf074b9b0e22d3974c0665f40b1b" },
    { id: "CUTE_FLUENT_ALARM_CLOCK", name: "빨간 알람시계", description: "이른 훈련이나 약속한 시간을 표시해요.", fileName: "cute-fluent-alarm-clock.webp", group: "WEATHER_TIME", licenseId: F, sourceAsset: "assets/Alarm clock/Flat/alarm_clock_flat.svg", sha256: "9929fbf5bf4534acd54689ce19336d672be60b1a0ff04ccd277cd6ff2ccd9a1e" },
    { id: "CUTE_FLUENT_TROPHY", name: "작은 트로피", description: "스스로 칭찬하고 싶은 날에 붙여요.", fileName: "cute-fluent-trophy.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Trophy/Flat/trophy_flat.svg", sha256: "51e3fdd6bcbf4a3760c56a6bd1990e33fb4a7c85644e78cb7486eb9d927fd7bb" },
    { id: "CUTE_FLUENT_PARTY_POPPER", name: "축하 폭죽", description: "목표를 마치거나 기쁜 일이 있던 날에 붙여요.", fileName: "cute-fluent-party-popper.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Party popper/Flat/party_popper_flat.svg", sha256: "7245602f2a86155ebbcb782f391315cfc41a4702ee3c55c6e67bfc904c556ab7" },
    { id: "CUTE_FLUENT_STAR", name: "노란 별", description: "마음에 드는 기록 옆에 별을 붙여요.", fileName: "cute-fluent-star.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Star/Flat/star_flat.svg", sha256: "f144268a94cda50b661e021ea2a1c4eff2699cfd0609af0d04cff3b053bf0948" },
    { id: "CUTE_FLUENT_CHECK", name: "초록 체크", description: "약속한 일을 마친 날에 체크해요.", fileName: "cute-fluent-check.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Check mark button/Flat/check_mark_button_flat.svg", sha256: "68a0f25b2ce812b14aeb1f588854f5c8940bd286fe6c5367dc975805ac332efb" },
    { id: "CUTE_FLUENT_BULLSEYE", name: "목표 정중앙", description: "목표에 가까워진 순간을 표시해요.", fileName: "cute-fluent-bullseye.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Bullseye/Flat/bullseye_flat.svg", sha256: "c780e2e6cc422ed4843cab33010d301dbae637a4152ec2fdafaec59bf1de778c" },
    { id: "CUTE_FLUENT_HUNDRED", name: "백점", description: "오늘의 만족스러운 기록에 붙여요.", fileName: "cute-fluent-hundred.webp", group: "CHEER_ACHIEVEMENT", licenseId: F, sourceAsset: "assets/Hundred points/Flat/hundred_points_flat.svg", sha256: "d0fc2fdcc07ac93f2adcc8553cde6876c45a64b338fe6e2ea851b50757ac306c" },
    { id: "CUTE_PEEP_HUMMING", name: "콧노래 친구", description: "기분 좋았던 하루에 낙서 친구를 붙여요.", fileName: "cute-peep-humming.webp", group: "DOODLE_FRIENDS", licenseId: P, sourceAsset: "open-peeps seed=trainoracle-open-peep-humming-v1 (face=cute, head=buns, skin=d08b5b, clothing=8fa7df)", sha256: "653793f3a0104a1283bcd056de1587426e48709ddf35c11b19909754e90f37ca" },
    { id: "CUTE_PEEP_HELLO", name: "반가운 친구", description: "가볍게 인사하고 싶은 페이지에 붙여요.", fileName: "cute-peep-hello.webp", group: "DOODLE_FRIENDS", licenseId: P, sourceAsset: "open-peeps seed=trainoracle-open-peep-hello-v1 (face=smile, head=short3, skin=ffdbb4, clothing=78e185)", sha256: "e475746b9d7607a48c14682b7124794f17d925f419cc7118f74fc43bf665d1f3" },
    { id: "CUTE_PEEP_HEART", name: "설레는 친구", description: "마음에 든 순간을 낙서 친구로 남겨요.", fileName: "cute-peep-heart.webp", group: "DOODLE_FRIENDS", licenseId: P, sourceAsset: "open-peeps seed=trainoracle-open-peep-heart-v1 (face=lovingGrin1, head=hijab, skin=edb98a, clothing=e279c7)", sha256: "841caed9f998783c1ea6ec75056ab250e46b03997bc719b20edd2fda6548bcf4" },
    { id: "CUTE_PEEP_SPARKLE", name: "눈 반짝 친구", description: "새로운 목표나 기대되는 날에 붙여요.", fileName: "cute-peep-sparkle.webp", group: "DOODLE_FRIENDS", licenseId: P, sourceAsset: "open-peeps seed=trainoracle-open-peep-sparkle-v1 (face=awe, head=hatBeanie, skin=d08b5b, clothing=8fa7df)", sha256: "3aed517c96b2876f40b2ce188373387e2447987464fcded6743fdb5763ee81bf" },
  ],
} as const satisfies DecorationCollection

/**
 * 등록 순서 = 상점 진입 카드 순서.
 * 새 컬렉션(시즌/굿즈/라이선스 캐릭터)은 여기에 한 항목만 추가하면 카탈로그 id·툴바·법적 고지·장부가 따라온다.
 * `as const`로 두어 아이템 id가 리터럴 유니언으로 남고, 카탈로그의 `DecorationId`·zod enum에 자동 편입된다.
 */
export const DECORATION_COLLECTIONS = [OPEN_CUTE_V1] as const satisfies readonly DecorationCollection[]

export type DecorationCollectionId = (typeof DECORATION_COLLECTIONS)[number]["id"]
export type CollectionItemId = (typeof DECORATION_COLLECTIONS)[number]["items"][number]["id"]

/** 모든 컬렉션 아이템 id(등록 순서). 카탈로그 `DECORATION_IDS`에 스프레드된다. */
export const COLLECTION_ITEM_IDS: readonly CollectionItemId[] = DECORATION_COLLECTIONS.flatMap((collection) => collection.items.map((item) => item.id))

export function collectionById(id: string): DecorationCollection | undefined {
  return DECORATION_COLLECTIONS.find((collection) => collection.id === id)
}

/* ── 파생 헬퍼 ── */

export function collectionItemAcquisition(collection: DecorationCollection, item: CollectionItemDefinition): CollectionAcquisition {
  return item.acquisition ?? collection.defaultAcquisition
}

export function collectionItemAvailability(collection: DecorationCollection, item: CollectionItemDefinition): DecorationAvailability {
  return item.availability ?? collection.availability
}

export function collectionAssetPath(collection: DecorationCollection, item: CollectionItemDefinition): string {
  return `${collection.assetDir}/${item.fileName}`
}

/** 아이템 id → 소속 컬렉션. 기본 재료는 undefined. */
export function collectionOfItem(itemId: string): DecorationCollection | undefined {
  return DECORATION_COLLECTIONS.find((collection) => collection.items.some((item) => item.id === itemId))
}

/** 시즌 기간 판정(양끝 포함, ISO 날짜 문자열 비교). */
export function withinSeason(season: { readonly from: string; readonly to: string } | undefined, today: string): boolean {
  if (season === undefined) return true
  return season.from <= today && today <= season.to
}

/**
 * 오늘 상점에 노출할 수 있는 컬렉션인가.
 * RETIRED거나 시즌이 지났거나 상용 라이선스가 만료됐으면 false — 단, 보유분 렌더는 막지 않는다.
 */
export function collectionVisibleInShop(collection: DecorationCollection, today: string): boolean {
  if (collection.availability !== "ACTIVE") return false
  if (!withinSeason(collection.season, today)) return false
  const licenseIds = new Set(collection.items.map((item) => item.licenseId))
  for (const licenseId of licenseIds) {
    const license = licenseById(licenseId)
    if (license?.validUntil !== undefined && license.validUntil < today) return false
  }
  return true
}

/**
 * 컬렉션 일괄 구매 시 실제 청구액.
 * 이미 일부를 개별 구매했다면 남은 개별 합계와 번들 가격 중 싼 쪽 — 먼저 산 사람이 손해 보지 않게 한다.
 */
export function collectionBundleCost(collection: DecorationCollection, ownedItemIds: ReadonlySet<string>): number | undefined {
  if (collection.bundle === undefined) return undefined
  const remaining = collection.items
    .filter((item) => !ownedItemIds.has(item.id))
    .reduce((total, item) => total + acquisitionCost(collectionItemAcquisition(collection, item)), 0)
  return Math.min(collection.bundle.cost, remaining)
}

/** 컬렉션 내 그룹별 아이템 (툴바 섹션 렌더용). */
export function collectionItemsByGroup(collection: DecorationCollection): readonly { readonly group: CollectionGroup; readonly items: readonly CollectionItemDefinition[] }[] {
  return collection.groups
    .map((group) => ({ group, items: collection.items.filter((item) => item.group === group.id) }))
    .filter((entry) => entry.items.length > 0)
}

/** 상점 카드 부제. */
export function collectionSubtitle(collection: DecorationCollection): string {
  if (collection.subtitle !== undefined) return collection.subtitle
  const acquisition = collection.defaultAcquisition
  const priceText = acquisition.kind === "POINTS" || acquisition.kind === "BUNDLE"
    ? `한 개 ${acquisition.cost}P`
    : acquisition.kind === "REWARD"
      ? "활동 보상"
      : acquisition.kind === "SEASON"
        ? "기간 한정 무료"
        : "기본 제공"
  return `${collection.items.length}종 · ${priceText}`
}
