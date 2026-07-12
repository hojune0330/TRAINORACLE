# ORDER_007_R_a11y.md

review_id: ORDER_007_R_a11y
persona: 접근성 검토자
mode: review_only_no_fix
result: S1 없음, S2 3건, S3 2건

## 확인 범위

- 코드 정독: `app/src/screens/LogEntry.tsx`, `app/src/screens/Home.tsx`, `app/src/screens/Trends.tsx`, `app/src/screens/LogDetail.tsx`
- 확인 제한: 실제 스크린리더/키보드 E2E 테스트는 실행하지 않았고 코드 기준으로 판단.

## 발견사항

```yaml
finding:
  id: R-a11y-001
  severity: S2
  evidence: "app/src/screens/LogEntry.tsx:522, app/src/screens/LogEntry.tsx:538, app/src/screens/LogEntry.tsx:548, app/src/screens/LogEntry.tsx:553"
  description: "통증 BodyDiagram의 SVG 부위는 `<g onClick>`로만 조작된다. role, tabIndex, keyboard handler, aria-label이 없어 키보드/스크린리더 사용자는 통증 부위를 선택하기 어렵다."
  suggested_direction: "SVG 핫스팟을 접근 가능한 button/listbox 모델로 감싸고, 부위명·현재 단계·변경 방법을 aria로 제공한다."
  verified_how: "코드 정독"
```

```yaml
finding:
  id: R-a11y-002
  severity: S2
  evidence: "app/src/screens/Home.tsx:321, app/src/screens/Home.tsx:323, app/src/screens/Home.tsx:328"
  description: "홈의 최근 일지 항목은 클릭 가능한 `<div>`다. 키보드 포커스, role, Enter/Space 조작이 없다."
  suggested_direction: "실제 `<button>` 또는 `<a>`로 바꾸고, 날짜/종류/요약을 accessible name으로 제공한다."
  verified_how: "코드 정독"
```

```yaml
finding:
  id: R-a11y-003
  severity: S2
  evidence: "app/src/screens/Trends.tsx:116, app/src/screens/Trends.tsx:118, app/src/screens/Trends.tsx:139, app/src/screens/Trends.tsx:141, app/src/screens/Trends.tsx:175"
  description: "감정/통증/거리 차트는 대부분 색과 title 속성에 의존한다. title은 스크린리더·터치 환경에서 충분한 데이터 테이블 대체가 아니다."
  suggested_direction: "차트 아래에 숨김/접힘 가능한 텍스트 표를 제공하고, 각 막대/셀에 aria-label을 부여한다."
  verified_how: "코드 정독"
```

```yaml
finding:
  id: R-a11y-004
  severity: S3
  evidence: "app/src/screens/LogDetail.tsx:185, app/src/screens/LogDetail.tsx:191, app/src/screens/LogDetail.tsx:230, app/src/screens/LogDetail.tsx:232, app/src/screens/Trends.tsx:200, app/src/screens/Trends.tsx:202"
  description: "뒤로/삭제 같은 일부 버튼은 padding이 4px 수준이다. 모바일 터치 타깃으로는 작고, 손 떨림이나 운동 직후 사용 환경에서 오조작 가능성이 있다."
  suggested_direction: "시각 크기는 작게 유지하더라도 hit area는 최소 44px 안팎으로 확장한다."
  verified_how: "코드 정독"
```

```yaml
finding:
  id: R-a11y-005
  severity: S3
  evidence: "app/src/screens/Trends.tsx:153, app/src/screens/Home.tsx:224, app/src/screens/Home.tsx:233"
  description: "색 기반 그래프와 작은 mono 텍스트가 많은 화면은 확대/고대비 테스트가 필요하다. 코드만으로 contrast pass를 확정할 수 없다."
  suggested_direction: "다음 UI QA에서 200% zoom, prefers-contrast, 키보드 tab order, 모바일 터치 영역을 캡처 증거로 남긴다."
  verified_how: "코드 기준 판단, 실제 시각 QA는 UNVERIFIED"
```

