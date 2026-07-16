# WO015 화면 검토 전달 자료

```yaml
order_id: CODEX_WORK_ORDER_015
status: HANDOFF_READY_NOT_REVIEWED
owner_response: NOT_REVIEWED
athlete_response: NOT_REVIEWED
coach_response: NOT_REVIEWED
privacy_response: NOT_REVIEWED
accessibility_response: NOT_REVIEWED
projection_accepted: false
runtime_authority: false
```

## 무엇을 보는가

`prototypes/formation-projection/index.html`은 합성 데이터만 쓰는 독립 시제품입니다.
실제 훈련계획을 만들거나 바꾸지 않고, 저장·전송·네트워크 요청도 하지 않습니다.
자동 화면 검사는 검토 준비 증거일 뿐 사람의 승인이나 보조기술 검사가 아닙니다.

## 공통 확인

- [ ] `비실행 시뮬레이션`과 `실제 훈련계획은 바뀌지 않아요`가 분명한가
- [ ] 다섯 설명 수준은 같은 사실을 다른 말로만 설명하는가
- [ ] 선수·코치·일지 전용·허용된 보호자 보기가 권한에 맞게 분리되는가
- [ ] 나만의 메모 존재 여부가 드러나지 않는가
- [ ] 복합 운동을 한 피로도 숫자로 뭉개지 않는가
- [ ] 스티커가 성과·순위·참여 강요로 읽히지 않는가

## 역할별 빈 응답

| 실제 역할 | 확인할 내용 | 응답 | 필수 수정 | 서명 참조 |
|---|---|---|---|---|
| `TOTAL_RESPONSIBILITY_HOLDER` | 최종 범위, 남은 위험, 실행 금지 유지 | `NOT_REVIEWED` |  |  |
| `ATHLETE_REVIEW_PARTICIPANT` | 쉬운 말, 거절·중단 이해, 압박 없음 | `NOT_REVIEWED` |  |  |
| `COACH_OWNER` | 사실·가설·코치 판단 구분 | `NOT_REVIEWED` |  |  |
| `QUALIFIED_PRIVACY_REVIEWER` | 대상별 최소 표시, 보호자 범위, 메모 무신호 | `NOT_REVIEWED` |  |  |
| `ACCESSIBILITY_REVIEWER` | 키보드, 200% 확대, 대비, 실제 보조기술 | `NOT_REVIEWED` |  |  |

응답은 `APPROVE`, `APPROVE_WITH_REQUIRED_CHANGES`, `REJECT`, `NOT_REVIEWED` 중
하나여야 합니다. 이름 없는 피드백, AI 리뷰, 자동검사 통과는 승인으로 세지 않습니다.
모든 필수 수정 뒤에는 새 증거 묶음으로 다시 검토합니다.

[HANDOFF_ONLY_NO_ACCEPTANCE]
