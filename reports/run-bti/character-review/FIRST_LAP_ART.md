# 첫 바퀴의 신입과 동물 그림

기준 원화는 커밋 `9616e2275442ce34df3b29bd097643250b6a65fd`의 [기존 동물 32명](README.md)이다. 원본 파일은 [app/public/run-bti/art](../../../app/public/run-bti/art)에 있고 작은 그림은 [assets/lap](../../../app/public/run-bti/assets/lap)에 있다.

동물마다 이름표보다 먼저 눈에 들어오는 특징 두 가지를 남겼다. 펭귄은 볼에서 목으로 이어지는 금빛 깃과 흰 배, 돌고래는 둥근 이마와 앞으로 뻗은 주둥이다. 얼굴과 몸을 작게 다시 그린 다음 소품이 없어도 종을 알아볼 수 있는 옆모습을 따로 그렸다. 전신은 192px, 소품을 뺀 얼굴과 단색 윤곽은 각각 96px다. 신입은 종을 짐작할 귀와 꼬리 없이 둥글게 그리고 가슴의 이름표를 비웠다. 신발 끈을 묶을 때와 가방을 건넬 때의 팔과 시선도 따로 그렸다. 신입 일곱 자세와 가방은 240px, 코스 풍경 여덟 장은 2:1 가로 그림이다.

## 48px에서 함께 보기

| | 황제펭귄 | 타월 거북이 | 송골매 | 물살 타는 돌고래 | 선글라스 상어 |
| --- | --- | --- | --- | --- | --- |
| 얼굴 | <img src="../../../app/public/run-bti/assets/lap/face-distance-numbers.webp" width="48" alt="펭귄 얼굴"> | <img src="../../../app/public/run-bti/assets/lap/face-distance-senses.webp" width="48" alt="거북이 얼굴"> | <img src="../../../app/public/run-bti/assets/lap/face-speed-numbers.webp" width="48" alt="송골매 얼굴"> | <img src="../../../app/public/run-bti/assets/lap/face-speed-senses.webp" width="48" alt="돌고래 얼굴"> | <img src="../../../app/public/run-bti/assets/lap/face-speed-explore.webp" width="48" alt="안경을 벗은 상어 얼굴"> |
| 윤곽 | <img src="../../../app/public/run-bti/assets/lap/silhouette-distance-numbers.webp" width="48" alt="펭귄 윤곽"> | <img src="../../../app/public/run-bti/assets/lap/silhouette-distance-senses.webp" width="48" alt="거북이 윤곽"> | <img src="../../../app/public/run-bti/assets/lap/silhouette-speed-numbers.webp" width="48" alt="송골매 윤곽"> | <img src="../../../app/public/run-bti/assets/lap/silhouette-speed-senses.webp" width="48" alt="몸을 둥글게 튼 돌고래"> | <img src="../../../app/public/run-bti/assets/lap/silhouette-speed-explore.webp" width="48" alt="삼각 등지느러미가 선 상어"> |

상어는 전신에만 선글라스를 그렸다. 해파리의 고리, 카멜레온의 스틱, 바다코끼리의 여행 가방, 고슴도치의 달력이 윤곽으로 남지 않도록 네 마리는 별도 시트로 교체했다. 진한 녹색 바탕에도 얹어 투명 영역에 남던 희끗한 사각 테두리를 걷어 냈다.

## 같은 그림 다시 내보내기

원화 네 장을 한 줄로 놓고 이미지 생성기에 참고 그림으로 주었다. 같은 순서로 전신·얼굴·윤곽을 그리도록 요청해 한 시트에 네 마리씩 담았다. 큰 머리와 짧은 팔다리, 테두리의 굵기 변화, 그림자 한 단계는 여덟 시트가 함께 쓴다. 동물 순서, 신입의 자세, 갈림길을 포함한 풍경 순서는 [내보내기 코드](export_lap_art.py)에 있다.

제작 기기의 원본 PNG는 `~/.codex/generated_images/01a2122e-b8f8-7c53-810f-3466338b7f15/`에 보관했다. 원본 시트 파일 이름은 `exec-{ID}.png`다. 작업 환경이 달라지면 시트 11장을 함께 옮긴다. 저장소에 있는 WebP만으로도 앱과 오프라인 체험판을 빌드할 수 있다. 같은 모양과 여백이 필요하면 기존 시트를 내보내고 디자인을 바꿀 때만 새 그림을 만든다.

저장소 루트에서 Pillow, NumPy가 있는 Python으로 실행한다. 먼저 빈 폴더로 내보내 실제 표시 크기에서 이전 판과 비교한다.

```text
python reports/run-bti/character-review/export_lap_art.py <원본-시트-폴더> <내보낼-폴더>
```

| 시트 | 원본 ID | SHA-256 |
| --- | --- | --- |
| 기본 앞 네 마리 | cdeb2c36-02e5-4ee6-96f7-e969f33931cd | 9667dd5757456dcf2601748a8062ee77add62d65afbd0517c12f31a95eef0435 |
| 기본 뒤 네 마리 | ebfd2d2f-7118-44a7-8ed2-b09c0bbbf9de | 66ef81751be3190f7aa05fafc37c8622d312efff3e6e3149485a80ad80b82ccd |
| 귤색 | 23d507cf-4d9b-486e-a186-90b38fbef886 | cf72056eef05c55a6272aa14e0cb9b3c72f63c87abeb813386bad12f8b627e80 |
| 청록색 | cf1abbff-d350-4d50-8a22-1c3d9e267fbd | b6334f3315b6dc10c5ed5dfe5d147f6b249dc9f48e475e82370e1fdb1f3552b9 |
| 파란색 | 3a26dcc3-9dbd-4eda-bdf4-778053e4d5c1 | 4f578274c5de65b3bfdbe5a5bbd9ad15240ff0667b50324fc68465f2c4aee06f |
| 보라색 | 36108555-1ac8-4704-a078-3cf3da609ade | c1dc9b89361ec732a12f9851c2ad3e8d783db7d9907194d38deff44402a69978 |
| 산호색 | e389eace-db1c-4ad8-ba03-627c0fbc157b | 2e82e579afdd1bbfbb608816ebd93402ac6aa66a35fe396ca5ae41a26684ffd4 |
| 올리브색 | 908f920d-a446-4bde-b63f-f141c7c4772f | 548d9cfeaa44dfab1191ed9b67e28c2e77ad543f244669b535c0d2eb5274d173 |
| 윤곽 보완 네 마리 | 54b08228-84c2-4581-8040-c67a628221b2 | 440efd719a0724682a9c241dd1c7654234bebe7429f0d0061be68486d9332fa0 |
| 신입 일곱 자세와 가방 | 3a08b2ba-7792-4375-9e4a-5f01a6999eee | 7e08c583e20c42b65634affe6a3c30d47569d5dbab3909062d07eb2e268c2225 |
| 풍경 여덟 장 | 3fbb99ac-4246-4658-86f1-d0a9edd3ac38 | ba0bd2742b11893fdc5791de9d8d26f0e6733c5b7908a86b45d50a326267cd68 |
