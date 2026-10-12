# 토리 Tripo 단일 모델 입력·설정

작성일: 2026-10-12 KST. 사용자 요청: 크레딧을 먼저 확인하고 꼭 필요한 에셋부터 만들어 Git에 보존.

## 입력 준비

기존 단순 v2 토리 설정 시트를 참조해 내장 image_gen.imagegen으로 정면 T포즈 한 장을 만들었다. 이는 Tripo의 이미지 생성 단계를 쓰지 않았으므로 Tripo 이미지 생성 크레딧은 0이다. 사용자가 요구한 약25% 디테일: 큰 머리 덩어리, 손가락 없는 둥근 손, 두 색 신발, 주름 없는 민트 상의/파란 쇼츠를 유지했다. 외부 캐릭터·작가·게임 에셋은 참조하지 않았다.

### 이미지 생성 프롬프트

```text
Use case: stylized-concept. Asset: ONE front-view T-pose reference for generating a riggable 3D game character in Tripo.
Image1 is the current SIMPLE TORI identity reference sheet. Extract ONE character only and keep its simplified style, 3-head proportions and colors. The user wants ONLY25% detail of elaborate art.
Friendly boy game mascot. Big rounded head. Hair ONE solid dark-purple #3A2A3F silhouette with ONLY3 large tufts, NO strand lines. Simple blue oval eyes with one tiny white dot and curved mild smile, nose omitted. Mint #25C2A0 headband with2 simple short flat tails behind. Mint sleeveless running top with tiny blank white race bib. Plain royal-blue #3D5AFE shorts. Hands smooth MITTEN shapes with NO individual finger/knuckle lines. White rounded shoes with ONE orange #FF7A45 sole strip, NO laces/panels/seams. Bold dark navy outline, flat color blocks, no detailed anatomy or fabric folds.
STRICT ORTHOGRAPHIC FRONT VIEW, no tilt or perspective. Straight neutral T-POSE: both arms extend HORIZONTALLY straight out at SHOULDER HEIGHT, symmetric straight elbows, palms/mitten hands facing down. Arms fully separated from torso, all hands visible. Feet point forward, both legs straight and slightly apart with a clear gap between them. Full body centered, head and feet and both extended hands wholly inside frame with generous10% margin. Body proportions same as reference, about3 heads tall. No giant fingers, no extra limbs.
One character only on plain clean WHITE background. Square high-resolution image. No turnaround views, no portrait grid, no color swatches, no text, numbers, logos, border, ground plane, castshadow or watermark. Highest quality SIMPLE clean shape design, not elaborate anime. Do not add decoration, clothing details or new accessories.
```

## Tripo 설정

- 입력: `tori-tpose-reference.png` 한 장.
- 생성 당시 계정 권한: Pro를 UI에서 확인.
- 모델: Studio 표시 H3.1. 내부 API wire version은 웹 UI에서 노출되지 않았으므로 추정하지 않는다.
- 울트라 메시 꺼짐, AI 자동 보완 꺼짐, 2K 텍스처, 조명 제거 켜짐, PBR 꺼짐.
- 삼각형, 폴리곤 예산10000, 부분별 생성·8K 부가 옵션 꺼짐, 비공개.
- 생성 버튼 표시 비용25. 완료 후 사용 이력에서 `2026-10-12 11:13:35 단일 이미지를 모델로 -25 이행됨`을 확인했다.
- 텍스트 프롬프트를 3D 작업에 추가하지 않았다. 업로드 이미지와 UI 설정으로 생성한다.
- 재생성, 다중 후보, 다른 캐릭터, 배경·소품 작업을 예약하지 않았다.

## 완료 결과와 다음 단계

- 작업 ID: `15d4e91d-7b0c-4471-af5a-8fcf70d73920`. 모델 생성 성공, 삼각형9398 / 버텍스6092.
- 기본 파일: `tori-base.glb`, 889092바이트. SHA-256: `cd39844b82b8d5058217c9434bad07f87e84feec3357027478fd924e4ea8e4db`.
- 자동 리깅: 인간형 / Studio 스켈레톤 표시 `Mixamo`. UI20크레딧으로 1회 실행하고 성공했다. 사용 이력: `2026-10-12 11:24:06 리깅 -20 이행됨`.
- 달리기: Studio의 `달리기` 프리셋. 텍스트 동작 생성은 쓰지 않았다. UI 재생을 확인했으며, 표시 길이는 `00’01’’25`였다. 내려받은 애니메이션 파일이 없으므로 이 표시를 정확한 파일 재생 시간·FPS로 변환하지 않는다.
- GLB 내보내기: 2K / 현재 프레임 끔 / 스켈레톤 켬 / 달리기1개 / In-place 켬. Chrome `ERR_BLOCKED_BY_CLIENT`로 파일 미확보.
- 대체 FBX 내보내기: Blender 프리셋 / 2K / 스켈레톤 켬 / 달리기1개 / In-place 켬. 같은 다운로드 차단으로 파일 미확보.
- 완료 후 잔액3060. 사용 이력에서 생성25 + 리깅20만 차감된 것을 확인했다. 재생성은 하지 않았다.
- 이미지와 Tripo 웹 UI는 seed를 노출하지 않아 기록할 수 없다. 내부 모델 버전·seed·미확보 출력 해시를 만들어 쓰지 않는다.

파일 검수와 인수 범위는 `README.md`, `BASE_OFFLINE_REVIEW.md`를 따른다. 기본 GLB에 skin과 애니메이션은 없으며, UI 재생 성공을 게임 연결 완료로 처리하지 않는다.
