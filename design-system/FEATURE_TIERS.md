# FEATURE TIERS — 무료/Pro 분리 준비 가이드

> **현재 결정**: 모든 기능 무료. **추후 결정**: 일부를 Pro로 분리.
> 이 문서는 "나중에 어렵지 않게" 분리할 수 있도록 미리 구조화하는 가이드.
>
> 디자인 시각 변경 X. 코드 구조와 메타데이터만 준비.

---

## 1. 기본 원칙

### 영구 무료 (Pro로 절대 안 옮김)
**"내 정체성 · 내 데이터 · 제품 정체성"**

- PB / SB / Target / Reference 입력·표시
- Personal Archive (시간순)
- 9 Rules 검증
- 9.5일 사이클 시각화
- 매일 Daily 브리프
- 기본 페이스 환산표 (7 zone)
- 본인 데이터 시각화 (3년 heatmap 등)
- 부상 입력 + 기본 통증 추적
- 매일 체크인

→ **이 기능들은 lock하면 사용자 떠난다.** 절대 Pro X.

### 추후 Pro 후보
**"AI/cohort/시뮬레이션 등 비용 발생 영역"**

- Cohort 동일그룹 매칭 (privacy + 컴퓨팅)
- 페이스 분배 시뮬레이션 (compute)
- 라이벌 추적 자동 알림 (notification + tracking)
- AI Chat 무제한 (LLM 비용)
- Monthly / Season 깊은 리포트 (compute)
- 5년 이상 PB Trail (storage + compute)
- 종목별 페이스 환산 customization
- 부상 deep pattern 분석
- 대회 페이스 시뮬레이션 (lap별 분배)

### B2B 영역 (별도)
- Coach view (8명 동시 관리)
- 팀 대시보드
- 코치 노트 공유

---

## 2. Feature Flag 매트릭스

### 코드 구조 (구현 시)

```typescript
// constants/features.ts
export type FeatureFlag = {
  enabled: boolean;
  requiresPro: boolean;
  proLockType: 'overlay' | 'preview' | 'redirect' | null;
  description: string;
};

export const FEATURES: Record<string, FeatureFlag> = {
  // === 영구 무료 ===
  pbInput: {
    enabled: true,
    requiresPro: false,  // 영구 false
    proLockType: null,
    description: 'PB / SB 입력 표시'
  },
  personalArchive: {
    enabled: true,
    requiresPro: false,  // 영구 false
    proLockType: null,
    description: '시간순 본인 기록'
  },
  ninefiveCycle: {
    enabled: true,
    requiresPro: false,  // 영구 false
    proLockType: null,
    description: '9.5일 사이클 시각화'
  },

  // === 추후 Pro 가능 ===
  cohortMatching: {
    enabled: true,
    requiresPro: false,  // 추후 true 가능
    proLockType: 'overlay',
    description: 'cohort 동일그룹 비교'
  },
  paceSimulation: {
    enabled: true,
    requiresPro: false,
    proLockType: 'preview',
    description: '페이스 분배 시뮬레이션'
  },
  rivalTracking: {
    enabled: true,
    requiresPro: false,
    proLockType: 'redirect',
    description: '라이벌 자동 추적 알림'
  },
  unlimitedAIChat: {
    enabled: true,
    requiresPro: false,
    proLockType: 'overlay',
    description: 'AI Chat 무제한 (free=10/day)'
  },
  fiveYearTrail: {
    enabled: true,
    requiresPro: false,
    proLockType: 'preview',
    description: '5년 이상 PB Trail'
  },
  monthlyReport: {
    enabled: true,
    requiresPro: false,
    proLockType: 'overlay',
    description: 'Monthly deep report'
  },
  seasonReport: {
    enabled: true,
    requiresPro: false,
    proLockType: 'overlay',
    description: 'Season recap (long-read)'
  },
  injuryPattern: {
    enabled: true,
    requiresPro: false,
    proLockType: 'overlay',
    description: '부상 deep pattern 분석'
  },
  raceSimulation: {
    enabled: true,
    requiresPro: false,
    proLockType: 'preview',
    description: '대회 lap별 페이스 분배'
  },
};

// 사용처
function isFeatureAvailable(feature: string, user: User): boolean {
  const flag = FEATURES[feature];
  if (!flag.enabled) return false;
  if (!flag.requiresPro) return true;
  return user.isPro;
}
```

### 사용량 추적 (분리 결정의 데이터 기반)

```sql
CREATE TABLE feature_usage (
  user_id UUID NOT NULL,
  feature_name TEXT NOT NULL,
  used_at TIMESTAMP DEFAULT NOW(),
  context JSONB  -- 추가 메타 (예: 어느 화면에서)
);

-- 분기마다 분석
SELECT feature_name, COUNT(*) as usage,
       COUNT(DISTINCT user_id) as users
FROM feature_usage
WHERE used_at > NOW() - INTERVAL '30 days'
GROUP BY feature_name
ORDER BY usage DESC;
```

→ "어느 기능이 자주 쓰이고, 어느 게 드물게 쓰이는지" 데이터로 결정.

---

## 3. 디자인 패턴 — Pro Lock UI

### 3.1 Overlay 패턴 (가장 일반)

기능 자체는 보이되 살짝 가려짐 + CTA:

```
┌─────────────────────────────┐
│ Cohort 동일그룹 비교        │
│ ─────────────────           │
│ ╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳   │  ← blur 또는 dim
│ ╳ Pro에서 보기  →   ╳     │  ← CTA
│ ╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳╳   │
│                              │
│ 〔dev: cohortMatching〕    │
└─────────────────────────────┘
```

**CSS 패턴:**
```css
.pro-locked {
  position: relative;
  overflow: hidden;
}
.pro-locked .content {
  filter: blur(3px);
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
}
.pro-locked .lock-cta {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 250, 247, 0.9);
}
```

### 3.2 Preview 패턴 (체험)

처음 N초/N개만 보여주고 나머지 lock:

```
┌─────────────────────────────┐
│ 페이스 분배 시뮬레이션      │
│ ─────────────────           │
│ Lap 1: 67.5"  ✓             │  ← 보임
│ Lap 2: 67.0"  ✓             │  ← 보임
│ Lap 3: ━━━ 〔Pro〕         │  ← lock
│ Lap 4: ━━━ 〔Pro〕         │  ← lock
│                              │
│ 4 lap 전체 보려면 Pro →     │
└─────────────────────────────┘
```

### 3.3 Redirect 패턴 (별도 화면)

기능이 큰 영역이면 화면 자체를 lock:

```
┌─────────────────────────────┐
│ 라이벌 자동 추적            │
│                              │
│ 〔Pro 전용 기능〕           │
│                              │
│ 등록한 선수의 SB/PB 갱신    │
│ 자동 알림                    │
│                              │
│  [ Pro 자세히 →  ]          │
│                              │
│  나중에 ↩                   │
└─────────────────────────────┘
```

---

## 4. 디자인 파일 메타데이터

각 디자인 HTML 파일에 주석으로 표시:

```html
<!--
  COMPONENT: cohort-comparison
  FEATURE_FLAG: cohortMatching
  PRO_LOCK_TYPE: overlay
  CURRENT_STATE: free (all users)
  FUTURE_STATE: pro (estimated 2027 Q1)
-->
<div class="cohort-section">
  ...
</div>
```

→ 디자인 파일을 보는 개발자/디자이너가 즉시 분리 가능 여부 인식.

---

## 5. 분리 결정 기준

### 분기 review 시 확인

**Pro로 옮길 후보 기능:**
1. **사용 빈도**: 월 1회 미만 사용 → Pro 후보 (드물게 사용 → 가치 인식)
2. **컴퓨팅 비용**: LLM 호출, heavy compute → Pro 후보
3. **개인 정체성과 무관**: 본인 핵심 데이터 X → Pro 후보
4. **고급 사용자 위주**: 코치/엘리트가 주로 사용 → Pro 후보

### 분리 안 할 후보

1. **매일 사용**: Daily 사용 빈도 ↑ → Pro X
2. **첫 인상 결정**: Onboarding/Hero에서 사용 → Pro X
3. **데이터 입력의 일부**: Records, Check-in → Pro X
4. **법적/윤리적 영역**: 부상 추적 기본 → Pro X

---

## 6. 사용자 마이그레이션 시나리오

### 무료 → Pro 분리 결정 시

**Step 1: 90일 사전 공지**
- 영향받는 사용자에게 이메일/앱 내 알림
- "X 기능이 2027.04.01부터 Pro 전용입니다"
- 사용 통계 안내 ("당신은 지난 90일 N번 사용")

**Step 2: 50일 전 — 90% 가격 할인**
- "기존 사용자에게 9개월 50% 할인"
- 신규 사용자엔 정가

**Step 3: 30일 전 — UI에 lock preview 표시**
- 기능 사용 시 "30일 후 Pro 전용" 배너
- 데이터는 그대로, 하지만 미리 인지

**Step 4: 0일 — lock 활성**
- Pro 미가입자엔 overlay/preview/redirect 표시
- 기존 입력한 데이터는 보존
- "다시 사용하려면 Pro" CTA

### Grandfathering 옵션

- 가입일 기준 1년 이내 사용자: 1년 무료 유지
- 활발한 사용자(월 20일 이상): 6개월 무료 유지
- 코치 추천 사용자: 별도 처리

---

## 7. 가격 모델 (추후 결정)

### 옵션 A · 단일 Pro
- Free: 기본 기능
- Pro: ₩9,900/월 또는 ₩99,000/년 — 모든 잠금 해제

### 옵션 B · Tiered
- Free
- Plus: ₩4,900/월 — 일부 기능
- Pro: ₩9,900/월 — 전체

### 옵션 C · B2B Coach
- Coach 라이선스: 코치 ₩29,900/월 + 선수 8명 무료
- 팀 대시보드 + 8명 관리

### 옵션 D · Pay-per-feature
- 기본 무료
- AI Chat 무제한: ₩4,900/월
- Cohort 비교: ₩2,900/월
- 분리 구매

→ **현재 미정. 사용 데이터 6개월 누적 후 결정.**

---

## 8. 디자이너 / 개발자 체크리스트

### 새 기능 만들 때

- [ ] 영구 무료 / Pro 후보 분류
- [ ] `FEATURES` 객체에 flag 추가
- [ ] `requiresPro: false` 시작 (현재)
- [ ] `proLockType` 정의 (overlay / preview / redirect)
- [ ] 디자인 파일 메타데이터 주석
- [ ] 사용량 추적 코드 삽입
- [ ] FEATURE_TIERS.md 매트릭스 업데이트

### 분기 review 시

- [ ] feature_usage 데이터 분석
- [ ] 분리 후보 기능 식별
- [ ] 영향받는 사용자 수 계산
- [ ] 마이그레이션 시나리오 작성
- [ ] FEATURE_TIERS.md 업데이트

---

## 9. 한 줄 결론

> **"분리는 디자인 결정이 아니라 비즈니스 결정이다.**
> **디자인은 그 결정을 빨리 반영할 수 있도록 준비만 한다."**

지금: 모든 기능 무료, lock 패턴 코드/디자인 준비.
추후: flag 한 줄 변경 → lock UI 자동 표시.
