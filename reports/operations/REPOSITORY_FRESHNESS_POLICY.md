# TrainOracle 저장소 최신 상태 점검

```yaml
document_id: REPOSITORY_FRESHNESS_POLICY
status: ACTIVE_OPERATIONS_GUARD
owner: aaclub
service: TrainOracle
```

## 목적

서로 다른 컴퓨터와 에이전트가 작업할 때 다음 두 가지 누락을 매일 자동으로 찾는다.

1. `main`보다 새 커밋이 있지만 PR이 없거나, PR 종료 뒤 다시 푸시된 브랜치
2. 공개 GitHub Pages가 최신 `main`이 아닌 버전을 제공하는 상태

## 자동 실행

`.github/workflows/repository-freshness.yml`이 매일 09:15(KST)에 실행된다.
필요할 때 GitHub Actions에서 수동 실행할 수도 있다.

실패하면 Actions 실행 요약에서 다음을 확인한다.

- 현재 `main` 전체 SHA
- Pages 배포 영수증의 원본 `main` SHA
- 열린 PR 번호
- PR이 없거나 닫힌 채 미병합됐거나 PR 이후 다시 푸시된 최신 브랜치와 커밋

## 작업자 규칙

1. 작업 전에 `git fetch origin`으로 원격 상태를 갱신한다.
2. `origin/main`에서 시작한다.
3. 원격 브랜치에 커밋을 푸시했다면 같은 작업 안에서 PR도 만든다.
4. 병합 후 `TrainOracle CI`의 배포 작업이 끝날 때까지 확인한다.
5. Pages의 `trainoracle-deploy-receipt.json`에서 `sourceSha`가 `main`과 같은지 확인한다.

오래된 보관 브랜치는 최신 `main`보다 이전이므로 경고하지 않는다. 새 작업을 푸시한 뒤
PR이 없거나 닫힌 채 미병합됐거나 PR 이후 다시 푸시한 경우, 그리고 배포가 뒤처진
경우만 실패시켜 불필요한 경보를 줄인다.
