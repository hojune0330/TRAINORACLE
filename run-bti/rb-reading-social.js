(() => {
  "use strict";
  const axes = ["recovery","record","social","explore"];
  const labels = {recovery:"회복",record:"기록",social:"함께",explore:"탐색"};
  const topics = {recovery:["reset"],record:["numbers","log","compare"],social:["company","conversation","encouragement"],explore:["explore","travel","route"]};
  const postNames = {postStats:"거리와 시간만",postSelfie:"내 셀카",postScenery:"달리다 본 풍경",keepPrivate:"안 올림"};
  const travelNotes = {market:"이 이야기에서는 숙소 앞보다 새로 본 시장 골목을 골랐어요.",nearby:"이번 여행에서는 익숙한 길에서 가볍게 뛰는 쪽을 골랐어요.",join:"이 장면에서는 길을 미리 정하기보다 친구와 만나 같이 고르기로 했어요."};
  const art = path => (window.rbReadingAsset || (value => value))(path);
  const safeImage = value => typeof value === "string" && /^art\/[a-z0-9-]+\.webp$/u.test(value);
  function node(type, text, cls) {
    const el = document.createElement(type);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function button(label, action, cls) {
    const el = node("button",label,cls);
    el.type = "button"; el.addEventListener("click",action); return el;
  }
  function painter(path, alt) {
    const img = node("img",null,"rs-image"); img.alt = alt; img.loading = "lazy";
    img.addEventListener("error",() => img.hidden = true,{once:true}); img.src = art(path); return img;
  }
  const eventKey = story => window.RBStoryMatch?.eventKey?.(story) || story.eventKey || story.id;
  function activeStories(now = new Date()) {
    const day = new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
    return (window.RBStoryCatalog || []).filter(s => !s.archived &&
      (!s.validFrom || s.validFrom <= day) && (!s.validUntil || s.validUntil >= day));
  }
  function rankStories(stories, result) {
    const qualified = (result.axes || []).filter(a => a.mean != null && a.evidence.length);
    const top = Math.max(...qualified.map(a => a.mean));
    const leading = qualified.filter(a => top - a.mean < .25).map(a => a.id);
    function fit(s) {
      let affinity = 0;
      for (const axis of leading) if ((topics[axis] || []).some(signal => s.signals?.includes(signal))) affinity++;
      return affinity;
    }
    return [...stories].sort((a,b) => fit(b)-fit(a) ||
      Number(b.id === "morning-market-dm" && fit(b)>0)-Number(a.id === "morning-market-dm" && fit(a)>0) ||
      Number(!!b.validUntil)-Number(!!a.validUntil) || a.id.localeCompare(b.id));
  }
  function mountStory(host, {result, mode, onChange, initial = null}) {
    if (!host) return;
    const previous = (Array.isArray(initial?.entries) ? initial.entries : initial ? [initial] : [])
      .filter(p => p && p.mode === mode && typeof p.answer === "string" && typeof p.title === "string");
    let entries = [...previous];
    let active = null, pick = entries.at(-1) || null;
    let shelfOpen = false;
    const stories = () => rankStories(activeStories(),result);
    function save() {
      const recent = entries.at(-1);
      onChange?.(recent ? {...recent,entries:entries.map(p => ({...p}))} : null);
    }
    function select(s, choice) {
      const post = (choice.signals || []).find(signal => Object.hasOwn(postNames,signal));
      const image = window.RBRepresentative?.endingArt?.(s,choice);
      const received = {id:s.id,event:eventKey(s),mode,version:s.version || 1,choiceId:choice.id,
        title:s.title,answer:choice.label,then:choice.then,line:choice.line,question:s.question,
        image:(!post || post === "postSelfie" || post === "postScenery") && safeImage(image?.art) ? image.art : (post ? "" : s.art),
        alt:image?.alt || s.title,post:post ? postNames[post] : null,
        reading:s.id === "morning-market-dm" ? travelNotes[choice.id] : ""};
      entries = entries.filter(p => p.id !== received.id && p.event !== received.event);
      entries.push(received); pick=received; active=null; shelfOpen=false; save(); render();
    }
    function open(s) {active=s; pick=null; shelfOpen=false; render();}
    function render() {
      host.classList.add("rs-block");
      host.replaceChildren(node("h3","이야기 속의 나"));
      if (pick) {
        host.append(node("p",pick.title,"rs-small"),node("h4",pick.answer),node("p",pick.then));
        if (pick.post) host.append(node("p","내가 고른 인증 · "+pick.post,"rs-note"));
        else host.append(node("p","“"+pick.line+"”","rs-note"));
        if (pick.reading) host.append(node("p",pick.reading));
        if (safeImage(pick.image)) host.append(painter(pick.image,pick.alt));
        host.append(node("p",pick.question,"rs-question"));
        const live = stories().find(s => s.id === pick.id && (s.version || 1) === pick.version);
        if (live) host.append(button("이 장면 다시 고르기",()=>open(live)));
        host.append(button("내 풀이에서 빼기",()=>{
          entries=entries.filter(p => p.id !== pick.id);pick=entries.at(-1) || null;active=null;save();render();
        }));
      } else {
        const current = active || stories().find(s => !entries.some(p => p.event === eventKey(s)));
        if (current) {
          host.append(node("p",current.title,"rs-small"),node("div",current.opening,"rs-bubble"));
          if (safeImage(current.art)) host.append(painter(current.art,current.title));
          host.append(node("h4",current.prompt));
          for (const c of current.choices) host.append(button(c.label,()=>select(current,c),"rs-choice"));
          if (current.source?.name) {
            const source=node("small",null,"rs-source");
            if (/^https:\/\//.test(current.source.url)) {
              const a=node("a",current.source.name);a.href=current.source.url;a.target="_blank";a.rel="noopener noreferrer";source.append(a);
            } else source.textContent=current.source.name;
            if (current.source.asOf) source.append(" · "+current.source.asOf+"에 확인");
            host.append(source);
          }
        } else host.append(node("p","지금 고를 수 있는 이야기를 모두 읽었어요."));
      }
      host.append(button(shelfOpen ? "이야기 목록 접기" : "다른 이야기 골라 보기",()=>{shelfOpen=!shelfOpen;render();}));
      if (shelfOpen) {
        const shelf=node("div",null,"rs-shelf");
        const used=new Set();
        for (const s of stories()) {
          if (used.has(eventKey(s))) continue;
          used.add(eventKey(s));shelf.append(button(s.title,()=>open(s)));
        }
        host.append(shelf);
      }
      if (entries.length>1) {
        const details=node("details");details.append(node("summary","내가 고른 이야기 "+entries.length+"편"));
        for (const e of entries) details.append(button(e.title+" · "+e.answer,()=>{pick=e;active=null;shelfOpen=false;render();}));
        host.append(details);
      }
    }
    render();
  }

  const crewBase = () => {
    if (!/^https?:$/.test(location.protocol)) return null;
    if (/^(www\.)?trainoracle\.io$/.test(location.hostname)) return "https://athletetime-backend.onrender.com/api/run-bti/crews";
    return "/api/run-bti/crews";
  };
  const crewId = id => typeof id === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
  const randomKey = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),v => v.toString(16).padStart(2,"0")).join("");
  const memory = new Map();
  function store(group,value) {
    const k="runbti.crew.manage.v1."+group;
    if (value) {
      localStorage.setItem(k,JSON.stringify(value));memory.set(k,value);return value;
    }
    try {return JSON.parse(localStorage.getItem(k)) || memory.get(k) || {};} catch {return memory.get(k) || {};}
  }
  async function remote(path="",method="GET",body,token) {
    const headers={};
    if (body) headers["Content-Type"]="application/json";
    if (token) headers.Authorization="Bearer "+token;
    const reply=await fetch(crewBase()+path,{method,headers,body:body ? JSON.stringify(body) : undefined,credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer"});
    if (!reply.ok) throw Object.assign(new Error(),{status:reply.status});
    return reply.status===204 ? null : reply.json();
  }
  function mountCrew(host, {result,mode}) {
    if (!host) return;
    const url = new URL(location.href);
    let id = url.searchParams.get("crew");
    const version=window.RBReadingModel?.version || "reading-1";
    let summary=null,waiting=false,message="", accessed=false, state={};
    const values=axes.map(axis => result.axes.find(a=>a.id===axis)?.mean ?? null);
    const person=result.character?.name || "";
    const details=node("details",null,"rs-block rs-crew");
    details.append(node("summary","크루 지도에 모아 보기"));
    const area=node("div");details.append(area);host.replaceChildren(details);
    if (id) details.open=true;
    async function run(fn) {
      if(waiting) return;
      waiting=true;message="";render();
      try {await fn();} catch (e) {
        message=e.status===404 ? "초대가 끝났거나 닫힌 크루예요." : e.status===409 ? "이 검사 방식으로는 이 크루에 보탤 수 없어요." :
          e.name==="QuotaExceededError" || e.name==="SecurityError" ? "이 브라우저에 수정용 키를 저장할 수 없어요. 저장을 허용한 브라우저에서 열어 주세요." :
          "크루 서버에 연결하지 못했어요. 잠시 후 다시 열어 주세요.";
      } finally {waiting=false;render();}
    }
    const empty=()=>({enabled:false,axes:[false,false,false,false],name:false,bars:false});
    let prefs=empty();
    function checked(label, key, checkedValue, disabled, action) {
      const el=node("label"), box=node("input");box.type="checkbox";box.checked=checkedValue;
      box.disabled=disabled || waiting;box.dataset.crew=key;
      box.addEventListener("change",()=>{action(box.checked);render();});el.append(box," "+label);return el;
    }
    function inviteLink() {
      const dest=new URL(location.href);dest.search="";dest.hash="";
      if(url.searchParams.get("edition")) dest.searchParams.set("edition",url.searchParams.get("edition"));
      dest.searchParams.set("crew",id);dest.searchParams.set("crewMode",summary.mode);
      return dest.href;
    }
    async function refresh() {summary=await remote("/"+id);}
    function render() {
      area.replaceChildren();
      if (!crewBase()) {area.append(node("p","크루 지도는 웹에서 열면 같이 쓸 수 있어요. 이 파일에서는 내 결과를 볼 수 있어요."));return;}
      if (id && !crewId(id)) {area.append(node("p","초대 주소를 확인해 주세요."));return;}
      if (!id) {
        area.append(node("p","단톡방에 초대 링크 하나를 보내면 각자 검사를 마친 뒤 공개하고 싶은 항목만 보탤 수 있어요. 링크는 30일 동안 열려요."));
        area.append(button("크루 초대 링크 만들기",()=>run(async()=>{
          const draft="creating-"+mode+"-"+version;
          const owner=store(draft).owner || randomKey();
          store(draft,{owner});
          const group=await remote("","POST",{mode,model:version},owner);
          state=store(group.id,{owner});id=group.id;
          url.searchParams.set("crew",id);url.searchParams.set("crewMode",mode);history.replaceState(history.state,"",url);
          const key="runbti.crew.manage.v1."+draft;localStorage.removeItem(key);memory.delete(key);
          await refresh();
        })));
      } else if(!summary) {
        area.append(button("크루 지도 불러오기",()=>run(refresh)));
      } else {
        const display=node("div",null,"rs-map");display.append(node("h4","우리 크루가 자주 고른 행동"));
        for (const a of summary.axes) display.append(node("p",labels[a.id]+" · "+(a.hidden ? "응답이 더 모이면 보여요" : "공개 응답 "+a.n+"명 중 "+a.hits+"명")));
        display.append(node("small","각 축에 5명 이상 동의하면 4점 이상인 인원을 보여 줘요. 한 사람이 여러 곳에 들어갈 수 있어요."));
        area.append(display);
        if(summary.cards.length) {
          const cards=node("details");cards.append(node("summary","공개한 멤버 카드"));
          for(const row of summary.cards) {
            const item=node("p",row.nickname || "익명 멤버");if(row.bars) item.append(" · "+row.bars.map((v,i)=>labels[axes[i]]+" "+(v==null?"―":Number(v).toFixed(2))).join(" / "));cards.append(item);
          }
          area.append(cards);
        }
        area.append(button("최신 지도 보기",()=>run(refresh)),button("초대 링크 복사",async()=>{
          const link=inviteLink();try{await navigator.clipboard.writeText(link);message="초대 링크를 복사했어요.";render();}
          catch{const input=node("input");input.value=link;input.readOnly=true;input.setAttribute("aria-label","복사할 초대 링크");area.append(input);input.select();}
        }));
        if(summary.mode!==mode || summary.model!==version) {
          area.append(node("p",summary.mode==="imagine"?"이 크루는 첫 러닝을 상상한 결과를 모아요.":"이 크루는 뛰어 본 날의 결과를 모아요."));
        } else {
          const choices=node("fieldset");choices.append(node("legend","내가 보여 줄 항목"));
          choices.append(checked("익명 집계에 내 답 보태기","aggregate",prefs.enabled,false,v=>prefs.enabled=v));
          axes.forEach((axis,i)=>choices.append(checked(labels[axis],"axis-"+i,prefs.axes[i],!prefs.enabled || values[i]===null,v=>prefs.axes[i]=v)));
          choices.append(checked("내 캐릭터 이름 보여 주기"+(person?" · "+person:""),"name",prefs.name,!person,v=>prefs.name=v));
          choices.append(checked("내 점수 네 개 보여 주기","bars",prefs.bars,values.every(n=>n===null),v=>prefs.bars=v));
          area.append(choices,node("small","링크를 가진 사람이 공개 항목을 볼 수 있어요. 이 브라우저에 철회용 키를 보관해요."));
          const chosen=axes.map((_,i)=>prefs.enabled && prefs.axes[i] && values[i]!==null ? Number(values[i]>=4):null);
          const publicName=prefs.name && person ? person:null;
          const publicBars=prefs.bars && values.some(n=>n!==null) ? values:null;
          const save=button("이대로 공개하기",()=>run(async()=>{
            state=store(id);
            if(!state.member) state=store(id,{...state,member:randomKey()});
            await remote("/"+id+"/me","PUT",{mode,model:version,contributions:chosen,nickname:publicName,bars:publicBars},state.member);
            state=store(id,{...state,prefs,joined:true});await refresh();message="고른 항목만 크루에 보탰어요.";
          }));save.disabled=!chosen.some(n=>n!==null) && !publicName && !publicBars;area.append(save);
        }
        if(state.member) area.append(button("내 공개 항목 모두 철회",()=>run(async()=>{
          await remote("/"+id+"/me","DELETE",undefined,state.member);
          prefs=empty();state=store(id,{...state,prefs,joined:false});await refresh();message="내 공개 항목을 모두 지웠어요.";
        })));
        if(state.owner) area.append(button("크루 초대 닫기",()=>{
          if(!confirm("이 링크의 크루 지도와 공개 항목을 모두 지울까요?")) return;
          run(async()=>{
            await remote("/"+id,"DELETE",undefined,state.owner);
            const key="runbti.crew.manage.v1."+id;
            localStorage.removeItem(key);memory.delete(key);
            summary=null;id=null;state={};prefs=empty();url.searchParams.delete("crew");url.searchParams.delete("crewMode");
            history.replaceState(history.state,"",url);message="크루 지도를 닫았어요.";
          });
        }));
      }
      if(message || waiting) {const status=node("p",waiting?"잠시만요…":message,"rs-note");status.setAttribute("role","status");area.append(status);}
      if(waiting) area.querySelectorAll("button").forEach(b=>b.disabled=true);
    }
    function first() {
      if(accessed || !crewBase() || !crewId(id)) return;
      accessed=true;state=store(id);
      const previous=state.prefs;
      if(previous && Array.isArray(previous.axes) && previous.axes.length===4) prefs={...empty(),...previous,axes:[...previous.axes]};
      run(refresh);
    }
    details.addEventListener("toggle",()=>{if(details.open) first();});
    render();if(id) first();
  }
  window.RBReadingSocial={mountStory,mountCrew,activeStories,rankStories};
})();
