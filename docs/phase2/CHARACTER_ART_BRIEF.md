# 캐릭터 아트 브리프: 이미지 생성 → 렌더링용

작성일: 2026-10-09. 작성: 디자인·UX·문구 담당.

오너 지시: "게임 캐릭터 너무 마음에 안 든다. 게임 캐릭터는 이미지 생성-렌더링해서 다시 줄게. 이미지 생성할 에셋 종류와 참고자료 등을 지시할 수 있는 프롬프트 줘."

이 문서는 오너(또는 생성 작업자)가 그대로 복사해 쓸 수 있는 **프롬프트, 에셋 목록, 납품 규격**이다. 받은 이미지는 이 담당이 검수하고, 개발 담당이 게임에 붙인다(WORK_SPLIT E-14).

> 이전 방침("생성보다 재구성")은 이 지시로 바뀌었다. 코드로 그린 리그(`anime-runner.ts`)는 생성 에셋이 들어올 때까지 대체용으로 남긴다.

---

## 1. 무엇을 만들어야 하나 (에셋 목록)

캐릭터는 6명이고, 각자 아래 묶음이 하나씩 필요하다. 모두 **오른쪽을 보고 달리는 옆모습**이다.

| # | 에셋 | 프레임 | 용도 | 우선 |
|---|---|---|---|---|
| A | 캐릭터 설정 시트(정면·3/4·옆·뒤 + 표정 4개) | 1장 | 일관성 기준. 이후 모든 생성의 참조 이미지 | ★ 먼저 |
| B | 달리기(run) 루프 | **8** | 게임 기본 동작 | ★ |
| C | 대기(idle) | 2 (숨쉬기) | 시작·일시정지 | ★ |
| D | 점프(jump) | 3 (도약·정점·낙하) | 장애물 넘기 | ★ |
| E | 대시(dash) | 4 (더 숙이고 보폭 크게) | 대시 | ● |
| F | 부딪힘(hit) | 2 (뒤로 젖힘·놀람) | 허들 충돌 | ● |
| G | 떨어짐·실패(fall) | 2 | 실패 결과 | ● |
| H | 지침(tired) | 2 | 에너지 0 | ○ |
| I | 완주 환호(cheer) | 3 (주먹 쥐고 들어 올리기) | 완주 결과 | ● |
| J | 초상(bust, 가슴 위) | 1, 웃는 얼굴 | 캐릭터 선택·소개(G5)·지도 | ★ |
| K | 얼굴 아이콘(head) | 1 | 작은 버튼·저장 상태 | ○ |

★ 1차 필수 · ● 있으면 좋음 · ○ 나중. 한 캐릭터를 끝까지 만들어 게임에서 확인한 뒤 나머지 다섯 명을 만든다.

## 2. 캐릭터 6명 설정

코드 id와 이름, 해금 조건은 그대로 둔다. 색은 게임 토큰 값이다(§6A). 이 값을 쓰면 배경·UI와 어울린다.

| id | 이름 | 콘셉트 | 머리·얼굴 | 옷 | 신발 | 포인트 소품 |
|---|---|---|---|---|---|---|
| `tori` | 토리 | 밝고 성실한 기본 남자 러너, 14~16세 느낌 | 검은 뾰족 머리 `#3A2A3F`, 파란 눈 | 민트 싱글렛 `#25C2A0`(어두운 면 `#17927A`) + 파란 반바지 `#3D5AFE` | 흰색, 주황 밑창 `#FF7A45` | 민트 머리띠, 끈 두 가닥이 뒤로 날림. 가슴 레이스 번호표 |
| `hana` | 하나 | 당찬 단거리 여자 러너 | 갈색 하이 포니테일 `#7A3E2E`, 분홍 눈 | 분홍 싱글렛 `#FF6FA8`(`#D84E86`) + 검은 러닝 쇼츠 | 흰색, 분홍 밑창 | 분홍 머리끈, 번호표 |
| `dandan` | 단단 | 듬직하고 느긋한 곰 귀 소년(곰 귀 인간) | 갈색 짧은 머리 + 둥근 곰 귀 `#B07A4F`, 귀 안 `#E8C49A` | 노란 싱글렛 `#FFC83D`(`#E49B0F`) + 파란 반바지 | 빨간색 `#FF4D5E` | 작은 둥근 꼬리, 번호표 |
| `nabi` | 나비 | 날쌘 고양이 귀 소녀 | 주황 뾰족 머리 + 고양이 귀 `#F2A14A`, 초록 눈 `#4CD964` | 파란 싱글렛 + 검은 쇼츠 | 빨간색 | 끝이 흰 줄무늬 꼬리 |
| `r01` | R-01 | 트랙 테스트용 안드로이드, 사람 비율 | 은발 `#C9D3E6`, 민트 발광 눈 `#41F2C6`, 귀 대신 헤드셋 | 은회색 보디 슈트 `#9AA8BC` + 진회색 하의 `#2E3440` | 민트 발광 밑창 | 가슴 원형 코어 라이트(민트) |
| `pengu` | 펭구 | 펭귄 후드를 쓴 꼬마 러너 | 남색 펭귄 후드 `#2B3350`(부리 `#FFA62B`, 흰 얼굴부), 검은 앞머리 | 남색 상의 + 흰 배 무늬 `#F4F7FF` | 주황색 `#FFA62B` | 빨간 털 머리띠 |

공통 외곽선은 `#1D1B2C`이고, 하이라이트는 흰색 한 단계만 쓴다.

## 3. 참고 자료

| 무엇 | 자료 | 라이선스 | 어떻게 쓰나 |
|---|---|---|---|
| 달리기 동작 | Eadweard Muybridge, *Animal Locomotion* Plate 65 "Running full speed"(1887), 윗줄 옆모습 8장 — https://commons.wikimedia.org/wiki/File:Animal_locomotion._Plate_65_(Boston_Public_Library).jpg | 퍼블릭 도메인 | **포즈 기준으로만** 쓴다. 생성 도구의 포즈 제어(OpenPose·뼈대·스케치 가이드)에 넣는다. 나체 사진이므로 이미지 자체를 결과물에 섞거나 저장소에 넣지 않는다 |
| 보조 동작 | Plate 63 "Running full speed" — https://commons.wikimedia.org/wiki/File:Animal_locomotion._Plate_63_(Boston_Public_Library).jpg | 퍼블릭 도메인 | 대시(더 큰 보폭) 참고 |
| 비율 | Wikipedia "Super deformed": SD는 머리가 키의 1/3~1/2 | CC BY-SA(내용만 참고) | 약 3등신 |
| 지금 동작 키 | `app/src/screens/treadmill/anime-runner.ts`의 `STEP` 표(관절 각도 7키, Muybridge에서 읽은 값) | 자체 | 프레임별 다리 각도 확인 |
| 지금 게임 화면 | `docs/handoff/minigame/screenshots/tour-*.png`, `flow-*.png` | 자체 | 배경과 크기 대비 확인(캐릭터가 화면에서 약 75px) |

**참고로 쓰면 안 되는 것:**
- 특정 애니메이션 작품·캐릭터·작가 이름("○○ 스타일", "○○처럼")을 프롬프트에 넣지 않는다. 저작권·상표 위험이 있다.
- 다른 게임의 스프라이트를 이미지 참조로 넣지 않는다.

## 4. 달리기 8프레임 키 (Muybridge Plate 65 기준)

몸은 항상 오른쪽을 본다. 상체는 약 10° 앞으로 기울인다. 머리 높이는 프레임 사이에서 크게 흔들지 않는다(최대 ±4%).

| 프레임 | 단계 | 앞(오른)다리 | 뒤(왼)다리 | 팔 | 몸 높이 |
|---|---|---|---|---|---|
| 1 | 착지(contact) | 앞으로 뻗어 뒤꿈치~발 중앙 착지, 무릎 살짝 굽힘 | 뒤로 길게, 발끝이 땅에서 떨어짐 | 왼팔 앞, 오른팔 뒤(다리와 반대) | 중간 |
| 2 | 지지(down) | 몸 바로 아래, 무릎 가장 많이 굽힘 | 무릎 접혀 뒤꿈치가 엉덩이 쪽으로 | 팔이 몸 옆을 지남 | **가장 낮음** |
| 3 | 지나감(passing) | 수직에 가깝게 밀어냄 | 무릎이 앞으로 올라옴 | 반대로 흔들기 시작 | 중간 |
| 4 | 차고 나감(push-off) | 뒤로 쭉 펴짐, 발끝으로 밀기 | 무릎 높이 들림(허벅지 수평 가까이) | 오른팔 앞, 왼팔 뒤 최대 | 올라감 |
| 5 | 공중(float) | 뒤로 뻗음 | 앞으로 뻗기 시작 | 최대 흔들림 | **가장 높음**(두 발 모두 공중) |
| 6~8 | 1~3의 좌우 반대 | — | — | — | — |

팔꿈치는 약 90°로 굽히고, 주먹은 가볍게 쥔다. 8프레임을 이어 붙였을 때 1번으로 자연스럽게 돌아와야 한다.

## 5. 프롬프트

생성 도구가 영어에 강하므로 프롬프트는 영어로 쓴다. `[ ]` 안만 바꿔 넣는다.

### 5.1 공통 스타일 블록 (모든 프롬프트 앞에 붙임)

```
2D game character art for a mobile running game. Japanese sports-anime look in super-deformed (SD) proportions,
about 3 heads tall: large head, big expressive eyes with two white highlights, small nose, simple mouth,
slim limbs, long legs for a runner. Clean cel shading with exactly one hard-edged shadow tone per color,
no gradients, no painterly texture, no airbrush. Crisp dark navy outline (#1D1B2C), uniform weight,
slightly thicker on the outer silhouette. Flat, bright, friendly colors. Modern athletic running gear.
Readable silhouette at very small size (the sprite is shown about 75 px tall on a phone).
Transparent background, no ground, no cast shadow, no text, no logo, no watermark, no border.
Single character only. Original character design, not based on any existing anime or game character.
```

### 5.2 네거티브 (지원하는 도구에서)

```
realistic, photorealistic, 3D render look, painterly, sketch lines, gradient shading, soft airbrush, lens blur,
background scenery, floor, drop shadow, text, letters, numbers on bib, logo, brand marks, watermark, signature,
multiple characters, cropped feet, cropped head, extra limbs, extra fingers, fused legs, wrong number of arms,
facing left, front view (for side-view frames), NSFW, revealing clothing, existing copyrighted characters
```

### 5.3 A. 캐릭터 설정 시트

```
[공통 스타일 블록]
Character design reference sheet of ONE character, plain white background allowed for this sheet only.
Show: full-body front view, three-quarter view, side view facing right, back view, all at the same scale
standing on one line; plus four head close-ups: happy, determined (running), surprised (hit), cheering.
Add small color swatches of the main colors. No text labels.
Character: [§2 표의 한 줄을 영어로, 예시는 아래 §5.6]
```

### 5.4 B~I. 동작 프레임 (설정 시트를 참조 이미지로 넣고)

```
[공통 스타일 블록]
Use the attached character reference sheet: same face, hair, outfit, colors and proportions.
Pure side view facing RIGHT, full body, centered, feet touching the same baseline.
Pose: [동작 문장 — 아래 표에서 고른다]
Pose guide: the attached running pose skeleton (from Muybridge's 1887 public-domain running study, side view).
Canvas 1024x1024, character height about 820 px, transparent background.
```

| 동작 | 프레임 | Pose 문장 |
|---|---|---|
| run 1 | 1/8 | `running, contact phase: right foot just landing ahead of the body, left leg extended behind with toes leaving the ground, left arm forward, right arm back, elbows bent 90 degrees, torso leaning forward 10 degrees` |
| run 2 | 2/8 | `running, midstance: right foot under the hips with the knee bent most, left knee folded so the heel rises toward the buttocks, arms passing the torso, body at its lowest point` |
| run 3 | 3/8 | `running, passing: right leg pushing straight down, left knee swinging forward, arms starting to swap` |
| run 4 | 4/8 | `running, push-off: right leg fully extended behind pushing off the toes, left thigh raised almost horizontal, right arm forward, left arm back at full swing` |
| run 5 | 5/8 | `running, flight phase: both feet off the ground, body at its highest point, right leg trailing behind, left leg reaching forward` |
| run 6~8 | 6/8~8/8 | run 2~4와 같은 문장에서 left/right만 바꾼다 |
| idle | 1~2/2 | `standing relaxed, weight on both feet, arms loose, gentle smile; frame 2: chest slightly raised (breathing in)` |
| jump | 1~3/3 | `1: crouched take-off pushing up, 2: tucked knees at the top of the jump, arms up and back, determined face, 3: legs reaching down to land` |
| dash | 1~4/4 | `sprint dash, strong 20-degree forward lean, longer stride than running, intense face, hair and headband streaming back` (run 1·2·4·5 키 사용) |
| hit | 1~2/2 | `bumped by a hurdle: upper body tilting backward, arms flung out, eyes squeezed shut; frame 2: surprised wide eyes, sweat drop` |
| fall | 1~2/2 | `losing balance and falling backward, arms up, comic dizzy face; frame 2: sitting on the ground, embarrassed smile` |
| tired | 1~2/2 | `out of breath, bent forward with hands near knees, mouth open panting, sweat drops` |
| cheer | 1~3/3 | `victory: 1 fist pump at chest, 2 both fists raised above the head, 3 big open smile with eyes closed, one fist up` |

### 5.5 J. 초상 / K. 얼굴 아이콘

```
[공통 스타일 블록]
Use the attached character reference sheet. Bust portrait from the chest up, three-quarter view turned to the right,
bright confident smile, looking at the viewer, 1024x1024, transparent background, head fills the upper 60% of the canvas.
```
얼굴 아이콘(K)은 위 문장에서 `bust portrait from the chest up`을 `head and neck only, centered`로 바꾼다.

### 5.6 캐릭터 문장 (§5.3 `Character:` 자리에 넣기)

```
tori: a cheerful teenage boy runner, spiky black hair (#3A2A3F), blue eyes, mint-teal running singlet (#25C2A0, shadow #17927A),
royal blue running shorts (#3D5AFE), white running shoes with orange soles (#FF7A45), mint headband whose two ties stream behind,
a plain white race bib on the chest with no number.

hana: a confident teenage girl sprinter, high brown ponytail (#7A3E2E) with a pink hair tie, pink eyes, pink running singlet
(#FF6FA8, shadow #D84E86), black running shorts, white shoes with pink soles, plain white race bib.

dandan: a sturdy, easygoing boy with round bear ears (#B07A4F, inner ears #E8C49A) and a small round bear tail, short brown hair,
yellow singlet (#FFC83D, shadow #E49B0F), blue shorts (#3D5AFE), red shoes (#FF4D5E), plain white race bib. Human face, not an animal head.

nabi: a quick, playful girl with orange cat ears and a striped orange cat tail with a white tip (#F2A14A), spiky orange hair,
green eyes (#4CD964), blue singlet (#3D5AFE), black shorts, red shoes (#FF4D5E). Human face with tiny whisker marks.

r01: a friendly android runner with human proportions, silver hair (#C9D3E6), glowing mint eyes (#41F2C6), a sleek headset instead of ears,
light steel-gray bodysuit (#9AA8BC) with dark gray lower half (#2E3440), a small round mint core light on the chest, shoes with glowing mint soles.

pengu: a small cheerful kid wearing a navy penguin hood (#2B3350) with an orange beak (#FFA62B) and a white face opening,
black bangs, light blue eyes, navy top with a white belly patch (#F4F7FF), navy shorts, orange shoes (#FFA62B), red knit headband.
```

## 6. 납품 규격 (렌더링 후 넘겨줄 파일)

| 항목 | 규격 |
|---|---|
| 형식 | PNG-24 + 알파(투명 배경). 원본 크기 그대로 |
| 칸 크기 | **프레임 하나 = 512×512px 정사각 칸**(생성은 1024로 해도 되고, 납품 때 512로 줄인다) |
| 위치 | 캐릭터 키 약 **420px**. **발바닥 기준선 y = 480px**. 엉덩이(골반 중심)를 x = 256px에 맞춘다. 모든 프레임이 같은 기준을 지켜야 달릴 때 흔들리지 않는다 |
| 방향 | 오른쪽을 본다(옆모습). 초상은 3/4 오른쪽 |
| 파일 이름 | `{id}_{동작}_{번호2자리}.png` 예: `tori_run_01.png` … `tori_run_08.png`, `tori_idle_01.png`, `tori_bust.png`, `tori_head.png`, `tori_sheet.png` |
| 폴더 | `character-art/{id}/` 아래. 압축해서 전달해도 된다 |
| 기록 | `character-art/{id}/PROMPTS.md`에 도구 이름·버전·날짜·프롬프트·시드·참조 이미지를 적는다(출처·재현용) |
| 금지 | 배경, 바닥 그림자, 글자, 번호표 숫자, 로고, 워터마크 |

**작게 보았을 때도 읽혀야 한다.** 게임에서 캐릭터는 약 75px(레티나 150px)로 보인다. 512 칸을 75px로 줄여도 얼굴 방향, 팔다리 앞뒤, 머리 실루엣이 구분되어야 한다. 납품 전에 64px로 줄여 보고 확인한다.

## 7. 라이선스·출처 확인 (생성 작업자)

- 사용하는 생성 도구의 이용약관이 **상업적 사용과 공개 저장소 배포**를 허용하는지 확인하고, 도구 이름·플랜을 PROMPTS.md에 적는다.
- 특정 작품·캐릭터·작가를 흉내 내지 않았는지 확인한다. 결과물이 기존 캐릭터와 닮았으면 다시 생성한다.
- Muybridge 사진은 포즈 기준으로만 쓰고, 결과물에 사진이 들어가지 않게 한다.
- 받은 파일은 게임 메뉴 › 오픈소스 탭과 `ASSETS.md`에 출처(도구·작업자·날짜)를 적는다. 이 담당이 처리한다.

## 8. 받은 뒤 처리 (이 담당 → 개발 담당)

1. **검수(이 담당):** 기준선·위치 맞춤, 64px 가독성, 프레임 이음새, 색이 토큰과 맞는지, 금지 요소가 없는지 확인한다. 필요하면 다시 생성을 요청한다.
2. **스프라이트 시트 묶기(이 담당):** `app/public/characters/{id}/{id}-{동작}.webp` 가로 띠와 `atlas.json`(프레임 수·칸 크기·기준선)을 만든다.
3. **게임 연결(개발 담당, E-14):**
   - `drawRunner`가 시트가 있으면 이미지 프레임을, 없으면 지금 리그를 그리게 한다.
   - 달리기 프레임은 지금 위상(phase)을 8단계로 나눠 고른다(`frame = floor(phase / 2π × 8) mod 8`).
   - 강화 표시(스프링·밴드·접지 밑창)는 이미지 위에 겹쳐 그린다.
   - 지연 로딩하고, 캐시 정책은 컬렉션 자산과 같게 한다.
