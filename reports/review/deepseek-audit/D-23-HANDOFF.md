# D-23 — 다음 작업자를 위한 인계 (HANDOFF)

- **감사자**: DeepSeek (지시서 v1.1 실행자)
- **일자**: 2026-08-07
- **스냅샷**: main HEAD = b4f5d99 (= origin/main)

```yaml
packet: D-23
executor: DeepSeek
executed_at: "2026-08-07"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

## 1. 재현 명령 모음 (복사 붙여넣기 가능)

```bash
cd /home/user/webapp

# --- §3 기준값 (HEAD 트리 기준 — 내 보고서 22건은 참여하지 않는다) ---
git ls-tree -r HEAD --name-only | grep -c '\.md$'                 # → 496 (493은 지시서 발행 직전 커밋 d9dc4a8^ 기준)
git ls-tree -r d9dc4a8^ --name-only | grep -c '\.md$'             # → 493 (발행 당시 값)
git grep -hoE '\bOI-[A-Z0-9-]{4,40}\b' HEAD -- '*.md' | sort -u | wc -l   # → 224
git grep -hoE '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' HEAD -- '*.md' | sort -u | wc -l  # → 847

# --- 검증기 55 / CI 등록 14 / 고아 41 ---
ls specs/test-packages/*.mjs specs/test-packages/*.sh | xargs -n1 basename | sort -u > /tmp/all_v.txt
grep -oE 'specs/test-packages/[A-Za-z0-9_.-]+\.(mjs|sh)' .github/workflows/ci.yml | awk -F/ '{print $NF}' | sort -u > /tmp/ci_v.txt
comm -12 /tmp/ci_v.txt /tmp/all_v.txt | wc -l   # → 14
comm -23 /tmp/all_v.txt /tmp/ci_v.txt | wc -l   # → 41

# --- D-19 OI 대장 재현 ---
git grep -hoE '\bOI-[A-Z0-9-]{4,40}\b' HEAD -- '*.md' | sort -u > /tmp/d19_oi.txt   # 224행

# --- D-21 백로그 OI 참조 (핵심 발견 = 0건) ---
grep -nE 'OI-[A-Z0-9-]+' INCOMPLETE_WORK_BACKLOG.md | wc -l       # → 0 (이게 발견이다)

# --- 쓰기 금지 폴더 clean 확인 ---
git diff --stat specs/ app impl .github   # → 전부 빈 출력
```

## 2. `/tmp` 중간 파일 목록 (⚠️ **`/tmp`는 날아간다** — 재실행 시 아래 명령으로 재생성)

| 파일 | 내용 | 재생성 명령 |
|---|---|---|
| `/tmp/d01_ids.txt` | 유니크 규칙 ID 847 (D-01) | `grep -rhoE '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . | sort -u` |
| `/tmp/d02_refcount.txt` | ID별 인용 문서 수 (D-02, 고립 693) | D-02 보고서 §2의 단일 패스 방법 |
| `/tmp/d15_enum.txt` | zod enum 수집 28 (D-15) | D-15 보고서 §1의 grep |
| `/tmp/d19_oi.txt` | 유니크 OI 224 (D-19) | 위 §1 4번째 블록 |
| `/tmp/d19_count.txt` | 224 OI / 99 파일 (D-19) | D-19 §1 |
| `/tmp/d19_lines.txt` | OI 출현 줄 674 (D-19) | D-19 §1 |
| `/tmp/d19_pairs.txt` | (OI, 상태 토큰) 쌍 (D-19) | D-19 §1 |
| `/tmp/d19_nostatus.txt` | 상태 미표기 91 (D-19) | D-19 §1 |
| `/tmp/all_v.txt` | 검증기 전체 55 | 위 §1 2번째 블록 |
| `/tmp/ci_v.txt` | CI 등록 검증기 14 | 위 §1 2번째 블록 |

## 3. 가장 먼저 볼 것 3개

1. **`D-22-SUMMARY.md`** — 발견 총괄 24행 + OD-REQ 15건 + 조사 못한 것 14건. 전체 지도.
2. **`D-08-latest-owner-decision.md`** — `validate-latest-owner-decision.mjs`가 CI에 없다 (conflicts=12, 최우선). 다음 작업자가 깊게 팔 곳.
3. **`D-18-dsb-inv-enforcement.md`** — DSB-INV 9건 강제 지점 대장. ㉢-a/b/c·B-17 진행 순서와 직결.

## 4. 새로 밟은 함정 (§5에 없던 것)

1. **`git ls-files '*.md'` = 496 ≠ 지시서 493**: 이유는 지시서 발행 커밋 `d9dc4a8`이 **감사 산출물 3건(지시서·검증보고서·README) 자체를 추적 md로 추가**했기 때문. §9-6 기준값 재현은 **HEAD가 아니라 발행 직전 커밋(d9dc4a8^ = 493)**에서 해야 한다. `git grep HEAD` 계열 명령으로 자기 파일을 제외하고 세는 것이 안전.
2. **한 줄 추측 표현 grep은 전부 정당 용례였다** (9건): "점추정"(통계), "추정하지 않습니다"(사용자 약속 인용), "자기 접두 추정"(대조표 주석), "~추정"(판정불가 주석) 등 — **말뭉치를 보고 판정할 것**, 건수만으로 불안해하지 말 것.
3. **D-21의 "OI grep 0건"이 스캔 오류처럼 보이지만 그 자체가 핵심 발견** — 빈 결과를 보고 "다시 grep"하지 말고 "매핑 부재"로 기록할 것.
4. **yaml 머리말 이원화**: D-01~D-06은 ```yaml 블록, D-07~D-21은 목록형으로 작성돼 있었다 — §12 검사에서 실패. 이번에 D-07~D-22 전부 yaml 블록으로 통일 삽입 완료 (재실행 시 삽입 위치는 H1 직후).
5. **백로그 `[완료]` 표시 신뢰 금지**는 이미 백로그 :255 교훈이지만, D-21에서 **B-01·B-02·B-04도 OI 기준이 아닌 PR/결정 기준으로만 "완료"**임을 확인 — "완료"의 의미가 항목마다 다르다.
