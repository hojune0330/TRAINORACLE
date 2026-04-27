# Designs — Standalone HTML files

각 파일은 **독립형(self-contained)**입니다. 인터넷 연결만 있으면 (폰트 로드용) 어디서든 브라우저로 열어 미리보기 가능합니다.

## 파일 목록

| # | 파일 | 화면 | 스타일 | Mobile | Desktop |
|---|---|---|---|---|---|
| 00 | `00_Moodboard.html` | Moodboard | reference | ✅ scrollable | — |
| 01 | `01_Landing.html` | Landing page (public) | v2 Tufte | ✅ responsive | ✅ |
| 02 | `02_Onboarding.html` | 3-step + Welcome | v2 Tufte | ✅ 4 frames | — |
| 03 | `03_Dashboard.html` | Dashboard home | ⚠️ v1 Opus (재작업) | ✅ tabs | ✅ |
| 04 | `04_Calendar.html` | 3-view calendar | ⚠️ v1 Opus (재작업) | ✅ | ✅ |
| 05 | `05_SessionDetail.html` | Session 상세 | ✅ v2 정본 | ✅ tabs | ✅ |
| 06 | `06_AIChat.html` | 장호준 AI 대화 | v2 Tufte | ✅ tabs | ✅ |
| 07 | `07_AIInbox.html` | AI Inbox | v2 Tufte | ✅ tabs | ✅ |
| 08 | `08_Analysis.html` | Analytics | v2 Tufte | ✅ tabs | ✅ |
| 09 | `09_DailyCheckin.html` | 일일 체크인 | v2 Tufte | ✅ 3 frames | — |
| 10 | `10_Competitions.html` | 대회 관리 | v2 Tufte | ✅ tabs | ✅ |
| 11 | `11_Philosophy.html` | 철학 페이지 (public) | v2 Tufte | ✅ responsive | ✅ |
| 12 | `12_Settings.html` | 설정 | v2 Tufte | ✅ tabs | ✅ |

**총 13개 화면 (00-12) + 1개 archive**

---

## 보는 방법

### 옵션 1: 직접 열기
```bash
open 00_Moodboard.html  # macOS
xdg-open 00_Moodboard.html  # Linux
start 00_Moodboard.html  # Windows
```

### 옵션 2: 로컬 서버
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

### 옵션 3: VS Code Live Server 등 IDE 확장

---

## Mobile / Desktop 전환

각 파일 상단의 탭 (Mobile / Desktop) 클릭으로 두 뷰 전환 가능. 선택은 localStorage에 저장.

일부 화면 (Onboarding, Daily Check-in, Moodboard)은 **모바일 multi-frame** 형태로 여러 단계를 한 화면에 펼쳐 보여줍니다.

---

## 디자인 기반 데이터

모든 화면의 시나리오는 동일한 **민지 (1500m)** 페르소나 기준:
- Cycle 7, Day 5 of 9.5
- Today: PM VO2 MAIN — 6×1000m @ 3'20"
- 1500m PB: 4:14.82 / 5000m PB: 16:10.44
- CK +18% (warning), RPE stable

코치 시나리오는 **장호준** 기준:
- 8명 선수 관리
- AI 인박스 3 미확인
- 다음 목표 대회: D-26

---

## 개발 시 주의

### v1 vs v2 구분
- **v2** (정본 — 이대로 구현): 05, 06, 07, 08, 09, 10, 02, 12, 11, 01
- **v1** (참고용 — 정보 구조만 가져오고 v2 시각 톤으로 재작업): 03 Dashboard, 04 Calendar
- **archive** (참고용, 폐기): `_archive/SessionDetail_v1_deprecated.html`

### Tufte × Linear 시각 톤 핵심
- `border-radius: 0` 기본
- 카드 박스 X → hairline + 여백
- 색은 정보 전달용만
- Inter + JetBrains Mono + Pretendard만
- 자세한 가이드: `../design-system/DESIGN_TOKENS.md`

---

## 라이선스

본 디자인 산출물은 TRAINORACLE 제품에만 사용됩니다. 외부 배포 금지.

폰트:
- Inter — SIL Open Font License
- JetBrains Mono — SIL Open Font License
- Pretendard — SIL Open Font License
