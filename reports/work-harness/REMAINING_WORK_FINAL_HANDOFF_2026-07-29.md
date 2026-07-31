# TRAINORACLE Remaining Work Final Handoff

## 한 줄 상태

일지 작성·수정·선수 기록·허용된 개인 페이스 근거·출처가 분명한 추이·
월/주/일 아카이브는 공개 앱에 반영되었습니다. 실제 훈련계획 자동 생성,
템플릿 자동 배정, 계정 동기화, 코치 상시 열람, 결제는 열리지 않았습니다.

## 재현 가능한 배포 기준

| 항목 | 값 |
| --- | --- |
| 저장소 | https://github.com/hojune0330/TRAINORACLE |
| 제품 기준 main | `2b2f62ee32c89cd1fa577dc2b982ef1f9df71765` |
| 제품 기준 gh-pages | `f62e0921b95f40ffd55a96425fd6de0c435f2c9f` |
| gh-pages 제목 | `deploy: verified app from main 2b2f62e` |
| main CI | https://github.com/hojune0330/TRAINORACLE/actions/runs/30631686570 |
| 공개 앱 | https://hojune0330.github.io/TRAINORACLE/ |
| 공개 JavaScript | `assets/index-D5x2CCmu.js`, SHA-256 `69b246cc41d68fed177cce17e4dd44fa8292db842f416aa301733f0eeb689582` |
| 공개 CSS | `assets/index-DmUX729h.css`, SHA-256 `b4eb13272abe4c69b8945b8b0b49baaa77027982584b31dad9502d0a59a9508a` |

위 main은 마지막 제품 변경 PR #155의 병합 커밋입니다. 이 문서만 추가하는
후속 PR의 병합 커밋과 배포 커밋은 작성 시점에는 존재할 수 없으므로 해당 PR의
GitHub Conversation, Actions 실행, 실행 장부에 사후 영수증으로 고정합니다. 이
문서의 제품 기준 SHA를 미래 SHA인 것처럼 바꾸지 않습니다.

## 이번 실행에서 닫힌 PR

| 범위 | PR | 병합 커밋 | 결과 |
| --- | --- | --- | --- |
| P2 기계 표기 선행 계약 | https://github.com/hojune0330/TRAINORACLE/pull/141 | `405b61943eaa78a6f75040e90e234e6acc2bc8c9` | 파서 안전 표기, 런타임 권한 없음 |
| 예시 추천 선행 계약 | https://github.com/hojune0330/TRAINORACLE/pull/142 | `60b2d76dc7480fedcd048e474201439ce1801f92` | 예시 후보만, 자동 처방 아님 |
| 오래된 PR 정합 | https://github.com/hojune0330/TRAINORACLE/pull/143 | `5bcf428d981a6af7321945537864ad1009f36ee0` | 보존·대체·종료 지도 |
| 정합 보수 | https://github.com/hojune0330/TRAINORACLE/pull/145 | `456d1bbbc85f547b95f823a3dae78b0dd4fd79f2` | #114/#126 후속 구현까지 보류 고정 |
| 의존성 판정 | https://github.com/hojune0330/TRAINORACLE/pull/147 | `ccd73debd75ec9e84d0a4e561b42b7550710b8a6` | 개발 전용 전이 취약점으로 추적 |
| 지난 일지 재방문 | https://github.com/hojune0330/TRAINORACLE/pull/148 | `40c264025a30b4a3707f06ae5f7d9c29777f35b9` | 과거 일지 수정·추가 흐름 |
| 재방문 무결성 보수 | https://github.com/hojune0330/TRAINORACLE/pull/151 | `f9d012e8d2a45f5305a74fc3d1b23ff61f10fd73` | 동시 수정·삭제 경계 보수 |
| P1 선수 기록 | https://github.com/hojune0330/TRAINORACLE/pull/152 | `aea3d356fbc7f25d3ddb905c1f2cf2aa69e52eb6` | 현재·목표·출처 분리 |
| P3 개인 페이스 | https://github.com/hojune0330/TRAINORACLE/pull/153 | `8862d7e86dd7cf35975b00e5cf9d2ae3c1f68d1d` | CURRENT·동일 종목만 숫자 근거 |
| P5 추이 | https://github.com/hojune0330/TRAINORACLE/pull/154 | `6c054a1b0637aed4777cfe56b9b34c49e41a91c7` | 출처 기반 집계, 메모 무신호 |
| 일지 아카이브 | https://github.com/hojune0330/TRAINORACLE/pull/155 | `2b2f62ee32c89cd1fa577dc2b982ef1f9df71765` | 월→주→일 탐색, 제외 건수 표시 |

Task 6은 #141의 계약을 최신 main에서 다시 검증한 단계라 새 제품 PR을 만들지
않았습니다. 오래된 원본 #114와 #126을 포함해 계획 시작 시점의 18개 PR은 모두
종료되었고, 이 문서 작성 직전 열린 PR 수는 0개였습니다.

## 공개 앱에서 확인된 범위

- 첫 방문 목적 선택과 건너뛰기
- 훈련 후·하루 마무리·경기 일지 저장
- 저장된 과거 일지 재열기, 수정, 같은 날짜 기록 추가
- P1 선수 기록의 현재 기록과 목표 기록 분리
- P3의 `CURRENT + 동일 종목 + 출처 확인` 조건에서만 숫자 페이스 근거 표시
- P5의 주·월 추이, 표본 수, 누락·제외·출처 상태 표시
- 월→주→일 아카이브 탐색과 선택 상태 복귀
- 안전 백업은 메모 기본 제외, 전량 백업은 별도 확인

개인 메모의 원문뿐 아니라 존재, 길이, 개수, 목적도 분석·추이·아카이브 결과를
바꾸지 않습니다. 출처를 확인할 수 없는 수치는 0으로 채우지 않고 집계에서
제외하며, 제외 사실을 텍스트로 표시합니다.

## 현재 잠겨 있는 권한

- 에너지 시스템 카탈로그 30개는 모두 `DRAFT`와 `REVIEW_REQUIRED`입니다.
- 모든 이벤트·경험 적격 배열은 비어 있고 활성 런타임 후보는 0개입니다.
- D9 `ACTIVE` 또는 `UNKNOWN`을 우회하거나 안전 해제로 해석하지 않습니다.
- P5 분석과 아카이브는 Plan Generator, Formation, D9, Safety Gate 입력이 아닙니다.
- 9.5일 Formation과 MAIN 2~3회는 제품 정체성으로 유지합니다. 다시 미결로
  돌리지 않지만 과학적으로 최적이거나 더 안전하다고 주장하지 않으며, 현재
  자동 처방 런타임을 열지도 않습니다.

## 남은 Sol·Owner·전문가 게이트

아래는 반복 구현 목록이 아니라, 권한을 실제로 열기 전에 필요한 결정 관문만
남긴 것입니다.

1. **Formation·처방 활성화**: 준비된 정식 검토 패킷 6건의 사람 승인, P1 정본
   패치 계획 10건의 Owner 승인, 코치·스포츠과학·청소년 전이 검토가 필요합니다.
   현재 엄격 승인 `0/6`, Owner 승인 `0/10`, 런타임 권한 `false`입니다.
2. **실제 그림자 파일럿**: 합성 QA와 사람 대상 파일럿을 구분합니다. 실제 선수
   모집 전 Owner·코치·독립 사람 검수자·선수 참여자 동의/동의보조와 미성년자
   보호 절차가 필요합니다.
3. **계정·기기 동기화·코치 연결**: Owner가 서비스 국가와 연령을 정한 뒤,
   개인정보·보안 전문가가 동의, 테넌트 분리, 보존·삭제, 지역·업체, 비밀키,
   사고 대응을 승인해야 합니다. 그 전에는 로컬 전용입니다.
4. **접근성·설명 화면**: 실제 선수와 접근성 검수자의 사람 테스트가 필요합니다.
   AI 페르소나 검토나 CI는 이를 대신하지 않습니다.
5. **최종 Sol 안전 검토와 Owner 활성화**: 위 사람 결정이 정본에 결속된 뒤,
   Sol이 권한 충돌·우회 경로를 다시 공격 검토하고 Owner가 별도의 활성화 기록을
   승인해야 합니다. 병합, 결제, 계정 소유, 침묵은 승인이 아닙니다.

## 다음 작업자가 믿어도 되는 경계

- 이 문서와 링크된 GitHub SHA·Actions·공개 자산 해시는 재현 가능한 사실입니다.
- 종료된 PR을 새 작업 목록으로 되살리지 않습니다.
- 로컬 Codex 세션 ID, 토큰 절감률 추정, 과학적 안전성 수치는 인계 근거가
  아닙니다.
- 새 기능은 위 게이트 중 해당되는 관문이 닫힌 뒤 최신 main에서 새 PR로
  시작합니다.

[HANDOFF_COMPLETE]
