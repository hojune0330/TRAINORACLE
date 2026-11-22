(() => {
  "use strict";
  const model = window.RBReadingModel;
  const asset = path => window.RBScene.assetURL(path);
  window.rbReadingAsset = asset;
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const modes = ["experience","imagine"];
  const levels = {experience:["거의 없어","가끔","반반","자주","거의 늘"], imagine:["전혀 안 끌려","별로 안 끌려","반반이야","해 보고 싶어","꼭 해 보고 싶어"]};
  const label = mode => mode === "imagine" ? "내가 상상한 첫 러닝" : "뛰어 본 날의 나";
  const personalKey = "runbti.reading." + model.version + ".map.";
  const draftKey = "runbti.reading." + model.version + ".draft";
  const reasons = ["몸 관리","체중 관리","루틴 지키기","인정받고 싶어서","대회 완주","여행지 구경"];
  const fmtDate = t => new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(t);
  const logoArrow = '<span aria-hidden="true">↗</span>';
  const local = (storage,key) => {try {return JSON.parse(window[storage].getItem(key));} catch {return null;}};
  const put = (storage,key,value) => {try {if (value === null) window[storage].removeItem(key); else window[storage].setItem(key,JSON.stringify(value)); return true;} catch {return false;}};
  const newId = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), n=>n.toString(36)).join("-");
  const isMatrix = a => Array.isArray(a) && a.length===6 && a.every(row=>Array.isArray(row)&&row.length===4&&row.every(v=>v===null||Number.isInteger(v)&&v>=1&&v<=5));
  const validMap = r => r && r.version===model.version && modes.includes(r.mode) && typeof r.id==="string" && /^[a-z0-9-]{1,60}$/.test(r.id) && Number.isFinite(r.at) && !Number.isNaN(new Date(r.at).getTime()) && isMatrix(r.answers);
  const validDraft = r => validMap(r) && Number.isInteger(r.cursor) && r.cursor>=0 && r.cursor<=24 && Array.isArray(r.order) && r.order.length===6 && r.order.every(arr=>Array.isArray(arr)&&arr.length===4&&new Set(arr).size===4&&arr.every(i=>[0,1,2,3].includes(i)));
  function maps() {
    try {return Object.keys(localStorage).filter(k=>k.startsWith(personalKey)).map(k=>local("localStorage",k)).filter(validMap).sort((a,b)=>b.at-a.at);}
    catch {return [];}
  }
  let transientDraft = null;
  function pending() {
    const value = transientDraft || local("sessionStorage",draftKey);
    return validDraft(value) ? value : null;
  }
  function newOrder() {
    const order = [0,1,2,3];
    for(let i=3;i>0;i--) {const j = Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]];}
    return order;
  }
  const matrix = fill => Array.from({length:6},()=>Array(4).fill(fill));
  function open(root, {view="home", mode="experience", id=null, shared=null, extras="", onHome, notify}) {
    const image = (path,alt,attrs="") => `<img src="${esc(asset(path))}" alt="${esc(alt)}" ${attrs}>`;
    const html = s => {root.innerHTML=s;};
    const get = selector => root.querySelector(selector);
    let task, current, result, freeText="", selectedReasons=[], story=null, timer, locking=false, approvedNote=false;
    const focus = (selector,scroll=true) => {
      if(scroll) window.scrollTo(0,0);
      get(selector)?.focus({preventScroll:true});
    };
    function fresh(m) {
      task={id:newId(),at:Date.now(),version:model.version,mode:m,order:Array.from({length:6},newOrder),answers:matrix(null),cursor:0};
      persistDraft(); question(true);
    }
    function persistDraft() {transientDraft=task; put("sessionStorage",draftKey,task);}
    function enter(m,continueExisting=true) {
      const previous=pending();
      if(previous && previous.mode===m && continueExisting) {task=previous; if(task.cursor===24) ready();else question(true);return;}
      if(previous && continueExisting) {
        html(`<section class="rd-slip"><h1 tabindex="-1">이어서 할 검사가 있어요</h1><p>${esc(label(previous.mode))}에서 ${Math.min(6,1+Math.floor(previous.cursor/4))}번째 장면까지 왔어요.</p><div class="rd-actions"><button class="rd-button" data-rd="resume">이어서 하기</button><button class="rd-secondary" data-rd="replace" data-mode="${m}">새 검사 시작</button></div></section>`);
        focus("h1");return;
      }
      fresh(m);
    }
    function home() {
      const d=pending(), list=maps();
      const params=new URLSearchParams(location.search);
      const crewMode=params.has("crew")&&modes.includes(params.get("crewMode"))?params.get("crewMode"):null;
      html(`<div class="rd-cover">
        <div class="rd-cover-art">${image("art/club-cover.webp","현관에서 운동화 끈을 묶고 뛰러 나갈 준비를 하는 모습",'fetchpriority="high"')}
        </div>
        <div class="rd-cover-text"><p class="rd-kicker">러닝 성향 테스트</p>
          <h1 tabindex="-1">달릴 때 나는 <br>어떤 사람일까<span>?</span></h1>
          <p class="rd-lead">현관에서 운동화 끈을 묶을 때부터 다음에 또 뛸 생각이 들 때까지. 여섯 장면을 지나면 내 러닝 캐릭터가 나와요.</p>
          ${crewMode?`<p class="rd-invite">크루가 초대했어요. ‘${crewMode==="imagine"?"첫 러닝 상상하기":"뛰어 본 날 떠올리기"}’로 시작하면 내 결과를 보고 크루에 보탤 항목을 고를 수 있어요.</p>`:""}
          <div class="rd-start"><button class="rd-button" data-rd="start" data-mode="experience">뛰어 본 날 떠올리기 ${logoArrow}</button><button class="rd-secondary" data-rd="start" data-mode="imagine">첫 러닝 상상하기 ${logoArrow}</button></div>
          ${d ? `<button class="rd-link" data-rd="resume">${esc(label(d.mode))} · ${Math.min(6,Math.floor(d.cursor/4)+1)}번째 장면 이어서 하기 →</button>` : ""}
          ${list.length ? `<button class="rd-link" data-rd="last">지난번 내 캐릭터 보기 →</button>` : ""}
        </div></div>
        ${extras ? `<details class="rd-more"><summary>다른 검사와 러닝 이야기</summary>${extras}</details>` : ""}`);
    }
    function question(scroll) {
      clearTimeout(timer);locking=false;
      const {cursor,order,mode}=task;
      const s=Math.floor(cursor/4), pos=cursor%4, col=order[s][pos], scene=model.scenes[s], item=scene.items[col];
      const had=get(".rd-quiz")?.dataset.scene===String(s);
      if(!had) {
        html(`<section class="rd-quiz" data-scene="${s}">
          <div class="rd-quiz-nav"><button class="rd-link" data-rd="back">← 이전</button><span>${esc(label(mode))}</span></div>
          <div class="rd-quiz-grid"><figure class="rd-location">${image(scene.image,"")}<figcaption>${esc(scene.title)}</figcaption></figure>
          <div class="rd-paper"><div class="rd-track" aria-label="전체 여섯 장면 중 ${s+1}번째">${model.scenes.map((_,i)=>`<i class="${i<=s?"filled":""}"></i>`).join("")}</div><div class="rd-prompt"></div></div></div></section>`);
      }
      const answer=task.answers[s][col];
      get(".rd-prompt").innerHTML=`<p class="rd-kicker">${s+1}/6장면 · 이 장면의 ${pos+1}/4</p>
        <h1 tabindex="-1">${esc(mode==="imagine"?item.wish:item.text)}</h1>
        <p class="rd-question-hint">${mode==="imagine"?"첫날이라면 얼마나 해 보고 싶어?":"요즘 뛸 때 이런 적이 얼마나 자주 있어?"}</p>
        <div class="rd-options" role="group" aria-label="${mode==="imagine"?"해 보고 싶은 정도":"행동 빈도"}">${levels[mode].map((word,i)=>`<button type="button" data-rd="answer" data-value="${i+1}" aria-pressed="${answer===i+1}"><span>${word}</span><i aria-hidden="true">${answer===i+1?"✓":""}</i></button>`).join("")}</div>
        <div class="rd-skip"><button data-rd="unavailable">${mode==="imagine"?"잘 모르겠어":"그럴 기회가 없었어"}</button><button data-rd="skip-scene">이 장면은 건너뛸래</button></div>`;
      focus(".rd-prompt h1",scroll||!had);
    }
    function advance(n) {
      task.cursor=n;persistDraft();
      if(n===24) ready(); else question(false);
    }
    function ready() {
      html(`<section class="rd-ready"><div class="rd-ready-image">${image(model.scenes[5].image,"")}</div><p class="rd-kicker">여섯 장면을 다 봤어요</p><h1 tabindex="-1">내가 달릴 때의 모습은?</h1><p>고른 답을 모아 내 러닝 지도를 펼쳐 볼게요.</p><button class="rd-button" data-rd="reveal">내 결과 보기 ${logoArrow}</button><button class="rd-link" data-rd="review-last">← 마지막 답 다시 보기</button></section>`);
      focus("h1");
    }
    function loadResult(rec,animate) {
      current=rec;
      result=model.evaluate(current.answers,current.mode);
      freeText=typeof rec.note==="string"?rec.note:"";selectedReasons=Array.isArray(rec.reasons)?rec.reasons.filter(x=>reasons.includes(x)):[];
      story=rec.story||null;approvedNote=Boolean(freeText||selectedReasons.length);
      showResult(animate);
    }
    function saveMap() {
      const rec={version:model.version,id:current.id,at:current.at,mode:current.mode,answers:current.answers};
      if(approvedNote){rec.note=freeText.trim();rec.reasons=selectedReasons;}
      if(story) rec.story=story;
      if(!put("localStorage",personalKey+rec.id,rec)){notify("이 브라우저에서는 보관하기 어려워요. 카드 이미지를 저장해 주세요.");return false;}
      current=rec;return true;
    }
    function showResult(animate) {
      const c=result.character, paragraphs=result.paragraphs || [];
      function evidenceDetails(paragraph) {
        const references=(paragraph?.itemIds||[]).flatMap(itemId=>{
          const scene=model.scenes.find(row=>row.items.some(i=>i.id===itemId));
          if(!scene)return [];
          const index=scene.items.findIndex(i=>i.id===itemId), item=scene.items[index];
          const value=current.answers[model.scenes.indexOf(scene)][index];
          if(value<4)return [];
          return [`<li><b>${esc(scene.title)}</b> · ${esc(current.mode==="imagine"?item.wish:item.text)} <strong>${levels[current.mode][value-1]}</strong></li>`];
        }).join("");
        return references?`<details class="rd-proof"><summary>이 풀이가 나온 내 답</summary><ul>${references}</ul></details>`:"";
      }
      const labelName=c?.name||"내가 남긴 러닝 장면";
      const emptyReading=result.status==="pending"?"답한 장면이 부족해서 별명을 비워 뒀어요. 아래에서 이번에 고른 답을 볼 수 있어요.":
        result.status==="low"?(current.mode==="imagine"?"해 보고 싶다고 고른 행동이 드물었어요. 끌리는 게 따로 있다면 내 말로 남겨 보세요.":"이번 장면에는 자주 한다고 고른 행동이 드물었어요. 내가 뛰는 이유가 따로 있다면 한 줄로 남겨 보세요."):
        "한 가지 모습으로 부르기엔 답이 다양했어요. 아래 막대를 펼쳐 내 답을 읽어 보세요.";
      const cover=c?.background||"art/club-bg-alley.webp";
      html(`<section class="rd-result"><div class="rd-quiz-nav"><button class="rd-link" data-rd="home">← 테스트 홈</button><span>${esc(label(current.mode))}</span></div>
        <div class="rd-reveal ${animate?"rd-animate":""}"><div class="rd-poster">${image(cover,"",'class="rd-backdrop"')}
        ${c?image(c.image,c.name+"의 러닝 장면",`class="rd-character"`):""}
        </div>
        <div class="rd-intro"><p class="rd-kicker">${c?esc(c.nickname):"열린 러닝 카드"}</p><h1 tabindex="-1">${esc(labelName)}</h1><p class="rd-quote">${esc(c?result.line:emptyReading)}</p>${paragraphs[0]?`<div class="rd-summary"><h2>${esc(paragraphs[0].title)}</h2><p>${esc(paragraphs[0].text)}</p>${evidenceDetails(paragraphs[0])}</div>`:""}
        <button class="rd-button" data-rd="card">내 카드 보기 ${logoArrow}</button>
        ${c?'<button class="rd-replay" data-rd="replay">↻ 다시 보기</button>':""}</div></div>
        <section class="rd-block"><div class="rd-block-head"><h2>내 러닝 지도</h2><span>5점 만점</span></div><p>막대를 누르면 어느 장면에서 뭐라고 답했는지 볼 수 있어요.</p><div class="rd-axes"></div>
        <label class="rd-compare" hidden>지난 지도와 겹쳐 보기 <select></select></label></section>
        ${paragraphs.slice(1).map(p=>{
          const secondCut=result.secondary&&p.itemIds.some(item=>item.endsWith("-"+result.secondary))&&c;
          const scene=secondCut && model.scenes.find(entry=>entry.items.some(item=>p.itemIds.includes(item.id)));
          return `<section class="rd-block rd-reading-text ${scene?"rd-with-cut":""}">${scene?image(scene.image,scene.title,'loading="lazy"'):""}<div><h2>${esc(p.title)}</h2><p>${esc(p.text)}</p>${evidenceDetails(p)}</div></section>`;
        }).join("")}
        <section class="rd-block rd-basket"><h2>내 얘기가 덜 담겼어요?</h2><label for="rd-free">더 떠오르는 이유가 있다면 내 말로 남겨 보세요.</label><textarea id="rd-free" maxlength="180" rows="2">${esc(freeText)}</textarea>
        <details><summary>떠오르는 말 골라 보기</summary><div class="rd-chips">${reasons.map(r=>`<label><input type="checkbox" value="${esc(r)}" ${selectedReasons.includes(r)?"checked":""}>${esc(r)}</label>`).join("")}</div></details>
        <label class="rd-check"><input type="checkbox" id="rd-keep-note" ${approvedNote?"checked":""}> 내 지도를 보관할 때 이 한 줄과 고른 말도 남길게요.</label></section>
        <div class="rd-story-host"></div><div class="rd-crew-host"></div>
        <section class="rd-block"><h2>다음에 다시 펼쳐 보기</h2><p>이 기기에 날짜와 이번 답을 보관하면 다음 검사에서 두 지도를 겹쳐 볼 수 있어요.</p><div class="rd-actions"><button class="rd-secondary" data-rd="save">내 지도 보관하기</button><button class="rd-button" data-rd="card">카드 꾸미고 공유하기 ${logoArrow}</button></div><div class="rd-status" role="status"></div></section>
        ${shared?'<button class="rd-secondary" data-rd="friend-compare">친구와 나란히 보기</button>':""}
        <button data-rd="restart" class="rd-link">다시 검사하기 →</button></section>`);
      renderAxes();
      const same=maps().filter(r=>r.mode===current.mode&&r.id!==current.id&&r.at<=current.at);
      if(same.length){
        const field=get(".rd-compare"),select=field.querySelector("select");
        field.hidden=false;select.add(new Option("이번 지도만 보기",""));
        same.forEach(r=>select.add(new Option(fmtDate(r.at),r.id)));
        const previous=same.find(r=>current.at-r.at>=30*86400000)||same[0];
        select.value=previous.id;renderAxes(previous);
        select.onchange=()=>renderAxes(same.find(r=>r.id===select.value));
      }
      window.RBReadingSocial.mountStory(get(".rd-story-host"),{result,mode:current.mode,record:current,initial:story,onChange:value=>{story=value;}});
      window.RBReadingSocial.mountCrew(get(".rd-crew-host"),{result,mode:current.mode});
      if(animate){window.RBScene.audio.effect("reveal");focus("h1");}
    }
    function renderAxes(previous) {
      const old=previous?model.evaluate(previous.answers,previous.mode):null;
      get(".rd-axes").innerHTML=result.axes.map((axis,col)=>{
        const val=axis.mean,prev=old?.axes[col]?.mean;
        const past=old ? (prev==null?"지난번도 계산할 답이 부족해요.":"지난번 "+Number(prev.toFixed(2))+"점") : "";
        const diff=Number.isFinite(prev)&&Number.isFinite(val)?Number((val-prev).toFixed(2)):null;
        return `<details class="rd-axis"><summary><span class="rd-axis-label"><b>${esc(axis.label)}</b><b>${val==null?"응답 부족":Number(val.toFixed(2))+"점"} ﹀</b></span><span class="rd-meter"><i style="width:${val==null?0:val*20}%"></i>${prev==null?"":`<em style="left:clamp(2px,${prev*20}%,calc(100% - 2px))"></em>`}</span><small>${axis.count}/6문항${old?" · "+past:""}${diff==null?"":diff===0?" · 같음":" · 이번에 "+Math.abs(diff)+"점 "+(diff>0?"높음":"낮음")}</small></summary>
        <ul>${model.scenes.map((s,i)=>{const v=current.answers[i][col];return `<li><b>${esc(s.title)}</b><span>${esc(current.mode==="imagine"?s.items[col].wish:s.items[col].text)}</span><em>${v==null?"응답 없음":levels[current.mode][v-1]}</em></li>`;}).join("")}</ul></details>`;
      }).join("");
    }
    function card(){
      html('<section class="rd-card-host"></section>');
      const personal=[freeText.trim(), ...selectedReasons].filter(Boolean).join(" · ");
      const postChoice={"거리와 시간만":"stats","내 셀카":"selfie","달리다 본 풍경":"scenery","안 올림":"private"}[story?.post];
      window.RBReadingCard.mount(root.firstElementChild,{result,mode:current.mode,note:personal,postChoice,onBack:()=>{showResult(false);focus("h1");}});
      window.scrollTo(0,0);
    }
    function friend(ownRecord) {
      html('<section class="rd-friend-host"></section>');
      const own=ownRecord&&{result:model.evaluate(ownRecord.answers,ownRecord.mode),mode:ownRecord.mode};
      window.RBReadingCard.renderFriend(root.firstElementChild,shared,{own:own||null,onStart:()=>enter(shared.mode),onHome});
    }
    root.onclick=e=>{
      const b=e.target.closest("[data-rd]");if(!b||!root.contains(b))return;
      const act=b.dataset.rd;
      if(act==="start")enter(b.dataset.mode);
      if(act==="replace")fresh(b.dataset.mode);
      if(act==="resume"){const d=pending();if(d)enter(d.mode);}
      if(act==="last"){const r=maps()[0];if(r){loadResult(r,false);focus("h1");}}
      if(act==="home")onHome();
      if(act==="back"){if(locking)return;if(task.cursor){task.cursor--;persistDraft();question(true);}else onHome();}
      if(act==="review-last"){task.cursor=23;persistDraft();question(true);}
      if(act==="skip-scene" && !locking){
        const s=Math.floor(task.cursor/4);
        task.answers[s]=[null,null,null,null];advance((s+1)*4);
      }
      if((act==="answer"||act==="unavailable")&&!locking){
        locking=true;const n=task.cursor, s=Math.floor(n/4),col=task.order[s][n%4];
        task.answers[s][col]=act==="answer"?Number(b.dataset.value):null;
        if(act==="answer"){get(".rd-options").querySelectorAll("button").forEach(btn=>{btn.setAttribute("aria-pressed",String(btn===b));btn.querySelector("i").textContent=btn===b?"✓":"";});}
        persistDraft();timer=setTimeout(()=>{if(root.isConnected)advance(n+1);},window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:145);
      }
      if(act==="reveal"){
        const rec={id:task.id,version:task.version,mode:task.mode,answers:task.answers.map(r=>r.slice()),at:Date.now()};
        transientDraft=null;put("sessionStorage",draftKey,null);loadResult(rec,true);
      }
      if(act==="replay"){const poster=get(".rd-reveal");poster.classList.remove("rd-animate");void poster.offsetWidth;poster.classList.add("rd-animate");window.RBScene.audio.effect("reveal");}
      if(act==="card")card();
      if(act==="restart")enter(current.mode);
      if(act==="friend-compare")friend(current);
      if(act==="save"&&saveMap()){get(".rd-status").textContent="이 기기에 내 지도를 보관했어요.";notify("내 지도를 보관했어요.");}
    };
    root.oninput=e=>{if(e.target.id==="rd-free")freeText=e.target.value;};
    root.onchange=e=>{
      if(e.target.id==="rd-keep-note")approvedNote=e.target.checked;
      if(e.target.closest(".rd-chips"))selectedReasons=Array.from(root.querySelectorAll(".rd-chips input:checked"),n=>n.value);
    };
    if(view==="result"){const r=maps().find(m=>m.id===id);if(r)loadResult(r,false);else home();}
    else if(view==="start")enter(mode);
    else if(view==="friend"&&shared){friend(maps().find(r=>r.mode===shared.mode));}
    else home();
  }
  function libraryHTML() {
    const list=maps();
    if(!list.length)return "";
    return `<section class="rd-archive"><h2>내 러닝 지도</h2>${list.map(r=>{const c=model.evaluate(r.answers,r.mode).character;return `<div><button data-act="reading-open" data-record="${esc(r.id)}"><strong>${esc(c?.name||"열린 러닝 카드")}</strong><small>${esc(label(r.mode))} · ${esc(fmtDate(r.at))}</small></button><button data-act="reading-delete" data-record="${esc(r.id)}" aria-label="${esc(fmtDate(r.at))} 지도 지우기">지우기</button></div>`;}).join("")}</section>`;
  }
  window.RBReadingUI={open,libraryHTML, remove:id=>maps().some(r=>r.id===id)&&put("localStorage",personalKey+id,null)};
})();
