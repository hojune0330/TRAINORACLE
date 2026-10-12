# 조사 자료와 근거 범위

아래 자료는 기획 대화 중 열람했던 출처를 인수하기 위한 목록이다. Reddit 일부 게시물·댓글은 전체 이용자의 대표 표본이 아니며, TrainOracle 방문 반복이나 친구 플레이의 효과를 검증한 실험도 아니다. 이후 제품의 재미·재방문은 직접 플레이로 확인해야 한다. 이 PR 작업에서는 게시물의 현재 내용·표시 수치를 다시 전수 조사하지 않았다. 과거 답변에서 “최종 검증”으로 표현한 추천은 **기획 판단**으로 읽는다.

## Roblox에서 가져올 패턴

- [원작 Speed Run 4 / @Vurse](https://www.roblox.com/games/183364845/Speed-Run-4): 구간별 플랫폼 도전과 친구/시간 경쟁. 트레드밀과 에너지 규칙은 이 프로젝트의 제안이지 원작의 정확한 복제가 아니다.
- [Creator Hub 공식 템플릿](https://create.roblox.com/docs/resources/templates): Platformer의 점프·대시·움직이는 발판, Classic Obby의 체크포인트·위험 요소, Line Runner의 옆으로 진행하는 반복 도전.
- [공식 moving world 설명](https://create.roblox.com/docs/resources/the-mystery-of-duvall-drive/develop-a-moving-world): 적은 기본 조각의 재조합과 움직이는 발판 참고.

Roblox 플랫폼·서버에 게임을 배포하는 요청은 아니다. 코드·캐릭터·아트를 복사하지 않고 동작 패턴을 참고했다. 현재 구현은 Canvas 도형을 사용한다.

## Reddit에서 나온 기획 가설

| 자료 | 대화에서 참고한 반응 | 적용 또는 보류 |
|---|---|---|
| [Super Auto Pets 주간 팩](https://www.reddit.com/r/superautopets/comments/18vaz4y/) | 같은 규칙 기반에서 조합이 달라지는 재미 | 후속 공통 코스/시드 후보 |
| [Super Auto Pets 메타 피로](https://www.reddit.com/r/superautopets/comments/1dxin58/) | 조합 고착과 반복 피로 | 수치 증가만 반복하지 않기 |
| [Balatro 같은 시드 친구 비교](https://www.reddit.com/r/balatro/comments/1rb0al5/) | 같은 조건을 각자 풀어 비교하는 놀이 | 친구 고스트보다 먼저 공통 조건 설계 검토 |
| [Slay the Spire 데일리 클라임](https://www.reddit.com/r/slaythespire/comments/1i9sytx/) | 매일 달라지는 도전에 대한 엇갈린 선호 | 매일 해야 하는 의무 보상 도입 보류 |
| [TFT Double Up](https://www.reddit.com/r/TeamfightTactics/comments/yt2hdl/) | 친구 협동의 재미와 실력 차 문제 | 고정 역할·실시간 대기를 먼저 만들지 않기 |
| [Across the Obelisk 지원 역할](https://www.reddit.com/r/AcrossTheObelisk/comments/11m3pvj/) | 특정 친구가 반복해서 지원을 맡는 문제 | 역할 분리 제안은 오너 수정으로 폐기 |
| [Uma Musume 반복과 운](https://www.reddit.com/r/UmaMusume/comments/1n7wm88/) | 반복 육성에서 운에 좌우되는 피로 | 확률 강화·실패 손실은 초기 범위에서 보류 |
| [For the King 턴·주도 플레이어](https://www.reddit.com/r/ForTheKing/comments/hdsi89/) | 다른 사람의 턴 대기·결정 독점 | 친구 플레이는 독립 조작부터 검토 |
| [게임 데일리 숙제](https://www.reddit.com/r/gaming/comments/vna8b7/) | 재방문 장치가 숙제로 느껴지는 문제 | 연속 방문을 능력치 권한에 묶지 않기 |

초기 The Tower·incremental games 조사와 Top War/Gun Hero의 상세 출처는 [대화 원문](CONVERSATION.md)의 링크를 보존했다. 이 자료만으로 “방문 반복이 검증됐다” 또는 “역할 팀전이 필요하다”고 결론 내리지 않는다.

## 실제 러닝과 게임 비유

- [2024 근력훈련·러닝 이코노미 검토](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/)
- [2024 근력훈련·달리기 수행 메타분석](https://pubmed.ncbi.nlm.nih.gov/38627351/)
- [2022 보행/주법 재훈련 검토](https://pubmed.ncbi.nlm.nih.gov/35128941/)

대화에서 이 자료를 바탕으로 “보완 훈련의 조건부 도움”과 “누구에게나 지수적 성장”을 구분했다. 현재 게임에서 접지·점프·대시의 수치 교환은 **허구의 게임 밸런스**이며, 실제 신발·플라이오·자세 교정의 효과 크기나 개인 부상 위험을 표시하지 않는다. 실제 학습 콘텐츠를 붙이려면 기존 훈련 스펙과 검토된 출처를 별도로 읽고 채택해야 한다.
