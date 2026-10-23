# 펫 원본 생성 기록

2026-10-22 · Tripo Studio Pro · 비공개 생성. 시드는 화면에서 제공되지 않았다.
실제 차감은 `credit-ledger.json`, 원본 파일과 작업 ID는 `sources/tripo/*/PROVENANCE.json`을 따른다.

로컬 참고 그림 업로드는 브라우저 확장의 파일 접근 제한으로 실패했다. 이를 우회하지 않았다.
아래 rabbit/seal/otter 문구는 Studio의 포함 이미지 생성에 사용했고, 그 결과를 같은
Studio 안에서 P2.0 모델 생성에 전달했다. duck은 포함 이미지 생성이 실패하여 같은 문구로
3D 모델을 직접 생성했다. 모델을 받은 뒤 색·표정·관절·동작은 Blender에서 수정했다.

## 고양이 · 강아지

기존 `references/cat-master.png`, `references/puppy-master.png`의 체형과 특징을 설명하는
텍스트로 P2.0 체험 모델을 만들었다. 해당 그림 자체가 업로드된 것은 아니다.
현재 이 파일에는 두 요청의 정확한 전송 문구가 보존돼 있지 않다. 재구성한 문장을
원문으로 표시하지 않는다. 생성 ID, 받은 원본, 수정 전후 파일은 보존한다.

## 토끼 — 실제 입력

```text
Create ONE original baby lop-eared rabbit as a clean 3D asset reference. Full body, 3/4 side view facing left. It is an ANIMAL ON ALL FOUR PAWS, like a pet rabbit sitting low in a loaf-like crouch, with the front paws extended to the floor under the chest and the big hind paws under the rump. HORIZONTAL body. The head is large and round, the torso is tiny and plump. Two very long soft lop ears hang down with pink inner ears. Warm gray-taupe body, cream rounded muzzle, cream chest, belly and four paw tips, tiny dark brown oval eyes, small brown nose, simple W-shaped smile, pale pink cheek circles. Small round pompom tail. Simple smooth shapes, matte flat colors, no fur details. Four separated paws visible. All paws touch the same ground plane. Plain light gray background. No words, no props, no clothing, no pedestal. It must resemble a cute real pet rabbit, not a human-shaped character or teddy bear.
```

## 오리 — 실제 입력

```text
ONE original baby duckling for a cozy pet-care game, clean 3D asset reference, single character full body, three-quarter front view facing left. A very large rounded pear-shaped butter-yellow head, two short rounded feather tufts on the top, tiny dark brown vertical oval eyes, small wide orange duck bill, pale pink circular cheeks. Tiny plump butter-yellow oval body, two short rounded wings held slightly out from the torso with visible gaps, little upward tail, two very short legs and two flat orange webbed feet standing on the same ground plane. Head is more than half the total height. Simplest possible smooth shapes and flat matte colors. Friendly soft silhouette, no fur, no feather texture, no eyelashes, no clothes, no accessories, no pedestal, no scenery, no writing. Plain light gray background. Keep left and right wing and each foot separate for animation.
```

## 물범 — 실제 입력

```text
One original adorable round blue-gray seal, full body, 3/4 front view. A very large smooth round head, tiny oval dark brown eyes, a cream round muzzle and chest, small dark brown nose, simple W smile and pale pink round cheeks. Short plump tapered horizontal body resting on its belly, two short rounded front flippers extended gently to the sides with clear gaps from the body, two flat rounded rear flippers at the tail. No legs, no feet, no ears. Extremely simple matte flat colors, no skin wrinkles, no hair, no whiskers, no eyelashes, no clothing or accessories. Single character alone, all body parts within frame, plain light gray background, no pedestal, no writing. Clean 3D model reference for a cozy pet care game. Friendly toy-like soft silhouette.
```

## 수달 — 실제 입력

```text
One original cute small river otter for a cozy pet care game. Full body, three-quarter SIDE view, standing on FOUR short animal legs with clearly separated paws. Its plump torso is long and HORIZONTAL like a real otter, not a standing teddy bear. Big round caramel-brown head, two tiny round ears, small dark brown oval eyes, a large cream-colored muzzle and cheeks, cream chest and belly, tiny dark brown nose, simple friendly W smile, pale pink blush. Short dark brown paws and a long thick tapered tail extending backward along the ground, separated from the legs. Simple rounded forms and flat matte colors, no hair strands, no clothing, no accessories, no pedestal, no writing. Light gray empty background. Keep the body low, four paws on one ground plane, head large and legs short. Clean editable 3D model reference.
```

## 수정 기준

- 고양이·강아지의 기본 걷기는 받은 Tripo 동작에서 과한 진폭을 줄였다.
- 토끼의 자동 뼈대는 귀와 머리를 잘못 묶어 최종본에서 쓰지 않는다. 원본은 보존한다.
- 토끼·오리·물범·수달의 최종 동작은 각 체형에 맞춘 별도 Blender 뼈대와 키프레임이다.
- 원본 이미지를 통째로 기울이거나 늘려서 팔다리 움직임을 대신하지 않는다.
- 최종 게임에는 담백한 갈색 선, 단순한 면색, 투명 배경의 2D 동작 시트를 쓴다.
