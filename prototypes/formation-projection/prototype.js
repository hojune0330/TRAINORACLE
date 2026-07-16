const explanationByLevel = Object.freeze({
  easy: Object.freeze({
    label: "쉽게",
    title: "힘든 날 다음에는 몸이 쉴 수 있게 했어요.",
    copy: "중요한 훈련을 몰아넣지 않았어요. 몸 상태가 다르면 코치가 먼저 보고 바꿀지 결정해요.",
  }),
  short: Object.freeze({
    label: "짧게",
    title: "중심 훈련 3회 사이에 회복 시간을 뒀어요.",
    copy: "경기는 중심 훈련 1회로 세고, 놓친 훈련은 자동으로 몰아넣지 않아요.",
  }),
  balanced: Object.freeze({
    label: "균형",
    title: "강한 날 사이에 회복할 틈을 둔 흐름이에요.",
    copy: "3개의 중심 훈련 사이에 회복과 보조 훈련을 나눠 놓았습니다. 몸 상태가 달라지면 코치가 먼저 확인합니다.",
  }),
  detail: Object.freeze({
    label: "자세히",
    title: "9.5일 안의 MAIN 노출을 분산한 가설입니다.",
    copy: "약 72시간 간격은 확정 법칙이 아니라 코치의 파일럿 가설입니다. 복합 훈련은 종류별 사실을 분리하고 회복 반응과 함께 검토합니다.",
  }),
  precise: Object.freeze({
    label: "정확히",
    title: "합성 입력으로 만든 읽기 전용 Formation 투영입니다.",
    copy: "각 값의 출처 꼬리표와 누락·충돌 상태를 보존합니다. 설명 문구만 바뀌며 fact hash와 실제 plan hash는 변경되지 않습니다.",
  }),
});

const audienceLabels = Object.freeze({
  athlete: "선수에게 보이는 설명",
  journal: "일지 화면에 보이는 설명",
  coach: "코치에게 보이는 설명",
  guardian: "허용된 보호자에게 보이는 설명",
});

const audienceNotices = Object.freeze({
  journal: Object.freeze({
    title: "Formation 화면 없음",
    copy: "일지 보기에서는 기록 사실만 확인할 수 있고, 훈련 흐름·분석·검토 기능은 표시하지 않습니다.",
  }),
  guardian: Object.freeze({
    title: "허용된 요약만 표시",
    copy: "별도로 허용된 기록 완료 여부만 볼 수 있습니다. 훈련 내용, 분석, RPE, 수면, 메모는 표시하지 않습니다.",
  }),
});

const scenarioMessages = Object.freeze({
  current: Object.freeze({ title: "비실행 시뮬레이션", detail: "실제 훈련계획은 바뀌지 않아요" }),
  missing: Object.freeze({ title: "기록이 더 필요해요", detail: "없는 값은 추측하지 않고 코치 확인을 기다립니다" }),
  stale: Object.freeze({ title: "최근 상태를 확인해 주세요", detail: "오래된 기록으로 다음 계획을 확정하지 않습니다" }),
  unknown: Object.freeze({ title: "지금은 판단할 수 없어요", detail: "확인할 수 없는 값은 추측하지 않고 사람 검토를 기다립니다" }),
  conflict: Object.freeze({ title: "서로 다른 기록이 있어요", detail: "어느 값이 맞는지 정하기 전에는 실행하지 않습니다" }),
  paused: Object.freeze({ title: "분석이 잠시 멈췄어요", detail: "기존 기록과 실제 계획은 그대로 유지됩니다" }),
  withdrawn: Object.freeze({ title: "분석 동의가 철회됐어요", detail: "새 분석을 만들거나 공유하지 않습니다" }),
  stopped: Object.freeze({ title: "검토가 중단됐어요", detail: "책임자가 다시 시작하기 전에는 진행하지 않습니다" }),
});

const levelInputs = document.querySelectorAll('input[name="level"]');
const audienceInputs = document.querySelectorAll('input[name="audience"]');
const scenarioSelect = document.querySelector("#scenario");
const title = document.querySelector("#explanation-title");
const copy = document.querySelector("#explanation-copy");
const audienceTitle = document.querySelector("#audience-title");
const statusTitle = document.querySelector("#status-title");
const statusDetail = document.querySelector(".status-band p");
const projection = document.querySelector("#projection");
const audienceNotice = document.querySelector("#audience-notice");
const audienceNoticeTitle = document.querySelector("#audience-notice-title");
const audienceNoticeCopy = document.querySelector("#audience-notice-copy");

const setExplanation = (level) => {
  const content = explanationByLevel[level];
  if (!content || !title || !copy) return;
  title.textContent = content.title;
  copy.textContent = content.copy;
};

const setAudience = (audience) => {
  const label = audienceLabels[audience];
  if (!label || !audienceTitle || !projection || !audienceNotice) return;
  audienceTitle.textContent = label;
  projection.dataset.audience = audience;
  const notice = audienceNotices[audience];
  audienceNotice.hidden = !notice;
  if (!notice || !audienceNoticeTitle || !audienceNoticeCopy) return;
  audienceNoticeTitle.textContent = notice.title;
  audienceNoticeCopy.textContent = notice.copy;
};

const setScenario = (scenario) => {
  const message = scenarioMessages[scenario];
  if (!message || !statusTitle || !statusDetail) return;
  statusTitle.textContent = message.title;
  statusDetail.textContent = message.detail;
};

for (const input of levelInputs) {
  input.addEventListener("change", (event) => setExplanation(event.currentTarget.value));
}
for (const input of audienceInputs) {
  input.addEventListener("change", (event) => setAudience(event.currentTarget.value));
}
scenarioSelect?.addEventListener("change", (event) => setScenario(event.currentTarget.value));
