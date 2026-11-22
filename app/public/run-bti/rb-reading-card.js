// This card travels as a public snapshot. Local history and the full answer matrix stay on the device.
window.RBReadingCard = (() => {
  "use strict";
  const backgrounds = [
    {id:"original", label:"캐릭터 대표 배경", image:null, color:"#e0dfcc"},
    {id:"alley", label:"동네 골목", image:"art/bg-02.webp", color:"#e8cdb9"},
    {id:"river", label:"강변", image:"art/bg-00.webp", color:"#c2decf"},
    {id:"dusk", label:"노을", image:"art/bg-01.webp", color:"#e8bbb2"}
  ];
  const frames = {ink:{label:"먹색 테두리",color:"#222c39"}, coral:{label:"코랄 테두리",color:"#903e35"}, green:{label:"초록 테두리",color:"#265746"}};
  const posts = {stats:"거리와 시간만",selfie:"내 셀카",scenery:"달리다 본 풍경",private:"안 올림"};
  const scale = {experience:["거의 없어","가끔","반반","자주","거의 늘"], imagine:["전혀 안 끌려","별로 안 끌려","반반이야","해 보고 싶어","꼭 해 보고 싶어"]};
  const canvasWidth = 1080;
  const imageCache = new Map();
  const preferences = new WeakMap();
  const model = () => window.RBReadingModel;
  const known = (list, key) => typeof key === "string" && Object.hasOwn(list,key);
  const plain = (text, limit) => typeof text === "string" && Array.from(text).length <= limit && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text);
  const shorten = (text,n) => Array.from(String(text || "").replace(/[\u0000-\u001f\u007f]+/g," ").trim()).slice(0,n).join("");
  const itemFor = (scene,axis) => model().scenes[scene]?.items[model().axes.findIndex(a => a.id === axis)];
  const modeLabel = mode => mode === "imagine" ? "내가 상상한 첫 러닝" : "내가 달릴 때의 모습";
  function clean(raw) {
    if (!raw || raw.v !== 3 || raw.ed !== model().version || !known(scale,raw.mode) ||
        !(raw.who === null || known(model().cast,raw.who)) || !plain(raw.line,160) ||
        !["4:5","9:16"].includes(raw.ratio) || !backgrounds.some(bg=>bg.id===raw.bg) || !known(frames,raw.frame)) return null;
    const card = {v:3,ed:raw.ed,mode:raw.mode,who:raw.who,line:raw.line,ratio:raw.ratio,bg:raw.bg,frame:raw.frame};
    if ("note" in raw) {
      if (!plain(raw.note,160)) return null;
      if (raw.note) card.note = raw.note;
    }
    if ("post" in raw) {
      if (!known(posts,raw.post)) return null;
      card.post = raw.post;
    }
    if ("scores" in raw) {
      if (typeof raw.scores !== "object" || raw.scores === null || Array.isArray(raw.scores)) return null;
      card.scores = {};
      for (const [key,value] of Object.entries(raw.scores)) {
        if (!model().axes.some(a=>a.id===key) || typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) return null;
        card.scores[key] = value;
      }
    }
    if ("proof" in raw) {
      const p = raw.proof;
      if (!p || !Number.isInteger(p.scene) || p.scene < 0 || p.scene >= model().scenes.length ||
          !model().axes.some(a => a.id === p.axis) || ![4,5].includes(p.value) ||
          !plain(p.text,160) || !p.text.trim()) return null;
      const item=itemFor(p.scene,p.axis);
      if(p.text === (raw.mode==="imagine" ? item?.wish : item?.text))
        card.proof = {scene:p.scene,axis:p.axis,value:p.value,text:p.text};
    }
    return card;
  }
  function read(hash = location.hash) {
    if (typeof hash !== "string" || hash.length > 10000 || !hash.startsWith("#card=")) return null;
    try { return clean(JSON.parse(decodeURIComponent(hash.slice(6)))); } catch { return null; }
  }
  function publicURL(card) {
    if (!/^https?:$/.test(location.protocol)) return null;
    const url = new URL(location.pathname,location.origin);
    const edition = new URL(location.href).searchParams.get("edition");
    if (edition === "athlete" || edition === "train") url.searchParams.set("edition",edition);
    url.hash = "card=" + encodeURIComponent(JSON.stringify(card));
    return url.href;
  }
  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function button(label,fn,kind="") {
    const control = el("button","rrc-btn" + (kind ? " rrc-" + kind : ""),label);
    control.type = "button"; control.addEventListener("click",fn);
    return control;
  }
  function select(obj,chosen,fn) {
    const input = el("select");
    Object.entries(obj).forEach(([id,label])=>input.add(new Option(label,id)));
    input.value = chosen;
    input.onchange = () => fn(input.value);
    return input;
  }
  function field(label, control) {
    const wrapper = el("label","rrc-field");
    wrapper.append(el("span","",label),control);
    return wrapper;
  }
  function check(label, checked, fn) {
    const wrapper = el("label","rrc-check");
    const input = el("input"); input.type="checkbox"; input.checked=checked;
    input.onchange=()=>fn(input.checked);
    wrapper.append(input,label);
    return wrapper;
  }
  function picture(path) {
    if (!path) return Promise.resolve(null);
    if (!imageCache.has(path)) {
      const promise = new Promise(resolve => {
        const img = new Image();
        img.onload = ()=>resolve(img);
        img.onerror = ()=>{ imageCache.delete(path); resolve(null); };
        img.src = window.rbReadingAsset?.(path) || window.RBAssets?.[path] || path;
      });
      imageCache.set(path,promise);
    }
    return imageCache.get(path);
  }
  function wrapped(ctx, value, max) {
    const lines = [];
    String(value).split("\n").forEach(paragraph=>{
      let line = "";
      for (const word of paragraph.split(/\s+/u)) {
        if (line && ctx.measureText(line + " " + word).width <= max) { line += " " + word; continue; }
        if (line) lines.push(line);
        line = "";
        for (const ch of word) {
          if (line && ctx.measureText(line + ch).width > max) { lines.push(line); line = ""; }
          line += ch;
        }
      }
      if (line) lines.push(line);
    });
    return lines;
  }
  function font(ctx,size,bold=false) {
    ctx.font = (bold ? "700 " : "500 ") + size + 'px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  }
  function makeCanvas(card) {
    const canvas = el("canvas","rrc-canvas");
    canvas.width=canvasWidth; canvas.height=card.ratio === "9:16" ? 1920 : 1350;
    canvas.setAttribute("role","img");
    const name = model().cast[card.who]?.name || "내 러닝 한 장";
    canvas.setAttribute("aria-label",[modeLabel(card.mode),name,card.line,card.note && "내가 덧붙인 한 줄 " + card.note,card.post && "내가 고른 답 " + posts[card.post]].filter(Boolean).join(". "));
    return canvas;
  }
  async function paint(card) {
    const canvas = makeCanvas(card), ctx=canvas.getContext("2d"), W=canvas.width,H=canvas.height;
    const person = model().cast[card.who], bg=backgrounds.find(x=>x.id===card.bg), ink=frames[card.frame].color;
    const builtInScene=person?.image === "art/reading-soyi.webp";
    const backdrop = bg.image || (builtInScene ? null : (person?.background || backgrounds[1].image));
    const [background,runner] = await Promise.all([picture(backdrop),picture(person?.image)]);
    const name = person?.name || "내 러닝 한 장";
    const left=66, right=W-left, innerWidth=right-left;
    font(ctx,38,true);
    const quoteLines=wrapped(ctx,card.line,innerWidth-24);
    font(ctx,31);
    const noteLines=card.note ? wrapped(ctx,card.note,innerWidth-28) : [];
    const textHeight=176+quoteLines.length*55+(noteLines.length ? 61+noteLines.length*44 : 0)+(card.post ? 70 : 0);
    const base=H-textHeight-52, top=112, picX=42, picW=W-84, picH=base-top;
    ctx.fillStyle="#fff9ed"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=ink; ctx.fillRect(0,0,W,14);
    font(ctx,36,true); ctx.fillText("RUN·BTI",left,74);
    font(ctx,27); ctx.textAlign="right";ctx.fillText(modeLabel(card.mode),right,74);ctx.textAlign="left";
    ctx.save(); ctx.beginPath(); ctx.rect(picX,top,picW,picH);ctx.clip();
    ctx.fillStyle=bg.color;ctx.fillRect(picX,top,picW,picH);
    if(background) {
      const ratio=Math.max(picW/background.width,picH/background.height);
      ctx.drawImage(background,picX+(picW-background.width*ratio)/2,top+(picH-background.height*ratio)/2,background.width*ratio,background.height*ratio);
    }
    if(runner) {
      const ratio=Math.min((picW*(builtInScene?1:.99))/runner.width,(picH*(builtInScene?1:.98))/runner.height);
      const w=runner.width*ratio,h=runner.height*ratio;
      ctx.drawImage(runner,picX+(picW-w)/2,builtInScene ? top+(picH-h)/2 : top+picH-h,w,h);
    }
    ctx.restore();
    ctx.strokeStyle=ink;ctx.lineWidth=7;ctx.strokeRect(picX,top,picW,picH);
    ctx.fillStyle=ink; font(ctx,76,true);ctx.fillText(name,left,base+96,innerWidth);
    font(ctx,38,true);let y=base+160;
    for(const line of quoteLines) {ctx.fillText(line,left,y);y+=55;}
    if (card.note) {
      ctx.fillStyle="#5c615c";font(ctx,27,true);ctx.fillText("내가 덧붙인 한 줄",left,y+13);y+=61;
      ctx.fillStyle=ink;font(ctx,31);
      for(const line of noteLines) {ctx.fillText(line,left,y);y+=44;}
    }
    if(card.post){ctx.fillStyle=ink;font(ctx,29,true);ctx.fillText("내가 고른 답  ·  " + posts[card.post],left,y+30,innerWidth);}
    ctx.fillStyle=ink;ctx.fillRect(picX,H-48,picW,3);
    return {canvas,missing:!!person && !runner || !!backdrop && !background};
  }
  function preview(host, card, onDone) {
    const token=Symbol();host.rrcToken=token;
    host.setAttribute("aria-busy","true");
    paint(card).then(({canvas,missing})=>{
      if(host.rrcToken!==token)return;
      host.replaceChildren(canvas);host.removeAttribute("aria-busy");
      if(missing)host.append(el("p","rrc-fine","그림 일부를 불러오지 못했어요. 연결을 확인하고 다시 열어 주세요."));
      onDone?.(canvas,missing);
    }).catch(()=>{
      if(host.rrcToken!==token)return;
      host.removeAttribute("aria-busy");host.replaceChildren(el("p","rrc-fine","이 브라우저에서 카드를 그리지 못했어요."));
      onDone?.(null,true);
    });
  }
  function capture(source, returnTo) {
    const dlg=el("dialog","rrc-capture"); dlg.setAttribute("aria-label","내 러닝 카드 캡처");
    const canvas=source.cloneNode();canvas.getContext("2d").drawImage(source,0,0);
    const close=button("편집으로 돌아가기",()=>{
      if(typeof dlg.close==="function")dlg.close();
      else {dlg.remove();returnTo.focus();}
    });
    dlg.append(canvas,close);document.body.append(dlg);
    dlg.addEventListener("close",()=>{dlg.remove();returnTo.focus();},{once:true});
    if(typeof dlg.showModal==="function")dlg.showModal();
    else {dlg.setAttribute("open","");close.focus();}
  }
  function evidenceFor(result,mode) {
    const list=[];
    for(const axis of result.axes) for(const evidence of axis.evidence) {
      if (evidence.value !== 4 && evidence.value !== 5)continue;
      const statement=itemFor(evidence.sceneIndex,axis.id);
      const text=mode==="imagine" ? (statement?.wish || evidence.text) : (statement?.text || evidence.text);
      if(text) list.push({axis:axis.id,scene:evidence.sceneIndex,value:evidence.value,text:shorten(text,160)});
    }
    return list;
  }
  function publicCard(result,mode,note,options,proofs,lines) {
    const card={v:3,ed:model().version,mode,who:result.character?.id||null,line:shorten(lines[options.quote]||result.line,160),ratio:options.ratio,bg:options.bg,frame:options.frame};
    if (options.includeNote && note) card.note=shorten(note,160);
    if (options.includePost && known(posts,options.post)) card.post=options.post;
    if (options.includeProof && proofs[options.proof]) card.proof=proofs[options.proof];
    const eligible=result.axes.filter(a=>options.scores.includes(a.id) && Number.isFinite(a.mean));
    if(eligible.length) card.scores=Object.fromEntries(eligible.map(a=>[a.id,Math.round(a.mean*100)/100]));
    return card;
  }
  function mount(host,{result,mode,note="",postChoice="",onBack}) {
    host.replaceChildren();
    const root=el("section","rrc-studio");
    const fromStory={postStats:"stats",postSelfie:"selfie",postScenery:"scenery",keepPrivate:"private"};
    const initialPost=known(posts,postChoice) ? postChoice : known(fromStory,postChoice) ? fromStory[postChoice] : "";
    const options=preferences.get(result) || {ratio:"4:5",bg:"original",frame:"ink",quote:0,includeNote:false,includePost:false,post:initialPost,includeProof:false,proof:0,scores:[]};
    preferences.set(result,options);
    const proofs=evidenceFor(result,mode);
    const lines=[...new Set([result.line,...proofs.map(p=>p.text)].filter(Boolean))];
    const shell=el("div","rrc-preview"), controls=el("div","rrc-controls");
    const layout=el("div","rrc-layout");layout.append(shell,controls);
    root.append(button("‹  내 풀이로 돌아가기",()=>onBack?.(),"back"),el("h2","rrc-head","친구에게 보낼 한 장"),layout);
    const format=select({"4:5":"4:5 피드","9:16":"9:16 스토리"},options.ratio,v=>{options.ratio=v;update()});
    const background=select(Object.fromEntries(backgrounds.map(x=>[x.id,x.label])),options.bg,v=>{options.bg=v;update()});
    const frame=select(Object.fromEntries(Object.entries(frames).map(([k,f])=>[k,f.label])),options.frame,v=>{options.frame=v;update()});
    const quote=select(Object.fromEntries(lines.map((line,i)=>[i,line])),String(options.quote),v=>{options.quote=Number(v);update()});
    controls.append(field("카드 크기",format),field("배경",background),field("프레임",frame));
    if(lines.length)controls.append(field("카드에 넣을 내 대사",quote));
    if(note)controls.append(check("내가 덧붙인 한 줄도 카드에 넣기",options.includeNote,v=>{options.includeNote=v;update()}),el("p","rrc-fine",shorten(note,160)));
    const postExample=el("div","rrc-post-example");
    function showPostExample() {
      postExample.replaceChildren();
      if(options.post==="selfie" || options.post==="scenery") {
        const art=options.post==="selfie"?"art/post-selfie.webp":"art/bg-00.webp";
        const img=el("img");img.alt=options.post==="selfie"?"렌즈를 바라보며 찍은 러닝 셀카 예시":"사람 없이 찍은 강변 풍경 예시";
        img.src=window.rbReadingAsset?.(art)||window.RBAssets?.[art]||art;
        postExample.append(img,el("small","","인증 방식 예시"));
      } else if(options.post==="stats")postExample.append(el("span","","달린 거리　·　걸린 시간"));
    }
    const post=select({"":"선택 안 함",...posts},options.post,v=>{
      options.post=v;options.includePost=false;postPermit.checked=false;postPermit.disabled=!v;showPostExample();update();
    });
    const postCheck=check("이 답도 카드에 넣기",options.includePost,v=>{options.includePost=v;update()});
    const postPermit=postCheck.querySelector("input");postPermit.disabled=!options.post;
    showPostExample();controls.append(field("러닝 인증을 남긴다면?",post),postExample,postCheck);
    const privacy=el("details","rrc-privacy");privacy.append(el("summary","","친구에게 보여 줄 검사 결과 고르기"),
      el("p","rrc-fine","고른 점수와 문항 답은 링크에 들어가요. 링크를 받은 사람은 누구나 볼 수 있어요."));
    result.axes.filter(a=>Number.isFinite(a.mean)).forEach(axis=>privacy.append(check(axis.label+" "+Number(axis.mean.toFixed(2))+"점",options.scores.includes(axis.id),v=>{
      options.scores=options.scores.filter(id=>id!==axis.id);if(v)options.scores.push(axis.id);update();
    })));
    if(proofs.length) {
      const choice=select(Object.fromEntries(proofs.map((p,i)=>[i,p.text+" · "+scale[mode][p.value-1]])),String(options.proof),v=>{options.proof=Number(v);update()});
      choice.disabled=!options.includeProof;
      privacy.append(check("내가 답한 문항 하나도 보내기",options.includeProof,v=>{options.includeProof=v;choice.disabled=!v;update()}),field("친구에게 보일 답",choice));
    }
    const status=el("p","rrc-fine");status.setAttribute("role","status");
    const manual=el("div","rrc-manual");const actions=el("div","rrc-actions");
    let card,canvas=null;
    const save=button("이미지 저장",()=>{
      if(!canvas)return;
      const snapshot=card;
      try {
        canvas.toBlob(blob=>{
          if(!blob){status.textContent="이미지를 저장하지 못했어요. 캡처 화면을 열어 주세요.";return;}
          const url=URL.createObjectURL(blob),a=el("a");
          a.href=url;a.download="런비티아이-"+(model().cast[snapshot.who]?.name||"내-러닝")+"-"+(snapshot.ratio==="9:16"?"스토리":"카드")+".png";
          document.body.append(a);a.click();a.remove();
          window.setTimeout(()=>URL.revokeObjectURL(url),20000);
          status.textContent="이미지를 저장했어요.";
        },"image/png");
      }catch{status.textContent="이미지를 저장하지 못했어요. 캡처 화면을 열어 주세요.";}
    });
    const screenshot=button("캡처 화면",()=>{if(canvas)capture(canvas,screenshot)});
    const share=button("친구에게 링크 보내기",async()=>{
      const link=publicURL(card);if(!link)return;
      const value=card; const announce=txt=>{if(card===value)status.textContent=txt;};
      if(navigator.share) {
        const name=model().cast[card.who]?.name;
        const message=name ? "나는 "+name+" 나왔어. 너는 뛰러 나갈 때 무슨 생각 해?" : "너는 뛰러 나갈 때 무슨 생각 해?";
        try{await navigator.share({title:"내 런비티아이",text:message,url:link});return;}
        catch(err){if(err.name==="AbortError")return;}
      }
      try{await navigator.clipboard.writeText(link);announce("카드 링크를 복사했어요. 친구 대화방에 붙여 넣어 주세요.");}
      catch{if(card!==value)return;const text=el("textarea");text.readOnly=true;text.value=link;manual.replaceChildren(field("길게 눌러 카드 링크 복사",text));text.focus();text.select();}
    },"primary");
    actions.append(save,screenshot);
    if(/^https?:$/.test(location.protocol))actions.append(share);
    else actions.append(el("p","rrc-fine","내려받은 파일에서는 이미지를 저장해서 보낼 수 있어요. 링크로 보내려면 웹에서 열어 주세요."));
    controls.append(privacy,actions,status,manual);host.append(root);
    function update(){
      card=publicCard(result,mode,note,options,proofs,lines);
      canvas=null;save.disabled=screenshot.disabled=true;manual.replaceChildren();status.textContent="";
      preview(shell,card,(source,missing)=>{canvas=source;save.disabled=!source||missing;screenshot.disabled=!source;});
    }
    update();
  }
  const topics={recovery:"머리 식히러 뛰고 싶은 날엔 어디로 가?",record:"뛰고 나서 어떤 숫자부터 봐?",social:"친구랑 뛰면 뭐가 제일 좋아?",explore:"다음에 가 보고 싶은 코스 있어?"};
  function comparison(card,own) {
    const box=el("section","rrc-compare");
    box.append(el("h3","","우리 둘이 달리면"));
    const mine=own?.result||own;
    const comparable=mine && (own.mode||mine.mode)===card.mode;
    const published=model().axes.filter(a=>card.scores?.[a.id] !== undefined);
    if(published.length) {
      const list=el("ul");
      for(const axis of published){
        const m=comparable ? mine.axes.find(a=>a.id===axis.id)?.mean : null;
        list.append(el("li","",axis.label+"　친구 "+card.scores[axis.id]+"점"+(Number.isFinite(m)?" / 나 "+Number(m.toFixed(2))+"점":"")));
      }
      box.append(list);
    }
    let prompt=null;
    if(card.proof){
      const p=card.proof;const scene=model().scenes[p.scene];
      box.append(el("p","rrc-answer","친구가 고른 답 · "+scene.title+"\n“"+p.text+"” · "+scale[card.mode][p.value-1]));
      const e=comparable && mine.axes.find(a=>a.id===p.axis)?.responses?.find(v=>v.sceneIndex===p.scene);
      if(e?.value>=4) box.append(el("p","","둘 다 이 장면에서 ‘"+(card.mode==="imagine"?"해 보고 싶어":"자주")+"’ 이상을 골랐어요."));
      else if(e?.value)box.append(el("p","","같은 장면에서 나는 ‘"+scale[card.mode][e.value-1]+"’를 골랐어요."));
      prompt=topics[p.axis];
    }
    if(comparable && published.length){
      const shared=published.filter(a=>card.scores[a.id]>=4 && mine.axes.find(x=>x.id===a.id)?.mean>=4);
      if(shared.length){box.append(el("p","","둘 다 ‘"+shared.map(a=>a.label).join("·")+"’에 담긴 행동을 "+(card.mode==="imagine"?"해 보고 싶다고 했어요.":"자주 한다고 했어요.")));prompt=topics[shared[0].id];}
      const different=published.find(a=>{
        const m=mine.axes.find(x=>x.id===a.id)?.mean;
        return Number.isFinite(m) && ((m>=4 && card.scores[a.id]<=3) || (m<=3 && card.scores[a.id]>=4));
      });
      if(different){
        const m=mine.axes.find(a=>a.id===different.id).mean;
        const high=m>=4?"나는":"친구는";
        const focus={recovery:"마음을 가라앉히는 쪽",record:"거리와 시간을 챙기는 쪽",social:"사람들과 러닝을 함께 나누는 쪽",explore:"새로운 길을 살펴보는 쪽"};
        box.append(el("p","",high+" "+focus[different.id]+(card.mode==="imagine"?"을 더 해 보고 싶다고 했어요.":"의 행동을 더 자주 한다고 했어요.")));
        if(!prompt)prompt=topics[different.id];
      }
    }
    if(!card.proof && !published.length)box.append(el("p","rrc-fine","친구가 공개한 건 카드 한 장이에요. 대사부터 읽어 보세요."));
    if(mine && !comparable)box.append(el("p","rrc-fine","경험 모드 결과는 경험끼리, 첫 러닝 상상은 상상끼리 비교해요."));
    box.append(el("p","rrc-question",prompt||"뛰러 나갈 때 너는 무슨 생각 해?"));
    return box;
  }
  function renderFriend(host,card,{own,onStart,onHome}={}) {
    const snapshot=clean(card);host.replaceChildren();if(!snapshot)return;
    const root=el("section","rrc-studio");const shell=el("div","rrc-preview");
    root.append(el("p","rrc-kicker","친구가 보낸 런비티아이"),
      el("h2","rrc-head",model().cast[snapshot.who]?.name || "친구의 러닝 한 장"),shell);
    if(own){const mine=own.result||own;root.append(el("p","rrc-answer","나 · "+(mine.character?.name||"내 러닝 한 장")+"\n"+mine.line));}
    root.append(comparison(snapshot,own));const actions=el("div","rrc-actions");
    actions.append(button(own?"다시 해 보기":"나도 내 캐릭터 찾기",()=>onStart?.(),"primary"));
    if(onHome)actions.append(button("테스트 홈",onHome));
    root.append(actions);host.append(root);preview(shell,snapshot);
  }
  return {mount,read,renderFriend};
})();

