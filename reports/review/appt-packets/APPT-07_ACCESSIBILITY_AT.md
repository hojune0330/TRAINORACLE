# APPT-07 접근성·보조기술 검토

```yaml
packet_id: TRAINORACLE_APPT_07_V1
status: READY_FOR_NAMED_REVIEWER
reviewer: UNASSIGNED
named_assistive_technology_evidence: 0
service_name: TrainOracle
provisional_service_provider_name: aaclub
review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT
runtime_authority: false
```

## 쉽게 말하면

자동 검사와 별도로, 보조기술을 실제 사용하는 사람이 핵심 흐름을 완료할 수 있는지
확인한다. 자동검사 통과만으로 사람 검토가 끝났다고 기록하지 않는다.

## 먼저 읽을 원문

- `reports/review/FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md`
- `specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md`
- `reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md`
- `runtime-evidence/formation-projection/desktop.png`
- `runtime-evidence/formation-projection/mobile-320.png`
- `runtime-evidence/formation-projection/zoom-200-reduced-motion.png`

## 검토자가 답할 질문

1. 상태·권한·불확실성·다음 행동이 보조기술에서도 같은 의미로 전달되는가?
2. 키보드만으로 핵심 과제를 완료하고 포커스가 보이며 순서가 자연스러운가?
3. 200% 확대와 400% equivalent reflow에서 잘림·겹침이 없는가?
4. 320px·375px 모바일과 데스크톱에서 터치 대상과 상태 알림이 유지되는가?
5. 상태 변화가 포커스를 빼앗지 않고 적절히 공지되는가?
6. 색만으로 의미를 전달하지 않고 대비 기준을 충족하는가?
7. 발견 사항마다 영향·심각도·수정·재검토 조건이 기록됐는가?

## Terra High 사전확인

- 자동 렌더 증거는 있지만 이름 있는 보조기술 사용자 증거는 없다.
- 기존 패키지는 키보드 트랩, 숨은 포커스, 확대 잘림과 overflow를 거부한다.
- 일부 대비값은 미달 가능성이 기록돼 있고 최종 팔레트는 미수용 상태다.
- 자동 추적은 수동 스크린리더·키보드·이해 확인을 대체하지 않는다.

## 사람이 남길 기록

```yaml
opaque_reviewer_or_participant_id: REQUIRED
restricted_identity_record_ref: REQUIRED_OUTSIDE_GIT
role_experience_or_qualification: REQUIRED
conflicts_of_interest: REQUIRED
os_browser_assistive_technology_versions: REQUIRED
device_viewport_zoom_contrast_motion_settings: REQUIRED
build_and_head_sha: REQUIRED
tasks_results_findings_severity_and_retest: REQUIRED
reviewed_at_and_signature_ref: REQUIRED
```

저장소에는 불투명 참여자 ID와 자발적으로 제공된 검토 환경만 기록한다. 실명, 연락처,
장애·건강정보와 자격 원본은 제한된 별도 신뢰 저장소에 두고 참조만 연결한다.

## 차단 조건

실제 보조기술 사용자 증거가 없거나 키보드·스크린리더·확대·대비 기준을 충족하지
못하면 수용하지 않는다. 이름 없는 피드백과 자동검사만으로 APPT-07을 닫지 않는다.

[DRAFT_COMPLETE]
