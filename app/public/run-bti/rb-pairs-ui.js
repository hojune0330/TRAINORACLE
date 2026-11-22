(() => {
  "use strict";
  const model = window.RBPairsModel;
  const params = () => new URLSearchParams(location.search);
  function ownsRoute() {
    return params().get("edition") !== "athlete" && !params().has("legacy") &&
      !params().has("test") && !params().has("story") && !params().has("crew") &&
      !/^#(?:card|moment)=/.test(location.hash);
  }
  const extraById = new Map(model.extras.map(item => [item.id, item]));
  const itemById = new Map(model.items.map(item => [item.id, item]));
  // Spread the three observations of each preference across different pages.
  const ordered = [0, 1, 2].flatMap(index => model.axes.flatMap(axis =>
    axis.sides.map(side => itemById.get(side.id + "-" + (index + 1)))));
  const pages = [
    [extraById.get("learning")],
    ...Array.from({length: 8}, (_, index) => ordered.slice(index * 3, index * 3 + 3)),
    ["distanceLevel", "strength", "challenge", "goal"].map(id => extraById.get(id)),
    ["motives", "eagerness"].map(id => extraById.get(id)),
  ];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch =>
    ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
  const asset = path => escape(window.RBScene.assetURL(path));
  const read = (type, key) => {
    try { return JSON.parse(window[type].getItem(key)); } catch { return null; }
  };
  const write = (type, key, value) => {
    try {
      if (value === null) window[type].removeItem(key);
      else window[type].setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  };
  const archivePrefix = "runbti." + model.version + ".saved.";
  const draftKey = "runbti." + model.version + ".draft";
  const legacyURL = new URL(location.href);
  legacyURL.searchParams.set("legacy", "archive");
  legacyURL.hash = "";
  function safeAnswers(raw) {
    const clean = {};
    for (const item of model.items) {
      const value = raw?.[item.id];
      if ([0, 1, 2, "unknown"].includes(value)) clean[item.id] = value;
    }
    for (const item of model.extras) {
      const allowed = item.options.filter(option => !option.sensitive);
      if (item.multiple) {
        const selected = allowed.filter(option => Array.isArray(raw?.[item.id]) && raw[item.id].includes(option.id));
        if (selected.length) clean[item.id] = selected.map(option => option.id);
      } else if (allowed.some(option => option.id === raw?.[item.id])) {
        clean[item.id] = raw[item.id];
      }
    }
    return clean;
  }
  function validRecord(record) {
    return record && record.version === model.version && typeof record.id === "string" &&
      /^[a-z0-9-]{1,80}$/.test(record.id) && typeof record.answers === "object" &&
      record.answers !== null && !Array.isArray(record.answers) &&
      typeof record.at === "string" && Number.isFinite(Date.parse(record.at));
  }
  function validPage(page) { return Number.isInteger(page) && page >= 0 && page < pages.length; }
  function records() {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith(archivePrefix))
        .map(key => read("localStorage", key)).filter(validRecord)
        .sort((a, b) => b.at.localeCompare(a.at));
    } catch { return []; }
  }
  const dateLabel = at => new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(at));
  const newId = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n.toString(36)).join("-");
  function button(action, label, primary = false) {
    return '<button type="button" class="fp-button' + (primary ? ' fp-primary' : '') +
      '" data-fp="' + action + '">' + escape(label) + '</button>';
  }
  function badge(axis) {
    if (axis.direction) return axis.sides.find(side => side.id === axis.direction).label;
    return {both:"양쪽 다 좋아", neither:"둘 다 별로", middle:"한쪽으로 기울지 않았어요",
      insufficient:"아직 판단하기 어려워요"}[axis.state];
  }
  function start() {
    document.body.classList.add("fp-app");
    const main = document.querySelector("#main");
    const mast = document.querySelector("#mast");
    const foot = document.querySelector("#foot");
    const scene = window.RBScene;
    const extras = window.RBPairsExtras;
    let received = extras?.readShared() || null;
    let view = "", current = null, page = 0, storyState = {}, personalName = "";
    let selectedComparison = "", noticeTimer;
    const sessions = new Map(); // Per-tab history only. Raw private answers never enter history.state.
    let draftId = "";
    const restoredDraft = read("sessionStorage", draftKey);
    if (validRecord(restoredDraft) && validPage(restoredDraft.page)) {
      current = {...restoredDraft, answers:safeAnswers(restoredDraft.answers)};
      page = restoredDraft.page;
      draftId = current.id;
    }
    function snapshot() {
      if (current) sessions.set(current.id,{current, page, storyState, personalName});
    }
    function restore(id) {
      const saved = sessions.get(id);
      if (!saved) return false;
      ({current,page,storyState,personalName} = saved);
      selectedComparison = "";
      return true;
    }
    function notify(message) {
      const toast = document.querySelector("#toast");
      toast.textContent = message;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { toast.textContent = ""; }, 2800);
    }
    function soundButton() {
      const enabled = scene.audio.enabled();
      const label = enabled ? "소리 끄기" : "소리 켜기";
      return '<button class="fp-text" data-fp="sound" aria-pressed="' + enabled + '">' + label + '</button>';
    }
    function frame(next, markup, focus = true) {
      view = next;
      const isQuiz = view === "quiz";
      document.body.classList.toggle("fp-taking", isQuiz);
      mast.hidden = isQuiz;
      foot.hidden = isQuiz;
      mast.innerHTML = '<div class="fp-top"><button class="fp-brand" data-fp="home" aria-label="런비티아이 홈">' +
        '<i aria-hidden="true"></i>런비티아이</button><nav aria-label="메뉴">' +
        '<button class="fp-text" data-fp="archive">내 보관함</button>' + soundButton() + '</nav></div>';
      const serviceLink = /^https?:$/.test(location.protocol) && params().get("edition") === "train"
        ? '<a href="../?oracleV2=1">트레인오라클로 돌아가기</a>' : "";
      foot.innerHTML = '<div class="fp-bottom"><button class="fp-text" data-fp="home">테스트 홈</button>' + serviceLink + '</div>';
      main.innerHTML = markup;
      if (focus) {
        main.focus({preventScroll:true});
        window.scrollTo(0, 0);
      }
    }
    function remember(viewName, push = true) {
      const previous = history.state;
      const state = {fpView:viewName, fpId:current?.id || "", fpPage:page,
        wasQuiz:push && previous?.fpView === "quiz" && previous.fpId === current?.id && previous.fpPage === page-1};
      try { history[push ? "pushState" : "replaceState"](state, ""); } catch { /* Offline viewers may disable history. */ }
    }
    function saveDraft() {
      if (!current || current.finished) return;
      draftId = current.id;
      snapshot();
      write("sessionStorage", draftKey, {id:current.id, version:model.version, at:current.at, page,
        answers:safeAnswers(current.answers)});
    }
    function home(focus = true) {
      if (current?.id !== draftId && draftId) { snapshot(); restore(draftId); }
      const resume = current && !current.finished;
      frame("home", '<section class="fp-cover"><div class="fp-cover-copy"><p class="fp-eyebrow">러닝 성향 테스트</p>' +
        '<h1>달릴 때 나는 <br>어떤 러너일까?</h1>' +
        '<div class="fp-meta">31문항 · 약 4분</div><div class="fp-cover-actions">' +
        button(resume ? "resume" : "start", resume ? (page + 1) + "번째 화면부터 이어하기" : "내 러닝 성향 알아보기", true) +
        (resume ? button("restart", "처음부터 다시 하기") : "") + '</div></div>' +
        '<figure><img width="1200" height="800" src="' + asset("art/club-cover.webp") +
        '" fetchpriority="high" alt="현관에서 운동화 끈을 묶는 러너"></figure></section>', focus);
    }
    function begin() {
      snapshot();
      current = {version:model.version,id:newId(),at:new Date().toISOString(),answers:{},finished:false};
      page = 0;
      personalName = "";
      selectedComparison = "";
      storyState = {};
      remember("quiz");
      saveDraft();
      quiz();
    }
    function choices(item) {
      if (itemById.has(item.id)) {
        return model.labels.map((label, index) => ({id:index === 3 ? "unknown" : index, label}));
      }
      return item.options;
    }
    function question(item, answers) {
      const multi = item.multiple === true;
      const options = choices(item);
      const selected = answers[item.id];
      return '<fieldset class="fp-question"><legend>' + escape(item.text) + '</legend>' +
        (multi ? '<p class="fp-helper">여러 개 골라도 돼요.</p>' : '') +
        '<div class="fp-choices' + (itemById.has(item.id) ? ' fp-ratings' : '') + '">' +
        options.map(option => {
          const checked = (multi ? Array.isArray(selected) && selected.includes(option.id) : option.id === selected);
          return '<label class="fp-option"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' +
            item.id + '" value="' + escape(option.id) + '"' + (checked ? ' checked' : '') + '><span>' +
            escape(option.label) + '</span></label>';
        }).join("") + '</div></fieldset>';
    }
    function quiz() {
      frame("quiz", '<section class="fp-quiz"><header class="fp-progress">' +
        '<button data-fp="previous" class="fp-text">이전</button><h1 class="fp-sr">러닝 성향 테스트</h1>' +
        '<span aria-label="검사 진행">' + (page + 1) + '/' + pages.length + '</span></header>' +
        '<progress aria-label="검사 진행" value="' + (page + 1) + '" max="' + pages.length + '"></progress>' +
        (page === 1 ? '<p class="fp-guide">문장마다 하나씩 고르세요. 처음이라면 해 보고 싶은 정도로 골라요.</p>' : '') +
        '<div class="fp-question-set">' + pages[page].map(item => question(item, current.answers)).join("") +
        '</div><div class="fp-quiz-foot">' + button("next", page === pages.length - 1 ? "내 결과 보기" : "다음", true) +
        '</div></section>');
    }
    function setAnswer(input) {
      if (view !== "quiz" || !current) return;
      const item = pages[page].find(row => row.id === input.name);
      if (!item) return;
      const option = choices(item).find(row => String(row.id) === input.value);
      if (!option) return;
      if (current.finished) {
        snapshot();
        current = {...current,id:newId(),at:new Date().toISOString(),answers:{...current.answers},finished:false};
        storyState = {}; personalName = ""; selectedComparison = "";
        remember("quiz",false);
      }
      if (item.multiple) {
        const id = option.id;
        const values = new Set(current.answers[item.id] || []);
        if (input.checked) {
          if (id === "unknown") values.clear();
          else values.delete("unknown");
          values.add(id);
        } else values.delete(id);
        current.answers[item.id] = [...values];
        for (const other of input.closest("fieldset").querySelectorAll("input")) other.checked = values.has(other.value);
      } else current.answers[item.id] = option.id;
      saveDraft();
    }
    function proof(ids, answers) {
      const list = ids.map(id => {
        const item = itemById.get(id);
        const value = answers[id];
        if (!item) return "";
        const label = model.labels[value] || (value === "unknown" ? model.labels[3] : "답하지 않음");
        return '<li><span>' + escape(item.text) + '</span><b>' + escape(label) + '</b></li>';
      }).join("");
      return '<ul class="fp-proof">' + list + '</ul>';
    }
    function score(side) {
      return side.mean === null ? '응답 없음' : (Math.round(side.mean * 100) / 100) + '/2점';
    }
    function axisPanel(axis, answers) {
      return '<section class="fp-axis"><h3><span>' + escape(axis.label) + '</span><strong>' +
        escape(badge(axis)) + '</strong></h3>' +
        '<div class="fp-bars">' + axis.sides.map(side => '<div><b>' + escape(side.label) + '</b>' +
          (side.mean === null ? '' : '<progress max="2" value="' + side.mean + '" aria-label="' +
             escape(side.label) + ' 응답 평균"></progress>') + '<small>' + score(side) +
          (side.count ? ' · 답 ' + side.count + '개' : '') + '</small></div>').join("") + '</div>' +
        '<details><summary>내가 고른 답</summary>' +
        proof(model.items.filter(item => item.axisId === axis.id).map(item => item.id), answers) + '</details></section>';
    }
    const factTitles = {strength:"자신 있는 것", goal:"다음 목표", learning:"배우고 싶은 방식",
      motives:"요즘 뛰는 이유", eagerness:"달릴 날을 기다리는 마음", distanceLevel:"쉬지 않고 뛰어 본 거리", challenge:"힘들어지는 구간"};
    function fact(id, answers) {
      const item = extraById.get(id);
      const values = Array.isArray(answers[id]) ? answers[id] : [answers[id]];
      const picked = item.options.filter(option => values.includes(option.id));
      if (!picked.length) return '<div class="fp-empty-fact"><b>' + factTitles[id] + '</b><span>답하지 않음</span></div>';
      const label = picked.map(option => option.label).join(" · ");
      return '<details class="fp-fact"><summary><b>' + factTitles[id] + '</b><span>' + escape(label) +
        '</span></summary><p>' + escape(item.text) + ' → ' + escape(label) + '</p></details>';
    }
    function reasonText(result, answers) {
      const sides = result.defaultKey.split("+");
      const reasons = {distance:"조금 더 멀리 달리는", speed:"짧게 속도를 내는", numbers:"페이스를 숫자로 확인하는",
        senses:"몸의 느낌을 살피는", familiar:"아는 길을 다시 뛰는", explore:"새 길로 뛰어 보는",
        plan:"미리 정해 두는", improvise:"그날 정하는"};
      if (sides.every(side => reasons[side])) return sides.length === 2 ?
        reasons[sides[0]] + " 것도 좋고 " + reasons[sides[1]] + " 것도 좋다고 답했어요." :
        reasons[sides[0]] + " 게 좋다고 답했어요.";
      const both = result.axes.filter(axis => axis.state === "both").map(axis => axis.label);
      if (both.length) return both.join(", ") + "에서 두 가지 모두 좋아한다고 답했어요.";
      const neither = result.axes.filter(axis => axis.state === "neither").map(axis => axis.label);
      if (neither.length) return neither.join(", ") + "에서 두 쪽 모두 별로 끌리지 않는다고 답했어요.";
      if (!result.anyAnswered) return model.items.some(item => answers[item.id] === "unknown") ?
        "‘아직 모르겠어’로 남긴 문항에는 점수를 매기지 않았어요." : "아직 성향 문항에서 고른 답이 없어요.";
      if (result.axes.every(axis => axis.state === "insufficient")) return "두 쪽을 비교하기엔 아직 고른 답이 적어요.";
      return "지금은 한쪽으로 뚜렷하게 기울지 않았어요. 짝마다 고른 답을 펼쳐 보세요.";
    }
    function compareBlock(result) {
      const previous = records().filter(row => row.id !== current.id && row.at < current.at);
      if (!previous.length) return "";
      const earlier = previous.find(row => row.id === selectedComparison);
      const then = earlier && model.evaluate(earlier.answers);
      return '<section class="fp-section"><h2>지난 답과 나란히 보기</h2><label class="fp-select-label">비교할 날짜 ' +
        '<select data-fp-change="compare"><option value="">날짜 선택</option>' + previous.map(row =>
          '<option value="' + escape(row.id) + '"' + (row === earlier ? ' selected' : '') + '>' +
          escape(dateLabel(row.at)) + '</option>').join("") + '</select></label>' +
        (then ? '<table class="fp-compare"><thead><tr><th>러닝 취향</th><th>지난 답</th><th>이번 답</th></tr></thead><tbody>' +
          result.axes.flatMap((axis, i) => axis.sides.map((side,j) => '<tr><th scope="row">' + escape(side.label) +
            '</th><td>' + score(then.axes[i].sides[j]) + '</td><td>' + score(side) + '</td></tr>')).join("") +
            '</tbody></table>' : '') + '</section>';
    }
    function resultView(focus = true) {
      const answers = current.answers;
      const result = model.evaluate(answers);
      const art = extras?.artFor?.(result, result.defaultName);
      const artSide = result.axes.flatMap(axis => axis.sides).find(side => side.id === art?.direction);
      const canonical = result.choices.find(choice => choice.name === personalName);
      personalName = canonical?.name || result.defaultName;
      const head = '<section class="fp-result-top"><div class="fp-result-copy"><p class="fp-eyebrow">내 러닝 성향</p>' +
        '<h1>' + escape(result.defaultName) + '</h1><p class="fp-reading">' + escape(reasonText(result,answers)) + '</p>' +
        (result.evidence.length ? '<details><summary>이 이름이 나온 내 답</summary>' + proof(result.evidence, answers) + '</details>' : '') +
        '</div>' + (art?.image ? '<figure class="fp-runner"><img src="' + asset(art.image) + '" alt="' +
        escape(art.alt || "") + '">' + (artSide ? '<figcaption>' + escape(artSide.label) +
        '를 그린 캐릭터</figcaption>' : '') + '</figure>' : '') + '</section>';
      const nameChoice = result.choices.length > 1 ? '<section class="fp-section"><label class="fp-select-label">이미지에 넣을 별명 ' +
        '<select data-fp-change="name">' + result.choices.map(choice => '<option' +
          (choice.name === personalName ? ' selected' : '') + '>' + escape(choice.name) + '</option>').join("") +
        '</select></label><p>동점인 별명 중에서 골라요. 친구에게 보내는 링크에는 기본 별명이 담겨요.</p></section>' : '';
      frame("result", head + '<section class="fp-section"><h2>네 짝으로 보는 내 취향</h2><div class="fp-axis-list">' +
        result.axes.map(axis => axisPanel(axis, answers)).join("") + '</div></section>' +
        '<section class="fp-section"><h2>지금의 나</h2><div class="fp-facts">' +
        Object.keys(factTitles).map(id => fact(id, answers)).join("") + '</div></section>' +
        nameChoice + '<div id="fp-extras"></div><div id="fp-profile"></div>' +
        '<section class="fp-section fp-save"><h2>이번 답 보관하기</h2><p>이 기기에서 지난 답과 다시 비교할 수 있어요. 민감한 답은 보관하지 않아요.</p>' +
        '<div class="fp-actions">' + button("save", "내 보관함에 저장", true) +
        button("archive", "내 보관함") + button("edit", "내 답 다시 보기") + '</div></section>' +
        compareBlock(result), focus);
      const featureHost = main.querySelector("#fp-extras");
      extras?.mount(featureHost, {result, answers, selectedName:personalName, storyState, shared:received,
        onStoryChange: next => { if (next && typeof next === "object") storyState = next; }});
      const projection = {};
      for (const id of ["learning","distanceLevel","strength","goal"]) if (answers[id]) projection[id] = answers[id];
      window.RBPairsProfile?.mount(main.querySelector("#fp-profile"), result, projection, current.at,
        () => extras?.profilePreferences?.(storyState) || {});
    }
    function saveResult() {
      const entry = {id:current.id, version:model.version, at:current.at, answers:safeAnswers(current.answers),
        stories:extras?.archiveStories?.(storyState) || {}, personalName};
      if (write("localStorage", archivePrefix + entry.id, entry)) notify("이번 답을 이 기기에 보관했어요.");
      else notify("이 브라우저에서는 보관할 수 없어요. 카드를 이미지로 저장해 주세요.");
    }
    function archive() {
      const entries = records();
      frame("archive", '<section class="fp-section fp-library"><h1>내 러너 보관함</h1>' +
        (entries.length ? '<ul>' + entries.map(row => '<li><button data-fp="open" data-id="' + escape(row.id) +
          '"><small>' + escape(dateLabel(row.at)) + '</small><b>' + escape(model.evaluate(row.answers).defaultName) +
          '</b></button><button class="fp-text" data-fp="remove" data-id="' + escape(row.id) +
          '" aria-label="' + escape(dateLabel(row.at)) + ' 답 지우기">지우기</button></li>').join("") + '</ul>' :
          '<p>아직 보관한 답이 없어요. 결과에서 ‘내 보관함에 저장’을 누르면 여기에 남아요.</p>') +
        '<a class="fp-legacy" href="' + escape(legacyURL.href) + '">이전 버전 보관함 열기 ↗</a></section>');
    }
    function openSaved(id) {
      const record = read("localStorage", archivePrefix + id);
      if (!validRecord(record)) { archive(); return; }
      snapshot();
      current = {...record, answers:safeAnswers(record.answers), finished:true};
      personalName = typeof record.personalName === "string" ? record.personalName : "";
      selectedComparison = "";
      storyState = extras?.archiveStories?.(record.stories) || {};
      resultView();
    }
    function nextPage() {
      if (page === pages.length - 1) {
        if (!current.finished) {
          current.finished = true;
          current.at = new Date().toISOString();
          draftId = "";
          write("sessionStorage", draftKey, null);
        }
        snapshot();
        remember("result"); resultView(); scene.audio.effect("reveal");
      } else {
        page++; saveDraft(); remember("quiz"); quiz(); scene.audio.effect("turn");
      }
    }
    function click(event) {
      const target = event.target.closest("[data-fp]");
      if (!target) return;
      switch (target.dataset.fp) {
        case "home": remember("home"); home(); break;
        case "sound":
          scene.audio.set(!scene.audio.enabled());
          target.outerHTML = soundButton();
          mast.querySelector('[data-fp="sound"]').focus();
          if (scene.audio.enabled()) scene.audio.effect("tap");
          break;
        case "start": begin(); break;
        case "restart":
          if (window.confirm("이어서 하던 답을 지우고 처음부터 다시 할까요?")) begin();
          break;
        case "resume": remember("quiz"); quiz(); break;
        case "previous":
          if (page > 0 && history.state?.wasQuiz) { history.back(); }
          else if (page > 0) { page--; saveDraft(); remember("quiz",false); quiz(); }
          else { remember("home",false); home(); }
          break;
        case "next": nextPage(); break;
        case "edit":
          snapshot();
          current = {id:newId(), version:model.version, at:new Date().toISOString(), answers:{...current.answers},finished:false};
          page = 0; storyState = {}; selectedComparison = ""; personalName = ""; saveDraft(); remember("quiz"); quiz(); break;
        case "save": saveResult(); break;
        case "archive": remember("archive"); archive(); break;
        case "open": openSaved(target.dataset.id); if (view === "result") remember("result"); break;
        case "remove":
          if (window.confirm("이 기기에 보관한 이 답을 지울까요?")) {
            if (write("localStorage", archivePrefix + target.dataset.id, null)) archive();
            else notify("보관한 답을 지우지 못했어요.");
          }
          break;
      }
    }
    const changed = event => {
      const el = event.target;
      if (el.matches(".fp-option input")) setAnswer(el);
      else if (el.dataset.fpChange === "name") {
        personalName = el.value; resultView(false);
        main.querySelector('[data-fp-change="name"]')?.focus({preventScroll:true});
      } else if (el.dataset.fpChange === "compare") {
        selectedComparison = el.value; resultView(false);
        main.querySelector('[data-fp-change="compare"]')?.focus({preventScroll:true});
      }
    };
    document.addEventListener("click", click);
    main.addEventListener("change", changed);
    window.addEventListener("rb-pairs-start", begin);
    function initial(focus = false) {
      if (extras && (received || location.hash.startsWith("#pairs="))) {
        frame("received", '<section id="fp-received" class="fp-section"></section>', focus);
        extras.mountReceived(main.firstElementChild, received);
      } else home(focus);
    }
    window.addEventListener("popstate", event => {
      const state = event.state || {};
      if (!ownsRoute()) { location.reload(); return; }
      if (current && state.fpId && state.fpId !== current.id) { snapshot(); restore(state.fpId); }
      if (state.fpView === "archive") { archive(); return; }
      if (state.fpView === "quiz" && current?.id === state.fpId && validPage(state.fpPage)) {
        page = state.fpPage; saveDraft(); quiz(); return;
      }
      if (state.fpView === "result") {
        if (current?.id === state.fpId && current.finished) { resultView(); return; }
        if (validRecord(read("localStorage", archivePrefix + state.fpId))) { openSaved(state.fpId); return; }
      }
      if (state.fpView === "home") home(); else initial(true);
    });
    window.addEventListener("hashchange", () => {
      if (!ownsRoute()) { location.reload(); return; }
      received = extras?.readShared() || null;
      initial(true);
    });
    initial();
  }
  window.RBPairsUI = {ownsRoute, start};
})();
