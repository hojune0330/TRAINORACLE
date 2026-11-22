(() => {
  "use strict";
  const model = window.RBPairsModel;
  const fields = {
    distanceLevel: "쉬지 않고 뛴 거리", strength: "자신 있는 것", goal: "다음 목표", learning: "배우고 싶은 방식",
  };
  const storyOptions = {
    training: ["훈련", ["drills", "strength", "distance", "speed"]],
    summer: ["여름", ["outside", "less", "indoor"]], winter: ["겨울", ["outside", "less", "indoor"]],
    snow: ["눈 오는 날", ["want", "maybe", "no"]], rain: ["비 오는 날", ["want", "maybe", "no"]],
    time: ["뛰는 시간대", ["morning", "day", "evening", "varies"]],
  };

  function mount(host, result, answers, answeredAt, getStoryAnswers) {
    host.replaceChildren();
    if (location.protocol !== "https:" && location.protocol !== "http:") return;
    const title = document.createElement("h3");
    title.textContent = "트레인오라클 프로필에 담기";
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "내 계정에 담을 항목 고르기";
    const form = document.createElement("form");
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = "트레인오라클에서 확인";
    const options = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "저장할 항목을 골라 주세요.";
    const selections = new Set();
    let values = {};
    function refresh() {
      options.replaceChildren(legend);
      const previous = values;
      values = {};
      function offer(label, key, value) {
        if (selections.has(key) && JSON.stringify(previous[key]) !== JSON.stringify(value)) selections.delete(key);
        values[key] = value;
        const line = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = selections.has(key);
        box.onchange = () => {
          if (box.checked) selections.add(key); else selections.delete(key);
          send.disabled = !selections.size;
        };
        line.append(box, document.createTextNode(label));
        options.append(line, document.createElement("br"));
      }
      if (result.anyAnswered && !["open", "unanswered"].includes(result.defaultKey))
        offer("기본 별명 · " + result.defaultName, "defaultKey", result.defaultKey);
      const preferences = Object.fromEntries(result.axes.filter(axis =>
        axis.sides.some(side => side.count > 0)).map(axis => [axis.id, axis.sides.map(side => side.mean)]));
      if (Object.keys(preferences).length) offer("네 짝에서 내가 고른 점수", "preferences", preferences);
      for (const [id, label] of Object.entries(fields)) {
        const value = answers?.[id];
        const found = model.extras.find(item => item.id === id)?.options.find(item => item.id === value);
        if (found && !found.sensitive && !["unknown", "other"].includes(value)) offer(label + " · " + found.label, id, value);
      }
      const stories = typeof getStoryAnswers === "function" ? getStoryAnswers() : {};
      for (const [id, [label, allowed]] of Object.entries(storyOptions)) {
        const value = stories?.[id];
        if (id === "training") {
          const picked = allowed.filter(key => Array.isArray(value) && value.includes(key));
          if (picked.length) offer("이야기에서 고른 " + label, id, picked);
        } else if (allowed.includes(value)) offer("이야기에서 고른 " + label, id, value);
      }
      for (const key of selections) if (!Object.hasOwn(values, key)) selections.delete(key);
      send.disabled = !selections.size;
      if (!Object.keys(values).length) status.textContent = "저장할 답이 아직 없어요.";
    }
    details.ontoggle = () => { if (details.open) refresh(); };
    form.onsubmit = event => {
      event.preventDefault();
      if (!selections.size) return;
      const previouslySelected = selections.size;
      refresh();
      if (selections.size !== previouslySelected) {
        status.textContent = "이야기에서 바꾼 답이 있어요. 저장할 항목을 다시 확인해 주세요.";
        return;
      }
      if (!globalThis.BroadcastChannel || !crypto.randomUUID) {
        status.textContent = "이 브라우저에서는 계정 연결이 어려워요. 최신 브라우저에서 다시 열어 주세요.";
        return;
      }
      const transfer = crypto.randomUUID();
      const data = {version: model.version, source: "self-report", answeredAt};
      for (const key of selections) if (Object.hasOwn(values, key)) data[key] = values[key];
      const channel = new BroadcastChannel("run-bti-profile/" + transfer);
      const close = () => { channel.close(); clearTimeout(timer); window.removeEventListener("pagehide", close); };
      const timer = setTimeout(close, 5 * 60 * 1000);
      window.addEventListener("pagehide", close, {once: true});
      channel.onmessage = ({data: message}) => {
        if (message === "ready") channel.postMessage({type: "preview", data});
        if (message === "saved") { status.textContent = "선택한 항목을 내 프로필에 저장했어요."; close(); }
      };
      const url = new URL("../", location.href);
      url.searchParams.set("run-bti-profile", transfer);
      window.open(url.href, "_blank", "noopener,noreferrer");
      status.textContent = "새 창에서 저장할 내용을 확인해 주세요. 확인할 때까지 이 창을 열어 두세요.";
    };
    form.append(options, send, status);
    details.append(summary, form);
    host.append(title, details);
  }
  window.RBPairsProfile = {mount};
})();
