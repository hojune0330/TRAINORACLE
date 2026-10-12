# 토리: 단순한 Tripo 3D 원본 후보

2026-10-12. [캐릭터 아트 브리프](../../../../docs/phase2/CHARACTER_ART_BRIEF.md)의 토리를 먼저 만들었다. 사용자 후속 지시인 **약 25% 수준의 디테일**을 우선했다. 큰 머리 덩어리, 손가락 없는 둥근 손, 끈 없는 흰 신발과 주황 밑창, 단색 민트 상의와 파란 반바지를 유지한다.

## 전달 파일과 상태

- [`tori-base.glb`](tori-base.glb): 실제로 다운로드한 정적 T포즈 원본. 889,092바이트, 삼각형 9,398개, 버텍스 6,092개, 내장 텍스처 1개. 스켈레톤과 애니메이션은 **들어 있지 않다**.
- [`tori-tpose-reference.png`](tori-tpose-reference.png): 이 모델에 올린 단일 정면 T포즈 입력. 기존 단순 v2 토리 설정 시트를 참고해 내장 이미지 생성 도구로 준비했다.
- [`base-review-contact.png`](base-review-contact.png): GLB에서 만든 정면·오른쪽 옆·뒤·3/4 검수 화면.
- [`base-review-readability.png`](base-review-readability.png): 실제 캐릭터 높이 64px·75px 비교.
- [`PROMPTS.md`](PROMPTS.md), [`USAGE_AND_RIGHTS.md`](USAGE_AND_RIGHTS.md): 입력 프롬프트, 설정, 사용량과 권한 근거.
- [`base-inspection.json`](base-inspection.json), [`base-review-renders.json`](base-review-renders.json), [`BASE_OFFLINE_REVIEW.md`](BASE_OFFLINE_REVIEW.md): 파일 검사와 외형 검수의 증거·한계.
- `tools/`: 파일 메타데이터 검사와 정적 검수 화면을 재현하는 로컬 도구. 원본 GLB를 수정하지 않는다.

자동 리깅은 Studio에서 성공했고, **달리기 프리셋을 실제로 재생**했다. 다만 달리기 포함 GLB와 대체 FBX 내보내기 주소를 Chrome이 `ERR_BLOCKED_BY_CLIENT`로 차단해, 두 파일은 로컬에 확보하지 못했다. 리그·동작은 아래 Studio 작업에 남아 있으며 Git에 애니메이션 파일이 있다고 주장하지 않는다.

- [생성 모델](https://studio.tripo3d.ai/ko/workspace/generate/15d4e91d-7b0c-4471-af5a-8fcf70d73920)
- [리그](https://studio.tripo3d.ai/ko/workspace/rigging/15d4e91d-7b0c-4471-af5a-8fcf70d73920)
- [애니메이션](https://studio.tripo3d.ai/ko/workspace/animate/15d4e91d-7b0c-4471-af5a-8fcf70d73920)

Studio 모델은 비공개이며 해당 계정의 접근 권한이 필요하다. 서명된 다운로드 주소·계정 화면·결제 정보는 이 패키지에 포함하지 않는다.

## 동료 작업자가 이어갈 순서

1. 이 GLB와 검수 화면으로 단순화·옆모습을 확인한다. 옆·뒤의 피부와 신발 일부가 회색으로 보이는 문제는 Studio 화면에서도 관측됐다. 어두운 배경에서 머리와 뒤 신발의 대비도 확인한다. 무료 재시도나 유료 재생성을 이 패키지가 승인하지 않는다.
2. 계정 오너가 Studio에서 달리기 파일을 확보한다. GLB / 2K / 현재 프레임 내보내기 끔 / 스켈레톤 켬 / 달리기 1개 / In-place 켬으로 설정했었다. 확보 후 파일에 skin과 애니메이션이 실제로 들어 있는지, 무릎·어깨가 올바르게 변형되는지 확인한다.
3. 오른쪽 옆모습 달리기 8프레임으로 렌더하고 골반 x=256, 발 기준선 y=480, 프레임 512×512를 맞춘다. 이 폴더의 T포즈 PNG는 최종 게임용 동작 프레임이 아니다.
4. 원 브리프의 D-12b 검수와 E-14 게임 연결을 거친 뒤 대기·점프와 다음 캐릭터를 만든다. 현재 패키지로 두 항목을 완료 처리하지 않는다.

이 변경은 **원본 후보와 인수 자료만 추가**한다. 앱의 기존 캐릭터 폴백, 저장소의 기존 자체 제작 에셋 선언, 게임 실행 코드와 배포는 변경하지 않았다.

## 로컬 검수 재현

```sh
node tools/inspect-glb.cjs tori-base.glb
python tools/render-glb-offline.py tori-base.glb .
```

렌더 도구에는 NumPy/Pillow가 필요하다. 모델 헤더·청크·외부 파일 참조·해시 검사와 정적 64/75px 검수를 수행했다. 전체 glTF 표준 적합성, 리그 변형, 달리기 프레임 접합, 앱 성능 또는 프로덕션 동작 검증은 포함하지 않는다.
