"use strict";
(function app() {
  "use strict";
  const { packs, score, answerOptions } = window.RB,
    scene = window.RBScene;
  const main = document.querySelector("#main"),
    modal = document.querySelector("#modal");
  const ids = ["base", "buddy", "record"],
    offsets = { base: 0, buddy: 9, record: 15 },
    ranges = { base: [0, 26], buddy: [27, 35], record: [36, 44] };
  const folderFile = location.protocol === "file:" && !window.RBAssets;
  const edition = new URLSearchParams(location.search).get("edition"),
    storageKey = "runbti.library.v2",
    draftKey = "runbti.draft.v2";
  const icons = {
    arrow: "M4 12h15m-6-6 6 6-6 6",
    left: "m14 5-7 7 7 7",
    book: "M3 5c4-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z M12 6v14",
    volume: "M4 9h4l5-4v14l-5-4H4z M16 9q3 3 0 6 M19 6q6 6 0 12",
    mute: "M4 9h4l5-4v14l-5-4H4z M17 9l5 6m0-6-5 6",
    shoe: "m4 10 3-4 4 5 5 3 5 1v4H3v-6z",
    star: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
    image: "M3 4h18v16H3z M3 17l6-6 5 5 3-3 4 4 M16 8h.1",
    download: "M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5",
    share:
      "M9 15l7-5m-7-1 7 5 M5 8a2 2 0 1 0 .1 0 M18 4a2 2 0 1 0 .1 0 M18 16a2 2 0 1 0 .1 0",
    check: "m4 12 5 5L20 6",
    play: "m7 4 13 8-13 8z",
    stop: "M6 6h12v12H6z",
  };
  const icon = (k) =>
    `<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${icons[k] || icons.star}"/></svg>`;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pad = (n) => String(n).padStart(2, "0"),
    asset = scene.assetURL;
  const thumb = (type, n, sub) =>
    asset(`art/${type}-${pad(n)}${sub === undefined ? "" : "-" + sub}.webp`);
  const btn = (action, label, cls = "light", ico = "") =>
    `<button type="button" data-act="${action}" class="btn ${cls}">${ico ? icon(ico) : ""}${esc(label)}</button>`;
  const packTitle = (id) => packs[id].title;
  let storeUnavailable = false;
  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      storeUnavailable = true;
      return false;
    }
  }
  function validRecord(r, id) {
    return (
      r &&
      ["experience", "imagine"].includes(r.mode) &&
      Array.isArray(r.answers) &&
      r.answers.length === packs[id].questions.length &&
      r.answers.every(
        (a) =>
          Array.isArray(a) &&
          a.length <= 2 &&
          a.every((i) => Number.isInteger(i) && i >= 0 && i < 3),
      )
    );
  }
  const stored = load(storageKey, {}),
    library = Object.fromEntries(
      ids
        .filter((id) => validRecord(stored?.[id], id))
        .map((id) => [id, stored[id]]),
    );
  let state = { view: "home" },
    timer,
    animationToken = 0,
    received = null,
    currentCanvas = null, cardObserver = null;
  function notify(s) {
    let t = document.querySelector("#toast");
    t.textContent = s;
    clearTimeout(timer);
    timer = setTimeout(() => (t.textContent = ""), 2600);
  }
  function output(html, view) {
    animationToken++;
    cardObserver?.disconnect();
    cardObserver = null;
    document.body.classList.remove("has-card-return");
    currentCanvas = null;
    if (["stories","profile"].includes(state.view) && !["stories","profile"].includes(view)) storyUI.clearRoute();
    state.view = view;
    main.innerHTML = html;
    const marker = history.state?.rbTestReturn;
    if (marker && marker.pack !== main.querySelector("[data-story-result]")?.dataset.storyResult) {
      const entry = {...history.state};
      delete entry.rbTestReturn;
      try { history.replaceState(entry, ""); } catch {}
    }
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  function note(title, inner) {
    if (modal.open) modal.close();
    modal.className = "";
    modal.setAttribute("aria-labelledby", "dialog-title");
    modal.innerHTML = `<h2 id="dialog-title">${esc(title)}</h2>${inner}<div class="actions">${btn("modalclose", "닫기", "primary sm")}</div>`;
    modal.showModal();
  }
  const motiveUI = window.RBMotiveUI.create({ main, output, head, btn, esc, asset, load, save, notify,
    resultStories: record => storyUI.resultSection("motive", record),
    useLine(line, mode) {
      if (library.base) {
        library.base.custom ||= {};
        library.base.custom.line = line;
        save(storageKey, library);
        showResult("base");
      } else {
        start("base", mode, line);
      }
    },
  });
  const storyUI = window.RBStories.create({main, output, esc, asset, icon, load, save, notify, note,
    ownResults:() => ({...library, motive:motiveUI.savedResult()}), canReturnToResult, restoreResult:restoreStoryResult});
  function canReturnToResult(pack) {
    return pack === "library" || pack === "profile" || (pack === "motive" ? !!motiveUI.savedResult() : ids.includes(pack) && !!library[pack]);
  }
  function restoreStoryResult(origin) {
    if (!origin || !canReturnToResult(origin.pack)) return false;
    if (origin.pack === "profile") storyUI.openProfile();
    else if (origin.pack === "library") libraryPage();
    else if (origin.pack === "motive") motiveUI.showResult();
    else showResult(origin.pack, false, origin.ratio === "9:16" ? "9:16" : "4:5");
    const links = main.querySelectorAll("[data-story-result] [data-story-act]");
    const link = [...links].find(el => el.dataset.storyAct === origin.action && (el.dataset.storyId || null) === origin.story);
    link?.focus({preventScroll:true});
    window.scrollTo(0, origin.scroll || 0);
    return true;
  }
  function header() {
    document.querySelector("#mast").innerHTML =
      `<div class="shell mast"><button class="brand" data-act="home" aria-label="런비티아이 홈"><span class="brand-art" aria-hidden="true"><i></i><i></i><i></i></span>런비티아이<em>RUN-BTI</em></button><nav class="nav" aria-label="메뉴"><button class="toolbtn nav-home" data-act="home">테스트</button><button class="toolbtn" data-act="library">${icon("book")} 내 보관함</button><button class="toolbtn icononly ${scene.audio.enabled() ? "sound-on" : ""}" aria-label="${scene.audio.enabled() ? "소리 끄기" : "소리 켜기"}" title="${scene.audio.enabled() ? "소리 끄기" : "소리 켜기"}" aria-pressed="${scene.audio.enabled()}" data-act="sound">${icon(scene.audio.enabled() ? "volume" : "mute")}</button></nav></div>`;
    document.querySelector("#foot").innerHTML =
      `<div class="shell foot"><span>런비티아이 · 트레인오라클 × 애슬리트타임</span><div><button data-act="about">테스트 소개</button>${["train", "athlete"].includes(edition) ? ` · <a href="${edition === "train" ? "../?oracleV2=1" : "../"}">서비스로 돌아가기</a>` : ""}</div></div>`;
  }
  function packCard(id) {
    let p = packs[id],
      n = offsets[id],
      label = { base: "기본 검사", buddy: "동행", record: "기록" }[id];
    return `<button class="p-card" data-act="pick" data-id="${id}"><div class="p-img"><img src="${thumb("q", n)}" alt="" loading="lazy"><span class="label">${label} · ${p.questions.length}문항</span></div><div class="p-copy"><h3>${esc(p.title)}</h3><p>${esc(p.subtitle)}</p></div></button>`;
  }
  const cameos = [
    {
      id: 11,
      label: "끈을 한 번 더 묶는 러너",
      text: "신발 끈을 고쳐 묶으며 오늘 어디까지 뛸지 정해요.",
    },
    {
      id: 18,
      label: "먼저 와서 손 흔드는 러너",
      text: "약속 장소에 먼저 와서 친구가 보이면 손부터 흔들어요.",
    },
    {
      id: 0,
      label: "샛길이 궁금한 러너",
      text: "늘 뛰던 길에서도 낯선 골목을 만나면 안쪽을 슬쩍 들여다봐요.",
    },
  ];
  function cameosButton() {
    return (
      '<button class="cameos" data-act="cameos" aria-label="러닝 캐릭터 세 명 미리 보기"><span class="cameo-faces">' +
      cameos
        .map((c) => '<img src="' + thumb("portrait", c.id) + '" alt="">')
        .join("") +
      "</span><span>캐릭터 미리보기</span>" +
      icon("arrow") +
      "</button>"
    );
  }
  function home() {
    scene.audio.stop();
    output(
      `<section class="hero"><div class="hero-copy"><span class="eyebrow">러닝 성향 테스트</span><h1>달릴 때의 나는<br> <em>어떤 사람일까?</em></h1><p>달릴 때 뭘 보고 집에 와서 뭘 기억하나요? 내가 고른 장면으로 러닝 캐릭터를 만들거나 달리는 이유부터 알아볼 수 있어요.</p><div class="actions">${btn("start-exp", "뛰어 본 날 떠올리기", "primary", "arrow")}${btn("start-img", "첫 러닝 상상하기", "light")}${btn("motives", "나는 왜 달릴까?", "light")}</div></div><div class="hero-art"><img src="${asset("hero-run.webp")}" fetchpriority="high" alt="한강에서 손목시계를 든 러너가 손을 흔드는 친구를 돌아보는 장면">${cameosButton()}</div></section>${draftPanel()}${storyUI.homeFeature()}<section><div class="sectionhead"><h2>러닝 테스트 고르기</h2><small>궁금한 주제부터 해 보세요.</small></div><div class="packs">${motiveUI.packCard()}${ids.map(packCard).join("")}</div></section>`,
      "home",
    );
  }
  function getDraft() {
    let v = load(draftKey, null);
    return v &&
      ids.includes(v.id) &&
      validRecord(v, v.id) &&
      Number.isInteger(v.index) &&
      v.index >= 0 &&
      v.index < packs[v.id].questions.length
      ? v
      : null;
  }
  function draftPanel() {
    let d = getDraft();
    return d
      ? `<div class="panel sectionhead"><div><strong>${esc(packTitle(d.id))}</strong><p class="hint">${d.index + 1}번째 장면에서 이어갈 수 있어요.</p></div>${btn("resume", "이어서 하기", "light sm")}</div>`
      : "";
  }
  function pick(id) {
    if (!ids.includes(id)) return;
    note(
      packTitle(id),
      `<p>${esc(packs[id].subtitle)}</p><div class="actions"><button class="btn primary" data-act="begin" data-id="${id}" data-mode="experience">뛰어 본 날 떠올리기</button><button class="btn light" data-act="begin" data-id="${id}" data-mode="imagine">첫 러닝 상상하기</button></div>`,
    );
  }
  function start(id, mode, cardLine = "") {
    if (modal.open) modal.close();
    let old = getDraft();
    if (old && (old.id !== id || old.mode !== mode)) {
      note(
        "진행 중인 검사가 있어요",
        `<p>${esc(packTitle(old.id))}의 ${old.index + 1}번째 장면이 남아 있어요.</p><div class="actions">${btn("resume", "이어서 하기", "primary")}<button class="btn light" data-act="replace" data-id="${id}" data-mode="${mode}" data-line="${esc(cardLine)}">새 검사 시작</button></div>`,
      );
      return;
    }
    if (old) {
      state = { ...old };
      if (cardLine) { state.cardLine = cardLine; saveDraft(); }
      question();
      return;
    }
    fresh(id, mode, cardLine);
  }
  function fresh(id, mode, cardLine = "") {
    state = {
      id,
      mode,
      index: 0,
      answers: packs[id].questions.map(() => []),
      blankReasons: [], cardLine, chatScenes: id === "buddy",
    };
    saveDraft();
    question();
  }
  function saveDraft() {
    save(draftKey, {
      id: state.id,
      mode: state.mode,
      index: state.index,
      answers: state.answers,
      blankReasons: state.blankReasons, cardLine: state.cardLine, chatScenes: state.chatScenes,
    });
  }
  function promptFor(q, mode, chatScenes) {
    const text = chatScenes && q.chat ? q.chat : q;
    return mode === "imagine" ? text.imagine : text.prompt;
  }
  function outgoingBubbles(chat, selected) {
    if (!selected.length) return "";
    const replies = selected.map(i => {
      const photo = chat.photo?.choice === i
        ? `<button type="button" class="chat-attachment" data-act="chat-photo" aria-haspopup="dialog"><img src="${asset(chat.photo.src)}" alt=""><span>${esc(chat.photo.title)} 크게 보기</span></button>`
        : "";
      return `<p class="chat-bubble">${photo}${esc(chat.replies[i])}</p>`;
    });
    return `<small class="chat-speaker">내가 고른 답장</small>${replies.join("")}`;
  }
  function questionChoices(q, mode, n, selected, chatScenes) {
    const chat = chatScenes && q.chat;
    const labels = chat ? chat.choices : answerOptions(q, mode, chatScenes);
    const buttons = labels.map((text, i) => {
      const pressed = selected.includes(i);
      return `<button type="button" class="opt" data-act="opt" data-i="${i}" aria-pressed="${pressed}"><img src="${thumb("o", n, i)}" alt=""><span>${esc(text)}</span><b aria-hidden="true">${pressed ? "✓" : ""}</b></button>`;
    }).join("");
    if (!chat) return `<p class="guide">내 얘기 같은 답을 골라 주세요. 두 개까지 골라도 돼요.</p><div class="options">${buttons}</div>`;
    return `<section class="chat-scene" aria-label="가상의 친구 대화">
      <div class="chat-incoming"><small class="chat-speaker">친구 · ${esc(chat.when)}</small><p class="chat-bubble">${esc(chat.incoming)}</p></div>
      <div class="chat-composer"><p class="guide" id="reply-guide">답장을 골라 보세요. 두 개까지 골라도 돼요.</p><div class="chat-choices" role="group" aria-labelledby="reply-guide">${buttons}</div></div>
      <div class="chat-outgoing" aria-live="polite" aria-atomic="true">${outgoingBubbles(chat, selected)}</div>
    </section>`;
  }
  function question() {
    const { id, mode, index, answers } = state,
      p = packs[id],
      q = p.questions[index],
      n = offsets[id] + index,
      a = answers[index],
      last = index === p.questions.length - 1;
    output(
      `<div class="narrow"><div class="head"><button class="back" data-act="home">${icon("left")} 테스트 홈</button></div><section class="question"><div class="qhead"><span>${esc(packTitle(id))}</span><small>${index + 1} / ${p.questions.length}</small></div><div class="progress" role="progressbar" aria-label="검사 진행" aria-valuemin="1" aria-valuemax="${p.questions.length}" aria-valuenow="${index + 1}"><i style="width:${(100 * (index + 1)) / p.questions.length}%"></i></div><div class="qscene"><img src="${thumb("q", n)}" alt=""><span>${esc(q.scene)}</span></div><h1>${esc(promptFor(q, mode, state.chatScenes))}</h1>
      ${questionChoices(q, mode, n, a, state.chatScenes)}
      <div class="qbar">${btn("prev", "이전", "light sm", "left")}<div class="actions"><button class="linkbtn" data-act="unsure">아직 모르겠어</button><button class="btn primary" data-act="next" ${a.length ? "" : "disabled"}>${last ? "내 결과 보기" : "다음"} ${icon("arrow")}</button></div></div><div class="question-omit"><button data-act="na">나한텐 해당 없어</button><details><summary>건너뛰기</summary><button data-act="pass">이 질문만 건너뛰기</button>${p.questions[index + 1]?.domain === q.domain ? `<button data-act="na-group">‘${esc(p.domains[q.domain].title)}’ 남은 질문은 해당 없어</button>` : ""}</details></div></section></div>`,
      "quiz",
    );
    if (!last) {
      const image = new Image();
      image.src = thumb("q", n + 1);
    }
    playQuestionAmbience(q.scene);
  }
  function playQuestionAmbience(place) {
    const sound = { "강변의 첫 5분": "river", "잠깐 멈춤": "street" }[place];
    if (sound) scene.audio.ambient(sound);
    else scene.audio.stop();
  }
  function toggleOpt(i) {
    let a = state.answers[state.index];
    if (a.includes(i)) a.splice(a.indexOf(i), 1);
    else if (a.length < 2) a.push(i);
    else {
      return notify("두 개까지 고를 수 있어요. 답을 바꾸려면 고른 것 중 하나를 다시 눌러 주세요.");
    }
    if (a.length && state.blankReasons) state.blankReasons[state.index] = null;
    saveDraft();
    main.querySelectorAll(".opt").forEach((el, j) => {
      el.setAttribute("aria-pressed", a.includes(j));
      el.querySelector("b").textContent = a.includes(j) ? "✓" : "";
    });
    main.querySelector("[data-act=next]").disabled = !a.length;
    const outgoing = main.querySelector(".chat-outgoing");
    if (outgoing) outgoing.innerHTML = outgoingBubbles(packs[state.id].questions[state.index].chat, a);
    scene.audio.effect("tap");
  }
  function advance(reason) {
    state.blankReasons ||= [];
    state.blankReasons[state.index] = reason || null;
    if (reason) state.answers[state.index] = [];
    nextOrFinish();
  }
  function omitTopic() {
    const {id, index} = state, qs = packs[id].questions;
    let end = index;
    while (end + 1 < qs.length && qs[end + 1].domain === qs[index].domain) end++;
    state.blankReasons ||= [];
    for (let k = index; k <= end; k++) {
      if (!state.answers[k].length && !state.blankReasons[k]) state.blankReasons[k] = "na";
    }
    state.index = end;
    nextOrFinish();
  }
  function nextOrFinish() {
    if (state.index + 1 < packs[state.id].questions.length) {
      state.index++;
      saveDraft();
      question();
      return;
    }
    const { id, mode, answers } = state;
    library[id] = {
      mode,
      answers: answers.map((a) => [...a]),
      blankReasons: state.blankReasons || [], chatScenes: state.chatScenes,
      custom: {},
      date: Date.now(),
    };
    if (id === "base" && typeof state.cardLine === "string" && state.cardLine) library[id].custom.line = state.cardLine.slice(0, 100);
    save(storageKey, library);
    save(draftKey, null);
    scene.audio.stop();
    showResult(id, true);
    if (storeUnavailable)
      notify(
        "지금은 보관함에 저장할 수 없어요. 결과를 간직하려면 카드를 이미지로 저장해 주세요.",
      );
  }
  function head(title, kicker = "") {
    return `<div class="head"><button class="back" data-act="home">${icon("left")} 테스트 홈</button>${kicker ? `<p class="eyebrow">${esc(kicker)}</p>` : ""}<h1>${esc(title)}</h1></div>`;
  }
  function libraryPage() {
    scene.audio.stop();
    let owned = ids.filter((id) => library[id]);
    output(
      `${head("내 캐릭터 보관함")}<p class="desc">이 브라우저에서 받은 러닝 캐릭터를 모았어요.</p>${storyUI.resultSection("library")}${storyUI.savedEntry()}${motiveUI.libraryEntry()}${
        owned.length
          ? `<div class="gallery" style="margin-top:18px">${owned
              .map((id) => {
                let m = model(id);
                return `<button class="p-card" data-act="result" data-id="${id}"><div class="p-img"><img src="${resultThumb(m)}" alt=""></div><div class="p-copy"><h3>${esc(m.name)}</h3><p>${esc(packTitle(id))}</p></div></button>`;
              })
              .join("")}</div>`
          : `<div class="empty"><h2>아직 받은 캐릭터가 없어요.</h2><p>테스트를 마치면 여기에 내 캐릭터가 생겨요.</p>${btn("start-exp", "첫 검사 시작", "primary")}</div>`
      }<div style="margin-top:28px" class="packs">${ids
        .filter((id) => !library[id])
        .map(packCard)
        .join("")}</div>${draftPanel()}`,
      "library",
    );
  }
  function sourceResult(id = state.id) {
    let r = library[id];
    return score(id, r.answers, r.mode, r.chatScenes);
  }
  function optionArt(id, choice) {
    return "art/o-" + pad(offsets[id] + choice.q) + "-" + choice.i + ".webp";
  }
  function resultScenes(v, id) {
    return v.evidence.filter(e => packs[id].questions[e.q].domain === v.focusDomain).map(e => ({
      ...e, key: e.q * 3 + e.i, art: optionArt(id, e),
      label: packs[id].questions[e.q].scene,
      topic: packs[id].domains[v.focusDomain].labels[e.i],
    }));
  }
  function usesCharacter(custom) {
    // Keep cards styled in the earlier editor when reopening a saved result.
    return custom.cardStyle ? custom.cardStyle === "character"
      : ["pose", "background", "charIndex", "prop", "expression", "frame"].some(k => custom[k] !== undefined);
  }
  function model(id = state.id) {
    const r = library[id], v = sourceResult(id), c = r.custom || {};
    const pictures = resultScenes(v, id);
    const picture = !usesCharacter(c) && (pictures.find(e => e.key === c.sceneChoice) || pictures[0]);
    const answers = r.answers.flatMap((indices, q) => indices.map(i => ({ q, i, text: proofText(id, q, i) })));
    const selected = answers.find(e => e.q * 3 + e.i === c.clue) || v.evidence[0];
    const action = !picture && v.kind === "clear" ? answers.find(e => e.q * 3 + e.i === c.actionChoice)
      || v.evidence.find(e => packs[id].questions[e.q].domain === 1) : null;
    const [a, b] = v.digest;
    const background = id === "base" ? [1, 5, 4][b] : id === "buddy" ? [2, 0, 3][b] : [6, 4, 11][a];
    return {
      charIndex: c.charIndex ?? (v.kind === "open" ? -1 : v.characterIndex),
      name: v.name, line: c.line ?? v.line,
      pose: c.pose ?? (v.kind === "clear" && v.characterIndex === 9 ? 0 : 2),
      prop: c.prop ?? -1, expression: c.expression ?? -1,
      background: c.background ?? background ?? 3, frame: c.frame ?? 0,
      sceneArt: picture?.art || "", sceneLabel: picture?.label || "",
      actionArt: action ? optionArt(id, action) : "",
      actionLabel: action ? window.RB.actionCaptions[offsets[id] + action.q][action.i] : "",
      evidence: selected?.text || "", evidenceArt: selected ? optionArt(id, selected) : "",
      includeEvidence: !!c.includeEvidence, mode: r.mode, pack: id,
    };
  }
  function resultThumb(m) {
    if (m.sceneArt) return asset(m.sceneArt);
    return m.charIndex >= 0 ? thumb("portrait", m.charIndex) : thumb("q", offsets[m.pack]);
  }
  function picturePicker(id, v, m) {
    if (!m.sceneArt) return "";
    const pictures = resultScenes(v, id);
    const selected = pictures.find(e => e.art === m.sceneArt);
    if (pictures.length === 1) return `<p class="scene-caption">내가 고른 답 · ${esc(selected.text)}</p>`;
    const n = v.counts[v.focusDomain][selected.i];
    const count = ["", "한", "두", "세"][n] || String(n);
    return `<section class="picture-picker" aria-labelledby="picture-title">
      <h2 id="picture-title">카드에 담을 장면</h2>
      <p>${pictures.length === 2 ? "두" : "세"} 가지 답을 ${count} 번씩 골랐어요. 남기고 싶은 장면을 눌러 보세요.</p>
      <div class="picture-choices">${pictures.map(e => `<button type="button" data-act="pick-scene" data-choice="${e.key}" aria-pressed="${e.art === m.sceneArt}" aria-label="${esc(e.topic + ' 장면 선택')}"><img src="${asset(e.art)}" alt=""><span>${esc(e.topic)}</span></button>`).join("")}</div>
      <p class="scene-caption" aria-live="polite">내가 고른 답 · <span>${esc(selected.text)}</span></p>
    </section>`;
  }
  function trialThumb(id, result) {
    const choice = resultScenes(result, id)[0];
    if (choice) return asset(choice.art);
    return result.kind === "open" ? thumb("q", offsets[id]) : thumb("portrait", result.characterIndex);
  }
  function proofText(id, q, i) {
    let r = library[id];
    return answerOptions(packs[id].questions[q], r.mode, r.chatScenes)[i];
  }
  function proof(v, p, d) {
    return v.evidence.find((e) => p.questions[e.q].domain === d);
  }
  function showResult(id, animate = false, ratio = "4:5") {
    if (!library[id]) return pick(id);
    state = { id, view: "result", ratio };
    let p = packs[id],
      r = library[id],
      v = sourceResult(),
      m = model();
    output(
      `${head(m.name, r.mode === "imagine" ? "내가 그려 본 첫 러닝" : "내가 달릴 때의 모습")}<div class="results"><section>${picturePicker(id, v, m)}<div class="scene-wrap"><canvas id="scene" width="1080" height="1350" role="img" aria-label="${esc(m.name + " · " + m.line)}"></canvas></div>${m.sceneArt || m.charIndex < 0 || matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : '<div class="scene-actions"><button data-act="replay">캐릭터 등장 장면 다시 보기</button><button data-act="skipmotion" hidden>마지막 장면 보기</button></div>'}<div class="actions">${btn("capture", "캡처 화면", "primary", "image")}${btn("download", "이미지 저장", "light", "download")}${btn("share", "친구에게", "light", "share")}</div><div class="work-actions">${["4:5", "9:16"].map((s, i) => `<button class="btn sm light ${s === ratio ? "active-ratio" : ""}" data-act="ratio" data-r="${s}" aria-pressed="${s === ratio}">${s} ${i ? "스토리" : "피드"}</button>`).join("")}</div></section><section class="stack">${motiveUI.fromResult()}${v.kind === "open" ? openPicker(id) : ""}<div class="panel"><h2>한눈에 보는 내 러닝</h2><div class="summary-grid">${p.domains
        .map((d, j) => {
          let e = proof(v, p, j);
          return `<div class="stat">${e ? `<img src="${thumb("o", offsets[id] + e.q, e.i)}" alt="">` : ""}<small>${esc(d.title)}</small><b>${esc(v.leaders[j].map((i) => d.labels[i]).join(" · ") || "아직 고른 답 없음")}</b>${e ? `<p>“${esc(e.text)}”</p>` : ""}</div>`;
        })
        .join(
          "",
        )}</div><p class="ev">${esc(v.line)}</p></div>${storyUI.resultSection(id, r)}${panel("내 선택 그래프", graph(id, v))}${panel("장면 다시 보기", timeline(id))}${panel("그때 다르게 골랐다면?", sandbox(id))}${panel("내 장면 꾸미기", editor(id, m), "edit-panel")}${received?.pack === id ? panel("친구와 나란히 보기", compare(id, received), "friend-panel", true) : ""}</section></div><section style="margin-top:32px"><div class="sectionhead"><h2>다른 러닝 테스트</h2></div><div class="packs">${ids
        .filter((k) => k !== id)
        .map(packCard)
        .join(
          "",
        )}</div><div class="work-actions">${btn("library", "내 보관함", "light sm", "book")}<button class="btn light sm" data-act="pick" data-id="${id}">다시 검사하기</button></div></section>`,
      "result",
    );
    renderScene(animate);
    if (m.charIndex >= 0) attachCardReturn(id);
    if (v.kind === "open") main.querySelector(".open-picker")?.focus();
  }
  function attachCardReturn(id) {
    if (!window.IntersectionObserver) return;
    const poster = main.querySelector("#scene"), m = model(id);
    const dock = document.createElement("button");
    dock.className = "card-return";
    dock.dataset.act = "return-card";
    dock.hidden = true;
    dock.innerHTML = `<img src="${resultThumb(m)}" alt=""><span>${esc(m.name)}</span><strong>내 카드 보기 ↑</strong>`;
    main.append(dock);
    cardObserver = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
      dock.hidden = !show;
      document.body.classList.toggle("has-card-return", show);
    });
    cardObserver.observe(poster);
  }
  function panel(title, html, id = "", open = false) {
    return `<details class="panel" ${id ? `id="${id}"` : ""} ${open ? "open" : ""}><summary>${esc(title)}</summary>${html}</details>`;
  }
  function openPicker(id) {
    return `<div class="panel open-picker" tabindex="-1"><h2>첫 장면을 직접 골라요</h2><p class="guide">이번엔 고른 답이 없어요. 마음에 드는 그림을 직접 고르거나 달리는 이유부터 살펴볼 수 있어요.</p>${btn("motives", "나는 왜 달릴까?", "light sm")}<div class="roster">${[0, 1, 2].map((i) => `<button data-act="openpick" data-i="${i}"><img src="${thumb("runner", ranges[id][0] + (id === "base" ? 9 : 3) * i, 0)}" width="60" height="60" alt="">${esc(packs[id].domains[0].labels[i])}</button>`).join("")}</div></div>`;
  }
  function graph(id, v) {
    let p = packs[id];
    return `<p class="hint">답한 질문에서 몇 번 골랐는지 보여 줘요. 한 질문에서 두 개를 고르면 양쪽에 한 번씩 들어가요.</p>${p.domains
      .map((d, j) => {
        let indices = p.questions
            .map((q, k) => (q.domain === j ? k : -1))
            .filter((k) => k >= 0),
          s = indices.filter(k => library[id].answers[k].length > 0).length;
        return `<h3 style="margin-top:14px">${esc(d.title)}</h3>${d.labels.map((l, i) => `<button data-act="graph" data-domain="${j}" data-i="${i}" class="graph-row" ${v.counts[j][i] ? "" : "disabled"}><span>${esc(l)}</span><span class="dots">${Array.from({ length: s }, (_, k) => `<i class="${k < v.counts[j][i] ? "on" : ""}"></i>`).join("")}　${s ? v.counts[j][i] + "/" + s : "응답 없음"}</span></button>`).join("")}<small class="muted">${["na", "unsure", "pass"].map(key => {
          const n = indices.filter(k => !library[id].answers[k].length && (library[id].blankReasons?.[k] || "unsure") === key).length;
          return n ? {na:"해당 없음", unsure:"아직 모름", pass:"건너뜀"}[key] + " " + n + "장면" : "";
        }).filter(Boolean).join(" · ")}</small>`;
      })
      .join("")}`;
  }
  function timeline(id) {
    return `<div class="timeline">${packs[id].questions.map((q, i) => `<button data-act="timeline" data-i="${i}"><img src="${thumb("q", offsets[id] + i)}" loading="lazy" alt=""><span>${esc(q.scene)}</span></button>`).join("")}</div>`;
  }
  function sandbox(id) {
    return `<label class="field">바꿔 볼 장면<select id="trial-q">${packs[id].questions.map((q, i) => `<option value="${i}">${i + 1}. ${esc(q.scene)}</option>`).join("")}</select></label><div id="trial-choices">${trialChoices(id, 0)}</div><div id="trial-out" aria-live="polite"></div>`;
  }
  function trialChoices(id, i) {
    return `<div class="work-actions">${answerOptions(
      packs[id].questions[i],
      library[id].mode, library[id].chatScenes,
    )
      .map(
        (s, j) =>
          `<button class="btn light sm" data-act="trial" data-i="${j}">${esc(s)}</button>`,
      )
      .join("")}</div>`;
  }
  const labels = {
    pose: ["대표 자세", "움직이는 순간", "마지막 포즈"],
    background: [
      "해 뜨는 둔치",
      "강변 다리",
      "동네 골목",
      "초록 공원",
      "비 갠 거리",
      "저녁 노을",
      "트랙",
      "편의점 앞",
      "숲길",
      "도시 광장",
      "나무 그늘",
      "밤 산책길",
    ],
    frame: [
      "기본",
      "엽서",
      "사진첩",
      "배번표",
      "필름",
      "공책",
      "우표",
      "운동장",
      "저녁 편지",
    ],
  };
  function selectField(key, title, count, value) {
    let ls = scene.labels?.[key] || labels[key];
    const none = ["prop", "expression"].includes(key) ? `<option value="-1"${value === -1 ? " selected" : ""}>없음</option>` : "";
    return `<label>${title}<select data-edit="${key}">${none}${Array.from({ length: count }, (_, i) => `<option value="${i}"${value === i ? " selected" : ""}>${esc(ls?.[i] || title + " " + (i + 1))}</option>`).join("")}</select></label>`;
  }
  function editor(id, m) {
    const choices = library[id].answers.flatMap((indices, q) =>
      indices.map((i) => ({ value: q * 3 + i, text: proofText(id, q, i) })),
    );
    const clueSelect = choices.length
      ? `<label class="field wide" id="clue-field"${m.includeEvidence ? "" : " hidden"}>함께 보낼 답<select data-edit="clue">` +
        choices
          .map(
            (e) =>
              '<option value="' +
              e.value +
              '"' +
              (e.text === m.evidence ? " selected" : "") +
              ">" +
              esc(e.text) +
              "</option>",
          )
          .join("") +
        "</select></label>"
      : "";
    const v = sourceResult(id);
    const actionField = m.actionArt ? `<label class="field wide">캐릭터 옆에 남길 행동<select data-edit="actionChoice">${choices.map(e => {
      const q = Math.floor(e.value / 3), i = e.value % 3;
      return `<option value="${e.value}"${m.actionArt === optionArt(id, {q,i}) ? " selected" : ""}>${esc(window.RB.actionCaptions[offsets[id] + q][i])}</option>`;
    }).join("")}</select></label>` : "";
    const style = v.focusDomain == null ? "" : `<label class="field wide">카드 그림<select data-edit="cardStyle"><option value="scene"${m.sceneArt ? " selected" : ""}>내가 고른 장면</option><option value="character"${m.sceneArt ? "" : " selected"}>캐릭터로 꾸미기</option></select></label>`;
    const characterFields = m.sceneArt ? "" : [
      selectField("pose", "포즈", 3, m.pose), selectField("expression", "표정 스티커", 18, m.expression),
      selectField("prop", "소품", id === "base" ? 36 : 48, m.prop),
      selectField("background", "배경", 12, m.background), selectField("frame", "프레임", 9, m.frame),
    ].join("");
    return `<div class="controls">${style}${actionField}${characterFields}<label class="field wide">내 대사<textarea rows="2" maxlength="100" data-edit="line">${esc(m.line)}</textarea></label><label class="check wide"><input type="checkbox" data-edit="includeEvidence" ${m.includeEvidence ? "checked" : ""}>공유 카드에 내가 고른 답도 적기</label>${clueSelect}</div><div class="work-actions">${btn("reset", "처음 나온 모습으로 되돌리기", "light sm")}</div>`;
  }
  function changeCustom(changes) {
    Object.assign(library[state.id].custom ||= {}, changes);
    save(storageKey, library);
    renderScene(false);
  }
  function renderScene(motion) {
    const canvas = document.querySelector("#scene");
    if (!canvas) return;
    currentCanvas = canvas;
    let m = model();
    const dockArt = main.querySelector(".card-return img");
    if (dockArt) dockArt.src = resultThumb(m);
    canvas.setAttribute("aria-label", m.name + " · " + m.line);
    canvas.style.aspectRatio = state.ratio === "9:16" ? "9/16" : "4/5";
    const token = ++animationToken;
    const replay = main.querySelector('[data-act="replay"]');
    const skip = main.querySelector('[data-act="skipmotion"]');
    function playing(on) {
      if (replay) replay.hidden = on;
      if (skip) skip.hidden = !on;
    }
    playing(Boolean(motion && replay));
    const paint = motion && replay ? scene.motion : scene.draw;
    paint(canvas, m, state.ratio).catch(() => {
      if (token === animationToken) notify("그림을 불러오지 못했어요. 페이지를 새로 열어 주세요.");
    }).finally(() => {
      if (token === animationToken) playing(false);
    });
  }
  function showAnswer(q) {
    let id = state.id,
      pack = packs[id],
      r = library[id];
    note(
      pack.questions[q].scene,
      `<p>${esc(promptFor(pack.questions[q], r.mode, r.chatScenes))}</p><p><strong>${esc(r.answers[q].map((i) => proofText(id, q, i)).join(" / ") || ({na:"나한텐 해당 없어",pass:"건너뛴 장면"}[r.blankReasons?.[q]] || "아직 모르겠어"))}</strong></p>`,
    );
  }
  function compare(id, c) {
    let v = sourceResult(id),
      p = packs[id];
    const mine = model(id);
    const portraits =
      '<div class="compare-portraits">' +
      [mine, c]
        .map(
          (m, j) =>
            '<figure><img src="' +
            resultThumb(m) +
            '" alt=""><figcaption>' +
            esc((j ? "친구 · " : "나 · ") + m.name) +
            "</figcaption></figure>",
        )
        .join("") +
      "</div>";
    if (!c.leaders)
      return `${portraits}<p>친구가 카드를 보낼 때 비교 항목은 뺐어요. 두 사람의 대사를 읽어 보세요.</p><p>나 · ${esc(mine.line)}</p><p>친구 · ${esc(c.line)}</p>`;
    let same = null,
      diff = null;
    for (let j = 0; j < 3; j++) {
      let a = v.leaders[j],
        b = c.leaders[j];
      if (!a.length || !b.length) continue;
      let shared = a.find((k) => b.includes(k));
      if (shared !== undefined && !same)
        same = `두 사람 모두 ‘${p.domains[j].title}’에서 ‘${p.domains[j].labels[shared]}’ 쪽을 골랐어요.`;
      let aa = a.find((k) => !b.includes(k)),
        bb = b.find((k) => !a.includes(k));
      if (!diff && (aa !== undefined || bb !== undefined))
        diff = `‘${p.domains[j].title}’에서 나는 ‘${a.map((k) => p.domains[j].labels[k]).join("·")}’ 쪽을, 친구는 ‘${b.map((k) => p.domains[j].labels[k]).join("·")}’ 쪽을 골랐어요.`;
    }
    return `<div class="compare">${portraits}<strong>${esc(v.name)} × ${esc(c.name)}</strong><p>${esc(same || "지금 비교할 수 있는 답 중에는 겹치는 게 없어요.")}</p><p>${esc(diff || "지금 비교할 수 있는 답 중에는 다른 게 없어요.")}</p><p>${esc({ base: "다음에 같이 뛰면 어디서 잠깐 쉬어 갈까?", buddy: "우리 같이 뛴다면 뭘 먼저 정할까?", record: "오늘 뛴 기록 중에 나한테 하나만 보여 준다면 뭐야?" }[id])}</p></div>`;
  }
  function shareSheet() {
    let id = state.id,
      m = model();
    note(
      "친구에게 내 장면 보내기",
      `<p>${esc(m.name)} · ${esc(m.line)}</p><label class="check"><input id="allow-compare" type="checkbox" checked>친구와 비교할 수 있게 세 항목의 결과도 보내기</label><p class="share-note">지금 보이는 그림과 대사를 친구에게 보내요. 비교 항목은 따로 고를 수 있어요.</p><div class="actions">${location.protocol === "file:" ? "" : btn("sendlink", "카드 링크 보내기", "primary", "share")}${btn(folderFile ? "capture" : "shareimage", folderFile ? "캡처 화면 열기" : "이미지로 보내기", "light", "image")}</div>${folderFile ? '<p class="hint">여기서는 ‘캡처 화면 열기’를 누른 뒤 화면을 캡처해 주세요. 이미지 파일은 웹 버전이나 ‘런비티아이 체험판.html’에서 저장할 수 있어요.</p>' : location.protocol === "file:" ? '<p class="hint">여기서는 카드를 이미지로 보낼 수 있어요. 친구와 결과를 비교하려면 웹 버전에서 링크를 보내 주세요.</p>' : ""}<div id="manual-link"></div>`,
    );
  }
  function sharedCard() {
    let m = model(),
      id = state.id;
    return {
      ...m,
      v: 2,
      ratio: state.ratio === "9:16" ? "9:16" : "4:5",
      leaders: document.querySelector("#allow-compare")?.checked
        ? sourceResult().leaders
        : null,
      evidence: m.includeEvidence ? m.evidence : "",
      evidenceArt: m.includeEvidence ? m.evidenceArt : "",
      line: m.line.slice(0, 160),
    };
  }
  function cardUrl(card) {
    let u = new URL(location.href);
    u.hash = "card=" + encodeURIComponent(JSON.stringify(card));
    return u.href;
  }
  function decodeCard() {
    if (!location.hash.startsWith("#card=") || location.hash.length > 12000)
      return null;
    try {
      let c = JSON.parse(decodeURIComponent(location.hash.slice(6)));
      if (
        c.v !== 2 ||
        !ids.includes(c.pack) ||
        !["experience", "imagine"].includes(c.mode) ||
        typeof c.line !== "string" ||
        typeof c.name !== "string"
      )
        return null;
      const validInt = (k, min, max) =>
        Number.isInteger(c[k]) && c[k] >= min && c[k] <= max;
      if (
        (c.charIndex !== -1 && !validInt("charIndex", ...ranges[c.pack])) ||
        !validInt("pose", 0, 2) ||
        !validInt("frame", 0, 8) ||
        !validInt("expression", -1, 17) ||
        !validInt("prop", -1, 47) ||
        !validInt("background", 0, 11)
      )
        return null;
      const sceneMatch = typeof c.sceneArt === "string" && /^art\/o-(\d{2})-[0-2]\.webp$/.exec(c.sceneArt);
      const sceneNumber = sceneMatch ? Number(sceneMatch[1]) : -1;
      const sharedSceneArt = sceneNumber >= offsets[c.pack] && sceneNumber < offsets[c.pack] + packs[c.pack].questions.length ? c.sceneArt : "";
      const actionMatch = typeof c.actionArt === "string" && /^art\/o-(\d{2})-([0-2])\.webp$/.exec(c.actionArt);
      const actionNumber = actionMatch ? Number(actionMatch[1]) : -1;
      const shareAction = !sharedSceneArt && actionNumber >= offsets[c.pack] && actionNumber < offsets[c.pack] + packs[c.pack].questions.length;
      const leaders =
        Array.isArray(c.leaders) &&
        c.leaders.length === 3 &&
        c.leaders.every(
          (a) =>
            Array.isArray(a) &&
            a.length <= 3 &&
            a.every((i) => Number.isInteger(i) && i >= 0 && i <= 2),
        )
          ? c.leaders
          : null;
      return {
        pack: c.pack,
        mode: c.mode,
        ratio: c.ratio === "9:16" ? "9:16" : "4:5",
        charIndex: c.charIndex,
        pose: c.pose,
        frame: c.frame,
        actionArt: shareAction ? c.actionArt : "",
        actionLabel: shareAction ? window.RB.actionCaptions[actionNumber][Number(actionMatch[2])] : "",
        sceneArt: sharedSceneArt,
        sceneLabel: sharedSceneArt ? packs[c.pack].questions[sceneNumber - offsets[c.pack]].scene : "",
        expression: c.expression,
        prop: c.prop,
        background: c.background,
        line: c.line.slice(0, 160),
        name: c.name.slice(0, 60),
        includeEvidence: c.includeEvidence === true,
        evidence:
          c.includeEvidence === true
            ? String(c.evidence || "").slice(0, 140)
            : "",
        evidenceArt:
          c.includeEvidence === true &&
          /^art\/o-(?:0[0-9]|1[0-9]|20)-[0-2]\.webp$/.test(c.evidenceArt)
            ? c.evidenceArt
            : "",
        leaders,
      };
    } catch {
      return null;
    }
  }
  function friendPage(c) {
    received = c;
    state = { id: c.pack };
    output(
      `${head(c.name, "친구가 보낸 러닝 장면")}<div class="results"><div class="scene-wrap"><canvas id="friend-scene" width="1080" height="1350" role="img" aria-label="${esc(c.line)}"></canvas></div><div class="stack"><div class="panel"><h2>친구의 한 줄</h2><p>${esc(c.line)}</p>${c.includeEvidence ? `<p class="hint">${esc(c.evidence)}</p>` : ""}</div>${library[c.pack] ? `<div class="panel"><h2>우리 둘이 달리면</h2>${compare(c.pack, c)}</div>` : ""}<div class="actions"><button class="btn primary" data-act="${library[c.pack] ? "result" : "pick"}" data-id="${c.pack}">${library[c.pack] ? "내 결과도 보기" : "나도 해보기"}</button>${btn("home", "테스트 둘러보기", "light")}</div></div></div>`,
      "friend",
    );
    scene
      .draw(document.querySelector("#friend-scene"), c, c.ratio)
      .catch(() => notify("그림을 불러오지 못했어요."));
  }
  async function transfer(type) {
    let box = document.querySelector("#manual-link");
    try {
      if (type === "sendlink") {
        let url = cardUrl(sharedCard());
        if (navigator.share) {
          await navigator.share({ title: "내 런비티아이", url });
          return;
        }
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(url);
            notify("카드 링크를 복사했어요.");
            return;
          } catch {}
        }
        box.innerHTML = `<label class="field">복사할 카드 링크<input readonly value="${esc(url)}"></label>`;
        box.querySelector("input").select();
      } else {
        const blob = await scene.blob(model(), state.ratio),
          f = new File([blob], "런비티아이.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [f] })) {
          await navigator.share({ files: [f], title: "내 러닝 캐릭터" });
        } else {
          await scene.download(model(), state.ratio);
          notify("카드를 이미지로 저장했어요. 친구에게 보내 보세요.");
        }
      }
    } catch (e) {
      if (e.name !== "AbortError")
        notify("카드를 보내지 못했어요. 이미지를 저장한 뒤 다시 보내 보세요.");
    }
  }
  function capture() {
    let m = model(),
      r = state.ratio;
    if (modal.open) modal.close();
    modal.className = "capture";
    modal.removeAttribute("aria-labelledby");
    modal.innerHTML = `<button class="shot-close" data-act="modalclose">편집으로 돌아가기</button><canvas aria-label="${esc(m.name + " · 화면을 누르면 편집으로 돌아가요")}" role="img"></canvas>`;
    modal.showModal();
    scene
      .draw(modal.querySelector("canvas"), m, r, { width: 1080 })
      .catch(() => notify("이미지를 불러오지 못했어요."));
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) {
      if (modal.open && modal.classList.contains("capture")) modal.close();
      return;
    }
    const act = b.dataset.act,
      id = b.dataset.id || state.id,
      i = Number(b.dataset.i);
    switch (act) {
      case "modalclose":
        modal.close();
        break;
      case "cameos":
        note(
          "러닝 스타일 미리보기",
          '<div class="preview-trio">' +
            cameos
              .map(
                (c) =>
                  '<article><img src="' +
                  thumb("portrait", c.id) +
                  '" alt=""><h3>' +
                  esc(c.label) +
                  "</h3><p>" +
                  esc(c.text) +
                  "</p></article>",
              )
              .join("") +
            "</div>",
        );
        break;
      case "about":
        note(
          "런비티아이",
          `<p>달릴 때의 취향을 알아보는 심리테스트예요. 그래프에서는 각 답을 몇 번 골랐는지 볼 수 있어요.</p><p>러너들이 평소 쓰는 말과 국내 러닝 앱 후기를 참고해 질문을 만들었어요.</p><a href="https://www.jksqm.org/upload/pdf/jksqm-53-1-19.pdf" target="_blank" rel="noopener">국내 러닝 앱 후기 연구 읽기</a>`,
        );
        break;
      case "home":
        if (location.hash.startsWith("#card="))
          history.replaceState(null, "", location.href.split("#")[0]);
        home();
        break;
      case "library":
        libraryPage();
        break;
      case "pick":
        pick(id);
        break;
      case "sound":
        scene.audio.set(!scene.audio.enabled());
        header();
        if (scene.audio.enabled()) {
          if (state.view === "quiz") playQuestionAmbience(packs[id].questions[state.index].scene);
          scene.audio.effect("tap");
          notify("소리를 켰어요.");
        } else notify("소리를 껐어요.");
        break;
      case "start-exp":
        start("base", "experience");
        break;
      case "start-img":
        start("base", "imagine");
        break;
      case "begin":
        start(id, b.dataset.mode);
        break;
      case "replace":
        modal.close();
        fresh(id, b.dataset.mode, b.dataset.line || "");
        break;
      case "resume": {
        let d = getDraft();
        if (modal.open) modal.close();
        if (d) {
          state = { ...d };
          question();
        }
        break;
      }
      case "opt":
        toggleOpt(i);
        break;
      case "chat-photo": {
        const photo = state.view === "quiz" && packs[state.id].questions[state.index].chat?.photo;
        if (photo && state.answers[state.index].includes(photo.choice)) {
          note(photo.title, `<img class="chat-photo-full" src="${asset(photo.src)}" alt="${esc(photo.alt)}">`);
        }
        break;
      }
      case "next":
        advance(false);
        break;
      case "na":
        advance("na");
        break;
      case "na-group":
        omitTopic();
        break;
      case "pass":
        advance("pass");
        break;
      case "unsure":
        advance("unsure");
        break;
      case "prev":
        if (state.index) {
          state.index--;
          saveDraft();
          question();
        } else home();
        break;
      case "motives":
        motiveUI.open();
        break;
      case "return-card": {
        const poster = main.querySelector("#scene");
        poster.setAttribute("tabindex", "-1");
        poster.focus({preventScroll:true});
        poster.scrollIntoView({block:"center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
        break;
      }
      case "result":
        showResult(id);
        break;
      case "replay":
        renderScene(true);
        break;
      case "skipmotion":
        if (currentCanvas) scene.skip(currentCanvas);
        break;
      case "ratio":
        state.ratio = b.dataset.r;
        main.querySelectorAll("[data-act=ratio]").forEach((el) => {
          el.classList.toggle("active-ratio", el === b);
          el.setAttribute("aria-pressed", el === b);
        });
        renderScene(false);
        break;
      case "timeline":
        showAnswer(i);
        break;
      case "graph": {
        let dom = Number(b.dataset.domain),
          p = packs[id],
          a = library[id].answers;
        let list = p.questions
          .map((q, k) =>
            q.domain === dom && a[k].includes(i)
              ? `<p><strong>${esc(q.scene)}</strong> · ${esc(proofText(id, k, i))}</p>`
              : "",
          )
          .join("");
        note(
          p.domains[dom].labels[i],
          list || "<p>이번에 고른 장면이 없어요.</p>",
        );
        break;
      }
      case "pick-scene": {
        const v = sourceResult(id);
        const choice = resultScenes(v, id).find(e => e.key === Number(b.dataset.choice));
        if (!choice || b.getAttribute("aria-pressed") === "true") break;
        changeCustom({ sceneChoice: choice.key, cardStyle: "scene" });
        for (const el of main.querySelectorAll('[data-act="pick-scene"]'))
          el.setAttribute("aria-pressed", String(el === b));
        main.querySelector(".scene-caption span").textContent = choice.text;
        break;
      }
      case "trial": {
        let qi = Number(main.querySelector("#trial-q").value),
          r = library[id],
          a = r.answers.map((z) => [...z]);
        a[qi] = [i];
        let v = score(id, a, r.mode, r.chatScenes);
        let target = main.querySelector("#trial-out");
        target.innerHTML = `<div class="trial"><p class="hint">원래 장면 → 바꿔 본 장면</p><div class="trial-pair"><img src="${resultThumb(model(id))}" alt="지금 카드 그림"><span>→</span><img src="${trialThumb(id, v)}" alt="답을 바꾸면 나오는 그림"></div><strong>${esc(sourceResult().name)} → ${esc(v.name)}</strong><p>${esc(v.line)}</p><p class="hint">${esc(packs[id].questions[qi].scene)} · ${esc(proofText(id, qi, i))}</p><button class="btn light sm" data-act="applytrial" data-i="${i}" data-q="${qi}">이 답으로 수정</button></div>`;
        break;
      }
      case "applytrial": {
        let r = library[id];
        r.answers[Number(b.dataset.q)] = [i];
        if (r.blankReasons) r.blankReasons[Number(b.dataset.q)] = null;
        r.custom = {};
        save(storageKey, library);
        showResult(id);
        break;
      }
      case "openpick":
        changeCustom({
          charIndex: ranges[id][0] + (id === "base" ? 9 : 3) * i,
          line: packs[id].domains[0].labels[i] + "부터 떠올려 봤어.",
        });
        notify("고른 장면을 담았어요.");
        break;
      case "reset":
        library[id].custom = {};
        save(storageKey, library);
        showResult(id);
        main.querySelector("#edit-panel").open = true;
        break;
      case "capture":
        capture();
        break;
      case "download":
        if (folderFile) {
          capture();
          break;
        }
        try {
          await scene.download(model(), state.ratio);
          notify("이미지를 저장했어요.");
        } catch {
          notify("이미지를 저장하지 못했어요. ‘캡처 화면’을 눌러 화면을 캡처해 주세요.");
        }
        break;
      case "share":
        shareSheet();
        break;
      case "sendlink":
      case "shareimage":
        await transfer(act);
        break;
    }
  });
  main.addEventListener("change", (e) => {
    const el = e.target,
      k = el.dataset.edit;
    if (el.id === "trial-q") {
      const n = Number(el.value);
      main.querySelector("#trial-choices").innerHTML = trialChoices(
        state.id,
        n,
      );
      main.querySelector("#trial-out").innerHTML = "";
      return;
    }
    if (k === "cardStyle") {
      const { id, ratio } = state;
      library[id].custom ||= {};
      library[id].custom.cardStyle = el.value;
      save(storageKey, library);
      showResult(id, false, ratio);
      const panel = main.querySelector("#edit-panel");
      panel.open = true;
      panel.querySelector('[data-edit="cardStyle"]').focus({preventScroll: true});
      main.querySelector("#scene").scrollIntoView({block: "center"});
      return;
    }
    if (k && k !== "line") {
      changeCustom({ [k]: k === "includeEvidence" ? el.checked : Number(el.value) });
      if (k === "includeEvidence" && main.querySelector("#clue-field"))
        main.querySelector("#clue-field").hidden = !el.checked;
    }
  });
  main.addEventListener("input", (e) => {
    if (e.target.dataset.edit === "line")
      changeCustom({ line: e.target.value });
  });
  window.addEventListener("hashchange", route);
  modal.addEventListener("close", () => {
    if (!modal.open) {
      modal.className = "";
      modal.innerHTML = "";
      modal.removeAttribute("aria-labelledby");
    }
  });
  function route() {
    const params = new URLSearchParams(location.search);
    if (restoreStoryResult(history.state?.rbTestReturn)) return;
    const card = decodeCard();
    if (card) friendPage(card);
    else if (params.get("test") === "stories" || params.has("story")) storyUI.open(params.get("story"), params.get("choice"), params.get("topic"));
    else if (params.get("test") === "profile") storyUI.openProfile();
    else if (params.get("test") === "motives") motiveUI.open();
    else {
      home();
      if (location.hash.startsWith("#card="))
        notify("이 링크로는 카드를 열 수 없어요. 친구에게 링크를 다시 받아 보세요.");
      else if (params.get("test") === "buddy") pick("buddy");
    }
  }
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    if (history.state?.rbTestReturn || ["stories","profile"].includes(state.view) || ["stories","profile"].includes(params.get("test")) || params.has("story")) route();
  });
  header();
  route();
})();
