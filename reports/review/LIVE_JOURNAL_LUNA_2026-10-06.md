# 독립 라이브 UX 검수: 일지 3개 여정

검수 진행: 2026-10-06~2026-10-07 (Asia/Seoul)  
대상: [공개 게스트 앱](https://hojune0330.github.io/TRAINORACLE/?app=1)  
기대 source: `e83605b6`; 검수 checkout의 HEAD는 `e83605b6`와 일치했다. Pages가 실제 제공한 커밋 SHA는 페이지에서 독립 확인하지 못했다.

## 요약

배정된 세 여정은 각 한 번 끝까지 완료했다. 메모의 unsaved guard와 저장 원본 보존, 달리기+근력의 한 일지 저장·원문 확인, 2026-09-20 과거 날짜 저장·월 이동·최근 기록 이동·원문 복귀를 확인했다. 실제 제품 문제는 달리기 세부값이 저장되어도 일지 원본의 요약 칸에 거리·시간·평균 페이스가 `-`로 남는 한 건이다. RPE `-`는 사용자가 미기록을 선택한 결과라 문제에서 제외한다.

| 여정 | 상태 및 화면 | 실제 확인 |
|---|---|---|
| 한 줄 메모, 찾기, 편집 취소 | 완료, 375×667, reduced-motion | `훈련 메모` 한 줄을 저장하고 일지 원문에서 찾았다. 가상 수정본을 입력한 뒤 뒤로가기를 처음에는 dialog `dismiss`해 편집 화면과 초안을 유지했고, 다시 뒤로가기를 dialog `accept`해 원문으로 돌아왔다. 저장된 원문은 바뀌지 않았다. |
| 달리기+근력 한 기록 | 완료, 320×667 | 1,000m·360초 달리기와 스쿼트 8회×2세트를 한 기록에 저장하고 날짜 요약과 일지 원문 양쪽에서 읽었다. 미지정 시간, 미기록 RPE, 미입력 근력 중량을 유지했다. |
| 과거 날짜 및 달력 복귀 | 완료, 375×667, reduced-motion | 2026-09-20에 합성 회복 메모를 저장했다. 원문에서 달력으로 돌아온 뒤 9월이 유지됐다. 10월로 이동한 다음 `최근 일지 · 09/20`으로 9월에 복귀했고, 해당 날짜의 원문을 다시 열고 돌아와도 9월 달력과 9/20 기록이 남았다. |

폭별 확인은 세 여정 전체를 각각 375px와 320px에서 반복한 매트릭스가 아니다. 메모와 과거 날짜는 375px, 운동 조합은 320px에서 완주했다. 운동 조합의 375px 추가 확인은 실제 폼을 열기 전에 아직 없는 거리 입력을 찾는 locator로 중단됐다. 현재 UI snapshot에서 실제 순서가 `운동 추가` → `거리·시간·횟수 적기`임을 확인했으나 추가 여정은 사용자의 범위 제한에 따라 실행하지 않았다. 이는 테스트 locator/진입 순서 문제이며 제품 결함으로 세지 않는다. 확인한 화면의 document/body 가로폭은 375px 및 320px viewport를 넘지 않았다.

## 발견 결함

**중간 수준의 반복 스캔 부담: 원문 요약이 저장된 달리기 값을 보여주지 않음.** 화면 41에서 `거리 — km`, `시간 — min`, `평균 페이스 —/km`, `RPE —` 네 칸이 모두 비어 있다. 바로 아래 같은 일지의 운동 상세에는 `달리기 1000m · 360초`와 `스쿼트 8회 × 2세트`가 보인다. 따라서 거리와 평균 페이스는 상세값과 모순되는 빈 요약으로 보이며, 사용자는 저장 실패로 오해하거나 아래 상세를 다시 찾아야 한다. 1,000m·360초에서 달리기 페이스는 6:00/km로 계산 가능하다. 근력 운동 시간 등 정의되지 않은 합계는 임의로 만들 필요가 없으며, 산출 불가 칸은 감추거나 상세로 안내하는 편이 낫다. RPE는 실제로 미기록 선택을 했으므로 `-`가 맞다. 저장 유실이나 여정 차단은 아니지만, 반복 열람 시 신뢰와 읽기 편의에 누적 부담을 준다.

증거: [화면 41 원문 요약과 운동 상세](evidence/live-followup-20261006/journal/41-run-strength-original-320.png)

## 여정별 증거

1. 메모 원문 유지 및 명시적 확인창 응답: [수정 초안](evidence/live-followup-20261006/journal/27-edit-unsaved-before-confirm-375-reduced.png), [취소 선택 후 편집 유지](evidence/live-followup-20261006/journal/28-edit-confirm-dismissed-375-reduced.png), [폐기 수락 후 원문](evidence/live-followup-20261006/journal/29-original-after-discard-375-reduced.png).
2. 운동 입력·저장·재열기: [달리기와 근력 입력](evidence/live-followup-20261006/journal/36-run-strength-added-320.png), [저장 요약](evidence/live-followup-20261006/journal/38-run-strength-saved-320.png), [날짜 상세](evidence/live-followup-20261006/journal/40-run-strength-day-detail-320.png), [일지 원문](evidence/live-followup-20261006/journal/41-run-strength-original-320.png).
3. 과거 날짜 저장·이동·원문 복귀: [9/20 선택](evidence/live-followup-20261006/journal/52-sept20-selected-375.png), [저장 원문](evidence/live-followup-20261006/journal/55-sept20-saved-original-375.png), [10월 이동](evidence/live-followup-20261006/journal/56-calendar-next-month-october-375.png), [최근 기록으로 9월 이동](evidence/live-followup-20261006/journal/63-september-after-recent-jump-375.png), [최근 기록 원문](evidence/live-followup-20261006/journal/65-original-from-recent-jump-375.png), [원문 뒤 달력 복귀](evidence/live-followup-20261006/journal/66-calendar-after-recent-original-back-375.png).

## 마찰 및 범위

- 일지 첫 진입의 빈 상태는 `내 달력`으로 실제 달력에 진입할 수 있었다. 기록 없는 날짜를 고른 뒤 `이날 일지 쓰기`를 눌렀을 때 작성 화면에 2026-09-20이 그대로 표시됐다. 달력 월 이동과 최근 기록 점프는 추가 클릭 없이 동작했다.
- 선택 입력은 실제로 비워 둘 수 있었다. 운동 기록의 시간은 `시간 미지정`, RPE는 명시적인 미기록 선택, 근력 중량은 빈 값으로 저장했다. 과거 회복 메모에서는 수면·체중·심박·통증·감정 입력을 비웠고 원문에도 미기록 상태가 남았다. 운동 후 몸 상태 질문은 합성 응답 `없어요`를 선택해 흐름을 끝까지 진행했다.
- 일지 준비 중 문구는 한 차례 약 367ms 보인 뒤 준비가 끝났다. 대기나 반복 클릭을 요구하는 막힘으로 보지 않았다. 세 여정에서 저장 버튼의 중복 클릭, 스크롤 고착, 반복 입력 루프는 관찰하지 않았다.
- 메모 여정은 `훈련 메모`로 완주했다. 별도 `나만의 메모` 선택지는 비밀 메모 보관 준비 화면으로 이어져 그 저장 경로는 검수하지 않았다. 계정·비밀번호 없이 끝낼 수 있는 범위를 벗어나지 않았다.
- 검수는 격리된 새 Chromium guest context에서 합성 데이터만 사용했다. 허용 요청은 지정된 GitHub Pages origin/path의 GET·HEAD로 제한했고 차단된 외부 요청은 없었다. 검수 초기에 기본 Chrome 창에서 공개 URL 탭이 잠깐 열린 후 상호작용 없이 닫혔으며, 실제 입력·저장은 격리 context에서만 했다.
- 앱 소스는 수정하지 않았다. 최종 Git 상태에서 `app/src/screens/LogDetail.tsx`와 `app/src/screens/LogDetail.revisit-preservation.contract.test.tsx`가 수정 상태로 관찰됐으나, 이번 검수에서 만든 변경이 아니며 내용을 열거나 덮어쓰지 않았다. 이 보고서와 `reports/review/evidence/live-followup-20261006/journal/`의 증거만 이번 요청의 산출물이다. 기존·이전 검수 보고서는 열지 않았다.
