"use strict";
window.RBMotiveUI = {
  create({main, output, head, btn, esc, asset, load, save, notify, useLine}) {
    const {title, groups, motives, scale, score} = window.RBMotives;
    const items = groups.flatMap(g => g.items);
    const key = "runbti.motives.v1";
    const original = load(key, {}) || {};
    const read = r => r && ["experience","imagine"].includes(r.mode) && typeof r.answers === "object" && r.answers !== null ? r : null;
    let draft = read(original.draft), saved = read(original.saved), view = "";
    const reasons = [...scale, {value:"na", label:"해당 없어"}, {value:"unsure", label:"잘 모르겠어"}];
    const topics = ["art/o-03-0.webp","art/o-01-0.webp","art/o-07-1.webp","art/o-20-1.webp","art/o-09-0.webp","art/o-20-0.webp"];
    const persist = () => save(key, {draft, saved});
    function button(act, text, cls = "light", extra = "") {
      return `<button type="button" class="btn ${cls}" data-motive="${act}" ${extra}>${esc(text)}</button>`;
    }
    function page(html, next) {
      view = next;
      window.RBScene.audio.stop();
      output(`<div class="narrow motive-page">${html}</div>`, "motives");
    }
    const research = `<details class="panel motive-sources"><summary>어떤 연구를 참고했나요?</summary><p>국내 러너의 참여 동기와 마라토너 동기 척도에서 건강·친교·성취 같은 주제를 가져왔어요. 입문자의 경험과 여행지에서 달린 사람들의 이야기도 참고해 한국어 문항을 새로 썼어요.</p><p>결과는 이번에 고른 답을 정리한 내용이에요. 이 24문항의 신뢰도와 타당도는 아직 따로 검증하지 않았어요.</p><p><a target="_blank" rel="noopener" href="https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART001141925">국내 달리기 동기 연구</a> · <a target="_blank" rel="noopener" href="https://pubmed.ncbi.nlm.nih.gov/8341836/">마라토너 동기 척도</a> · <a target="_blank" rel="noopener" href="https://doi.org/10.1016/j.psychsport.2023.102515">입문 러너 면담</a> · <a target="_blank" rel="noopener" href="https://doi.org/10.1080/17450101.2020.1762462">여행지에서 달린 경험</a></p></details>`;
    function packCard() {
      return `<button class="p-card" data-act="motives"><div class="p-img"><img src="${asset("art/q-00.webp")}" loading="lazy" alt=""><span class="label">달리는 이유 · ${items.length}문항</span></div><div class="p-copy"><h3>${title}</h3><p>기록을 깨고 싶어서? 여행지 골목이 궁금해서? 내게 맞는 주제부터 골라요.</p></div></button>`;
    }
    function libraryEntry() {
      return draft || saved ? `<section class="panel sectionhead"><div><h2>${title}</h2><p>${saved ? "지난번에 고른 이유를 다시 볼 수 있어요." : "답하던 동기 문항이 있어요."}</p></div>${btn("motives", saved ? "내 이유 보기" : "이어서 답하기", "light sm")}</section>` : "";
    }
    function fromResult() {
      return `<section class="panel motive-invite"><h2>다시 뛰고 싶은 이유는 뭘까?</h2><p>훈련하는 재미와 머리를 식히고 싶은 마음은 함께 있을 수 있어요.</p>${btn("motives",saved ? "내가 고른 이유 보기" : title,"light sm")}</section>`;
    }
    function open() {
      if (saved && !draft) { result(); return; }
      if (draft) { hub(); return; }
      page(`${head(title, "달리는 이유")}<div class="motive-intro"><img src="${asset("art/q-00.webp")}" alt=""><p>결승선을 지나고 싶은 날도 있고 머리 좀 식히러 나가는 날도 있죠. 요즘 내 마음에 가까운 말을 골라 보세요.</p><p class="hint">${groups.length}개 주제 · ${items.length}문항. 해 본 적 없는 주제는 통째로 건너뛸 수 있어요.</p><div class="actions">${button("begin","뛰어 본 날 떠올리기","primary",'data-mode="experience"')}${button("begin","첫 러닝 상상하기","light",'data-mode="imagine"')}</div></div>${research}`, "intro");
    }
    function hub() {
      const tracker = groups.map((g,i) => {
        const marked = g.items.filter(it => draft.answers[it.id] !== undefined).length;
        const allNA = g.items.every(it => draft.answers[it.id] === "na");
        return `<button class="motive-topic" data-motive="topic" data-group="${i}"><img src="${asset(topics[i])}" alt=""><span><b>${esc(g.title)}</b><small>${allNA ? "해당 없음" : marked ? `${marked}/${g.items.length}개 표시` : `${g.items.length}문항`}</small></span><span aria-hidden="true">›</span></button>`;
      }).join("");
      page(`${head("어떤 얘기부터 해 볼까요?", title)}<p>내 얘기가 있는 주제부터 열어 보세요. 답한 만큼만 결과에 담아요.</p>${saved ? '<p class="hint">결과를 저장하면 보관함에 새 답이 반영돼요.</p>' : ""}<div class="motive-topics">${tracker}</div><div class="actions">${button("finish","지금까지 답한 결과 보기","primary")}${saved ? button("saved","지난번 결과 보기") : ""}</div>${research}`,"hub");
    }
    function topic(index) {
      if (!groups[index]) return;
      draft.group = index;
      persist();
      const g = groups[index];
      const questions = g.items.map(it => {
        const wording = draft.mode === "imagine" ? it.imagine : it.text;
        return `<fieldset class="motive-item"><legend>${esc(wording)}</legend><div class="motive-ratings">${reasons.map(r =>
          `<label><input type="radio" name="${it.id}" value="${r.value}" ${draft.answers[it.id] === r.value ? "checked" : ""}><span>${esc(r.label)}</span></label>`
        ).join("")}</div></fieldset>`;
      }).join("");
      page(`${head(g.title,title)}<div class="motive-topline"><span>${index + 1} / ${groups.length} 주제</span>${button("hub","주제 고르기","light sm")}</div><p>${esc(g.context)}</p><p class="hint">해 본 적이 없으면 ‘해당 없어’를 골라 주세요. 경험이나 생각은 있지만 내 얘기와 다르면 ‘전혀 아니야’를 고르면 돼요.</p>${g.items.some(it=>draft.answers[it.id] === undefined) ? button("omit","이 주제의 남은 질문은 해당 없어","light sm") : ""}<div class="motive-items">${questions}</div><div class="actions">${index < groups.length-1 ? button("next","다음 주제","primary") : ""}${button("finish","여기까지 결과 보기",index === groups.length-1 ? "primary" : "light")}</div>`, "topic");
    }
    function profileRows(profiles) {
      return profiles.filter(p=>p.count).map(p => `<div class="motive-stat"><span>${esc(p.name)}</span><meter value="${p.mean}" min="0" max="3" aria-label="${esc(p.name)} 평균"></meter><small>${p.mean.toFixed(1)} / 3 · ${p.count}개 답</small></div>`).join("");
    }
    function preview(id) {
      const m = motives[id];
      const card = {pack:"base",mode:saved.mode,name:m.name,line:saved.mode === "imagine" ? m.imagineLine || m.line : m.line,sceneArt:m.art,sceneLabel:"내가 달리는 이유",prop:-1,expression:-1,charIndex:-1};
      const section = main.querySelector("#reason-selection");
      section.innerHTML = `<canvas id="reason-poster" width="1080" height="1350" aria-label="${esc(m.name + ' · ' + m.line)}" role="img"></canvas><p class="reason-action"><b>다음에 해 볼 일</b> ${esc(m.action)}</p><div class="actions">${button("download","이 이유만 이미지로 저장","primary")}${button("use","이 대사를 캐릭터 카드에 쓰기")}</div><p class="hint">지금 고른 그림과 한 줄만 이미지에 들어가요.</p>`;
      window.RBScene.draw(section.querySelector("canvas"),card,"4:5").catch(()=>notify("그림을 불러오지 못했어요."));
      return card;
    }
    let card = null;
    function result() {
      if (!saved) return open();
      const {profiles, leaders, singles, coverage:c} = score(saved.answers);
      const positive = profiles.filter(p => p.count && p.mean > 0);
      const chips = positive.map(p=>button("select",p.name,"light sm",`data-reason="${p.id}" aria-pressed="${saved.selection === p.id}"`)).join("");
      const top = leaders.map(id=>motives[id].name).join(" · ");
      const single = singles.map(id=>motives[id].name).join(" · ");
      const heading = top ? "요즘 내가 달리는 이유" : positive.length ? "내 답에서 찾은 이유" : c.answered ? "내가 뛰는 이유가 또 있나요?" : "아직 답으로 읽을 수 있는 이유가 없어요";
      const useSaved = positive.some(p=>p.id === saved.selection);
      page(`${head(heading,saved.mode === "imagine" ? "첫 러닝을 상상하며" : "뛰어 본 날을 떠올리며")}<div class="panel motive-overview">${top ? `<h2>${esc(top)}</h2><p>두 문항에 모두 답한 이유 중 평균이 가장 높았어요.</p>` : `<p>${c.answered ? "한 가지 이유로 묶지 않고 답한 내용 그대로 담았어요." : "아직 숫자로 답한 문항이 없어요. 궁금한 주제만 열어 봐도 돼요."}</p>`}${single ? `<p><b>한 문항에서 마음이 갔던 이유</b><br>${esc(single)}</p>` : ""}<small>답함 ${c.answered} · 해당 없음 ${c.na} · 잘 모르겠어 ${c.unsure} · 건너뜀·미응답 ${c.skipped+c.unanswered}</small></div>
      ${positive.length ? `<section class="panel"><h2>카드에는 어떤 이유를 남길까요?</h2><div class="actions motive-chips">${chips}</div><div id="reason-selection"></div></section>` : ""}
      <details class="panel"><summary>동기별로 내 답 보기</summary><p>숫자 답만 평균을 냈어요. 0은 ‘전혀 아니야’이고 3은 ‘정말 그래’예요.</p>${profileRows(profiles) || "<p>아직 숫자로 답한 문항이 없어요.</p>"}</details>
      <section class="panel"><label class="field"><b>내 이유를 직접 쓴다면?</b><textarea id="reason-note" rows="2" maxlength="100" placeholder="예: 주말에 들른 빵집에 한 번 더 가고 싶어서">${esc(saved.note || "")}</textarea></label><p class="hint">여기에 쓴 말은 내 보관함에 남아요.</p>${button("use-note","내 문장을 캐릭터 카드에 쓰기","light sm")}</section>
      <div class="actions">${button("edit","내 답 다시 보기","light")}${!draft ? button("switch",saved.mode === "experience" ? "첫 러닝을 상상하며 새로 답하기" : "뛰어 본 날로 새로 답하기","light") : ""}${btn("home","테스트 홈","light")}</div>${research}`, "result");
      card = useSaved ? preview(saved.selection) : null;
    }
    main.addEventListener("change", e => {
      const input=e.target;
      if (view !== "topic" || !draft || !input.closest(".motive-page") || input.type !== "radio") return;
      if (!groups[draft.group].items.some(it=>it.id === input.name)) return;
      const response = reasons.find(r=>String(r.value) === input.value);
      if (response) { draft.answers[input.name] = response.value; persist(); }
      if (groups[draft.group].items.every(it=>draft.answers[it.id] !== undefined)) main.querySelector('[data-motive="omit"]')?.remove();
    });
    main.addEventListener("input", e=>{
      if (e.target.id === "reason-note" && saved) { saved.note=e.target.value.slice(0,100); persist(); }
    });
    main.addEventListener("click",async e=>{
      const b=e.target.closest("[data-motive]");
      if (!b) return;
      switch (b.dataset.motive) {
        case "begin":
          draft={mode:b.dataset.mode === "imagine" ? "imagine" : "experience",answers:{},group:0};persist();hub();break;
        case "hub": hub();break;
        case "topic": topic(Number(b.dataset.group));break;
        case "next": topic(draft.group+1);break;
        case "omit": {
          const g=groups[draft.group];
          for (const it of g.items) if (draft.answers[it.id] === undefined) draft.answers[it.id]="na";
          persist();hub();break;
        }
        case "finish":
          saved={...draft,answers:{...draft.answers}};draft=null;
          if (!persist()) notify("이 브라우저에서는 결과를 보관할 수 없어요. 이미지를 저장해 주세요.");
          result();break;
        case "saved": result();break;
        case "switch":
          draft={mode:saved.mode === "experience" ? "imagine" : "experience",answers:{},group:0};
          persist();hub();break;
        case "edit":
          if (!draft) draft={...saved, answers:{...saved.answers}};
          persist();hub();break;
        case "select": {
          const id=b.dataset.reason;
          if (!Object.hasOwn(motives,id)) break;
          saved.selection=id;persist();
          for (const el of main.querySelectorAll("[data-reason]")) el.setAttribute("aria-pressed",String(el===b));
          card=preview(id);break;
        }
        case "download":
          if (card) try { await window.RBScene.download(card,"4:5");notify("고른 이유를 이미지로 저장했어요."); }
          catch { notify("이미지를 저장하지 못했어요. 화면을 캡처해 주세요."); } break;
        case "use":
          if (card) useLine(card.line,saved.mode);
          break;
        case "use-note": {
          const line=(saved.note || "").trim();
          if (line) useLine(line,saved.mode); else main.querySelector("#reason-note").focus();
          break;
        }
      }
    });
    return {open, packCard, libraryEntry, fromResult};
  },
};
