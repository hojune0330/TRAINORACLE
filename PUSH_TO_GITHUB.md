# 🚀 GitHub에 업로드하는 방법

> 이 폴더(`handoff/`)를 GitHub 저장소로 올리려면 아래 명령어들을 실행하세요.

---

## 옵션 A: 새 저장소 생성

### 1. GitHub에서 새 저장소 만들기
1. github.com에서 우측 상단 `+` → `New repository`
2. Repository name: `trainoracle-design-handoff` (또는 원하는 이름)
3. Description: `TRAINORACLE design handoff package — for AI dev agent`
4. **Private** 선택 (디자인 산출물은 공개하지 않는 게 좋음)
5. README, .gitignore, license **체크 해제** (이미 있음)
6. `Create repository` 클릭

### 2. 로컬에서 push
저장소 폴더로 이동 후 터미널에서:

```bash
# 폴더로 이동 (다운로드한 handoff 폴더)
cd handoff

# Git 초기화
git init
git branch -M main

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit — TRAINORACLE design handoff v1"

# GitHub 저장소 연결 (URL은 본인 것으로 교체)
git remote add origin https://github.com/YOUR_USERNAME/trainoracle-design-handoff.git

# Push
git push -u origin main
```

---

## 옵션 B: 기존 저장소에 폴더로 추가

이미 모노레포가 있다면:

```bash
# 메인 저장소로 이동
cd your-existing-repo

# handoff 폴더 복사 (다운로드 폴더에서)
cp -r ~/Downloads/handoff ./design-handoff

# 추가 + 커밋 + push
git add design-handoff
git commit -m "Add TRAINORACLE design handoff package"
git push
```

---

## 옵션 C: GitHub CLI (`gh`) 사용

`gh` CLI 설치되어 있다면 한 번에:

```bash
cd handoff
gh repo create trainoracle-design-handoff --private --source=. --push
```

---

## 다른 AI 개발 에이전트에 전달

GitHub URL을 다음 형식으로 다른 AI에게 전달하세요:

```
TRAINORACLE 제품의 디자인 핸드오프 패키지를 GitHub에 올렸습니다.
저장소: https://github.com/YOUR_USERNAME/trainoracle-design-handoff

먼저 README.md를 읽고, HANDOFF.md의 지시를 따라 개발을 시작하세요.

주요 제약:
- Tufte × Linear 시각 톤 유지 (둥근 모서리·카드 X)
- 모든 AI 응답에 verdict + confidence 표시
- 9.5-Cycle 뷰 필수 (제품 정체성)
- 소셜·게이미피케이션 기능 추가 금지

기술 스택은 HANDOFF.md 권장안 따르되, 다른 의견이 있으면
먼저 사용자에게 확인 후 변경하세요.
```

---

## 권한 설정 (선택)

다른 사람과 협업하려면:

1. GitHub 저장소 → `Settings` → `Collaborators`
2. `Add people` → 사용자명 입력
3. 권한 선택 (Read / Write / Admin)

AI 에이전트 (Claude, GPT 등)는 사람이 아니므로,
**대화창에 GitHub URL + 위 메시지만 복사·붙여넣기** 하면 됩니다.

---

## 폴더 구조 확인

올리기 전 폴더 구조가 다음과 같은지 확인:

```
handoff/
├── README.md                       ★ 시작점
├── HANDOFF.md                      ★ 첫 프롬프트
├── PHILOSOPHY.md                   ★ 가치관 (필독)
├── DESIGN_DECISIONS.md
├── CONVERSATION_LOG.md
├── BRIEF_ORIGINAL.md
├── PUSH_TO_GITHUB.md               (이 파일)
├── .gitignore
│
├── design-system/
│   ├── DESIGN_TOKENS.md
│   ├── COMPONENT_INVENTORY.md
│   └── SCREENS.md
│
└── designs/
    ├── README.md
    ├── 00_Moodboard.html
    ├── 01_Landing.html
    ├── 02_Onboarding.html
    ├── 03_Dashboard.html           [v1 - 재작업 필요]
    ├── 04_Calendar.html            [v1 - 재작업 필요]
    ├── 05_SessionDetail.html       [v2 - 정본]
    ├── 06_AIChat.html
    ├── 07_AIInbox.html
    ├── 08_Analysis.html
    ├── 09_DailyCheckin.html
    ├── 10_Competitions.html
    ├── 11_Philosophy.html
    ├── 12_Settings.html
    └── _archive/
        └── SessionDetail_v1_deprecated.html
```

총 9개 마크다운 + 14개 HTML = **23 files**.

---

## 트러블슈팅

### "permission denied" 오류
→ SSH key 또는 personal access token 설정 필요.
GitHub Settings → Developer settings → Personal access tokens → Generate

### "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/REPO.git
```

### 파일이 너무 큼
→ HTML 파일은 모두 100KB 이하라 문제없음. 만약 추후 PDF나 영상이 추가되면 Git LFS 고려.

---

**준비 완료. 이제 push 하고 다른 AI 에이전트한테 넘기면 됩니다.**
