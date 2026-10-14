> 실제 제출본: [sources/manifest.json](sources/manifest.json). Studio의 1,000자 제한에 맞춰 아래 계획 문장을 압축했다. 모델 H3.1, 작업 2건, 총 50크레딧, seed는 UI에 제공되지 않아 null.

# 신규2종 생성 지시문 — 미실행

기본 경로: 기존 유료 Tripo Studio. 한 종 생성→내보내기→64px 검수 후 다음 종. 출력 소스는 이 폴더 아래 자산별 `sources/`에 보존한다. 비용은 [README](README.md)의 실행 전 확인 절차를 따른다. 프롬프트는 다른 게임의 스크린샷 없이 텍스트만 입력한다.

## 공통 스타일 — 각 본문 앞에 붙이기

Single isolated original miniature toy prop for a friendly running defense game. Extremely simple chunky rounded geometry, roughly one quarter of ordinary game asset detail. Three to five large shape masses, at most three flat matte colors. Strong silhouette readable at 64 pixels. No environment, no floor plane, no lettering, no logo, no realistic surface texture, no thin pieces. A stable broad contact base. Simple materials, no baked dramatic shadow. Do not add accessories beyond the description.

## A-08 · dust-runner-base · 먼저 만들기

One small original dust creature: a single squat rounded bean body in warm coral, two tiny navy dot eyes on its front, and two large rounded feet integrated into the base. No arms, no fingers, no hair, no teeth, no fur, no clothing. Clearly distinguish its front and back using the eye placement. The body is wider than tall and the feet are thick and readable. No locomotion pose, neutral standing shape. It will be animated as one rigid object. Avoid resemblance to any existing game or cartoon character.

파생: 일반형은 원형 그대로. 돌진형은 로컬 작업본을 높이고 앞에 큰 삼각 돌기1개, 단단형은 넓히고 두꺼운 띠1개를 더한다. 원본 재생성·개별 리깅을 요청하지 않는다. 눈 방향과 부피 대비를 검수한 다음 변형한다.

## A-09 · wind-device · 두 번째

One original compact toy wind machine for a park running game: a broad mint rounded housing on a short navy block base, with one large cream circular opening on the front. The opening is empty and clean; no fan blades, no grille, no mesh, no buttons, no screws, no cables. The front circular opening must be clearly readable. The silhouette is squat and stable, with a rounded rear cap. Three colors only: mint, cream, navy. A simple three-blade rotor will be added locally, so do not generate internal mechanics or blades.

파생: 로컬에서 굵은3날개 평면/메시를 입구에 추가하고 회전축을 분리한다. 레벨2는 받침의 큰 노란 띠1개와 바람 링을 추가한다. 모델 전체 회전이나 부품 분할 API 구매는 필요 없다.

## 생성하지 않는 대상

토리/나무/바위/허들/게이트/전망대/신발은 기존 원본을 사용한다. 공 발사기는 둥근 통·공·받침의 기본 도형, 깃발은 막대·삼각판, 보급품은 큰 육각 토큰으로 자체 제작한다. 도시 배경·적3종·레벨2시설을 각각 새 Tripo 작업으로 분리하지 않는다.

## 작업 기록 양식

각 자산 폴더의 PROMPTS.md에 다음을 채운다: 생성 일시, Studio 실제 모델 표시명, 공통+개별 최종 입력, negative 필드가 지원될 때만 실제 입력값, taskId, seed 또는null, 예상/실제 크레딧, 내보내기 실제 포맷, 파일 해시, 실패/재시도 이유, 검수 판정. 아직 생성하지 않은 결과를 채워 넣지 않는다.
