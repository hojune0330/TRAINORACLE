# Defense image library v1 — exact generation prompts

- Tool: `image_gen.imagegen` (built-in), one standalone PNG call per asset, 12 calls total.
- Date: 2026-10-16 (Asia/Seoul).
- Seed: not provided by tool for every asset.
- Source: generated PNG copied byte-for-byte to this folder; original alpha preserved, no pixel editing.
- Reference: first `td-rapid-tower.png` is the style anchor; cannon/frost upgraded use their own base-family reference.
- Review: every generated output was visually reviewed at full size. True alpha is checked separately in `assets.json`; this does not establish gameplay integration or Tripo generation.
- Known limitations: sparse nearly transparent generated edge pixels exist; pale edge fringe can show on dark backgrounds. Individual exceptions are recorded below.

## td-rapid-tower — 연사 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: none
- Source artifact: `exec-d2ddd4c0-bab8-4a5b-9029-6439166d8f17.png`
- Visual QA: 긴 단포신, 틸색 본체. 전체 형태·무기 방향·기본 받침 확인.

```text
Use case: stylized-concept. Create exactly ONE standalone game sprite PNG: td-rapid-tower, a friendly rapid-fire defense tower. Toy-like 2.5D game art with only 25% normal detail, broad chunky geometry, clean silhouette, matte flat surfaces, muted charcoal edges and only 2-3 simple shading planes. A low ivory octagonal plinth supports one squat teal cylindrical turret with a short single thick green barrel, broad dark navy muzzle opening, one simple ivory band. Solid coherent single object suitable for later 3D reconstruction. Three-quarter elevated ORTHOGRAPHIC view, camera looking down about 45 degrees, barrel points toward screen lower-right. Whole centered object occupying about 75% of a square canvas with generous transparent margin. Palette teal/green, ivory, dark navy. True transparent alpha background, no floor, no cast shadow, no scenery, no text, no logo, no tiny details, no textures, no detached parts, no effect, no UI. Original design.
```

## td-cannon-tower — 포격 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-2534aae0-8432-4598-a419-800d52d63b67.png`
- Visual QA: 짧고 넓은 단일 포구, 코럴 본체. 연사형과 구분 확인.

```text
Use case: stylized-concept. Reference image 1 is STYLE ONLY: match its friendly chunky matte 2.5D game art, ivory octagonal plinth, broad darknavy edge colors, simple shading and camera. Generate exactly ONE new standalone sprite: td-cannon-tower. Distinct squat CORAL heavy mortar tower with a much SHORTER and WIDER single barrel than the reference, like a thick round cup tilted toward screen lower-right, one broad navy muzzle cavity. Compact coral rounded turret, low ivory octagonal plinth; very broad heavy silhouette. Only 25% normal detail, broad geometric forms, 2-3 shading planes, no textures or greebles. Elevated orthographic view looking down 45 degrees; whole centered object occupies 75% of square canvas with generous margins. A solid coherent single object for future 3D reconstruction. True transparent alpha background. No floor, no cast shadow, no environment, no detached objects, no text, logo, UI, fire or effects.
```

## td-frost-tower — 냉기 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-5306ed06-37ec-4ce1-9f6b-07be3c95f3ce.png`
- Visual QA: 큰 수정 실루엣 확인. 받침 외곽의 옅은 프린지는 어두운 배경에서 보일 수 있음.

```text
Use case: stylized-concept. Image 1 is STYLE ONLY, match chunky toy matte 2.5D game art, ivory octagonal base, navy edges, simple shading, scale and camera. Generate exactly ONE new sprite: td-frost-tower, an ice defense tower whose main silhouette is a single broad chunky ICE BLUE CRYSTAL growing from a low squat navy socket on an ivory octagonal plinth. The large opaque matte icy blue crystal is one solid faceted hexagonal obelisk with a blunt point, leaning subtly toward screen lower-right, two tiny integrated supporting crystal shoulders. No turret barrel. Only 25% normal detail; broad forms, 2-3 flat shading planes; pale iceblue, deeper blue, ivory and dark navy. Elevated orthographic view down 45 degrees, whole centered object about 75% square canvas with transparent margins. One coherent solid object for future 3D reconstruction. Actual transparent alpha; no floor/cast shadow, glow, particles, frost texture, transparency inside crystal, text, logo, UI or scenery.
```

## td-rapid-tower-upgraded — 강화 연사 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-40203840-c130-4a21-80da-2eaa7c0b8929.png`
- Visual QA: 쌍포와 금색 띠 확인. 기본형의 받침·색·시점 유지.

```text
Use case: stylized-concept. Use image 1 as the exact family and style reference. Create exactly ONE standalone upgraded rapid tower sprite td-rapid-tower-upgraded. Preserve its matte teal squat cylindrical turret, ivory octagonal plinth, navy edge palette, simple broad geometry and 45-degree downward orthographic camera. UPGRADE change: TWO clearly separated parallel thick green barrels pointing screen lower-right from a wider teal turret; one broad gold band low around turret communicates upgrade. Both muzzles navy. Slightly wider more capable silhouette, same simple chunky toy aesthetic, 25% normal detail, only 2-3 shading planes. Center whole object about75% square frame, transparent margins. True transparent alpha, no ground/cast shadow, no texture, tiny greebles, text, UI, logo, effects or detached parts. Solid coherent object suitable for future3D reconstruction.
```

## td-cannon-tower-upgraded — 강화 포격 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-cannon-tower.png
- Source artifact: `exec-538b1f7f-3aec-45b9-8889-73942629b81e.png`
- Visual QA: 넓고 짧은 이중 포구와 금색 띠 확인.

```text
Use case: stylized-concept. Image1 is the base cannon tower family reference. Generate exactly ONE new standalone sprite td-cannon-tower-upgraded. Preserve the same squat CORAL mortar tower, low ivory octagonal plinth with chunky navy edges and identical elevated 45-degree downward orthographic camera. Upgrade silhouette: TWO very short wide mortar cups side-by-side pointing toward screen lower-right, each broad navy muzzle cavity; the body is wider, one broad gold band around its lower coral body. Do not use long slender barrels. Same matte toy-like2.5D, 25% normal detail, broad chunky forms and 2-3 simple shadingplanes. Solid coherent object for future3D reconstruction. Center whole object about75% squarecanvas and transparent margins. Actual transparent alpha background, no floor/castshadow, textures, fine details, text, logo, UI, effects or detachedparts.
```

## td-frost-tower-upgraded — 강화 냉기 타워

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-frost-tower.png
- Source artifact: `exec-74589809-bf1d-4dfc-9381-87fb94c5134f.png`
- Visual QA: 큰 수정 세 갈래와 금색 고리로 강화 구분. 세로 점유율이 약87%로 목표75%보다 큼.

```text
Use case: stylized-concept. Reference image1 is the base frost-tower family. Create exactly ONE standalone upgraded frost tower sprite td-frost-tower-upgraded. Preserve the ivory octagonal plinth, navy socket and broad opaque matte iceblue crystal language, identical 45-degree downward orthographic camera. Upgrade silhouette: THREE LARGE connected blue crystal prongs fanning from one solid navy socket, central prism taller and two stout side prisms nearly half its height, one broad gold ring at socket base. Clear larger crown silhouette, crystal points oriented subtly toward screen lower-right, still chunky and not spiky delicate. Friendly toy-like2.5D, 25% normaldetail, 2-3 simple flat shadingplanes, iceblue/ivory/navy/gold. Solid joined single object suitable for future3D reconstruction. Whole object centered at75% squarecanvas with transparent margins. True transparent alpha, no floor/castshadow, no glow, frost texture, particles, text, logo, UI or detachedparts.
```

## td-enemy-scout — 정찰 적

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-0f28e42a-33fa-4492-aaa4-73cbc54071c8.png`
- Visual QA: 둥근 틸색 몸, 네 다리 구조(원근상 3개 주로 보임), 아이보리 얼굴, 우하향 확인.

```text
Use case: stylized-concept. Reference image1 is STYLE ONLY, not subject: match broad chunky matte2.5D toy shapes, navy edge colors, clean silhouettes and simple 2-3 shadingplanes. Generate exactly ONE standalone new sprite td-enemy-scout. Subject a small friendly original four-legged toy scout creature, round teal-green pebble body, four short thick navy stumpfeet, a compact ivory faceplate on the front with two large simple navy doteyes. One tiny broad teal dorsal bump. No turret, barrel, pedestal, weapons or armor. Walking-ready neutralpose facing screen LOWER-RIGHT. Clearly light and round silhouette. Only25% normaldetail, no texture/fur/scales/greebles, matte teal/green/ivory/navy. Elevated orthographic view45degrees down; whole centered creature at75% squareframe with transparent margin, one connected body for future3D reconstruction. Actual transparent alpha background, no floor/castshadow, scenery, effects, text, logos, UI or props. Originaldesign.
```

## td-enemy-swift — 신속 적

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-81334816-0870-4f57-b782-748b221b7c7b.png`
- Visual QA: 길고 낮은 금색 몸, 뒤로 젖힌 두 귀, 네 다리, 우하향 확인.

```text
Use case: stylized-concept. Image1 is STYLE ONLY, match the friendly broad chunky matte2.5D toy game art, darknavy edges, simple2-3 shadingplanes and45degree downward orthographiccamera. Generate exactlyONE standalone sprite td-enemy-swift. A friendly original swift runner creature/toyrobot: elongated low GOLD-MUSTARD capsulebody with streamlined wedge front, four thick short navy legs splayed in a stable walking-ready pose, small ivory frontfaceplate with two navy doteyes. Two broad short sweptback golden ears integrated atrear give a fast silhouette. Body long and low, markedly different from a round scout. Facing screen LOWER-RIGHT. Only25% normaldetail; large geometry, no intricate joints, weapons, turret, base, textures, fur or tiny details. Gold/ivory/navy with tiny tealaccent. Center complete object at75% squarecanvas with ample transparentmargin. True transparent alpha background; no ground/castshadow, speedlines, effects, scenery, text, logo, UI or detachedparts. Single connected solid creature for future3D reconstruction.
```

## td-enemy-armored — 장갑 적

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-381af87e-d1a8-4eaf-b8de-5bf082706e80.png`
- Visual QA: 넓은 코럴 장갑 등판과 굵은 네 다리, 우하향 확인. 좌우 투명 여백이 좁아 목표75% 점유와 차이.

```text
Use case: stylized-concept. Image1 STYLE ONLY: broad chunky matte toy-like2.5D gameart, navy edges, 2-3 simple shadingplanes, camera down45degree orthographic. Generate exactlyONE standalone sprite td-enemy-armored: an original friendly heavily armored fourlegged toyrobot creature with a very WIDE LOW CORAL shell shaped like a rounded rectangular block, one broad central ridge and TWO LARGE connected shellplates only, four very thick short navy blockfeet, a compact ivory frontfaceplate with two simple navy eyes. Broad protective shoulder cheeks, no sharp weapons. Facing screen LOWER-RIGHT, stable neutralpose. Heavy squat silhouette markedly different from roundscout and slender swift. Coral/ivory/navy palette, only25% normaldetail, clean readable geometry. Whole centered object at75% squarecanvas with margins. Single coherent body for future3D reconstruction. True transparent alpha background; no floor/castshadow, texture, scratches, fine rivets, turret/barrel, pedestal, effects, scenery, text, logo, UI or detachedparts.
```

## td-enemy-boss — 보스 적

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-049cf551-b4d4-486c-88c6-f7e8f70ce389.png`
- Visual QA: 남색 큰 몸·금색 왕관·굵은 다리·우하향 확인. 일반 적과 실루엣 차이.

```text
Use case: stylized-concept. Image1 STYLE ONLY: unified friendly chunky matte2.5D gameart, navy edges, 2-3 broad shadingplanes,45degree downward orthographiccamera. Generate exactlyONE standalone sprite td-enemy-boss: an original LARGE imposing but friendly fourlegged toyrobot creature. Tall broad DARKNAVY roundedblock body, four sturdy chunky navy legs, IVORY forwardfaceplate with two large simple teal doteyes, one simple GOLD crownlike TRIPLE BLUNT RIDGE directly joined to topbody and a broad gold shoulderband, small coral chestpanel. Taller silhouette than armoredenemy and obvious goldcrown identifies boss. Head faces screen LOWER-RIGHT, stable neutralpose. No weapons. Only25% normaldetail, broad simple solid connected shapes for future3D reconstruction. CRITICAL generous margins: whole creature only70-75% of squarecanvas, no part near edges. True transparent alpha, no floor/castshadow, detachedcrown, textures, scratches, greebles, finejointdetail, scenery, effects, text, logo or UI.
```

## td-base-gate — 기지 성문

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-361a49c6-bae0-4e28-b136-07e0b7111ae4.png`
- Visual QA: 작은 아이보리 성문·틸 띠·닫힌 문 확인. 정면 방향은 요청 우하향보다 좌하향에 가까움. 상단 옅은 프린지 가능.

```text
Use case: stylized-concept. Image1 STYLE ONLY: broad chunky matte toy-like2.5D gameart, ivory/darknavy/tealpalette, 2-3 simple shadingplanes,45degree downward orthographiccamera. Generate exactlyONE standalone sprite td-base-gate: a small friendly defense fort gateway, TWO short thick ivory squarepillars joined by one thick ivory lintel forming a broad roundedrectangular arch opening, one simple teal inset broadband on eachpillar, darknavy thickfootings, three large blunt ivory battlements integrated onlintel. A small solid navy closed gatepanel inset behind arch, one broad teal vertical centerstripe. Compact coherent solid gatewaystructure suitable for future3D reconstruction. Front opening faces screen LOWER-RIGHT. Only25% normaldetail, no masonry texture/bricks/windows/flags/tinydecorations. Whole centered gate75% squarecanvas with generous transparentmargin; true transparentalpha. No environmental floor, no castshadow, landscape, detachedobjects, text, logo, UI or effects. Clean toy-fort silhouette.
```

## td-build-pad — 건설 받침

- Tool: `image_gen.imagegen`
- Date: 2026-10-16 (Asia/Seoul)
- Returned seed: not provided
- `transparent_background`: `true`
- Reference: td-rapid-tower.png
- Source artifact: `exec-eac7e2c9-073a-4c88-afd1-18c70eb89c3c.png`
- Visual QA: 비어 있는 틸색 상판·아이보리 팔각 받침 확인. 외곽 일부 옅은 프린지 가능.

```text
Use case: stylized-concept. Image1 is STYLE and BASE-FAMILY reference only. Generate exactlyONE standalone sprite td-build-pad, an EMPTY low octagonal stone construction plinth for the same defense-game towers. A single squat broad IVORY octagonal slab with one slightly inset flat teal octagonal top surface, broad darknavy bottombeveled rim. Extremely simple: only three stacked broad geometric surfaces, NO tower, turret, crystal, icons, symbols, text, markings or props. Top entirely empty and flat. Same friendly matte2.5D toyart,25% normaldetail,2-3 flat shadingplanes, no texture. Elevated orthographic view down45degrees, octagon oriented like reference and near corner toward screen LOWER-RIGHT. Whole lowplinth centered occupying75% canvaswidth, ample transparentmargin. Solid coherent object suitable for future3D reconstruction. True transparentalpha background, no environmental floor, no castshadow, no scenery, tiny greebles, detachedparts, effects, UI or logo.
```
