# 앱 소개 · 공유 이미지

- 제작일: 2026-10-26
- 도구: OpenAI image_gen / imagegen 스킬. 모델 이름과 seed는 도구에서 제공하지 않음.
- 용도: 더보기 → 앱 소개, 공개 링크 공유 카드. 실제 운동·사용자 기록을 묘사한 자료가 아니라 기능을 설명하는 삽화.
- 원본: `running-journal-hero-source.png`, `running-journal-share-source.png`
- 앱용: `app/public/illustrations/app-introduction/running-journal-hero-v1.webp` (900×600, alpha, 90,266 bytes)
- 공유용: `app/public/illustrations/app-introduction/running-journal-share-v1.jpg` (1200×633, 96,305 bytes)
- 파일 최적화: Sharp 0.35.5. 비율 유지 축소 및 WebP/JPEG 인코딩만 적용. 원본은 별도 보존.
- 얼굴·캐릭터는 이 작업용으로 생성. 특정 캐릭터·작가의 화풍이나 외부 작품을 프롬프트에 지정하지 않음.

## 히어로 제작 브리프 요약

Transparent-background original minimal cute flat 2D illustration: an upright weekly training planner with seven columns and three blue planned-day dots, an open ivory running journal with simple lines and a route, an original cream cat-face sticker, yellow star sticker, teal running shoe and amber pencil. Warm ivory, teal, blue, amber and charcoal palette; very low detail. No people, letters, numbers, logos, interface or medical claims. Planner dots represent planned days, not completed results.

## 공유 이미지 최종 프롬프트

참조 이미지: 위 히어로의 PNG 원본. `transparent_background: false`.

> Create a finished polished social share cover for the Korean running app TrainOracle, based on the supplied original illustration. Wide horizontal landscape 1.91:1 composition, ideally 1536x804 or 1200x630. Soft clean ivory background throughout. On the RIGHT half, use the supplied friendly minimal 2D illustration of a weekly training planner, open running journal, teal running shoe, cream cat sticker, amber pencil and star. Keep the same original visual identities, no new characters. Large clear readable Korean typography on the LEFT, meticulously reproduce exactly these words on three lines: '훈련 계획을 받아보고,' then '러닝 일지를' then '꾸며요'. Above the headline, small dark teal label exactly '트레인오라클'. Below the headline one short line in muted charcoal exactly '달릴 계획부터 오늘의 기록까지'. Strong legibility on a phone. Headline dark almost-black charcoal, final '꾸며요' in dark teal. Generous margins, simple Korean rounded sans-serif typography, crisp high contrast text, sophisticated editorial spacing, quiet friendly tone. The headline must have ample space and must not overlap illustration. No border, no screenshot, no UI frame, no buttons, no claims about health, no English text, no watermark, no additional words. Deliver only the complete social card.

## 사용 범위

- 삽화는 장식용이므로 앱 이미지의 `alt`는 비우고, 제목과 기능은 실제 텍스트·버튼으로 제공한다.
- 공유 이미지는 삽화에 포함된 한국어 문구와 일치하는 OG/Twitter 제목·대체 설명을 함께 제공한다.
- 홈 화면 추가용 아이콘·기존 설치 ID·일지 저장소·도메인은 변경하지 않는다.
- 원본 index.html의 canonical과 og:url은 기존 GitHub Pages 주소를 유지한다. 기존 도메인 게시기가 trainoracle.io로 변환한다. 공유 이미지는 두 채널에서 동일한 공개 GitHub Pages 이미지 URL을 사용하므로 Pages 자산 게시 후 도메인을 갱신한다.
