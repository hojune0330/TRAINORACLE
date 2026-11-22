// A shared scene is reconstructed from the published question. No answer history travels with it.
window.RBFriend = (() => {
  "use strict";
  const offsets = {base:0, buddy:9, record:15};
  const pad = n => String(n).padStart(2, "0");
  const knownMode = mode => mode === "experience" || mode === "imagine";

  function read(ref) {
    if (!ref || typeof ref !== "object") return null;
    const mode = ref.mode;
    if (ref.source === "story") {
      const story = window.RBStoryCatalog.find(s => s.id === ref.story);
      if (!story) return null;
      return {title:story.title, opening:story.opening, prompt:story.prompt, art:story.art,
        context:knownMode(mode) ? mode : null,
        choices:story.choices.map(c => {
          const post = window.RBStoryMatch.postQuestion.choices.find(p => c.signals?.includes(p.signal));
          return {id:c.id, text:c.label, posting:post?.signal,
            art:post ? post.art : window.RBRepresentative.endingArt(story,c)?.art};
        })};
    }
    if (!knownMode(mode)) return null;
    if (ref.source === "post") {
      const post = window.RBStoryMatch.postQuestion;
      return {title:post.scene, prompt:mode === "imagine" ? post.imagine : post.prompt,
        art:"art/q-06.webp", context:mode,
        choices:post.choices.map(c => ({id:c.signal, text:c.label, posting:c.signal, art:c.art}))};
    }
    if (ref.source !== "quiz" || !Object.hasOwn(offsets, ref.pack) || !Number.isInteger(ref.q)) return null;
    const q = window.RB.packs[ref.pack].questions[ref.q];
    if (!q) return null;
    const variant = ref.chat === true && q.chat ? q.chat : q;
    return {title:q.scene, prompt:mode === "imagine" ? variant.imagine : variant.prompt,
      art:"art/q-" + pad(offsets[ref.pack] + ref.q) + ".webp", context:mode,
      choices:window.RB.answerOptions(q, mode, ref.chat === true).map((text,i) => ({id:i, text,
        art:"art/o-" + pad(offsets[ref.pack] + ref.q) + "-" + i + ".webp"}))};
  }

  function fromProfile(profile) {
    for (const e of profile.direction.evidence || []) {
      if (e.id === "motive") continue;
      if (e.choiceId) {
        const ref = {source:"story", story:e.id, mode:knownMode(e.mode) ? e.mode : null, choice:e.choiceId};
        if (read(ref)?.choices.some(c => c.id === ref.choice && c.text === e.answer)) return ref;
      } else if (["record","base"].includes(e.id) && e.itemId === window.RBStoryMatch.postQuestion.id) {
        const ref = {source:"post", mode:e.mode};
        const c = read(ref)?.choices.find(c => c.text === e.answer);
        if (c) return {...ref, choice:c.id};
      } else {
        for (const chat of [false,true]) {
          const ref = {source:"quiz", pack:e.id, q:e.itemId, mode:e.mode, chat};
          const c = read(ref)?.choices.find(c => c.text === e.answer);
          if (c) return {...ref, choice:c.id};
        }
      }
    }
    return null;
  }

  function clean(ref, includeAnswer) {
    const scene = read(ref);
    if (!scene) return null;
    const out = {source:ref.source, mode:scene.context};
    if (ref.source === "story") out.story = ref.story;
    if (ref.source === "quiz") Object.assign(out, {pack:ref.pack, q:ref.q, chat:ref.chat === true});
    // If an editor later rewrites this scene, do not attribute its new wording to a previous sender.
    const content = JSON.stringify([scene.opening, scene.prompt, scene.choices.map(c => [c.id,c.text])]);
    let revision = 0;
    for (const ch of content) revision = (Math.imul(31,revision) + ch.codePointAt(0)) >>> 0;
    out.revision = revision;
    if (includeAnswer && (ref.revision === undefined || ref.revision === revision) &&
        scene.choices.some(c => c.id === ref.choice)) out.choice = ref.choice;
    return out;
  }
  function url(key, data) {
    const u = new URL(location.pathname, location.origin);
    const edition = new URL(location.href).searchParams.get("edition");
    if (["athlete","train"].includes(edition)) u.searchParams.set("edition", edition);
    u.hash = key + "=" + encodeURIComponent(JSON.stringify(data));
    return u.href;
  }

  async function deliver(value, {link, useShare, output, notify}) {
    if (useShare && navigator.share) {
      try {
        await navigator.share(link ? {title:"내 런비티아이", url:value} : {text:value});
        return;
      } catch (err) { if (err.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(value);
      notify(link ? "친구에게 보낼 링크를 복사했어요." : "답장을 복사했어요. 친구와 나누던 대화에 붙여 넣으세요.");
    } catch {
      const label = document.createElement("label");
      label.className = "field";
      label.textContent = link ? "길게 눌러 링크 복사" : "길게 눌러 답장 복사";
      const field = document.createElement("textarea");
      field.readOnly = true;
      field.rows = link ? 3 : 2;
      field.value = value;
      label.appendChild(field);
      output.replaceChildren(label);
      field.focus();
      field.select();
    }
  }

  function mount(container, ref, {esc, notify}) {
    const scene = read(ref);
    if (!scene) return;
    const sender = scene.choices.find(c => c.id === ref.choice);
    const context = {imagine:"첫 러닝을 상상하며", experience:"뛰어 본 날을 떠올리며"}[scene.context];
    container.innerHTML = `<h2>친구에게 한 장면 답하기</h2>${context ? `<p class="hint">${context}</p>` : ""}
      ${scene.opening ? `<p>${esc(scene.opening)}</p>` : ""}<p><strong>${esc(scene.prompt)}</strong></p>
      ${sender ? `<p class="share-note">친구가 고른 답 · ${esc(sender.text)}</p>` : ""}
      <div class="options" role="group" aria-label="내 답 하나 고르기">${scene.choices.map((c,i) =>
        `<button type="button" class="opt" data-echo-choice="${i}" aria-pressed="false">${c.art ? `<img src="${esc(window.RBScene.assetURL(c.art))}" alt="" loading="lazy">` : ""}<span>${esc(c.text)}</span><b aria-hidden="true"></b></button>`).join("")}</div>
      <p class="hint">여기서 고른 답은 이 화면에서만 보여요.</p>
      <div data-echo-result aria-live="polite"></div>`;
    const result = container.querySelector("[data-echo-result]");
    let reply = "";
    container.onclick = async event => {
      const target = event.target.closest("button");
      if (!target || !container.contains(target)) return;
      if (target.hasAttribute("data-echo-choice")) {
        const mine = scene.choices[Number(target.dataset.echoChoice)];
        container.querySelectorAll("[data-echo-choice]").forEach(b => {
          b.setAttribute("aria-pressed", String(b === target));
          b.querySelector("b").textContent = b === target ? "✓" : "";
        });
        const same = sender && mine.id === sender.id;
        const shortLines = {postStats:"난 거리랑 시간만 올릴래.", postSelfie:"난 다 뛰고 찍은 셀카!", postScenery:"난 뛰다가 본 풍경!", keepPrivate:"난 오늘 건 그냥 내 폰에 둘래."};
        const sameLines = {postStats:"나도 기록만 딱 한 장!", postSelfie:"나도 셀카!", postScenery:"나도 풍경 사진!", keepPrivate:"나도 안 올리고 내 폰에 둘래."};
        reply = (same ? sameLines : shortLines)[mine.posting] || (same ? "나도 같은 거 골랐어! " : "난 이거 골랐어. ") + "“" + mine.text + "”";
        result.innerHTML = `${sender ? `<div class="compare-portraits"><figure><figcaption>친구<br><strong>${esc(sender.text)}</strong></figcaption></figure><figure><figcaption>나<br><strong>${esc(mine.text)}</strong></figcaption></figure></div>` : `<p>내가 고른 답 · ${esc(mine.text)}</p>`}<p><strong>보낼 답장</strong><br>${esc(reply)}</p>
          <div class="actions"><button type="button" class="btn primary" data-echo-transfer="share">답장 보내기</button>
          <button type="button" class="btn light" data-echo-transfer="copy">답장 복사</button></div><div data-echo-manual></div>`;
      }
      if (target.dataset.echoTransfer && reply)
        await deliver(reply, {useShare:target.dataset.echoTransfer === "share", output:result.querySelector("[data-echo-manual]"), notify});
    };
  }

  function askProfile(profile, {note, esc, notify}) {
    const ref = fromProfile(profile);
    if (!ref) return;
    const scene = read(ref), answer = scene.choices.find(c => c.id === ref.choice);
    note("친구에게 한 장면 묻기", `<p><strong>${esc(scene.title)}</strong></p><p>${esc(scene.prompt)}</p>
      <label class="check"><input type="checkbox" id="echo-proof">내 답도 같이 보내기 · ${esc(answer.text)}</label>
      <p class="hint">친구는 이 질문 하나에 바로 답할 수 있어요.</p>
      <div class="actions"><button class="btn primary" type="button" id="echo-link">질문 링크 보내기</button>
      <button class="btn light" type="button" data-act="modalclose">나만 간직하기</button></div><div id="echo-manual"></div>`);
    document.getElementById("echo-link").onclick = () => deliver(url("moment", clean(ref, document.getElementById("echo-proof").checked)),
      {link:true, useShare:true, output:document.getElementById("echo-manual"), notify});
  }
  return {read, clean, fromProfile, url, deliver, mount, askProfile};
})();
