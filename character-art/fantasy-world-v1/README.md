# 별빛 릴레이 숲 · 공유 랜드마크 3종

2026-10-17. 기존 유료 Tripo 원본을 보존하고 Blender 4.5.14에서 새 판타지
랜드마크로 가공했다. 캐릭터는 변경하지 않았으며 **신규 Tripo 생성·과금 0**이다.
잔액을 새로 조회하거나 과거 잔액을 현재 값으로 사용하지 않았다.

| 납품 | 기존 원형 | 이번 제작 |
|---|---|---|
| `gate.webp` | defense-v4 finish-gate | 보랏빛 석조색, 굵은 수정 룬, 이끼 받침 |
| `crystal.webp` | run-party-v2 upgrade-core | 원형을 낮은 광물 기반으로 가공, 큰 수정 3개를 자체 메시로 제작 |
| `bridge.webp` | 서울 rock FBX | 바위를 교각으로 재사용, 7개 석조 아치 블록·낮은 난간·이끼·통행면 자체 제작 |

## 연결 계약

- 공개 파일: `app/public/game/fantasy-world-v1/{gate,crystal,bridge}.webp`.
- 3종 모두 512×512 투명 lossless WebP, 종횡비 1:1.
- 공통 지면 원점은 `(0.5, 0.78)`. 투명 여백을 잘라내지 않는다.
- 다리 위를 실제 경로가 통과할 때는 manifest의 **`pathAlignmentOrigin`**으로
  통행면을 경로에 맞춘다. 지면 원점 그대로 통행면을 맞췄다고 가정하지 않는다.
- TD v5와 같은 정사영 카메라 방향·부드러운 조명. 팬·확대/축소용 고정 시점이며,
  이 한 장으로 자유로운 3D 회전이 지원된다는 의미가 아니다.
- 충돌·통행·입장 규칙은 이미지 알파 영역과 별개로 게임이 정의한다.
- 지면 그림자는 넣지 않았고 runtime이 필요 시 별도로 그린다.
- `ground.webp`와 `panorama.webp`는 다른 작업자의 소유이며 이 스크립트는 건드리지 않는다.

## 편집 / 재현 / 근거

`{gate,crystal,bridge}.blend`에 편집 메시·재질·카메라·조명이 있다.
`working/*.glb`는 나중에 3D 배치에도 재사용 가능한 자체 작업본이다.
기존 GLB/FBX는 덮어쓰지 않는다. `bake-report.json`과 `ledger.json`에는
원본 경로·해시·작업 ID·카메라·실제 출력 해시·삼각형 수를 기록했다.

```text
blender --background --factory-startup --python-exit-code 1 --python character-art/fantasy-world-v1/tools/bake.py
python character-art/fantasy-world-v1/tools/pack.py
```

특정 자산만 다시 촬영하려면 첫 명령 뒤 `-- gate`처럼 지정한다.
검수판은 `review/contact.png`: 밝고 어두운 배경, 320px와 96px 비교다.
원본 Tripo 텍스처를 새 팔레트 재질로 대체했으며 모델별로 다른 조명이나
표면 디테일을 추가하지 않았다. 최초 관문 시안의 상대 크기 오류는 작업 변환을
정점에 반영하는 순서를 수정해 다시 촬영했다. 최종 검수와 실제 맵 배치 검증은 구분한다.

## 권리

기존 유료 출력의 권리 기록은
[`defense-v4/ledger.json`](../defense-v4/ledger.json),
[`run-party-v2/sources/generation.json`](../run-party-v2/sources/generation.json),
[`서울 소품 기록`](../scenery/seoul-v1/README.md),
[`토리 공통 사용권 기록`](../tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md)에 있다.
새 룬·수정·다리 구성은 로컬 Blender 메시 제작이다. 게임 스크린샷이나 다른
회사의 모델을 입력·복사하지 않았다. 코드의 MIT를 아트의 MIT/CC0 허가로
확장하지 않으며, 원형과 가공물에 별도 공개 재사용 라이선스를 새로 부여하지 않는다.
계정 화면·인증정보·서명 URL은 포함하지 않는다.
