# 다음 작업자 인계서

## 지금 상태

- 작업 목록의 정본은 `TRAINORACLE_WORK_CATALOG.json`이다.
- 3단계 기계 작업은 `gpt-5.6-terra`의 높은 추론으로 실행한다.
- 현재 세 단계 모두 `NO_READY_TASKS`다. 승인이나 사람 검토가 필요한 일을 임의로 시작하지 않는다.
- 자동 처방과 런타임 권한은 계속 `false`다.

## 반드시 멈추고 넘길 때

다음 하나라도 생기면 상태를 완료로 바꾸지 말고, 근거와 실패 내용을 남겨 다음 작업자에게 넘긴다.

1. 근거 파일의 확인 문구가 목록과 다를 때
2. 허용된 파일 범위를 넘어 수정해야 할 때
3. 코치·과학·개인정보·법률·사람 승인이 필요할 때
4. 정해진 검사 명령이 실패할 때

## 다음으로 열릴 가능성이 큰 일

- 책임자 결정: WO012 코치 규칙 30문항과 P1 계획 10건의 개별 승인
- 사람 검토: 연구 167편과 보조 자료 18편의 선별, 전문가 6인 검토, 사용자 확인
- 위 결정이 기록된 뒤에만 2단계 정본 패치와 비실행형 Plan Generator 작업을 시작한다.

## 시작 전 확인

```bash
node specs/test-packages/reasoning-tier-harness.mjs validate
node specs/test-packages/reasoning-tier-harness.mjs next --stage S3_MECHANICAL_BATCH
```

두 번째 명령이 `NO_READY_TASKS`를 출력하면 새 일을 만들지 말고, 막힌 결정 또는 사람 검토를 요청한다.
