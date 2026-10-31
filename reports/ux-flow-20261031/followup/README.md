# 독립 검수 후 제품 흐름 통합 결과 — 2026-10-31

제품 커밋: **`1f29f76541b611fcb415838e6b20bb6b39c397b0`**, 브랜치 `ux/flow-20261031`.
기준은 `1702188ddd26eaf1ef33fdd6481a49df4ac23635`다. 이 보고서와 새 증거는 후속 구현에만 해당한다. 상위 폴더의 초기 보고서·통과 기록은 새 기능의 통과 근거로 재사용하지 않았다.

## 사용자에게 달라진 점

- **가져온 기록 보기**가 실제 저장한 파일 일지 전체 목록으로 열린다. 같은 날짜·같은 이름이어도 거리·시간·순번으로 구별하고 정확한 `date + entryId`의 상세를 연다. 일반 분석의 빈 집계가 먼저 나오지 않는다.
- 파일 확인 중 상단 뒤로 또는 브라우저 뒤로를 누른 뒤 다시 들어오면 선택·제외·마지막 조작 위치를 이어 본다. 이 초안은 현재 화면/계정 수명의 메모리에만 남는다. 새 파일과 새 가져오기, 계정 수명 변경은 이전 문맥을 버린다.
- 저장 결과 → 목록 → 상세 → 뒤로가 원래 목록과 저장 결과로 돌아온다. 목록의 열었던 행과 저장 결과의 열었던 버튼으로 초점이 돌아온다. 탐색 자체는 저장하지 않는다.
- 분류 근거가 없는 가져오기 기본값 `base`를 **기초 지구력**으로 해석하지 않는다. **훈련 종류 미확인**, **파일 시간 · 종류 미확인**을 표시한다. 원래 저장값·수치·훈련 공식은 바꾸지 않는다. 보완한 기존 분류와 확인한 시간 의미는 유지한다.
- 실제 가져오기 화면에 공통 선택행·상태·오류·행동 컴포넌트를 적용했다. 로컬 보관, 계정 저장 확인 대기, 실제 확인된 일지, 분석 가능 여부는 기존 계약대로 나뉜다. 연결을 제공하지 않는 서비스는 연결 완료로 표시하지 않는다.

## 세 독립 검수의 합의와 구현

독립 결론을 고정한 뒤 1·2번 보고서를 읽었다. 원본 [3번 독립 검수](../../../../REVIEW-INDEPENDENT-20261031.md)는 수정하지 않았다. 부모가 전달한 1번 `REVIEW-CROSS-20261031.md`와 `independent-review/ACCEPTANCE-MATRIX-20261031.md`의 AC01–09를 아래에 결속했다. 1번의 새 브라우저 실행은 EACCES로 미실행이었으며, 그 보고서를 새 실행 증거로 계산하지 않는다.

| 합친 발견 | 실제 수정 | 보호한 계약 |
|---|---|---|
| 3-F1: 분류 없는 BASE·시간 종류 소실 | `LogDetail.tsx`의 표시 의미를 보정. 원본·확인 시간 구분 유지 | 저장된 `system`, 거리·시간·페이스·원본 출처 불변 |
| 1-R1 / 2-F1 / 3-F3: 최근 1건·일반 집계로 잘못 진입 | 새 `ImportedRecords.tsx`, AppShell의 가져온 기록 오버레이 | 확인한 계정 projection의 정확한 id/date/savedAt만 허용. pending·다른 계정 사본 제외 |
| 2-F2 / 3-F2: 저장 전·후 뒤로 문맥 소실 | 메모리 `ImportReviewSession`, 기존 오버레이 아래 저장 결과 유지, 목록 행/스크롤 복원 | 새 영구 저장·raw file history 없음. 동일 저장 요청 재시도 인스턴스 보존. 계정 세대별 초기화 |
| 1-R2 / 2-S1: 공통 UI의 실제 소비 부족 | `ImportStages`, `DeviceConnections`에 RecordChoice/Notice/StateList/Action 적용 | 기존 선택·중복·의도·ACK 게이트와 callback 소유권 유지 |
| 1-R3 / 3-F4: 좁은 화면·반복 밀도·긴 시간 | 반복 설명 축약, 행 밀도와 글자 크기를 따르는 열 배치 | 불확실 시간·출처·선택·제외는 계속 보임. 네이티브 선택창의 긴 선택값은 아래 문장에도 표시 |

2번 공통 후속 `afc43a23641692294ee681bf85ca7fd3b5fac2f6`의 `record-ui-contract-followup.patch`를 적용했다. `RecordUI.tsx`, 두 CSS, `RecordUI.contract.test.tsx` 네 파일은 2번 산출물과 줄바꿈을 제외한 텍스트가 정확히 같다. 별도 중복 컴포넌트를 만들지 않았다. 실제 소비 화면에서 발견한 전역 `.next-action.next-action`의 파란 스타일 충돌은 가져오기 버튼에서 그 클래스를 제거해 해결했고, 기존 행동 그룹 배치 CSS는 명시적으로 읽는다.

## 근거 → 설계 규칙 → 실제 동작

자료 위치: `C:/Users/admin/Documents/Codex/2026-10-31/task/reports/ux-reference-20261031/`의 공식 영상 7개/프레임 38개, `IMPLEMENTATION_HANDOFF.md`, `OFFICIAL_VIDEO_OBSERVATIONS.md`, evidence gallery. Aside 보고서·46개 증거와 대조했다. Aside 보고서 SHA256은 `7A885C06E682FFFE58661652613A4CC52685C180A88DB3C7CBEC59BD14EC36C4`다.

| 원제품 관찰 등급·구간 | 도출한 규칙 | 구현과 유리한 차이 |
|---|---|---|
| Apple **VIDEO** A-WORK 2:05, 시간 종류를 나눈 상세 | 숫자와 의미를 함께 읽고 상세에서도 의미를 잃지 않는다 | 파일의 시간 종류를 모르면 그대로 표시한다. Workout/Elapsed 라벨을 근거 없이 붙이지 않는다. `ImportedActivityFacts`, 목록, `LogDetail`에 연결 |
| Apple **VIDEO** A-WORK 2:11, 이미 있는 운동으로 이어감; A-FIT 0:40 반복 요약행 | 요약에서 선택한 실제 대상과 완료 문맥을 유지한다 | 정확한 일지 ID로 상세, 같은 목록·결과로 복귀. 미저장 파일 초안의 보존은 OUR/TOSS 요구이며 Apple에서 직접 본 동작으로 주장하지 않는다 |
| Garmin **VIDEO** G-ACT 0:25–0:35, All Activities → Yoga 상세 | 여러 활동을 읽기 좋은 반복행에서 고르고 해당 상세로 간다 | 실제 전체 가져온 기록 목록을 추가. 최근 1건으로 대체하지 않는다. 날짜·거리·시간으로 같은 이름의 파일도 구별 |
| Garmin **VIDEO** G-CONNECT 0:40–0:45, 1:05–1:40 및 최신성 **DOC** | 준비·연결·동기화·이용 가능한 상태의 의미를 분리한다 | 실제 제공하지 않는 연결은 미제공. 로컬 보관·미확인 ACK·확인·충돌·분석 제외를 독자 계약으로 유지. Garmin ACK 프로토콜을 역설계했다고 주장하지 않는다 |
| Apple **VIDEO** A-HEALTH 0:20–0:25 No Data | 빈값과 오류를 관측 사실대로 알린다 | 정상 활동 0건, 깨진 파일, 읽기 불가, 자료 없는 개인 분석, 명시적 예시 전환을 나눈다 |

**NATIVE 실앱 직접 조작은 Apple·Garmin 모두 0건**이다. 위는 공식 영상/공식 문서/정적 이미지에서 관찰한 설계 규칙과 OUR 합성 구현·검증이다. 토큰·색상·글자·간격·44/48px은 TrainOracle/Toss 규칙이며 벤더 실측이 아니다. 원제품 자산·로고·코드를 복제하지 않았다. 링·색상·기기 연결 화면을 그대로 모사하는 대신 이 제품의 파일 확인·출처·명시적 저장을 앞세웠다. 이는 전체 Apple/Garmin 앱의 역공학 완료 선언이 아니다.

## 9개 수용조건 판정

**아래 통과는 명시한 로컬/합성 범위에 한정한다.** 실제 계정·공급자 네이티브 앱 검증을 포함하지 않는다.

| ID | 판정과 실제 근거 |
|---|---|
| AC01 | **통과 — 로컬 브라우저+계약.** 같은 날 2km/10분과 3km/15분을 각각 열고 미확인 분류·시간을 확인. 저장 문자열 불변. 계약검사는 이미 보완한 BASE와 확인한 TIMER 시간 및 원본 observation 불변도 확인. `exact-first-detail-430.png`, `exact-second-detail-430.png`, 최종 52개 검사 |
| AC02 | **통과 — 로컬 브라우저+계약.** 처음 저장한 3건 모두 목록, 첫 h1 초점, 같은 날짜의 두 상세와 다른 날짜 상세. 새 1건 저장 후 목록 4건. 계정 pending/소유자 불일치와 없는 정확한 대상 대체 금지 계약. `evidence/results.json`, `records-320/375/430.png` |
| AC03 | **통과 — 로컬 브라우저+계약.** 상단 Back·브라우저 Back 후 선택/제외 보존. 실제 scrollTop **627→627**, 마지막 선택창 초점 복원. A→B→A 계정 수명과 명시적 새 가져오기는 이전 초안 폐기. 저장 전 POST 0. `verify.mjs`, `results.json`, `ImportActivities.flow.contract.test.tsx` |
| AC04 | **통과 — 로컬 브라우저.** 저장 3건 결과→목록→정확한 상세→Back으로 동일 결과·opener 복원. 새 파일 1건의 결과도 왕복 후 1건. 탐색 전후 저장 문자열 동일, 새 저장 뒤 실제 총 4건. 계정 수명 변경 뒤 옛 결과/overlay Back 복원 차단. `results.json`, `restored-save-result-320.png` |
| AC05 | **통과 — 실제 공통 선택행 브라우저+계약.** Space 0→1→2→1→0→1, 재선택 후 제외 유지, 0건 저장 비활성. 실제 값·순번을 포함한 native 접근성 이름. 보통 글씨 320/375/430px와 200% 글씨 320px에서 다음 행 이동 **0px**, 가로 넘침 없음. `review-results.json` |
| AC06 | **통과 — 로컬 OFF 화면+계정 mock.** 미제공 provider 3개는 미제공. 계정 pending→검증 ACK 이전 분석 제외, 조회 실패 후 오래된 ACK의 분석 권한 차단, 검증된 정정 원본 identity 유지. 단위 계약의 실패/충돌/재검토·읽기 실패 시 결과 보존. 새 실제 로그인·공급자 서버 실행 아님. `account-browser.log`, `account/*.png`, account-import 계약 |
| AC07 | **통과 — 로컬 브라우저+기존 보호 계약의 새 실행.** 정상 빈 TCX와 깨진 XML이 다른 안내, 실패한 새 파일 뒤 이전 6건 선택·제외 복귀, 기존 일지 보존. 개인 자료 없음/읽기 실패/명시적 예시 전환은 OracleExplore·AppShell 관련 두 suite **63개씩 UTC/KST**. 불완전 목록을 0건으로 표시하지 않음. `common-error-*.png`, `personal-states-*.log` |
| AC08 | **통과 — 로컬 브라우저.** 같은 조건의 기본 6건 행 범위 **1,946→1,646px**. 긴 합성 이름 6건·`1,256.78분`과 320px DOM 글자 200%: 숫자 부분 한 줄, 단위는 다음 줄 허용, 가로 넘침 없음. 선택시 위치 이동 없음. 단순 축소·중요 정보 숨김·고정 CTA 덮개 없음. `review-six-common-320.png`, `review-long-200-320.png`, `review-results.json` |
| AC09 | **통과 — 실제 소비 화면 CSS+mock.** 로컬 결과와 계정 pending/confirmed의 주 행동이 공통 RecordAction. 계정 브라우저는 실제 계산 배경색이 `--brand`와 같고 min-height **48px**임을 검사. 보조 행동 중립, 판단·상태는 원래 callback/ACK 결과가 결정. `account-style-final.log`, `account/import-pending-320.png`, `account/import-confirmed-375.png` |

## 전후 화면

전 화면은 독립 검수 시점의 합성 2건/6건이고 후 화면은 같은 종류의 합성 3건/6건이다. 저장 건수 차이를 기능 변경 효과로 비교하지 않는다.

| 항목 | 전 | 후 |
|---|---|---|
| 숫자·시간·분류 의미 | [기본 BASE/일반 시간](evidence/before/individual-journal-320.png) | [정확한 두 번째 일지/미확인 의미](evidence/exact-second-detail-430.png) |
| 전체 기록 진입 | [일반 빈 집계가 먼저 나옴](evidence/before/import-view-destination-top-320.png) | [실제 파일 일지 목록](evidence/records-320.png) |
| 상위 Back 문맥 | [파일 선택으로 초기화](evidence/before/back-reopen-lost-review-320.png) | [결과 복귀](evidence/restored-save-result-320.png), 선택 복귀는 `results.json`의 focus·627px 근거 |
| 6건 밀도와 큰 글씨 | [이전 6건](evidence/before/six-record-review-320.png) | [공통 6건](evidence/review-six-common-320.png), [긴 숫자·200%](evidence/review-long-200-320.png) |

## 실행 검사와 재현

| 실행 | 결과 / 범위 |
|---|---|
| 통합 직후 관련 10 suite | **133개씩 UTC/KST 통과**, `unit-utc.log`, `unit-kst.log`. 마지막 버튼 충돌 발견 전 실행이므로 이것만으로 최종 화면 통과를 주장하지 않음 |
| 마지막 기능 수정·결함 복원 후 영향 5 suite | **52개씩 UTC/KST 통과**, `final-focused-utc.log`, `final-focused-kst.log` |
| 개인 분석 상태 관련 2 suite | **63개씩 UTC/KST 통과**, `personal-states-utc.log`, `personal-states-kst.log` |
| 기존 계정 합성 e2e 중 관련 4개 | **4개 통과**: 정확한 일지, 미확인→ACK, stale ACK 제외, 실제 TCX 정정. 마지막 행동 배치 CSS 복원 후 pending→confirmed 1개 추가 확인 통과. `account-browser.log`, `account-style-final.log` |
| 새 OFF 브라우저 | `verify.mjs`의 6 흐름, `verify-review.mjs`의 선택·오류·밀도·큰 글씨 모두 통과. 외부 네트워크 차단, POST 0 |
| 의도적 결함 | 목록 1건 절단 / 근거 없는 BASE 복원 / 미저장 초안 복원 제거 / 계정 확인 필터 제거 각각 해당 **이름의 테스트 실패 검출**. 정확한 원본 바이트 복원 후 위 52개 통과. `defect-results.json`, `defect-1..4.log` |
| TypeScript / Vite | 로컬 설치된 `typescript/bin/tsc --noEmit -p tsconfig.json` exit 0, 공개 계정 OFF 빌드 exit 0. 큰 chunk 경고는 남음. `typecheck.log`, `build.log` |

검사 수는 실행별이며 서로 겹치므로 합산한 고유 테스트 수가 아니다. 검사 도중 잘못 만든 테스트 observation의 lap 합계 누락을 수정했으며 제품 계약을 느슨하게 하지 않았다. 긴 값의 숫자 중간 줄바꿈과 전역 행동 스타일 충돌은 실제 캡처에서 발견해 고쳤다.

재현은 저장소 루트에서 `node reports/ux-flow-20261031/followup/verify.mjs`, `node reports/ux-flow-20261031/followup/verify-review.mjs`를 실행한다. 계정 e2e는 app에서 기존 `playwright.file-analysis.config.ts`와 보고서의 4개 이름을 골라 실행한다. 모두 설치된 로컬 런타임을 사용한다. `verify-defects.mjs`는 단독으로 실행하며 실행 중 같은 파일을 검사·편집하지 않는다. `make-manifest.mjs`는 제품 파일과 선택된 증거를 SHA256으로 묶는다. `sha256`은 캡처 당시 원본 바이트, `sha256Lf`는 Git 줄바꿈 변환에도 비교할 수 있는 LF 정규화 텍스트다. CLI 로그는 원본 공백·ANSI 출력을 보존한다.

## 한계와 전달 경계

- Apple/Garmin 네이티브 실앱·실계정·실기기·공급자 동기화는 미실행이다. 실제 ACK/저장 서버 대신 기존 합성 mock만 실행했다.
- 확인 범위는 **보통 글씨 320/375/430px, 200% 글씨는 320px DOM 조정**이다. OS Dynamic Type, 모바일 native 선택창 전체, 물리 키보드·스크린리더의 읽기 순서는 검증하지 않았다.
- 파일 목록은 현재 소유자에게 읽힌 확인 가능한 파일 일지 전체다. 읽기가 불완전하면 그 사실과 재확인을 표시한다. 범용 운동 전체 라이브러리·새 서버 동기화를 만들었다는 뜻이 아니다.
- 이 구현은 실제 사용 흐름에서 발견한 부족분을 해결했다. 앱 전체 화면에 공통 시스템을 완전히 이식한 상태는 아니다. 남은 화면의 별도 디자인 검수까지 완료로 확장하지 않는다.
- D: 원본의 Git 소유권 보호·safe.directory·보안 설정을 변경하지 않았다. 상태 확인 중 일반 권한 CIM 프로세스 목록 읽기는 접근 거부됐다. 실제 실행 상태는 도구의 명령 종료코드와 결과 파일로 확인했으며 이 거부는 제품 구현을 막지 않았다.
- 공개 병합·push·배포·계정 활성화·새 로그인·권한 변경·개인 건강정보 전송은 하지 않았다. 미완료 차단은 로컬 승인 범위 안에는 없다.
