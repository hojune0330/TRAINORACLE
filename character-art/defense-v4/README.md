# 러닝 디펜스 에셋 v4

2026-10-15. Tripo Studio 유료 계정, H3.1 지오메트리+텍스처, 비공개 생성, 기본 25크레딧/종. 8종 생성으로 잔액 2,425 → 2,225. 새로운 결제·API 충전은 하지 않았다.

## 확보 상태

| ID | 생성 완료 | 새 원본 확보 | 런타임 연결 |
|---|---|---|---|
| cannon | 예 | 예 | 새 원본 렌더 |
| fan | 예 | 예 | 새 원본 렌더 |
| flag | 예 | 예 | 새 원본 렌더 |
| normal | 예 | 예 | 새 원본 렌더 |
| rush | 예 | 아직 아님 | 기존 Tripo v1 `dust-fast` 렌더 재사용 |
| armor | 예 | 아직 아님 | 기존 Tripo v1 `dust-armored` 렌더 재사용 |
| base | 예 | 예 | 새 원본 렌더 |
| finish-gate | 예 | 예 | 새 원본 렌더 |

Studio 내보내기 알림은 시간 초과했지만 앞의 6개는 실제 다운로드 파일을 확인했다. 이후 Chrome 제어 연결 해제/탭 소실이 반복되어 나머지 2개는 확보 완료로 표시하지 않는다. 미래 89종은 예산만 배정했고 생성 요청하지 않았다.

`sources/`는 다운로드한 원본 그대로다. `working/`는 Blender 4.5.14에서 2,600개 정도의 삼각형과 최대 512px 텍스처로 줄인 작업용 복사본이다. `renders/`는 투명 512px PNG, 앱에는 `app/public/game/defense-v4/`의 256px WebP만 들어간다. 기준선은 240/256이다. 충돌 판정은 이미지와 독립적이다.

8개 런타임 이미지 합계 70,646바이트. 64px/176px 검수는 `review/contact.png`. 얼굴·팔·머리카락·신발 디테일을 추가하지 않은 단순한 형태를 유지했다. 로드 실패 시 도형/텍스트로 플레이가 계속된다.

## 재현

1. Blender로 `tools/bake.py` 실행. 필요한 ID만 `-- cannon fan ...`으로 제한 가능.
2. Pillow가 있는 Python으로 `tools/pack.py` 실행.
3. `bake-report.json`의 원본 해시, 렌더 경계와 `app/public/game/defense-v4/manifest.json`의 실제 런타임 원본 경로를 확인한다.

프롬프트·작업 ID·차감은 `ledger.json`. 날짜는 2026-10-15 KST, 시드는 Studio가 표시하지 않아 기록할 수 없다. 실패한 다운로드를 새 생성으로 재시도하지 않는다.

## 출처와 권리

외부 게임 캐릭터·스크린샷·유명 작가 스타일을 입력하지 않은 자체 텍스트 프롬프트다. 유료 출력의 사용/수정/배포 근거는 [Tripo 약관](https://www.tripo3d.ai/terms), [상업 이용 안내](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) 및 기존 `../tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md`에 남긴 확인을 따른다. API와 Studio 결제는 독립적이다.

이 아트에 MIT·CC0 등의 추가 라이선스를 부여하지 않는다. 저장소의 소스 코드 라이선스를 아트의 재사용 허가로 해석하지 않는다. 계정 정보, 결제 정보, 서명된 다운로드 주소는 저장하지 않는다.
