"use strict";
(function app() {
  "use strict";
  if (window.RBPairsUI?.ownsRoute()) {
    window.RBPairsUI.start();
    return;
  }
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
      if (key === storageKey) {
        for (const mode of ["experience", "imagine"]) {
          const current = Object.fromEntries(ids.filter(id => val[id]?.mode === mode).map(id => [id, val[id]]));
          if (!Object.keys(current).length) continue;
          const archiveKey = storageKey + "." + mode;
          localStorage.setItem(archiveKey, JSON.stringify({...load(archiveKey, {}), ...current}));
        }
      }
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
    window.RBRepresentative?.prepare?.(main);
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
      if (library.base?.mode === mode) {
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
    ownResults, canReturnToResult, restoreResult:restoreStoryResult});
  function ownResults(mode) {
    if (!["experience","imagine"].includes(mode)) return {...library, motive:motiveUI.savedResult()};
    const archived = load(storageKey + "." + mode, {});
    const records = {};
    for (const id of ids) {
      const r = library[id]?.mode === mode ? library[id] : archived?.[id];
      if (validRecord(r, id) && r.mode === mode) records[id] = r;
    }
    return {...records, motive:motiveUI.savedResult(mode)};
  }
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
    if (id === "base") {
      return `<button class="p-card" data-act="home"><div class="p-img"><img src="${asset("art/life-afterwork.webp")}" alt="" loading="lazy"><span class="label">기본 검사 · 6장면</span></div><div class="p-copy"><h3>달릴 때 나는 어떤 사람일까?</h3><p>내 러닝 캐릭터와 풀이를 만나 보세요.</p></div></button>`;
    }
    let p = packs[id],
      n = offsets[id],
      label = { base: "기본 검사", buddy: "동행", record: "기록" }[id];
    return `<button class="p-card" data-act="pick" data-id="${id}"><div class="p-img"><img src="${thumb("q", n)}" alt="" loading="lazy"><span class="label">${label} · ${p.questions.length}문항</span></div><div class="p-copy"><h3>${esc(p.title)}</h3><p>${esc(p.subtitle)}</p></div></button>`;
  }
  const cameos = [
    {
      id: 16,
      label: "반환점 찍고 오는 러너",
      text: "신발 끈을 고쳐 묶으며 오늘 어디까지 뛸지 정해요.",
    },
    {
      id: 18,
      label: "노을 같이 보는 친구",
      text: "친구가 부르면 나가요. 둘이 본 노을이 집에 와서도 생각나요.",
    },
    {
      id: 0,
      label: "샛길로 한 바퀴",
      text: "늘 뛰던 길에서도 낯선 골목을 만나면 안쪽을 슬쩍 들여다봐요.",
    },
  ];
  function home() {
    if (new URLSearchParams(location.search).get("legacy") === "archive") {
      const url = new URL(location.href);
      url.searchParams.delete("legacy");
      url.hash = "";
      location.assign(url);
      return;
    }
    scene.audio.stop();
    const extras = `<div class="packs journey-packs">${motiveUI.packCard()}${["buddy","record"].map(packCard).join("")}</div>${draftPanel()}${storyUI.homeFeature()}`;
    reading({view:"home",extras});
  }
  function reading(options) {
    output('<div id="reading-root" class="rd-app"></div>',"reading");
    window.RBReadingUI.open(main.firstElementChild,{...options,notify,onHome:()=>{
      if(location.hash.startsWith("#card=")) history.replaceState(null,"",location.href.split("#")[0]);
      home();
    }});
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
    const order = [n % 3, (n + 1) % 3, (n + 2) % 3];
    const buttons = order.map(i => {
      const text = labels[i];
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
      `<div class="narrow"><div class="head"><button class="back" data-act="home">${icon("left")} 테스트 홈</button></div><section class="question"><div class="qhead"><span>${esc(p.domains[q.domain].title)} <small>· ${mode === "imagine" ? "첫 러닝 상상" : "내 경험"}</small></span><small>${index + 1} / ${p.questions.length}</small></div><div class="progress" role="progressbar" aria-label="검사 진행" aria-valuemin="1" aria-valuemax="${p.questions.length}" aria-valuenow="${index + 1}"><i style="width:${(100 * (index + 1)) / p.questions.length}%"></i></div><div class="qscene"><img src="${thumb("q", n)}" alt=""><span>${esc(q.scene)}</span></div><h1>${esc(promptFor(q, mode, state.chatScenes))}</h1>
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
    main.querySelectorAll(".opt").forEach(el => {
      const j = Number(el.dataset.i);
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
    if (library[id] && library[id].mode !== mode) save(storageKey, library);
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
  function head(title, kicker = "", beforeTitle = "") {
    return `<div class="head"><button class="back" data-act="home">${icon("left")} 테스트 홈</button>${beforeTitle}${kicker ? `<p class="eyebrow">${esc(kicker)}</p>` : ""}<h1>${esc(title)}</h1></div>`;
  }
  function libraryPage() {
    scene.audio.stop();
    const readingMaps = window.RBReadingUI.libraryHTML();
    const owned = ["experience","imagine"].flatMap(mode => {
      const records = ownResults(mode);
      return ids.filter(id => records[id]).map(id => ({id, mode, record:records[id]}));
    });
    output(
      `${head("내 캐릭터 보관함")}<p class="desc">뛰어 본 날과 상상한 날의 카드를 따로 모았어요.</p>${readingMaps}${
        owned.length
          ? `<div class="gallery" style="margin-top:18px">${owned
              .map(({id,mode,record}) => {
                const m = model(id,record);
                return `<button class="p-card" data-act="result" data-id="${id}" data-mode="${mode}"><div class="p-img"><img src="${resultThumb(m)}" alt=""></div><div class="p-copy"><h3>${esc(m.name)}</h3><p>${mode === "imagine" ? "첫 러닝 상상" : "내 경험"} · ${esc(packTitle(id))}</p></div></button>`;
              })
              .join("")}</div>`
          : readingMaps ? "" : `<div class="empty"><h2>아직 보관한 캐릭터가 없어요.</h2><p>결과에서 ‘내 지도 보관하기’를 누르면 여기서 다시 볼 수 있어요.</p>${btn("start-exp", "첫 검사 시작", "primary")}</div>`
      }${storyUI.resultSection("library")}${storyUI.savedEntry()}${motiveUI.libraryEntry()}<div style="margin-top:28px" class="packs">${ids
        .filter((id) => !library[id])
        .map(packCard)
        .join("")}</div>${draftPanel()}`,
      "library",
    );
  }
  function sourceResult(id = state.id, r = library[id]) {
    return score(id, r.answers, r.mode, r.chatScenes, r.typePicks);
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
  function model(id = state.id, r = library[id]) {
    const v = sourceResult(id, r), c = r.custom || {};
    const pictures = resultScenes(v, id);
    const picture = !usesCharacter(c) && (pictures.find(e => e.key === c.sceneChoice) || pictures[0]);
    const answers = r.answers.flatMap((indices, q) => indices.map(i => ({ q, i, text: proofText(id, q, i, r) })));
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
    if (!selected) return "";
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
  function proofText(id, q, i, r = library[id]) {
    return answerOptions(packs[id].questions[q], r.mode, r.chatScenes)[i];
  }
  function proof(v, p, d) {
    return v.evidence.find((e) => p.questions[e.q].domain === d);
  }
  function packCardReason(id, v, custom = {}) {
    const domain = packs[id].domains;
    if (id === "base") {
      if (!v.typeKey) return "아직 정하지 않은 항목이 있어요. 아래에서 내 쪽에 가까운 답을 고를 수 있어요.";
      const [a,b,c] = v.digest;
      if (library.base.mode === "imagine") {
        return ["처음엔 새 길이 궁금해서 나가 보고 싶어요.", "처음엔 어디까지 갈지 정해 두고 나가고 싶어요.", "처음엔 같이 뛰자는 사람이 있으면 나가 보고 싶어요."][a] + " " +
          ["풍경을 구경하며 뛰고 나면", "내 호흡에 맞춰 뛰고 나면", "거리와 시간을 살피며 뛰고 나면"][b] + " " +
          ["집에 와서 한결 개운할 것 같아요.", "어디까지 해냈는지 떠올리며 뿌듯할 것 같아요.", "집에 와서 누군가에게 그날 얘기를 하고 싶을 것 같아요."][c];
      }
      const start = ["낯선 길이 궁금해서 나가요.", "어디까지 뛸지 정해 두면 나가기 쉬워요.", "같이 뛰자는 사람이 있으면 나가고 싶어져요."][a];
      const focus = ["뛸 땐 주변 풍경을 보고", "뛸 땐 발걸음과 호흡을 살피고", "뛸 땐 거리와 시간을 확인하고"][b];
      const end = ["집에 와서는 기분이 얼마나 풀렸는지 느껴요.", "집에 와서는 오늘 어디까지 해냈는지 떠올려요.", "집에 와서는 오늘 있었던 일을 누군가에게 들려주고 싶어요."][c];
      return start + " " + focus + " " + end;
    }
    if (Object.keys(custom || {}).some(k => ["pose","background","charIndex","prop","expression","frame","line","sceneChoice","cardStyle","actionChoice"].includes(k))) {
      return "직접 꾸민 검사 카드예요. 카드 그림이나 대사를 바꿔도 내가 고른 답은 그대로예요.";
    }
    if (v.kind === "open") return "이 검사에서 아직 고른 장면이 없어요. 아래에서 첫 장면을 고를 수 있어요.";
    if (v.kind === "mixed") return "이 검사에서 같은 횟수로 고른 행동이 있어요. 그중 한 장면을 카드에 담았어요.";
    if (v.kind === "scene") return "이 검사에서 눈길이 갔던 장면 하나를 카드에 담았어요.";
    const labels = v.digest.map((i,d) => "‘" + domain[d].labels[i] + "’");
    return id === "base" ? `${labels.join(" · ")} 순서로 골랐어요. 세 영역에서 자주 고른 답을 모아 이 캐릭터를 골랐어요.`
      : `${labels.slice(0,2).join(" · ")} 쪽을 자주 골라 이 캐릭터가 나왔어요. 마지막 영역에서 자주 고른 ${labels[2]} 쪽 답은 대사에 담았어요.`;
  }
  function typeQuestions(v) {
    const prompts = ["뛰러 나갈 때 어느 쪽 마음이 더 커?", "뛰고 있을 때 뭐가 더 자주 눈에 들어와?", "다 뛰고 돌아오면 뭐가 더 오래 남아?"];
    const options = [
      ["안 가 본 길에 뭐가 있나 궁금해", "오늘 가기로 한 데까지 가고 싶어", "같이 뛰기로 한 사람이 기다려"],
      ["지나가는 길에 보이는 풍경", "숨이 차거나 발걸음이 가벼워지는 느낌", "얼마나 뛰었나 알려 주는 거리나 시간"],
      ["나갔다 온 뒤 달라진 기분", "마음먹은 만큼 해냈다는 생각", "누군가한테 들려주고 싶은 얘기"],
    ];
    const open = v.digest.findIndex(x => x === null);
    if (open < 0) return "";
    const n = v.digest.filter(x => x === null).length;
    const tied = v.leaders[open].length > 1;
    return `<section class="type-decider" aria-labelledby="type-prompt"><p class="eyebrow">내 유형 마무리 · ${n}개 남음</p><h2 id="type-prompt" tabindex="-1">${prompts[open]}</h2><p>${tied ? "여러 답을 같은 횟수로 골랐어요. 딱 하나만 남긴다면 어느 쪽이에요?" : "이 부분은 아직 고른 답이 없어요. 지금 떠올려 보고 고르거나 나중에 다시 와도 돼요."}</p><div class="type-choices">${v.candidates[open].map(i => `<button class="btn light" data-act="type-pick" data-domain="${open}" data-i="${i}">${esc(options[open][i])}</button>`).join("")}</div><button class="linkbtn" data-act="type-later">지금까지 고른 답 보기</button></section>`;
  }
  function typeEvidence(v) {
    if (!v.typeKey) return "";
    const p = packs.base;
    return `<section class="panel type-evidence"><h2>어떤 답에서 이 유형이 나왔을까?</h2>${p.domains.map((d,j) => {
      const i = v.digest[j], evidence = proof(v,p,j);
      const label = v.candidates[j].length > 1 ? "마지막에 직접 고름" : v.counts[j][i] + "개 장면에서 고름";
      return `<div class="type-trait"><div><small>${esc(d.title)}</small><strong>${esc(d.labels[i])}</strong><span>${label}</span></div>${evidence ? `<button data-act="timeline" data-i="${evidence.q}">“${esc(evidence.text)}” ${icon("arrow")}</button>` : ""}</div>`;
    }).join("")}${v.candidates.some(row => row.length > 1) ? '<button class="linkbtn" data-act="type-revise">마지막에 고른 답 다시 보기</button>' : ""}</section>`;
  }
  function typeReaction(v) {
    const opinion = library.base.reaction;
    const current = opinion?.type === v.typeKey ? opinion.value : "";
    return `<section class="panel type-reaction"><h2>읽어 보니 내 얘기 같아?</h2><div class="actions">${["내 얘기 같아","조금 달라"].map((text,i) => `<button class="btn light sm" data-act="type-react" data-i="${i}" aria-pressed="${current === text}">${text}</button>`).join("")}</div><div class="reaction-next" aria-live="polite">${current === "내 얘기 같아" ? btn("share","친구도 이렇게 볼까? 카드 보내기","light sm","share") : current === "조금 달라" ? `<p>어느 부분이 달랐어요? 그때 고른 답을 다시 볼 수 있어요.</p><div class="work-actions">${packs.base.domains.map((d,j) => `<button class="linkbtn" data-act="review-domain" data-domain="${j}">${esc(d.title)}</button>`).join("")}</div>` : ""}</div></section>`;
  }
  function postingQuestion(record) {
    const own = ownResults(record.mode);
    record = own[window.RBStoryMatch.latestPost(own)] || record;
    const q = window.RBStoryMatch.postQuestion;
    const picked = q.choices.find(c => c.signal === record.postChoice);
    if (!picked && record.postQuestionSkipped) {
      return `<div class="panel rb-post-skipped"><button type="button" class="linkbtn" data-act="post-open">러닝 인증 질문 다시 보기</button></div>`;
    }
    const prompt = record.mode === "imagine" ? q.imagine : q.prompt;
    return `<section class="panel rb-post-question"><h2 id="post-choice-heading" tabindex="-1">${esc(prompt)}</h2>
      <div class="rb-post-options" role="group" aria-labelledby="post-choice-heading">${q.choices.map(c =>
        `<button type="button" data-act="post-select" data-signal="${esc(c.signal)}" aria-pressed="${c === picked}">
          ${c.art ? `<img src="${esc(asset(c.art))}" alt="">` : ""}
          <span>${esc(c.label)}</span>${c === picked ? '<b aria-hidden="true">✓</b>' : ""}</button>`).join("")}</div>
      ${picked ? window.RBRepresentative.postingScene(picked.signal,{esc,auto:true}) : ""}<div class="rb-post-controls"><span>${picked ? "고른 답을 내 러닝 성향에 반영했어요." : "가까운 답 하나를 골라 주세요."}</span>
      <button type="button" class="linkbtn" data-act="post-omit">${picked ? "이 답 빼기" : "이 질문 건너뛰기"}</button></div></section>`;
  }
  function showResult(id, animate = false, ratio = "4:5") {
    if (!library[id]) return pick(id);
    state = { id, view: "result", ratio };
    let p = packs[id],
      r = library[id],
      v = sourceResult(),
      m = model();
    if (id === "base" && !v.typeKey) {
      const answered = r.answers.filter(a => a.length).length;
      output(`${head("내 러닝 유형 마무리", r.mode === "imagine" ? "첫 러닝을 상상한 답" : "뛰어 본 날을 떠올린 답")}<div class="pending-result">${typeQuestions(v)}${panel("지금까지 고른 답 · " + answered + "장면", timeline(id) + graph(id,v), "partial-answers")}${storyUI.resultSection(id,r)}<div class="actions">${btn("library","보관함에 두고 나가기","light")}</div></div>`, "result");
      return;
    }
    const storyResult = storyUI.resultParts(id, r);
    const summary = id === "base" ? typeEvidence(v) : `<section class="panel"><h2>내 답에서 보이는 세 가지</h2><div class="summary-grid">${p.domains.map((d,j) => {
      const e = proof(v,p,j);
      return `<div class="stat"><small>${esc(d.title)}</small><b>${esc(v.leaders[j].map(i => d.labels[i]).join(" · ") || "아직 고른 답 없음")}</b>${e ? `<p>“${esc(e.text)}”</p>` : ""}</div>`;
    }).join("")}</div></section>`;
    const modeLabel = r.mode === "imagine" ? "첫 러닝을 상상한 답" : "뛰어 본 날을 떠올린 답";
    const kicker = (id === "base" ? "내 러닝 유형" : packTitle(id)) + " · " + modeLabel;
    const replay = scene.canReplay(m) && !matchMedia("(prefers-reduced-motion: reduce)").matches
      ? '<div class="scene-actions"><button data-act="replay">내 답이 카드에 담기는 장면 다시 보기</button><button data-act="skipmotion" hidden>마지막 장면 보기</button></div>' : "";
    output(
      `${head(m.name,kicker)}<p class="desc result-description" data-pack-reason>${esc(packCardReason(id,v,r.custom))}</p>
       <div class="results"><section class="result-card-column">${picturePicker(id,v,m)}
       <div class="scene-wrap"><canvas id="scene" width="1080" height="1350" role="img" aria-label="${esc(m.name + " · " + m.line)}"></canvas></div>${replay}
       <div class="actions">${btn("share","친구에게 보내기","primary","share")}${btn("edit-card","내 카드 꾸미기","light")}</div>
       <div class="work-actions">${btn("capture","캡처 화면","light sm","image")}${btn("download","이미지 저장","light sm","download")}${["4:5","9:16"].map((s,i) => `<button class="btn sm light ${s === ratio ? "active-ratio" : ""}" data-act="ratio" data-r="${s}" aria-pressed="${s === ratio}">${i ? "스토리" : "피드"} ${s}</button>`).join("")}</div>
       </section><section class="stack">${summary}${id === "base" ? typeReaction(v) : ""}${received?.pack === id ? panel("친구와 나란히 보기",compare(id,received),"friend-panel",true) : ""}
       ${panel("내 장면 꾸미기",editor(id,m),"edit-panel")}${panel("내 선택 그래프",graph(id,v))}${panel("장면별로 내 답 보기",timeline(id))}${panel("그때 다르게 골랐다면?",sandbox(id))}
       ${id === "record" || id === "base" ? postingQuestion(r) : ""}${storyResult.summary}${storyResult.suggestions}${motiveUI.fromResult()}${v.kind === "open" ? openPicker(id) : ""}</section></div>
       <section class="more-tests"><div class="sectionhead"><h2>다른 날의 내 모습도 궁금하다면</h2></div><div class="packs">${ids.filter(k => k !== id).map(packCard).join("")}</div><div class="work-actions">${btn("library","내 보관함","light sm","book")}<button class="btn light sm" data-act="pick" data-id="${id}">다시 검사하기</button></div></section>`,
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
    const scope = main.querySelector("[data-pack-reason]");
    if (scope) scope.textContent = packCardReason(state.id, sourceResult(), library[state.id].custom);
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
    const record = ownResults(c.mode)[id] || library[id];
    const v = sourceResult(id,record), p = packs[id], mine = model(id,record);
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
    if (c.mode !== mine.mode)
      return `${portraits}<p>한 사람은 뛰어 본 날을 떠올렸고 한 사람은 첫 러닝을 상상했어요. 두 사람이 쓴 한 줄을 함께 읽어 보세요.</p><p>나 · ${esc(mine.line)}</p><p>친구 · ${esc(c.line)}</p>`;
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
    const sameType = id === "base" && c.typeKey && c.typeKey === v.typeKey;
    return `<div class="compare">${portraits}<strong>${esc(mine.name)} × ${esc(c.name)}</strong>${sameType ? "<p>기본 검사에서 두 사람의 대표 선택 세 가지가 모두 같아요.</p>" : ""}${same ? `<p>${esc(same)}</p>` : ""}${diff ? `<p>${esc(diff)}</p>` : ""}${!same && !diff ? "<p>둘 다 답한 항목이 아직 없어요.</p>" : ""}</div>`;
  }
  function conversationScenes(id, m) {
    const r = library[id];
    const clues = r.answers.flatMap((row, q) => row.map(i => ({q, i})));
    const first = clues.find(({q,i}) => optionArt(id,{q,i}) === m.evidenceArt);
    const refs = (first ? [first,...clues.filter(c => c !== first)] : clues)
      .map(({q,i}) => ({source:"quiz", pack:id, mode:r.mode, q, choice:i, chat:r.chatScenes === true}));
    if (id === "record" || id === "base") {
      const results = ownResults(r.mode);
      const post = results[window.RBStoryMatch.latestPost(results)];
      if (post && window.RBStoryMatch.postQuestion.choices.some(c => c.signal === post.postChoice))
        refs.unshift({source:"post", mode:r.mode, choice:post.postChoice});
    }
    return refs;
  }
  function publicQuestion(pack, mode) {
    return pack === "buddy" ? {source:"quiz", pack, mode, q:0} : {source:"post", mode};
  }
  function shareSheet() {
    const m = model(), refs = conversationScenes(state.id, m);
    const items = refs.map(ref => {
      const q = window.RBFriend.read(ref);
      return q.title + " · " + q.choices.find(c => c.id === ref.choice).text;
    });
    const web = location.protocol !== "file:";
    note(
      "친구에게 내 장면 보내기",
      `<canvas id="share-preview-art" role="img" aria-label="보낼 카드 미리보기" style="display:block;width:min(43%,12rem);height:auto;margin:0 auto"></canvas><p><strong>${esc(m.name)}</strong><br>${esc(m.line)}</p>
      <p class="hint">${web ? "친구가 내 카드를 보고 질문 하나에 답할 수 있어요." : "이 카드를 이미지로 간직하거나 친구에게 보낼 수 있어요."}</p>
      ${items.length ? `<label class="check"><input id="allow-answer" type="checkbox">내가 고른 답 한 줄도 보내기</label>
        <label class="field" id="echo-field" hidden>보내고 싶은 답<select id="echo-selection">${items.map((item,i) => `<option value="${i}">${esc(item)}</option>`).join("")}</select></label>` : ""}
      ${web ? '<label class="check"><input id="allow-compare" type="checkbox">링크에 세 영역의 결과도 담기</label>' : ""}
      <p class="share-note" id="send-preview" aria-live="polite"></p>
      <div class="actions">${web ? btn("sendlink","친구에게 링크 보내기","primary","share") : ""}
      ${btn(folderFile ? "capture" : "shareimage", folderFile ? "캡처 화면 열기" : "이미지로 보내기","light","image")}
      ${btn("modalclose","나만 간직하기","light")}</div><div id="manual-link"></div>`,
    );
    function preview() {
      const c = sharedCard();
      const picker = modal.querySelector("#echo-field");
      if (picker) picker.hidden = !c.includeEvidence;
      const areas = c.leaders?.map((group,i) => group.map(k => packs[c.pack].domains[i].labels[k]).join(" / ")).filter(Boolean);
      modal.querySelector("#send-preview").textContent = [web ? "친구에게 물어볼 질문 · " + window.RBFriend.read(c.echo).prompt : "",
        areas?.length ? "함께 보낼 결과 · " + areas.join(" · ") : ""].filter(Boolean).join("  ");
      modal.querySelector("#manual-link").replaceChildren();
      const previous = modal.querySelector("#share-preview-art");
      const canvas = previous.cloneNode(false);
      previous.replaceWith(canvas);
      scene.draw(canvas, c, state.ratio, {width:540}).catch(() => canvas.hidden = true);
    }
    modal.querySelectorAll("input,select").forEach(el => el.addEventListener("change", preview));
    preview();
  }
  function sharedCard() {
    const m = model(), ref = conversationScenes(state.id,m)[Number(modal.querySelector("#echo-selection")?.value || 0)];
    const showAnswer = !!modal.querySelector("#allow-answer")?.checked;
    const echo = window.RBFriend.clean(showAnswer ? ref : publicQuestion(m.pack,m.mode), showAnswer);
    const answer = showAnswer && window.RBFriend.read(echo).choices.find(c => c.id === echo.choice);
    return {
      pack:m.pack, mode:m.mode, name:m.name, charIndex:m.charIndex, pose:m.pose,
      background:m.background, frame:m.frame, expression:m.expression, prop:m.prop,
      sceneArt:m.sceneArt, sceneLabel:m.sceneLabel, actionArt:m.actionArt, actionLabel:m.actionLabel,
      v: 2,
      ratio: state.ratio === "9:16" ? "9:16" : "4:5",
      leaders: document.querySelector("#allow-compare")?.checked
        ? sourceResult().leaders
        : null,
      typeKey:modal.querySelector("#allow-compare")?.checked ? sourceResult().typeKey || "" : "",
      echo, includeEvidence:!!answer, evidence:answer ? answer.text : "",
      evidenceArt:answer && ref.source === "quiz" ? optionArt(state.id, {q:ref.q, i:ref.choice}) : "",
      line: m.line.slice(0, 160),
    };
  }
  function cardUrl(card) {
    return window.RBFriend.url("card", card);
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
        typeKey:leaders && c.pack === "base" && /^base-[0-2]-[0-2]-[0-2]$/.test(c.typeKey) ? c.typeKey : "",
        echo:c.echo && c.echo.mode === c.mode && ((c.echo.source === "post" && ["base","record"].includes(c.pack)) ||
          (c.echo.source === "quiz" && c.echo.pack === c.pack)) ? window.RBFriend.clean(c.echo,c.includeEvidence === true) : null,
      };
    } catch {
      return null;
    }
  }
  function friendPage(c) {
    received = c;
    state = { id: c.pack };
    output(
      `${head(c.name, "친구가 보낸 검사 카드 · " + packTitle(c.pack))}<div class="results"><div class="scene-wrap"><canvas id="friend-scene" width="1080" height="1350" role="img" aria-label="${esc(c.line)}"></canvas></div><div class="stack"><div class="panel"><h2>친구의 한 줄</h2><p>${esc(c.line)}</p>${c.includeEvidence && c.echo?.choice === undefined ? `<p class="hint">${esc(c.evidence)}</p>` : ""}</div><section class="panel" id="friend-echo"></section>${library[c.pack] ? `<details class="panel"><summary>내 결과와 같이 보기</summary><div class="stack" data-compare-own></div></details>` : ""}<div class="actions"><button class="btn primary" data-act="${library[c.pack] ? "result" : "pick"}" data-id="${c.pack}">${library[c.pack] ? "내 결과도 보기" : "나도 해보기"}</button>${btn("home", "테스트 둘러보기", "light")}</div></div></div>`,
      "friend",
    );
    window.RBFriend.mount(main.querySelector("#friend-echo"), c.echo || publicQuestion(c.pack,c.mode), {esc,notify});
    const comparison = main.querySelector("[data-compare-own]");
    if (comparison) comparison.parentElement.addEventListener("toggle", () => {
      if (comparison.parentElement.open && !comparison.childElementCount) comparison.innerHTML = compare(c.pack,c);
    });
    scene
      .draw(document.querySelector("#friend-scene"), c, c.ratio)
      .catch(() => notify("그림을 불러오지 못했어요."));
  }
  function openSharedMoment() {
    if (!location.hash.startsWith("#moment=") || location.hash.length > 1000) return false;
    try {
      const ref = window.RBFriend.clean(JSON.parse(decodeURIComponent(location.hash.slice(8))),true);
      if (!ref) return false;
      const q = window.RBFriend.read(ref);
      output(`<div class="narrow">${head(q.title, "친구가 보낸 러닝 장면")}<section class="panel" id="friend-echo"></section><div class="actions">${btn("home","내 러닝 캐릭터도 만나 보기","primary")}</div></div>`, "friend");
      window.RBFriend.mount(main.querySelector("#friend-echo"),ref,{esc,notify});
      return true;
    } catch { return false; }
  }
  async function transfer(type) {
    let box = document.querySelector("#manual-link");
    try {
      if (type === "sendlink") {
        await window.RBFriend.deliver(cardUrl(sharedCard()),{link:true,useShare:true,output:box,notify});
      } else {
        const card = sharedCard();
        const blob = await scene.blob(card, state.ratio),
          f = new File([blob], "런비티아이.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [f] })) {
          await navigator.share({ files: [f], title: "내 러닝 캐릭터" });
        } else {
          await scene.download(card, state.ratio);
          notify("카드를 이미지로 저장했어요. 친구에게 보내 보세요.");
        }
      }
    } catch (e) {
      if (e.name !== "AbortError" && type === "shareimage") {
        capture();
        notify("이미지를 바로 보내기 어려워요. 이 카드를 캡처해 주세요.");
      } else if (e.name !== "AbortError") notify("링크를 보내지 못했어요. 다시 눌러 주세요.");
    }
  }
  function capture() {
    let m = modal.open && modal.querySelector("#send-preview") ? sharedCard() : model(),
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
      case "type-pick": {
        if (state.view !== "result" || id !== "base") break;
        const r = library.base, v = sourceResult(id), d = Number(b.dataset.domain);
        if (v.digest[d] !== null || !v.candidates[d]?.includes(i)) break;
        r.typePicks ||= [];
        r.typePicks[d] = i;
        save(storageKey, library);
        showResult(id, true);
        main.querySelector("#type-prompt")?.focus({preventScroll:true});
        break;
      }
      case "type-revise":
        if (state.id !== "base" || !library.base) break;
        delete library.base.typePicks;
        save(storageKey, library);
        showResult("base");
        break;
      case "type-later": {
        const details = main.querySelector("#partial-answers");
        details.open = true;
        details.querySelector("summary").focus();
        break;
      }
      case "edit-card": {
        const details = main.querySelector("#edit-panel");
        details.open = true;
        details.querySelector("summary").focus();
        break;
      }
      case "type-react": {
        if (state.id !== "base" || state.view !== "result" || ![0,1].includes(i)) break;
        const v = sourceResult("base");
        if (!v.typeKey) break;
        library.base.reaction = {type:v.typeKey, value:["내 얘기 같아","조금 달라"][i]};
        save(storageKey,library);
        main.querySelector(".type-reaction").outerHTML = typeReaction(v);
        main.querySelector('[data-act="type-react"][aria-pressed="true"]').focus({preventScroll:true});
        break;
      }
      case "review-domain": {
        const q = packs.base.questions.findIndex(row => row.domain === Number(b.dataset.domain));
        const select = main.querySelector("#trial-q");
        if (q < 0 || !select) break;
        select.closest("details").open = true;
        select.value = String(q);
        select.dispatchEvent(new Event("change", {bubbles:true}));
        select.focus();
        break;
      }
      case "post-select":
      case "post-omit":
      case "post-open": {
        const record = library[id];
        if (state.view !== "result" || !["record","base"].includes(id) || !record) break;
        if (act === "post-select") {
          const selection = window.RBStoryMatch.postQuestion.choices.find(c => c.signal === b.dataset.signal);
          if (!selection) break;
          record.postChoice = selection.signal;
          delete record.postQuestionSkipped;
        } else if (act === "post-omit") {
          delete record.postChoice;
          record.postQuestionSkipped = true;
        } else {
          delete record.postQuestionSkipped;
          delete record.postChoice;
        }
        record.postChoiceAt = Date.now();
        const stored = save(storageKey, library);
        showResult(id, false, state.ratio);
        const target = act === "post-select" ? '.rb-post-options [aria-pressed="true"]' :
          act === "post-omit" ? '[data-act="post-open"]' : "#post-choice-heading";
        main.querySelector(target)?.focus({preventScroll:true});
        if (!stored) notify("이번에 연 화면에서만 바뀌었어요.");
        break;
      }
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
          `<p>여섯 장면에서 내가 얼마나 자주 하는 행동인지 골라요. 첫 러닝을 상상한다면 얼마나 해 보고 싶은지 답하면 돼요.</p><p>회복·기록·함께·탐색 네 가지를 살펴보고 답과 어울리는 캐릭터와 풀이를 보여 줘요. 나를 돌아보는 창작 성향 테스트예요.</p>`,
        );
        break;
      case "home":
        if (/^#(?:card|moment)=/.test(location.hash))
          history.replaceState(null, "", location.href.split("#")[0]);
        home();
        break;
      case "library":
        libraryPage();
        break;
      case "reading-open":
        reading({view:"result",id:b.dataset.record});
        break;
      case "reading-delete":
        if (confirm("이 기기에 보관한 이 지도와 한 줄을 지울까요?")) {
          notify(window.RBReadingUI.remove(b.dataset.record) ? "지도를 지웠어요." : "지도를 지우지 못했어요.");
          libraryPage();
        }
        break;
      case "pick":
        if (id === "base") home(); else pick(id);
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
        reading({view:"start",mode:"experience"});
        break;
      case "start-img":
        reading({view:"start",mode:"imagine"});
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
        if (b.dataset.mode && library[id]?.mode !== b.dataset.mode) {
          const previous = ownResults(b.dataset.mode)[id];
          if (!previous) break;
          save(storageKey,library);
          library[id] = previous;
          save(storageKey,library);
        }
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
        let v = score(id, a, r.mode, r.chatScenes, r.typePicks);
        let target = main.querySelector("#trial-out");
        target.innerHTML = `<div class="trial"><p class="hint">원래 장면 → 바꿔 본 장면</p><div class="trial-pair"><img src="${resultThumb(model(id))}" alt="지금 카드 그림"><span>→</span><img src="${trialThumb(id, v)}" alt="답을 바꾸면 나오는 그림"></div><strong>${esc(sourceResult().name)} → ${esc(v.name)}</strong><p>${esc(v.line)}</p><p class="hint">${esc(packs[id].questions[qi].scene)} · ${esc(proofText(id, qi, i))}</p><button class="btn light sm" data-act="applytrial" data-i="${i}" data-q="${qi}">이 답으로 수정</button></div>`;
        break;
      }
      case "applytrial": {
        let r = library[id];
        r.answers[Number(b.dataset.q)] = [i];
        if (r.blankReasons) r.blankReasons[Number(b.dataset.q)] = null;
        // The renderer resolves scene and evidence picks against the revised answers.
        // Keep the person's own dialogue, styling and sharing preferences.
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
    const readingCard = window.RBReadingCard.read();
    if (readingCard) { reading({view:"friend",shared:readingCard}); return; }
    if (openSharedMoment()) return;
    if (params.get("legacy") === "archive" && !location.hash) {
      libraryPage();
      return;
    }
    const card = decodeCard();
    if (card) friendPage(card);
    else if (restoreStoryResult(history.state?.rbTestReturn)) return;
    else if (params.get("test") === "stories" || params.has("story")) storyUI.open(params.get("story"), params.get("choice"), params.get("topic"));
    else if (params.get("test") === "profile") storyUI.openProfile();
    else if (params.get("test") === "motives") motiveUI.open();
    else {
      home();
      if (/^#(?:card|moment)=/.test(location.hash))
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
