# ORDER_007_R_parent.md

review_id: ORDER_007_R_parent
persona: 학부모, 자녀의 민감 데이터를 걱정하는 보호자
mode: review_only_no_fix
result: S1 없음, S2 2건, S3 2건

## 확인 범위

- 코드 정독: `app/src/screens/Home.tsx`, `app/src/screens/LogEntry.tsx`, `app/src/domain/journal-store.ts`
- 스펙 대조: `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`, `FEDERATED_ACCOUNT_SSO_CONTRACT.md`
- 결정 문서 대조: `ACCOUNT_FEDERATION_DECISION.md`, `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md`

## 발견사항

```yaml
finding:
  id: R-parent-001
  severity: S2
  evidence: "app/src/screens/LogEntry.tsx:285, app/src/screens/LogEntry.tsx:292, app/src/screens/LogEntry.tsx:298, specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:280, specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:294, specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:303"
  description: "앱은 체중·안정시 심박·통증을 받지만, 14세 미만/보호자 동의 경로는 아직 미해결 open issue다. 로컬 저장 단계에서는 즉시 법적 문제로 보이지 않지만, 계정 연동 전에는 보호자 관점에서 차단·설명 기준이 더 필요하다."
  suggested_direction: "미성년자 계정 연동 전에는 보호자 동의 미해결 상태를 명시하고, 서버 승격은 guardian flow가 수용될 때까지 막는다."
  verified_how: "입력 화면 코드 정독 + SSO minor handling 스펙 대조"
```

```yaml
finding:
  id: R-parent-002
  severity: S2
  evidence: "app/src/domain/journal-store.ts:21, app/src/domain/journal-store.ts:40, app/src/domain/journal-store.ts:43, app/src/domain/journal-store.ts:113, app/src/screens/Home.tsx:238, app/src/screens/Home.tsx:246"
  description: "내보내기 JSON은 memo/note를 포함한 전체 로컬 일지를 그대로 파일로 저장한다. 서버 전송은 아니지만, 보호자나 학생이 파일을 공유하면 원문 메모와 민감 기록이 그대로 이동한다."
  suggested_direction: "내보내기 전에 '원문 메모 포함' 고지, redacted export 옵션, 보호자/선수용 쉬운 설명을 제공한다."
  verified_how: "저장 스키마와 export 함수 정독"
```

```yaml
finding:
  id: R-parent-003
  severity: S3
  evidence: "app/src/screens/LogEntry.tsx:604, app/src/screens/LogEntry.tsx:617, specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:134, specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:158"
  description: "현재 UI는 자유 입력 아래 '기기에만 보관 · 서버 저장 안 함'이라고 말한다. 동기화 계약은 raw memo 서버 정책이 아직 미결이라고 하므로, 미래 계정 연동 시 문구가 쉽게 드리프트될 수 있다."
  suggested_direction: "현재 단계 문구에는 '현재는'을 명시하고, 계정 연동 화면에서 raw memo는 로컬 유지/암호화/정책 변경 중 어떤 선택인지 다시 확인한다."
  verified_how: "UI 문구와 sync 계약 대조"
```

```yaml
finding:
  id: R-parent-004
  severity: S3
  evidence: "app/src/screens/Home.tsx:172, app/src/screens/Home.tsx:181, app/src/screens/LogDetail.tsx:159, app/src/screens/LogDetail.tsx:168"
  description: "통증 4 이상 기록을 홈과 상세 화면에 계속 보여주는 점은 보호자 관점에서 좋다. 다만 이 알림이 실제 코치 확인 워크플로로 이어지는지는 아직 보이지 않는다."
  suggested_direction: "다음 단계에서 '코치/보호자에게 보여줄 요약' 또는 '상담 필요 표시'로 연결한다."
  verified_how: "화면 코드 정독"
```

