(() => {
  "use strict";
  const model = () => window.RBPairsModel;
  const art = file => "art/" + file + ".webp";
  const asset = path => window.RBAssets?.[path] || path;
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function button(text, action, cls = "") {
    const node = make("button", "rpx-btn " + cls, text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }
  function select(label, options, chosen, change) {
    const field = make("label", "rpx-field"), input = make("select");
    for (const [value, text] of options) input.add(new Option(text, value));
    input.value = chosen;
    input.addEventListener("change", () => change(input.value));
    field.append(make("span", "", label), input);
    return field;
  }
  function details(title, body, cls = "") {
    const node = make("details", cls);
    node.append(make("summary", "", title), body);
    return node;
  }
  function question(id, text, options, config = {}) {
    return {id, text, options: options.map(([id, label, image]) => ({id, label, image})), ...config};
  }
  const intention = [
    ["want", "한번 뛰어 보고 싶어"], ["maybe", "그날 가서 정하고 싶어"], ["no", "밖에서는 별로 뛰고 싶지 않아"],
  ];
  const experience = [["yes", "뛰어 봤어"], ["no", "아직 안 뛰어 봤어"]];
  const chapters = [
    {id:"weather", title:"계절과 날씨", questions:[
      question("summer","더운 여름엔 어떻게 뛰고 싶어?",[
        ["outside","여름에도 밖에서 뛰고 싶어"],["less","여름엔 덜 뛰고 싶어"],["indoor","실내에서 뛰고 싶어"],
      ]),
      question("winter","추운 겨울엔 어떻게 뛰고 싶어?",[
        ["outside","겨울에도 밖에서 뛰고 싶어"],["less","겨울엔 덜 뛰고 싶어"],["indoor","실내에서 뛰고 싶어"],
      ]),
      question("snowExperience","눈 오는 날 밖에서 뛰어 본 적 있어?",experience),
      question("snow","눈이 오고 길이 미끄럽지 않다면 나가 보고 싶어?",intention),
      question("rainExperience","비 오는 날 밖에서 뛰어 본 적 있어?",experience),
      question("rain","가볍게 비가 내리는 날이라면?",intention),
      question("time","뛸 시간을 고를 수 있다면 언제가 좋아?",[
        ["morning","아침"],["day","낮"],["evening","저녁이나 밤"],["varies","날마다 달라"],
      ]),
      question("timeAvailable","평일에는 뛸 시간이 얼마나 나?",[
        ["rarely","거의 없어"],["short","30분 미만"],["hour","30분에서 한 시간"],["long","한 시간 이상"],["varies","날마다 달라"],
      ]),
    ]},
    {id:"travel", title:"여행지", axis:"routes", questions:[
      question("travelRun","여행 가방을 쌀 때 운동화는?",[
        ["always","여행 가면 꼭 뛰고 싶어서 챙겨","life-travel"],["sometimes","일정에 여유가 있으면 챙겨"],["rest","여행 중엔 러닝도 쉬고 싶어"],["wish","아직 해 본 적은 없는데 다음 여행엔 챙기고 싶어","life-travel"],
        ["limited","뛰고는 싶은데 일정상 챙기기 어려워"],["disliked","여행지에서 뛰어 봤는데 내 취향은 아니었어"],
      ]),
      question("travelRoute","여행지에서 뛴다면 어떤 길이 좋아?",[
        ["explore","처음 보는 동네를 뛰면서 둘러보고 싶어"],["familiar","미리 알아본 길을 뛰고 싶어"],["near","숙소 근처면 어디든 좋아"],
      ]),
      question("homeRoute","평소 같은 코스를 뛴다면 어떤 이유가 있어?",[
        ["compare","지난번과 기록을 비교하기 좋아"],["lit","밤에도 밝아서 다니기 편해"],["near","집에서 가까워"],["fond","아는 길을 다시 뛰는 게 좋아"],["different","같은 코스를 자주 뛰진 않아"],
      ]),
    ]},
    {id:"practice", title:"훈련과 배움", fields:["learning","goal","eagerness"], questions:[
      question("training","연습 시간이 생기면 뭘 해 보고 싶어?",[
        ["drills","러닝 드릴을 익혀 보고 싶어","life-practice"],["strength","달리기에 도움이 되는 근력 운동을 해 보고 싶어"],
        ["distance","달리는 거리를 늘려 보고 싶어"],["speed","짧게 속도를 내며 달리고 싶어"],
      ],{multiple:true}),
      question("athlete","선수로 훈련한 경험이 있어?",[
        ["now","지금 선수로 훈련하고 있어"],["past","예전에 선수로 훈련했어"],["none","선수로 훈련한 적은 없어"],
      ]),
      question("freeDay","훈련 일정이 없는 날엔 어떤 마음이 들어?",[
        ["want","일정이 없어도 뛰고 싶어"],["rest","쉬는 날이 반가워"],["varies","날마다 달라"],
      ]),
      question("shortEasy","짧게 천천히 뛰고 오는 날은 어때?",[
        ["like","짧게 천천히 뛰고 오는 게 좋아"],["dislike","그렇게 뛰어 봤는데 별로였어"],
        ["new","그렇게 뛰어 본 적은 없어"],["limited","그렇게 뛰고 싶은데 요즘 여건이 안 돼"],["varies","날마다 달라"],
      ]),
      question("restPressure","쉬는 날에 훈련 생각이 나면 어때?",[
        ["ease","다음에 뛰면 돼서 편해"],["worry","준비가 모자랄까 마음이 쓰여"],["both","쉬어서 좋으면서도 마음 한쪽은 쓰여"],
      ],{private:true}),
    ]},
    {id:"race", title:"대회 날", fields:["goal"], questions:[
      question("ownFinish","내 목표보다 천천히 완주했다면 어떤 마음일까?",[
        ["time","완주해도 목표 기록을 놓치면 아쉬워"],["finish","시간보다 끝까지 뛴 게 더 기억에 남을 것 같아","life-finish"],
        ["fun","천천히 뛰는 것도 대회를 즐기는 방법이야"],["both","완주는 기쁜데 기록은 아쉬울 것 같아"],
      ]),
      question("otherFinish","친구가 천천히 완주한 날엔 어떤 얘기를 나누고 싶어?",[
        ["celebrate","끝까지 갔다는 얘기부터 축하하고 싶어","story-cheer"],["ask","친구한테 어땠는지 먼저 듣고 싶어"],["time","친구가 세운 목표 기록 얘기를 나누고 싶어"],
      ]),
      question("pride","기록이 잘 나온 날엔 남들이 알아주면 좋겠어?",[
        ["yes","나 잘 뛰었다고 자랑하고 싶어"],["private","혼자 봐도 충분히 좋아"],["depends","그날에 따라 달라"],
      ],{private:true}),
      question("embarrassed","천천히 뛴 날 내 기록을 남들이 봐도 괜찮아?",[
        ["uneasy","속도가 느려서 좀 민망해"],["fine","내 기록이 느려도 괜찮아"],["depends","누가 보느냐에 따라 달라"],
      ],{private:true}),
    ]},
    {id:"body", title:"몸과 데이터", axis:"signals", fields:["strength","challenge","goal"], questions:[
      question("watch","달리는 동안 시계나 앱은 어떻게 쓰고 싶어?",[
        ["during","뛰면서 숫자를 보고 페이스를 조절하고 싶어"],["after","뛰는 동안엔 두고 끝나고 기록만 보고 싶어","life-record"],
        ["without","기록 없이 뛰고 싶어"],["new","아직 써 본 적이 없어"],
      ]),
      question("soreness","몸이 불편해서 계획을 다시 생각한 적이 있어?",[
        ["changed","그날은 쉬거나 계획을 바꿨어"],["continued","마음에 걸렸지만 원래 계획대로 했어"],["none","아직 그런 날은 없었어"],
      ],{private:true}),
      question("firstReason","처음 달리기를 떠올린 이유는 뭐였어?",[
        ["fitness","체력을 기르고 싶었어"],["mood","나가서 머리를 식히고 싶었어"],
        ["race","한번 대회를 완주해 보고 싶었어"],["company","같이 뛰자는 사람이 있었어"],["other","다른 이유였어"],
      ]),
    ]},
  ];
  const companion = question("company","누군가와 뛰게 되면 어떤 시간이 좋아?",[
    ["chat","얘기하면서 같이 뛰고 싶어"],["own","같이 출발해서 각자 뛰고 다시 만나고 싶어"],
    ["quiet","말없이 발 맞춰 뛰고 싶어"],["solo","혼자 뛰고 나중에 얘기하는 게 좋아"],
  ]);
  const questions = new Map([...chapters.flatMap(ch => ch.questions), companion].map(q => [q.id,q]));
  function selected(q, state) {
    const raw = state[q.id];
    const ids = q.multiple ? (Array.isArray(raw) ? raw : []) : [raw];
    return q.options.filter(option => ids.includes(option.id));
  }
  function profilePreferences(state = {}) {
    const preferences = {};
    for (const key of ["training","summer","winter","snow","rain","time"]) {
      const q = questions.get(key);
      const values = selected(q,state).map(opt => opt.id);
      if (values.length) preferences[key] = q.multiple ? values : values[0];
    }
    return preferences;
  }
  function archiveStories(state) {
    if (!state || typeof state !== "object") return {};
    const clean = {};
    for (const q of questions.values()) {
      if (q.private) continue;
      const values = selected(q,state).map(o => o.id);
      if (values.length) clean[q.id] = q.multiple ? values : values[0];
    }
    return clean;
  }
  const casts = {
    numbers:["16","손목을 보는 러너"], explore:["01","지도를 펼친 러너"],
    plan:["37","지도를 들고 출발을 준비하는 러너"], speed:["27","팔을 흔들며 달리는 러너"],
    distance:["12","편한 걸음으로 달리는 러너"], senses:["34","걸음에 집중하는 러너"],
    familiar:["00","고개를 들어 주위를 보는 러너"], improvise:["32","앞을 둘러보는 러너"],
  };
  function artFor(result, name = result.defaultName) {
    const key = result.choices?.find(c => c.name === name)?.key || result.defaultKey;
    const sides = (key || "").split("+");
    const match = Object.keys(casts).find(side => sides.includes(side));
    if (!match) return {image:null,background:null,direction:null,caption:"",alt:""};
    const [id,alt] = casts[match];
    return {image:art("club-runner-" + id),background:null,direction:match,caption:alt,alt};
  }
  function priorEvidence(chapter, result, answers) {
    const entries = [];
    for (const id of chapter.fields || []) {
      const q = model().extras.find(q => q.id === id);
      const answer = q.options.find(o => o.id === answers[id] && !["other","unknown"].includes(o.id));
      if (answer) entries.push({question:q.text, answer:answer.label});
    }
    if (chapter.axis) {
      const item = model().items.find(q => q.axisId === chapter.axis && answers[q.id] === 2);
      if (item) entries.push({question:item.text, answer:model().labels[2]});
    }
    return entries;
  }
  function evidenceList(entries) {
    const list = make("ul","rpx-evidence");
    for (const entry of entries) {
      const li = make("li");
      li.append(make("span","",entry.question),make("strong","",entry.answer));
      list.append(li);
    }
    return list;
  }
  function choicePanel(q, state, onChange) {
    const root = make("fieldset","rpx-choices");
    root.append(make("legend","",q.text));
    if (q.private) root.append(make("small","rpx-note","이 답은 나만 봐요."));
    if (q.multiple) root.append(make("small","rpx-note","여러 개 골라도 돼요."));
    const choices = make("div","rpx-options");
    root.append(choices);
    for (const opt of q.options) {
      const active = selected(q,state).includes(opt);
      const btn = button(opt.label,() => {
        if (q.multiple) {
          const set = new Set(selected(q,state).map(s => s.id));
          if (set.has(opt.id)) set.delete(opt.id); else set.add(opt.id);
          if (set.size) state[q.id] = Array.from(set); else delete state[q.id];
        } else if (selected(q,state).includes(opt)) delete state[q.id];
        else state[q.id] = opt.id;
        for (const child of choices.children) child.setAttribute("aria-pressed",String(selected(q,state).some(s => s.id === child.dataset.value)));
        onChange();
      });
      btn.dataset.value = opt.id;
      btn.setAttribute("aria-pressed",String(active));
      choices.append(btn);
    }
    return root;
  }
  function chapterPanel(ch, result, answers, state, onChange) {
    const panel = make("div","rpx-chapter");
    const prior = priorEvidence(ch,result,answers);
    if (prior.length) {
      const intro = {
        class:"달리기는 클래스에서 배우고 싶어요.", coach:"코치에게 따로 배우고 싶어요.", solo:"혼자 해 보면서 배우고 싶어요.",
      };
      const first = prior[0], line = ch.id === "practice" && intro[answers.learning]
        ? intro[answers.learning] : "‘"+first.question+"’에 ‘"+first.answer+"’라고 답했어요.";
      panel.append(make("p","rpx-narrative",line),details("앞에서 고른 답",evidenceList(prior)));
    }
    const current = make("div"), reading = make("div","rpx-reading");
    const live = make("p","rpx-note"); live.setAttribute("role","status");
    function showReading() {
      reading.replaceChildren();
      const entries = [];
      let frame;
      for (const q of ch.questions) {
        for (const opt of selected(q,state)) {
          entries.push({question:q.text,answer:opt.label});
          if (opt.image) frame = {image:opt.image,answer:opt.label};
        }
      }
      if (!entries.length) return;
      reading.append(make("h4","","이 장면에서 나는"));
      const selectedLine = summaryLine(ch.id,state,answers);
      if (selectedLine) reading.append(make("p","rpx-narrative",selectedLine),details("이 풀이에 담긴 답",evidenceList([...prior,...entries])));
      else reading.append(evidenceList(entries));
      if (frame) {
        const figure = make("figure","rpx-scene"), img = make("img");
        img.loading = "lazy"; img.src = asset(art(frame.image)); img.alt = "";
        figure.append(img,make("figcaption","","이 선택을 담은 그림 · " + frame.answer));
        reading.append(figure);
      }
    }
    function openQuestion(q) {
      current.replaceChildren(choicePanel(q,state,() => {
        showReading(); live.textContent = selected(q,state).length ? "고른 답을 아래에 담았어요." : "이 답을 지웠어요.";
        onChange();
      }));
    }
    const topics = select("읽고 싶은 장면",ch.questions.map(q=>[q.id,shortTitles[q.id]]),ch.questions[0].id,id=>openQuestion(questions.get(id)));
    panel.append(topics,current,live,reading); openQuestion(ch.questions[0]); showReading();
    return details(ch.title,panel,"rpx-chapter-shell");
  }
  const shortTitles = {
    summer:"여름",winter:"겨울",snowExperience:"눈 오는 날의 경험",snow:"눈 오는 날의 마음",
    rainExperience:"비 오는 날의 경험",rain:"비 오는 날의 마음",time:"좋아하는 시간대",timeAvailable:"평일에 낼 수 있는 시간",
    travelRun:"여행 가방",travelRoute:"여행지 코스",homeRoute:"동네 단골길",training:"더 해 보고 싶은 훈련",
    athlete:"선수 경험",freeDay:"훈련이 없는 날",shortEasy:"짧고 느긋하게 뛰는 날",restPressure:"쉬는 날의 마음",ownFinish:"내 완주",
    otherFinish:"친구의 완주",pride:"기록이 잘 나온 날",embarrassed:"느린 기록",watch:"뛰는 중에 보는 숫자",
    soreness:"몸이 불편했던 날",firstReason:"처음 뛰고 싶던 이유",
  };
  function summaryLine(id,s,a) {
    if (id === "weather") {
      if (s.snowExperience === "no" && s.snow === "want") return "눈 오는 날엔 아직 안 뛰어 봤어요. 길이 미끄럽지 않다면 한번 나가 보고 싶어요.";
      if (s.rainExperience === "no" && s.rain === "want") return "비 오는 날 뛰어 본 적은 없지만 가랑비가 내리는 날엔 한번 뛰어 보고 싶어요.";
      if (s.summer === "less" && s.winter === "outside") return "더운 여름에는 덜 뛰고 싶어요. 추운 겨울에는 밖에서 달려 보고 싶고요.";
    }
    if (id === "travel" && s.travelRoute === "explore") {
      if (s.homeRoute === "compare") return "동네에서는 지난 기록과 비교하려고 같은 길을 돌아요. 여행지에서는 낯선 동네를 구경하며 뛰고 싶어요.";
      if (s.homeRoute === "lit") return "동네에서는 밤에도 밝은 길을 골라요. 여행지에서는 처음 보는 동네를 뛰며 둘러보고 싶어요.";
    }
    if (id === "practice") {
      if (s.athlete === "now" && a.eagerness === "reluctant") return "지금 선수로 훈련하고 있어요. 요즘은 달릴 날이 꼭 기다려지지는 않아요.";
      if (s.freeDay === "want" && s.restPressure === "worry") return "훈련이 없어도 뛰고 싶은 날이 있어요. 쉬기로 한 날엔 준비가 모자랄까 마음도 쓰여요.";
    }
    if (id === "race" && s.ownFinish === "time" && s.otherFinish === "celebrate") return "내 목표 기록을 놓치면 완주해도 아쉬워요. 친구가 천천히 끝까지 달린 날엔 완주했다는 걸 먼저 축하하고 싶어요.";
    if (id === "body" && s.watch === "after" && a.goal === "speed") return "속도는 늘리고 싶어요. 달리는 동안에는 시계를 두고 끝난 뒤 기록을 보는 게 좋아요.";
    return null;
  }

  // Only registered optional sentences can leave the device. The fragment carries no raw answers.
  const safeExtraIds = new Set(["strength","goal","learning"]);
  const extraHead = {strength:"자신 있는 것",goal:"다음 목표",learning:"배우고 싶은 방식"};
  function quoteText(id) {
    if (!id || id === "_") return "";
    const [source,field,value] = id.split(":");
    if (source === "i") {
      const item = model().items.find(i => i.id === field);
      return item && !value ? "“" + item.text + "”에 ‘좋아’" : "";
    }
    if (source === "e" && safeExtraIds.has(field)) {
      const opt = model().extras.find(q => q.id === field)?.options.find(o => o.id === value);
      return opt && !opt.sensitive && !["unknown","other"].includes(value) ? extraHead[field] + " · " + opt.label : "";
    }
    if (source === "s") {
      const q = questions.get(field);
      const opt = q && q !== companion && !q.private && q.options.find(o => o.id === value);
      return opt ? shortTitles[field] + " · " + opt.label : "";
    }
    return "";
  }
  function quoteOptions(answers,state) {
    const keys = model().items.filter(q=>answers[q.id] === 2).map(q=>"i:"+q.id);
    for (const id of safeExtraIds) if (answers[id]) keys.push("e:"+id+":"+answers[id]);
    for (const q of questions.values()) {
      if (q.private || q === companion) continue;
      for (const opt of selected(q,state)) keys.push("s:"+q.id+":"+opt.id);
    }
    return keys.map(key=>[key,quoteText(key)]).filter(([,v])=>v);
  }
  const chars = {both:"b",neither:"n",middle:"m",insufficient:"u"};
  function packShare(result,include,quote) {
    const states = include ? result.axes.map((a,i) => a.state === "direction"
      ? (a.direction === model().axes[i].sides[0].id ? "l" : "r") : chars[a.state]).join("") : "_";
    const id = quoteText(quote) ? quote : "_";
    return "#pairs="+[result.version,result.defaultKey,states,id].join("~");
  }
  function readShared(hash = location.hash) {
    if (typeof hash !== "string" || !hash.startsWith("#pairs=") || hash.length > 160) return null;
    const parts = hash.slice(7).split("~");
    if (parts.length !== 4) return null;
    const [version,defaultKey,states,id] = parts;
    const m = model();
    if (version !== m.version || !Object.hasOwn(m.names,defaultKey) || (states !== "_" && !/^[lrbnmu]{4}$/.test(states))) return null;
    if (id !== "_" && (!/^(i:[a-zA-Z0-9-]+|[es]:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+)$/.test(id) || !quoteText(id))) return null;
    if (id.startsWith("i:") && defaultKey === "unanswered") return null;
    const axes = states === "_" ? [] : m.axes.map((a,i) => {
      const ch = states[i];
      const dir = ch === "l" || ch === "r";
      return {id:a.id,state:dir ? "direction" : Object.keys(chars).find(k=>chars[k]===ch),direction:dir ? a.sides[ch==="l" ? 0 : 1].id : null};
    });
    if (axes.length) {
      const dirs = axes.filter(a=>a.direction).map(a=>a.direction);
      if (defaultKey === "unanswered" && axes.some(a=>a.state!=="insufficient")) return null;
      if (["open","unanswered"].includes(defaultKey) ? dirs.length > 0 :
        defaultKey.split("+").length !== Math.min(2,dirs.length) || !defaultKey.split("+").every(s=>dirs.includes(s))) return null;
    }
    return {version,defaultKey,defaultName:m.names[defaultKey],axes,quote:quoteText(id)};
  }
  function publicURL(result,include,quote) {
    if (!["http:","https:"].includes(location.protocol)) return null;
    const url = new URL(location.pathname,location.origin);
    if (new URL(location.href).searchParams.get("edition")==="train") url.searchParams.set("edition","train");
    url.hash = packShare(result,include,quote);
    return url.href;
  }
  async function copyText(value,host) {
    try {
      await navigator.clipboard.writeText(value);
      host.replaceChildren(document.createTextNode("복사했어요."));
    } catch {
      const input = make("textarea","rpx-copy");
      input.setAttribute("aria-label","복사할 내용"); input.readOnly = true; input.value=value;
      host.replaceChildren(document.createTextNode("아래 내용을 선택해 복사해 주세요."),input); input.focus(); input.select();
    }
  }
  function compareSection(result,shared) {
    const node = make("section","rpx-panel");
    node.append(make("h3","","친구와 나란히"),make("p","rpx-intro",result.defaultName+" × "+shared.defaultName));
    if (shared.quote) node.append(make("p","rpx-speech","친구가 고른 한 줄 · "+shared.quote));
    const lines = model().compare(result,shared);
    if (!lines.length) node.append(make("p","rpx-note",shared.axes.length ? "지금 공개한 답에는 함께 읽을 짝이 없어요." : "친구가 네 짝 결과를 비공개로 뒀어요."));
    const status = make("p","rpx-note"); status.setAttribute("role","status");
    for (const line of lines) {
      const row=make("div","rpx-compare-line");
      row.append(make("small","",model().axes.find(a=>a.id === line.axisId).label),make("p","",line.text));
      if (line.kind === "question") row.append(button("이 말 복사",()=>copyText(line.text,status)));
      node.append(row);
    }
    node.append(status);
    return node;
  }
  function mountReceived(host,shared) {
    host.replaceChildren();
    const panel=make("section","rpx-panel rpx-received");
    if (!shared) {
      panel.append(make("h1","","이 링크를 읽을 수 없어요."),make("p","","친구에게 새 카드 링크를 받아 보세요."));
    } else {
      const picture = artFor(shared);
      panel.append(make("p","rpx-caption","친구가 보내 준 기본 별명"),make("h1","",shared.defaultName));
      if (picture.image) { const img=make("img","rpx-received-art");img.src=asset(picture.image);img.alt=picture.alt;panel.append(img); }
      if(shared.quote) panel.append(make("p","rpx-speech",shared.quote));
      panel.append(make("p","rpx-note",shared.axes.length ? "내 결과를 보면 친구와 함께 이야기할 짝을 찾을 수 있어요." : "친구가 네 짝 결과를 비공개로 뒀어요."));
    }
    panel.append(button("나도 해보기",()=>window.dispatchEvent(new Event("rb-pairs-start")),"rpx-primary"));
    host.append(panel);
  }

  const images = new Map();
  function loadImage(path) {
    if (!path) return Promise.resolve(null);
    if (!images.has(path)) images.set(path,new Promise(resolve=>{
      const img = new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>{images.delete(path);resolve(null);};
      img.src=asset(path);
    }));
    return images.get(path);
  }
  function fitText(ctx,text,width) {
    const lines=[];
    let current="";
    for (const word of text.split(/\s+/u)) {
      const next=current ? current+" "+word : word;
      if (current && ctx.measureText(next).width>width) {lines.push(current);current=word;} else current=next;
    }
    if(current) lines.push(current);
    return lines;
  }
  const font=(size,weight=500) => weight+" "+size+'px "Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  async function paint(result,title,format,quote) {
    const canvas=make("canvas"), ctx=canvas.getContext("2d");
    if (!ctx) throw Error("canvas");
    const W=1080,H=format==="story" ? 1920 : 1350;
    canvas.width=W; canvas.height=H;
    const portrait=artFor(result,title), img=await loadImage(portrait.image);
    if (portrait.image && !img) throw Error("image unavailable");
    ctx.fillStyle="#f9f5e9";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#d54e39";ctx.fillRect(0,0,W,19);
    ctx.fillStyle="#202d39";ctx.font=font(46,800);ctx.fillText("RUN·BTI",64,98);
    ctx.font=font(28,600);ctx.textAlign="right";ctx.fillText("내 러닝 성향",W-64,94);ctx.textAlign="left";
    const pageWidth=W-128;
    ctx.font=font(72,800);
    const titleLines=fitText(ctx,title,pageWidth);
    ctx.font=font(35);
    const quoteLines=quote ? fitText(ctx,quote,pageWidth) : [];
    const textTop=H-105-titleLines.length*88-quoteLines.length*52-(quote?40:0);
    const top=145,bottom=textTop-50,panelHeight=bottom-top;
    ctx.fillStyle="#dddcc8";ctx.fillRect(64,top,pageWidth,panelHeight);
    ctx.save();ctx.beginPath();ctx.rect(64,top,pageWidth,panelHeight);ctx.clip();
    ctx.strokeStyle="#fffbed";ctx.lineWidth=5;
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.moveTo(64,bottom-panelHeight*.14-i*27);ctx.bezierCurveTo(W*.37,bottom-50-i*27,W*.66,top+panelHeight*.83-i*27,W-64,bottom-panelHeight*.42-i*27);ctx.stroke();
    }
    if(img) {
      const scale=Math.min((pageWidth-82)/img.naturalWidth,(panelHeight-36)/img.naturalHeight);
      const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
      ctx.drawImage(img,(W-w)/2,bottom-18-h,w,h);
    }
    ctx.restore();
    ctx.strokeStyle="#26343b";ctx.lineWidth=5;ctx.strokeRect(64,top,pageWidth,panelHeight);
    ctx.fillStyle="#1c2b32";ctx.font=font(72,800);let y=textTop+55;
    titleLines.forEach(line=>{ctx.fillText(line,64,y);y+=88;});
    ctx.font=font(35);y+=2;
    quoteLines.forEach(line=>{ctx.fillText(line,64,y);y+=52;});
    ctx.fillStyle="#d34e37";ctx.fillRect(64,H-60,76,8);
    canvas.setAttribute("aria-label",[title,quote,portrait.alt].filter(Boolean).join(". "));
    return canvas;
  }
  function capture(url,title,invoker) {
    const dlg=make("dialog","rpx-dialog"), img=make("img");
    const cleanup=()=>{dlg.remove();invoker?.focus();};
    const close=()=>{if(typeof dlg.close === "function")dlg.close();else cleanup();};
    img.src=url;img.alt=title+" 카드"; const closer=button("돌아가기",close);
    dlg.append(img,closer);document.body.append(dlg);dlg.addEventListener("close",cleanup,{once:true});
    dlg.addEventListener("click",ev=>{if(ev.target===dlg)close();});
    if(typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open","");
  }
  const studioSettings=new WeakMap();
  function studio(result,answers,state,title) {
    const prefs=studioSettings.get(state) || {format:"feed",quote:"_",include:false};
    studioSettings.set(state,prefs);
    const panel=make("div","rpx-studio"),preview=make("div","rpx-preview"),actions=make("div","rpx-actions");
    const controls=make("div","rpx-controls");
    const status=make("p","rpx-note");status.setAttribute("role","status");
    const fallback=make("p","rpx-note");fallback.setAttribute("role","status");
    const download=make("a","rpx-btn rpx-primary","이미지 저장");
    const captureBtn=button("캡처 화면",()=>{if(cardImage)capture(cardImage,title,captureBtn);});
    const quoteHost=make("div");
    let cardImage="",revision=0;
    async function renderCard() {
      const renderId=++revision;
      cardImage="";captureBtn.disabled=true;download.removeAttribute("href");download.setAttribute("aria-disabled","true");
      try {
        const canvas=await paint(result,title,prefs.format,quoteText(prefs.quote));
        if (renderId!==revision) return;
        // A data URL keeps a long-pressable image available in browsers without a download action.
        cardImage=canvas.toDataURL("image/png");
        const img=make("img");img.src=cardImage;img.alt=canvas.getAttribute("aria-label");
        preview.replaceChildren(img);
        download.href=cardImage;download.download="런비티아이-"+title+"-"+(prefs.format==="story"?"스토리":"카드")+".png";
        download.removeAttribute("aria-disabled");captureBtn.disabled=false;fallback.textContent="";
      } catch {
        if(renderId!==revision)return;
        preview.replaceChildren(make("p","",title));
        fallback.replaceChildren(document.createTextNode("카드 그림을 불러오지 못했어요. "),button("다시 불러오기",renderCard));
      }
    }
    function refreshQuotes() {
      const options=quoteOptions(answers,state);
      if(!options.some(([key])=>key===prefs.quote))prefs.quote="_";
      quoteHost.replaceChildren(select("카드에 넣을 한 줄",[["_","별명만 담기"],...options],prefs.quote,val=>{
        prefs.quote=val;status.replaceChildren();renderCard();
      }));
    }
    const consent=make("label","rpx-consent"),input=make("input");
    input.type="checkbox";input.checked=prefs.include;
    input.onchange=()=>{prefs.include=input.checked;status.replaceChildren();};
    consent.append(input,document.createTextNode("친구가 비교할 수 있게 네 짝의 결과도 담기"));
    refreshQuotes();
    controls.append(select("카드 크기",[["feed","4:5 피드"],["story","9:16 스토리"]],prefs.format,val=>{
      prefs.format=val;renderCard();
    }),quoteHost);
    actions.append(download,captureBtn);
    const linkArea=make("div","rpx-link-area");
    linkArea.append(make("h4","","친구에게 보낼 링크"),make("p","rpx-note","링크에는 기본 별명과 직접 고른 한 줄이 담겨요. 링크를 받은 사람이 볼 수 있어요."),consent,
      button("링크 복사",()=>{
        const url=publicURL(result,prefs.include,prefs.quote);
        if (url) copyText(url,status);
        else status.textContent="웹에서 열면 링크를 만들 수 있어요. 여기서는 카드를 이미지로 저장해 주세요.";
      }),status);
    controls.append(actions,fallback,linkArea);
    panel.append(preview,controls);
    const wrapper=details("카드 꾸미고 저장하기",panel,"rpx-card-shell");
    wrapper.addEventListener("toggle",()=>{if(wrapper.open&&!cardImage)renderCard();});
    return {node:wrapper,refresh(){refreshQuotes();status.replaceChildren();if(wrapper.open)renderCard();}};
  }
  function mount(host,options) {
    const {result,answers={},storyState={},onStoryChange,shared}=options;
    const title=result.choices.find(c=>c.name===options.selectedName)?.name || result.defaultName;
    const card=studio(result,answers,storyState,title);
    const onChange=()=>{card.refresh();onStoryChange?.(storyState);};
    const topics=make("section","rpx-panel rpx-chapters");
    topics.append(make("h3","","내 러닝 이야기"));
    chapters.forEach(ch=>topics.append(chapterPanel(ch,result,answers,storyState,onChange)));
    const together=make("section","rpx-panel rpx-together");
    together.append(make("h3","","러닝 궁합"));
    if(shared) together.append(compareSection(result,shared));
    else together.append(make("p","rpx-note","친구 카드의 링크로 들어오면 두 사람의 취향을 나란히 볼 수 있어요."));
    together.append(details("누군가와 같이 뛴다면",choicePanel(companion,storyState,onChange)));
    host.replaceChildren(topics,card.node,together);
  }
  window.RBPairsExtras={mount,readShared,mountReceived,artFor,profilePreferences,archiveStories};
})();
