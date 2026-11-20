/* Each episode lives in the catalog. Opening a shared ending leaves the reader's own choice intact. */
window.RBStories = (() => {
  "use strict";
  const groups = {weather:"날씨", race:"대회", gear:"러닝화·장비", community:"러닝 친구", routine:"일상", travel:"여행"};
  const sourceNames = {event:"대회 안내", brand:"브랜드 발표", community:"커뮤니티 글", weather:"날씨 자료"};
  const storagePrefix = "runbti.story.v1.";
  const kstDay = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const available = (s, day) => (!s.validFrom || day >= s.validFrom) && (!s.validUntil || day <= s.validUntil);
  const formatDate = date => String(date || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_,y,m,d) => `${y}년 ${+m}월 ${+d}일`);

  function sourceURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }

  function create({main, output, esc, asset, icon, load, save, notify, note}) {
    const data = Array.isArray(window.RBStoryCatalog) ? window.RBStoryCatalog : [];
    const catalog = data.filter(s => s && Object.hasOwn(groups, s.category) && Array.isArray(s.choices));
    const byId = new Map(catalog.map(s => [s.id, s]));
    const memory = new Map();
    let category = "all", current = null, ending = null, shared = false, shelfPosition = 0;
    const latestPick = id => memory.get(id) ?? load(storagePrefix + id, null);
    const illustration = s => asset(/^art\/[a-z0-9-]+\.webp$/.test(s.art) ? s.art : "art/q-00.webp");
    function active() {
      const day = kstDay();
      const news = [], lanes = new Map(Object.keys(groups).map(key => [key, []]));
      for (const story of catalog) {
        if (!available(story, day)) continue;
        if (story.validFrom || story.validUntil) news.push(story);
        else lanes.get(story.category).push(story);
      }
      const dateOf = s => s.source?.asOf || s.validFrom || "";
      const newest = (a,b) => dateOf(b).localeCompare(dateOf(a));
      news.sort(newest);
      const queues = [...lanes.values()].filter(rows => rows.length);
      for (const rows of queues) rows.sort(newest);
      queues.sort((a,b) => newest(a[0], b[0]));
      const ordered = [...news];
      for (let i = 0; queues.some(rows => i < rows.length); i++)
        for (const rows of queues) if (rows[i]) ordered.push(rows[i]);
      return ordered;
    }

    function urlFor(id, choice, forSharing = false, listFilter = "all") {
      const here = new URL(location.href);
      let url = new URL(here.pathname, here);
      if (forSharing && !/^https?:$/.test(here.protocol)) {
        const athlete = here.searchParams.get("edition") === "athlete";
        url = new URL("https://" + (athlete ? "athlete-time.netlify.app" : "trainoracle.io") + "/run-bti/index.html");
        url.searchParams.set("edition", athlete ? "athlete" : "train");
      } else if (here.searchParams.has("edition")) {
        url.searchParams.set("edition", here.searchParams.get("edition"));
      }
      url.searchParams.set("test", "stories");
      if (!id && listFilter !== "all") url.searchParams.set("topic", listFilter);
      if (id) url.searchParams.set("story", id);
      if (choice) url.searchParams.set("choice", choice);
      return url.href;
    }
    function rememberPosition() {
      if (!main.querySelector(".story-shelf")) return;
      shelfPosition = window.scrollY;
      try { history.replaceState({...history.state, rbStoryScroll:shelfPosition}, ""); } catch {}
    }
    window.addEventListener("pagehide", rememberPosition);
    function navigate(id, replace = false) {
      rememberPosition();
      const next = urlFor(id, null, false, category);
      if (location.href !== next) {
        try { history[replace ? "replaceState" : "pushState"](id ? null : {rbStoryScroll:shelfPosition}, "", next); } catch {}
      }
    }
    function clearRoute() {
      const url = new URL(location.href);
      if (url.searchParams.get("test") !== "stories" && !url.searchParams.has("story")) return;
      for (const key of ["test", "story", "choice", "topic"]) url.searchParams.delete(key);
      try { history.replaceState(null, "", url.href); } catch {}
    }
    function image(s, lazy = false) {
      return `<img src="${esc(illustration(s))}" alt="" decoding="async" ${lazy ? 'loading="lazy"' : ''}>`;
    }
    function episodeLink(s, contents, klass) {
      return `<a class="${klass}" data-story-act="episode" data-story-id="${esc(s.id)}" href="${esc(urlFor(s.id))}">${contents}</a>`;
    }
    function shelfLink() {
      return `<a class="back story-back" data-story-act="shelf" href="${esc(urlFor(null,null,false,category))}">${icon("left")} 이야기 목록</a>`;
    }
    function homeFeature() {
      const list = active();
      if (!list.length) return "";
      const covers = ["race", "gear", "weather"].map(k => list.find(s => s.category === k)).filter(Boolean);
      return `<section class="story-feature"><div><h2>러닝 이야기</h2><p>비가 그친 저녁부터 대회 전날까지. 한 장면을 골라 내 이야기로 이어 가요.</p><a href="${esc(urlFor())}" data-story-act="shelf" class="btn primary">이야기 ${list.length}편 보기 ${icon("arrow")}</a></div><div class="story-strip" aria-hidden="true">${covers.map(s => image(s, true)).join("")}</div></section>`;
    }
    function savedEntry() {
      const n = active().filter(s => s.choices.some(c => c.id === latestPick(s.id))).length;
      return n ? `<section class="panel sectionhead"><div><h2>내가 고른 이야기</h2><p>결말까지 읽은 이야기 ${n}편을 다시 볼 수 있어요.</p></div><button class="btn light sm" data-story-act="mine">내 이야기 보기</button></section>` : "";
    }
    function tile(s) {
      const read = s.choices.some(c => c.id === latestPick(s.id));
      const meta = `<span class="story-meta">${esc(groups[s.category])}${read ? '<span class="story-read">읽음</span>' : ""}</span>`;
      return episodeLink(s, `<div class="story-tile-art">${image(s,true)}</div><div class="story-tile-copy">${meta}<h3>${esc(s.title)}</h3></div>`, "story-tile");
    }
    function matchesFilter(s) {
      if (category === "mine") return s.choices.some(c => c.id === latestPick(s.id));
      return category === "all" || category === s.category;
    }
    function shelf(message = "") {
      current = ending = null;
      shared = false;
      const stories = active();
      const filtered = stories.filter(matchesFilter);
      const filters = {all:"전체", ...groups, mine:"읽은 이야기"};
      const buttons = Object.entries(filters).map(([key,label]) =>
        `<button type="button" data-story-act="filter" data-filter="${key}" aria-pressed="${key === category}">${label}</button>`).join("");
      const empty = category === "mine" ? "마음에 드는 이야기에서 다음 장면을 골라 보세요. 여기에서 다시 볼 수 있어요." : "지금 이 주제로 읽을 수 있는 이야기가 없어요.";
      output(`<div class="story-shelf"><button class="back story-back" data-act="home">${icon("left")} 테스트 홈</button><div class="story-shelf-head"><h1>러닝 이야기</h1><p>이럴 때 나는 어떻게 할까? 마음에 드는 이야기부터 펼쳐 보세요.</p></div>${message ? `<p class="story-status" role="status">${esc(message)}</p>` : ""}<div class="story-filters" role="group" aria-label="이야기 주제">${buttons}</div><div class="story-grid">${filtered.map(tile).join("") || `<p class="story-empty">${empty}</p>`}</div></div>`, "stories");
    }
    function sourceInfo(s) {
      const src = s.source;
      const url = src && sourceURL(src.url);
      if (!url) return "";
      let dateText = "자료 기준 " + formatDate(src.asOf);
      if (src.kind === "weather" && src.issuedAt && Number.isFinite(Date.parse(src.issuedAt))) {
        const issued = new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul",dateStyle:"long",timeStyle:"short"}).format(new Date(src.issuedAt));
        dateText = src.note?.includes("한국시간 발표") ? "" : "예보 발표 " + issued + " (한국시간)";
      }
      return `<aside class="story-source"><h2>이야기의 배경</h2><p>${esc(src.note)}</p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(src.name)} · ${esc(sourceNames[src.kind] || "원문")} ↗</a><small>${dateText ? esc(dateText) + " · " : ""}장면과 대사는 재구성했어요.</small></aside>`;
    }
    function related(s, choice) {
      const today = kstDay();
      const direct = byId.get(choice.next);
      const next = direct && direct.id !== s.id && available(direct, today) ? direct : null;
      const previous = catalog.filter(t => t.links?.includes(s.id) || t.choices.some(c => c.next === s.id)).map(t => t.id);
      const ids = [...new Set([...(s.links || []), ...previous])];
      const also = ids.map(id => byId.get(id)).filter(t => t && t.id !== s.id && t.id !== next?.id && available(t, today));
      const links = also.map(t => episodeLink(t, esc(t.title) + icon("arrow"), "story-next")).join("");
      return `${next ? `<section class="story-related"><h2>이 선택으로 이어지는 이야기</h2>${episodeLink(next, esc(next.title) + icon("arrow"), "story-next")}</section>` : ""}${also.length ? `<section class="story-related"><h2>관련 이야기</h2>${links}</section>` : ""}`;
    }
    function read(s, choice, fromFriend = false) {
      current = s;
      ending = choice || null;
      shared = fromFriend && !!choice;
      const archived = s.validUntil && s.validUntil < kstDay();
      const span = [s.validFrom && formatDate(s.validFrom) + "부터", s.validUntil && formatDate(s.validUntil) + "까지"].filter(Boolean).join(" ");
      const context = archived ? `지난 이야기 · 한국시간 ${formatDate(s.validUntil)}까지 소개했어요.` : span ? `소개 기간 · 한국시간 ${span}` : "";
      const meta = `<p class="story-meta">${esc(groups[s.category])} · ${s.source ? "자료로 만든 이야기" : "창작 이야기"}</p>`;
      const options = s.choices.map(c => `<button type="button" data-story-act="pick" data-choice="${esc(c.id)}">${esc(c.label)}${icon("arrow")}</button>`).join("");
      const decision = `<div class="story-opening"><p>${esc(s.opening)}</p><h2>${esc(s.prompt)}</h2><div class="story-answers">${options}</div></div>`;
      const recap = `<details class="story-recap"${shared ? " open" : ""}><summary>처음 장면 보기</summary><p>${esc(s.opening)}</p></details>`;
      const outcome = choice ? `<div class="story-ending">${recap}<p class="story-picked">${shared ? "이 링크에 담긴 선택" : "내가 고른 선택"} · ${esc(choice.label)}</p><p class="story-then">${esc(choice.then)}</p><blockquote>${esc(choice.line)}</blockquote><div class="story-talk"><h2>같이 얘기해 볼까?</h2><p>${esc(s.question)}</p></div><div class="actions"><button class="btn primary" data-story-act="share">${icon("share")} 이 장면 공유하기</button><button class="btn light" data-story-act="again">${shared ? "나는 어떻게 할까?" : "다른 선택 해보기"}</button></div></div>` : "";
      output(`<article class="story-reader">${shelfLink()}${context ? `<p class="story-status">${esc(context)}</p>` : ""}<div class="story-spread"><div class="story-art">${image(s)}</div><div class="story-prose">${meta}<h1>${esc(s.title)}</h1>${choice ? outcome : decision}</div></div>${choice ? related(s, choice) : ""}${sourceInfo(s)}</article>`, "stories");
    }
    function open(id, selected, filter = category) {
      window.RBScene.audio.stop();
      if (!id) {
        category = filter === "mine" || Object.hasOwn(groups, filter) ? filter : "all";
        shelf();
        shelfPosition = Number(history.state?.rbStoryScroll) || 0;
        if (shelfPosition > 0) window.scrollTo(0, shelfPosition);
        return;
      }
      const s = byId.get(id);
      if (!s || (s.validFrom && s.validFrom > kstDay())) {
        shelf("지금은 이 이야기를 열 수 없어요. 목록에서 다른 이야기를 골라 보세요.");
        return;
      }
      const saved = s.choices.find(c => c.id === latestPick(id));
      const linked = s.choices.find(c => c.id === selected);
      read(s, selected ? linked : saved, !!linked);
    }
    async function share() {
      if (!current || !ending) return;
      const url = urlFor(current.id, ending.id, true);
      if (navigator.share && location.protocol !== "file:") {
        try {
          await navigator.share({title: "런비티아이 · " + current.title, text: ending.line + "\n" + current.question, url});
          return;
        } catch (error) { if (error.name === "AbortError") return; }
      }
      try {
        await navigator.clipboard.writeText(url);
        notify("이 장면의 링크를 복사했어요.");
      } catch {
        note("이 장면 공유하기", `<label class="field">복사할 이야기 링크<input type="url" readonly value="${esc(url)}"></label>`);
        const input = document.querySelector("#modal input");
        input.focus(); input.select();
      }
    }
    main.addEventListener("click", event => {
      const control = event.target.closest("[data-story-act]");
      if (!control || (control.tagName === "A" && (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey))) return;
      event.preventDefault();
      const action = control.dataset.storyAct;
      if (action === "shelf" || action === "mine") {
        if (action === "mine") category = "mine";
        else if (!control.closest(".story-reader")) category = "all";
        if (!control.closest(".story-reader")) shelfPosition = 0;
        navigate(); open();
      } else if (action === "filter") {
        if (category === control.dataset.filter) return;
        category = control.dataset.filter;
        navigate(null, true); open();
        main.querySelector('[data-story-act="filter"][aria-pressed="true"]').focus({preventScroll:true});
      } else if (action === "episode") {
        navigate(control.dataset.storyId); open(control.dataset.storyId);
      } else if (action === "pick" && current) {
        const pick = current.choices.find(c => c.id === control.dataset.choice);
        if (!pick) return;
        memory.set(current.id, pick.id);
        const stored = save(storagePrefix + current.id, pick.id);
        navigate(current.id, true); read(current, pick);
        if (!stored) notify("이 브라우저에는 선택을 저장하기 어려워요. 장면 링크를 복사해 두세요.");
      } else if (action === "again" && current) {
        navigate(current.id, true); read(current, null);
      } else if (action === "share") {
        share();
      }
    });
    return {homeFeature, savedEntry, open, clearRoute};
  }
  return {create};
})();
