# ORDER_007_R_privacy.md

review_id: ORDER_007_R_privacy
persona: 보안·프라이버시 감사자
mode: review_only_no_fix
result: S1 없음, S2 3건, S3 1건

## 확인 범위

- 코드 정독: `app/src/domain/journal-store.ts`, `app/src/screens/Home.tsx`, `app/src/screens/LogDetail.tsx`
- 스펙 대조: `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`, `FEDERATED_ACCOUNT_SSO_CONTRACT.md`
- 결정 문서 대조: `ACCOUNT_FEDERATION_DECISION.md`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`

## 발견사항

```yaml
finding:
  id: R-privacy-001
  severity: S2
  evidence: "app/src/domain/journal-store.ts:21, app/src/domain/journal-store.ts:40, app/src/domain/journal-store.ts:49, app/src/domain/journal-store.ts:113, app/src/screens/Home.tsx:238, specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:158"
  description: "로컬 저장 자체는 현재 정책에 맞지만, export는 raw memo/note를 그대로 포함한다. 파일 다운로드는 서버 전송이 아니어도 민감 텍스트 이동 경로가 된다."
  suggested_direction: "export 시 raw 포함/제외 선택, redaction state, 보호자/선수용 공유 경고를 추가한다."
  verified_how: "저장 타입과 export 함수 정독 + sync memo policy 대조"
```

```yaml
finding:
  id: R-privacy-002
  severity: S2
  evidence: "app/src/domain/journal-store.ts:70, app/src/domain/journal-store.ts:77, app/src/screens/LogDetail.tsx:97, app/src/screens/LogDetail.tsx:150"
  description: "`loadEntries`는 JSON 배열이면 곧바로 `JournalEntry[]`로 캐스팅한다. localStorage 변조나 이전 버전 데이터가 들어오면 schema 검증 없이 상세 화면에 사용자 문자열이 렌더된다. React escape로 즉시 XSS로 보이지는 않지만, 데이터 무결성과 민감 필드 경계가 약하다."
  suggested_direction: "Zod 또는 수동 파서로 kind별 필드 shape를 검증하고, unknown field는 보존/무시 정책을 분리한다."
  verified_how: "저장소 파서와 상세 렌더링 경로 정독"
```

```yaml
finding:
  id: R-privacy-003
  severity: S2
  evidence: "ACCOUNT_FEDERATION_DECISION.md:62, ACCOUNT_FEDERATION_DECISION.md:67, LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md:107, LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md:109, specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:303"
  description: "계정 결정문은 AthleteTime OAuth 흐름을 구현 기준으로 적고, launch 계획은 AthleteTime OAuth가 현재 기술적으로 불가능하다고 적는다. SSO 계약은 이를 open issue로 남겼지만, 외부 검토자는 현재 가능/미가능 상태를 혼동할 수 있다."
  suggested_direction: "문서 상단 상태를 '제품 결정은 SSO, 구현 가능성은 AthleteTime 인증 서버 작업 전까지 미확정'으로 한 문장 정렬한다."
  verified_how: "결정 문서와 SSO open issue 대조"
```

```yaml
finding:
  id: R-privacy-004
  severity: S3
  evidence: "app/src/domain/journal-store.ts:151, app/src/domain/journal-store.ts:179, app/src/domain/journal-store.ts:191, app/src/domain/journal-store.ts:199"
  description: "`?uitest=seed`는 사용자의 실제 브라우저 localStorage에 시드 일지를 남긴다. 개발 증거용으로 유용하지만, 라이브에서 URL만으로 가짜 건강/체중/통증 데이터가 생길 수 있다."
  suggested_direction: "프로덕션 빌드에서는 seed 파라미터를 막거나, 별도 preview/dev 환경에서만 허용한다."
  verified_how: "테스트 시드 코드 정독"
```

