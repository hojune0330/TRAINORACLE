import type { DecorationCollection } from './decoration-collections'

/** Exact encoded sizes from docs/art/pet-observations/scene-manifest.json; artwork keeps its original aspect ratio. */
const SCENE_PIXEL_HEIGHTS = {
  'otter-ball': 427,
  'otter-seal-ball': 320,
  'cat-box': 427,
  'cat-box-paws': 427,
  'seal-cushion': 427,
  'seal-flat': 320,
  'red-panda-tail': 427,
  'red-panda-tent': 427,
  'rabbit-blanket': 427,
  'rabbit-hedgehog-blanket': 320,
  'puppy-plush': 571,
  'puppy-plush-hug': 427,
} as const

/** Stable IDs survive later scene/art updates and already decorated journals. */
export const PET_OBSERVATION_STICKERS = [
  { sceneId: 'otter-ball', sha256: '69bd042a7814425e83e76126104993c9596c66349eeebbe29b0a332358809f11', id: 'PET_NIGHT_OTTER_BALL', ruleId: 'PET_PHOTO_OTTER_BALL', name: '공을 안고 쿨쿨', group: 'OTTER' },
  { sceneId: 'otter-seal-ball', sha256: '7bc05566cec76e782907aba1333d3309e65d7cd59c3544411dccce36ebe27bf8', id: 'PET_NIGHT_OTTER_SEAL_BALL', ruleId: 'PET_PHOTO_OTTER_SEAL_BALL', name: '같은 공 위에 앞발', group: 'OTTER' },
  { sceneId: 'cat-box', sha256: '3f98740618f1e2cc773ccb1c880a1a4d7cadaa88a292c29b30554845c0a06b3c', id: 'PET_NIGHT_CAT_BOX', ruleId: 'PET_PHOTO_CAT_BOX', name: '침대보다 상자', group: 'CAT' },
  { sceneId: 'cat-box-paws', sha256: 'f46ebf654f4c1d56e218d086b929c654cd3ee6241851e3ccf5bfc0c39c39652d', id: 'PET_NIGHT_CAT_BOX_PAWS', ruleId: 'PET_PHOTO_CAT_BOX_PAWS', name: '꼬리와 한쪽 발만 빼꼼', group: 'CAT' },
  { sceneId: 'seal-cushion', sha256: 'df8c612e9b47ba42a5635c36361d7d54c472c6cb57001300102b2e1be23baf86', id: 'PET_NIGHT_SEAL_CUSHION', ruleId: 'PET_PHOTO_SEAL_CUSHION', name: '쿠션에 턱 올리기', group: 'SEAL' },
  { sceneId: 'seal-flat', sha256: 'b086998bd3a8d4d7275a5441457ad9c1acb0cbe68ef91bf5e54dcfa0190494fa', id: 'PET_NIGHT_SEAL_FLAT', ruleId: 'PET_PHOTO_SEAL_FLAT', name: '쿠션은 옆에 둘래', group: 'SEAL' },
  { sceneId: 'red-panda-tail', sha256: '117024969fb5ed32f1baded0b1d958752df7cc81021c7811a22267d6e03bd0f4', id: 'PET_NIGHT_RED_PANDA_TAIL', ruleId: 'PET_PHOTO_RED_PANDA_TAIL', name: '내 꼬리가 베개', group: 'RED_PANDA' },
  { sceneId: 'red-panda-tent', sha256: 'fe147478f89eb7e36a3ed035ef27c76b885c5c03d6572cefbeee905f465e6de0', id: 'PET_NIGHT_RED_PANDA_TENT', ruleId: 'PET_PHOTO_RED_PANDA_TENT', name: '꼬리로 닫은 천막', group: 'RED_PANDA' },
  { sceneId: 'rabbit-blanket', sha256: '87147e4006b13896316899debe229bef384046bd8aac8d447ee2fcb5b9c2bdf5', id: 'PET_NIGHT_RABBIT_BLANKET', ruleId: 'PET_PHOTO_RABBIT_BLANKET', name: '이불 끝의 작은 자리', group: 'RABBIT' },
  { sceneId: 'rabbit-hedgehog-blanket', sha256: '3a842c516c412030ecfaf5b0479d0469283efd4822526521a39c4e4f36ff5e6a', id: 'PET_NIGHT_RABBIT_HEDGEHOG_BLANKET', ruleId: 'PET_PHOTO_RABBIT_HEDGEHOG_BLANKET', name: '이불 양쪽에 나란히', group: 'RABBIT' },
  { sceneId: 'puppy-plush', sha256: '7fa8ecb99bf4e5e353bbb55c5e43808aa20a84f25f67c03cb0d848c9fd500f53', id: 'PET_NIGHT_PUPPY_PLUSH', ruleId: 'PET_PHOTO_PUPPY_PLUSH', name: '인형도 침대로', group: 'PUPPY' },
  { sceneId: 'puppy-plush-hug', sha256: '2434197c77c1122e643c2b21381c8837253d2a9d02caade7be74d38e6bfc037e', id: 'PET_NIGHT_PUPPY_PLUSH_HUG', ruleId: 'PET_PHOTO_PUPPY_PLUSH_HUG', name: '인형을 꼭 안고', group: 'PUPPY' },
] as const

export const PET_OBSERVATIONS_V1 = {
  id: 'PET_OBSERVATIONS_V1', title: '잠든 친구들', subtitle: '12종 · 친구 방에서 사진을 남기면 받아요',
  artDirection: '작은 펫이 물건과 함께 잠든 행동을 담은 단순한 선의 2D 스티커.',
  sourceNote: 'TrainOracle 펫을 바탕으로 새로 만든 원본 그림이에요.',
  assetDir: 'collections/pet-observations-v1',
  render: { width: 640, height: 640, transparentBackground: true },
  groups: [{ id: 'OTTER', label: '수달' }, { id: 'CAT', label: '고양이' }, { id: 'SEAL', label: '물범' }, { id: 'RED_PANDA', label: '레서판다' }, { id: 'RABBIT', label: '토끼' }, { id: 'PUPPY', label: '강아지' }],
  items: PET_OBSERVATION_STICKERS.map(item => ({
    id: item.id, name: item.name, description: `친구 방에서 남긴 ‘${item.name}’ 사진을 일지에 붙여요.`,
    fileName: `${item.sceneId}.webp`, group: item.group, licenseId: 'TRAINORACLE_PET_OBSERVATION_ORIGINAL' as const,
    sourceAsset: `games/pet-room-v1/observations/${item.sceneId}.webp`,
    sha256: item.sha256,
    pixelDimensions: { width: 640, height: SCENE_PIXEL_HEIGHTS[item.sceneId] },
    acquisition: { kind: 'REWARD' as const, ruleId: item.ruleId },
  })),
  defaultAcquisition: { kind: 'REWARD', ruleId: 'PET_PHOTO_OTTER_BALL' }, availability: 'ACTIVE',
  entryPreviewItemIds: ['PET_NIGHT_OTTER_BALL', 'PET_NIGHT_CAT_BOX', 'PET_NIGHT_RED_PANDA_TAIL', 'PET_NIGHT_RABBIT_BLANKET'],
  licenseReviewedOn: '2026-10-26',
} as const satisfies DecorationCollection
