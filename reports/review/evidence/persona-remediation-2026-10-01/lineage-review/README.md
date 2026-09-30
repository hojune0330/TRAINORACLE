# W2 연결 독립 검수 증거

status: LOCAL_SYNTHETIC_REVIEW_WITH_UNRESOLVED_FINDINGS
production_verification: NOT_PERFORMED

## 읽는 순서

1. [최종 독립 보고서](FINAL_REVIEW_KO.md): B01~B08의 정확한 재현과 한계.
2. [수정 전 KST](baseline-kst-v2.json) / [수정 전 UTC](baseline-utc-v2.json).
3. [B05 수정 후 KST](baseline-kst-v4.json) / [B05 수정 후 UTC](baseline-utc-v4.json).
4. [수동 교체 보관 결함 주입](mutation-drop-prior-archives-kst-v3.json) /
   [수행 재계획 보관 결함 주입](mutation-drop-prior-replan-archives-kst-v4.json).

고유 경계 8개에서 4통과/4실패가 5통과/3실패로 바뀌었다. B03/B06/B07은 미해결이다.
v1은 B06/B08의 정상 대조군부터 미승인 변환으로 막힌 시험기 한계를 포함한다. 확정
결함의 근거로 사용하지 않는다. 시간대 반복·결함 주입을 새로운 페르소나로 세지 않는다.

## 원본과 재현기

이 폴더는 `.scratch/followup-w2-lineage-20261001/`의 원본 10개를 바이트 그대로 복사해
각각 SHA-256 일치를 확인한 보관본이다. Git 줄바꿈 정규화는 저장소 설정을 따른다.
보고서의 절대 경로·줄번호·소스 지문은 각 실행 시점의 정보다. 부모가 실행 사이 제품을
수리했으므로 모든 JSON을 하나의 동일한 깨끗한 커밋 검증으로 합치지 않는다.

원본 `FINAL_REVIEW_KO.md` 끝의 빈 줄도 보존했다. 이 때문에 이 파일을 포함한 Git
공백 검사는 `new blank line at EOF` 경고 1건을 반환한다. 원본 보존 예외이며 검사 전체
통과로 표시하지 않는다. 제품 코드·스펙·새 안내 문서의 공백 검사와 구분한다.

`run-lineage-review.mjs`도 원본 보관본이다. **이 깊이의 폴더에서 바로 실행하지 않는다.**
재현기는 자신의 위치에서 두 단계 위를 저장소 루트로 해석한다. 저장소 루트 아래
`.scratch/followup-w2-lineage-20261001/`에 동일 파일을 복사한 뒤, 보고서의 명령을
사용한다. 필요한 기존 설치 의존성은 app의 esbuild/jsdom이며 새 설치나 계정 연결은 없다.
출력 파일명은 매번 새 이름을 사용한다. 기존 증거 덮어쓰기는 재현기가 거절한다.

## 증명하지 않는 것

실제 사람 100명, 실제 모바일 제스처, 운영 계정, 서버 저장, DB 동시성, 새 처방 수치
승인 또는 배포를 증명하지 않는다. 이 재현기는 메모리 DOM/Storage/locks를 사용하며
v3/v4에서 외부 통신 시도 0을 확인했다. 실제 PostgreSQL 검사는 별도
[F02 기록](../../../../../supabase/tests/concurrency/RESULTS_2026-10-01.md)에 있다.

[DRAFT_COMPLETE]
