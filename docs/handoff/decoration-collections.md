# 꾸미기 컬렉션 아키텍처 — 다음 작업자용 인수인계

```yaml
상태: 활성 (2026-09-04, PR #317)
범위: app/src/domain/decoration-*.ts, app/src/screens/journal/JournalDecoration*.tsx, app/public/collections/, app/public/legal/open-source.html
상위문서: docs/DECORATION_TOOL_DESIGN_BRIEF.md (기본 재료 아트 디렉션), docs/UX_UI_VISUAL_STANDARD.md §6
읽는_이유: 컬렉션·라이선스·획득 경로에 손대기 전에 "어디를 고치면 무엇이 따라오는지"를 알기 위해
```

## 0. 30초 요약

- 꾸미기 카탈로그는 두 층이다. **기본 재료**(TrainOracle 자체 제작, 브리프 §2.2 문구용품 톤)와 **컬렉션**(각자 아트 디렉션을 가진 묶음 — 현재 `OPEN_CUTE_V1` 귀여운 스티커 28종).
- 컬렉션은 **`app/src/domain/decoration-collections.ts` 한 파일의 데이터 한 덩어리**다. 카탈로그·툴바·상점·법적 고지·자산 장부·테스트가 모두 여기서 파생된다.
- 새 컬렉션을 붙일 때 코드를 고칠 필요가 없다. 레지스트리에 항목을 추가하고 자산을 놓고 `npm run collection-docs`를 돌리면 끝. 빠뜨리면 계약 테스트가 막는다.
- **절대 삭제하지 않는다(retire-never-delete).** 시즌 종료·라이선스 만료는 `availability: "RETIRED"`로 처리한다. 사용자가 이미 일지에 붙인 그림은 계속 렌더돼야 한다.

## 1. 파일 지도

| 파일 | 역할 | 손댈 때 주의 |
|---|---|---|
| `domain/decoration-collections.ts` | **단일 진실.** `LICENSES`, `REWARD_RULES`, `DECORATION_COLLECTIONS`, 획득/노출/번들가 헬퍼 | `as const satisfies` 유지 — 아이템 id 리터럴 타입이 `z.enum(DECORATION_IDS)`까지 흐른다 |
| `domain/decoration-catalog.ts` | 기본 재료 36행 + `allCollectionItems()`로 컬렉션을 카탈로그 행으로 변환. `minimumSpentPointsForOwned()` | 컬렉션 아이템을 여기 직접 쓰지 말 것 |
| `domain/decoration-schema.ts` | 저장 상태 v3 Zod 스키마. `spentPoints` 하한 검증이 `minimumSpentPointsForOwned`를 호출 | `availability`는 스키마와 무관 — RETIRED 아이템이 저장 상태를 깨면 안 된다 |
| `domain/decoration-store.ts` | `purchaseDecoration`, `purchaseCollectionBundle`, `claimRewardDecorations` | 모두 `saveDecorationStateIfCurrent`로 낙관적 동시성 검사 후 저장 |
| `domain/decoration-collection-docs.ts` | 레지스트리 → HTML/JSON **결정적** 렌더러 | 날짜·난수·환경 의존 금지. 출력이 바뀌면 생성기 재실행 필요 |
| `scripts/generate-collection-docs.mjs` | esbuild로 위 모듈을 번들해 `public/legal/open-source.html`, `public/collections/<dir>/assets.json` 작성. `--check`로 CI 검사 | Node 20은 TS 직접 실행 불가 → esbuild 경유 |
| `screens/journal/JournalDecorationToolbar.tsx` | 재료 서랍. `openCollectionId`로 컬렉션 화면 전환, 번들 행, 보상/시즌 라벨 | e2e가 aria-label 문자열에 의존(§5) |
| `screens/journal/JournalDecorationSurface.tsx` | 편집기 상태. 열릴 때 보상 자동 지급, RETIRED/시즌 밖 아이템 상점 필터 | `items` 필터는 "기본 제공·보유분은 항상 보임" 원칙 |
| `public/collections/<dir>/` | 컬렉션 webp + 생성된 `assets.json` | **SW 프리캐시 제외**(lazy). `sw.js` 코드에 `/collections/` 캐시 조건을 넣으면 테스트가 실패한다 |
| `public/legal/open-source.html` | 자동 생성. 컬렉션별 `id="<collectionId>"` 앵커 | 손으로 고치지 말 것. 다음 생성 때 덮어써진다 |

## 2. 개념 세 가지

### 2.1 획득 경로 `acquisition`
```
STARTER            기본 제공(기본 재료 전용, 컬렉션은 불가)
POINTS {cost}      개별 포인트 구매
BUNDLE {cost}      개별가는 cost, 컬렉션 일괄가는 collection.bundle.cost
REWARD {ruleId}    REWARD_RULES 조건 충족 시 자동 지급 — 포인트 미차감
SEASON {from,to}   기간 안에서 무료 지급 — 포인트 미차감, 기간 밖에서는 신규 지급 중단
```
- `acquisitionCost()`는 POINTS/BUNDLE만 비용을 돌려준다. 나머지는 0.
- **`spentPoints` 하한**은 `minimumSpentPointsForOwned()`가 계산한다. 컬렉션은 `min(번들가, 보유분 개별 합계)` — 번들로 산 사용자가 "개별 합계보다 적게 썼다"는 이유로 스키마에 걸리지 않는다. (2026-09-04 회귀 수정: 처음엔 개별 합계로만 계산해 번들 구매 직후 `ZodError`가 났다. `decoration-store.contract.test.ts` "collection acquisition paths"가 이를 잡는다.)

### 2.2 노출 `availability` + 시즌 + 라이선스 만료
`collectionVisibleInShop(collection, today)`가 셋을 한 번에 판단한다:
- `availability !== "ACTIVE"` → 숨김
- `season`이 있고 오늘이 밖 → 숨김
- 아이템이 참조하는 `LICENSES[].validUntil`이 오늘보다 과거 → 숨김

숨김은 **상점 노출·신규 구매만** 막는다. 보유분 렌더, 즐겨찾기, 페이지 배치는 그대로다. `purchaseDecoration`은 `NOT_PURCHASABLE{reason}`을 돌려주고 Surface가 이유별 문구를 보여 준다.

### 2.3 라이선스 `LICENSES`
`kind: OPEN | COMMERCIAL | IN_HOUSE`. 상용 계약은 `validUntil`(신규 판매 종료일)과 `contractRef`(계약 식별자)만 기록한다 — 계약 내용은 저장소에 넣지 않는다. `attributionRequired: true`면 법적 고지 페이지가 출처 표기 의무를 이행하는 자리다.

## 3. 새 컬렉션 추가 절차 (체크리스트)

1. 자산을 `app/public/collections/<kebab-id>/` 에 넣는다 (투명 WebP 권장, 256×256 또는 컬렉션 `render`에 맞춤).
2. `sha256sum` 으로 각 파일 해시를 얻는다.
3. `decoration-collections.ts`:
   - 새 출처면 `LICENSES`에 항목 추가 (전문 파일은 `public/licenses/`에).
   - `DecorationCollection` 객체를 `as const satisfies DecorationCollection`으로 정의. 아이템마다 `id`(대문자 스네이크, 전역 유일), `fileName`, `group`, `licenseId`, `sha256`, `sourceAsset`.
   - `DECORATION_COLLECTIONS`에 추가.
4. `cd app && npm run collection-docs` → `open-source.html`, `assets.json` 갱신.
5. `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run src/domain/decoration` — 레지스트리 검증(`validateCollectionRegistry`), sha256 일치, 문서 동기화가 여기서 걸린다.
6. `vite build` 후 e2e `journal-decoration.spec.ts` 실행. 진입 카드 라벨은 `${title} ${n}종 보기, ${hint}` 형식이다.
7. 브리프 §1.3 "이모지풍 금지"는 기본 재료에만 적용된다. 컬렉션은 `artDirection`에 의도를 한 줄로 남긴다.

**컬렉션 종료 절차**: 아이템/컬렉션 `availability: "RETIRED"` 또는 라이선스 `validUntil` 설정 → `npm run collection-docs` → 커밋. 자산 파일과 레지스트리 항목은 **남겨 둔다**.

## 4. 검증 명령 (2026-09-04 실측)

```bash
cd app
./node_modules/.bin/tsc --noEmit                                  # 클린
./node_modules/.bin/vitest run src/domain/decoration src/screens/journal   # 꾸미기 관련 전부
npm run collection-docs:check                                     # 문서 최신 여부 (CI 후보)
./node_modules/.bin/vite build --emptyOutDir=false
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 CI=1 \
  ./node_modules/.bin/playwright test e2e/journal-decoration.spec.ts e2e/decoration-studio-ux.spec.ts --reporter=line
```
- 전체 vitest에서 `private-memo-vault*`, `private-note-crypto*` 계열 47개가 실패하는 것은 Node 20.19 WebCrypto `Pbkdf2Params salt` 문제로 이 영역과 무관하다 (main에서도 동일).

## 5. e2e가 의존하는 문자열

바꾸면 `e2e/journal-decoration.spec.ts`도 함께 고친다.
- 진입 카드: `귀여운 스티커 28종 보기, 한 개 4포인트`
- 컬렉션 부제: `28종 · 한 개 4P` (`collectionSubtitle`)
- 출처 링크 href: `legal/open-source.html#OPEN_CUTE_V1`
- 개별 구매: `콧노래 친구 4P로 받기` → 확인 그룹 `콧노래 친구 받기 확인` → 버튼 `4P로 받기`
- 번들: 버튼 `${title} 남은 N종 한 번에 받기, ${cost}포인트` → 그룹 `${title} 한 번에 받기 확인` → 버튼 `${cost}P로 모두 받기`

## 6. 알려진 미완·다음 개선 후보

| # | 항목 | 우선도 | 메모 |
|---|---|---|---|
| A | **CI에 `collection-docs:check` 연결** | 높음 | 현재는 vitest 계약 테스트가 동기화를 강제하지만, 스크립트 자체도 CI 단계로 두면 실패 원인이 더 명확하다. `.github/workflows` 수정 권한이 필요하므로 오너 조치 |
| B | **보상 아이템 실제 등록** | 중간 | `REWARD_RULES` 4개와 `claimRewardDecorations`는 준비돼 있으나 `acquisition: REWARD`인 아이템이 아직 없다. 첫 후보: 기본 재료 중 도장 1종을 `FIRST_JOURNAL` 보상으로 — 오너 결정 필요 |
| C | 보상 지급 시점 | 중간 | 지금은 **편집기를 열 때만** 판정한다. 홈 `EngagementStrip`에서 "받을 수 있는 보상 N개" 배지를 보여 주려면 `claimableRewardDecorations`를 홈에서도 호출해야 한다 |
| D | 번들 행이 20종 이상 남았을 때만 의미 | 낮음 | 남은 개별 합계가 번들가보다 싸면 `collectionBundleCost`가 개별 합계를 돌려주므로 "묶음 할인"이 사실상 없다. 그때는 행을 숨기는 게 나을 수 있다 (현재는 ≥2종이면 노출) |
| E | 컬렉션 화면 진입 시 lazy fetch 체감 | 낮음 | 타일 `<img loading="lazy">`는 적용돼 있어 뷰포트 밖 그림은 지연된다. 컬렉션이 100종 규모로 커지면 그룹 섹션 접기 또는 가상 스크롤을 고려 |
| F | 시즌 컬렉션 종료 후 정리 | 낮음 | `season.to`가 지나면 상점은 자동 숨김되고 문서는 "시즌 기간 안에서만 제공"으로 표기된다(2026-09-04 반영). 시즌이 끝난 뒤 `availability: "RETIRED"`로 명시 전환하는 것은 여전히 사람이 한다 |
| G | `Home.tsx` 다음 목표 | 완료 | 2026-09-04: RETIRED·REWARD·SEASON 항목을 후보에서 제외하도록 필터 추가 |

## 7. 의사결정 기록

- **왜 레지스트리를 카탈로그와 분리했나** — 기본 재료는 아트 디렉션이 고정된 "제품"이고, 컬렉션은 계속 늘어나는 "콘텐츠"다. 같은 파일에 두면 컬렉션 하나 추가할 때마다 카탈로그 타입·테스트를 흔든다.
- **왜 문서를 생성하나** — 손으로 쓴 `open-source.html`은 자산과 어긋나기 시작하면 아무도 모른다. 레지스트리에서 생성하고 테스트로 동기화를 강제하면 "장부가 거짓인 상태"가 커밋될 수 없다.
- **왜 SW 프리캐시에서 뺐나** — 컬렉션은 대부분 사용자가 한두 개만 연다. 전부 프리캐시하면 첫 설치 용량이 컬렉션 수에 비례해 커지고, 컬렉션 추가마다 SW 버전을 올려야 한다.
- **왜 번들 하한을 `min(번들가, 개별 합계)`로 잡았나** — 스키마는 "이 보유분이 가능한 가장 싼 경로로 얻어졌다면 최소 얼마를 썼나"를 물어야 한다. 개별 합계로 잡으면 정직한 번들 구매자를 거부한다.
