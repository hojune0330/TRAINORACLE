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
    return {id, text, options: options.map(([id, label, image, caption]) => ({id, label, image, caption})), ...config};
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
        ["always","여행 가면 꼭 뛰고 싶어서 챙겨","club-anime-travel","여행 가방을 쌀 때"],["sometimes","일정에 여유가 있으면 챙겨"],["rest","여행 중엔 러닝도 쉬고 싶어"],["wish","아직 해 본 적은 없는데 다음 여행엔 챙기고 싶어","club-anime-travel","다음 여행에 해 보고 싶은 일"],
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
        ["drills","러닝 드릴을 익혀 보고 싶어","club-anime-drill","배워 보고 싶은 동작"],["strength","달리기에 도움이 되는 근력 운동을 해 보고 싶어"],
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
        ["time","완주해도 목표 기록을 놓치면 아쉬워"],["finish","시간보다 끝까지 뛴 게 더 기억에 남을 것 같아"],
        ["fun","천천히 뛰는 것도 대회를 즐기는 방법이야"],["both","완주는 기쁜데 기록은 아쉬울 것 같아"],
      ]),
      question("otherFinish","친구가 천천히 완주한 날엔 어떤 얘기를 나누고 싶어?",[
        ["celebrate","끝까지 갔다는 얘기부터 축하하고 싶어"],["ask","친구한테 어땠는지 먼저 듣고 싶어"],["time","친구가 세운 목표 기록 얘기를 나누고 싶어"],
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
        ["during","뛰면서 숫자를 보고 페이스를 조절하고 싶어"],["after","뛰는 동안엔 두고 끝나고 기록만 보고 싶어","club-anime-record","기록을 보고 싶은 때"],
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
  const sceneDescriptions = {
    "club-anime-drill":"트랙에 낮은 허들이 놓여 있고 러너가 한쪽 무릎을 들어 첫 허들을 넘고 있어요.",
    "club-anime-travel":"여행 가방을 펼쳐 놓고 옷 옆에 운동화 한 켤레를 넣고 있어요.",
    "club-anime-record":"러너가 트랙 옆 벤치에 앉아 수첩을 펼치고 손목시계를 보고 있어요.",
  };
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
  function artFor(result, name = result.defaultName) {
    return window.RBPairArt.select(result, name);
  }
  function priorEvidence(chapter, answers) {
    const entries = [];
    for (const id of chapter.fields || []) {
      const q = model().extras.find(q => q.id === id);
      const answer = q.options.find(o => o.id === answers[id] && !["other","unknown"].includes(o.id));
      if (answer) entries.push({field:id, value:answer.id, question:q.text, answer:answer.label});
    }
    if (chapter.axis) {
      const item = model().items.find(q => q.axisId === chapter.axis && answers[q.id] === 2);
      if (item) entries.push({field:item.id, value:2, question:item.text, answer:model().labels[2]});
    }
    return entries;
  }
  function evidenceList(entries) {
    const list = make("ul","rpx-evidence");
    for (const entry of entries) {
      const li = make("li");
      li.dataset.question = entry.field;
      li.dataset.answer = entry.value;
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
  function chapterSticker(ch, state, characterKey) {
    const allowed = archiveStories(state);
    const rows = ch.questions.flatMap(q => selected(q,allowed).map(opt => ({q,opt})));
    if (!rows.length) return null;
    const sheet = make("div","rpx-sticker"), portrait = make("div","rpx-sticker-portrait");
    if (Object.hasOwn(model().characters,characterKey)) {
      const img = make("img"); img.src=asset("assets/lap/mini-"+characterKey.replace("+","-")+".webp");
      img.alt=model().characters[characterKey].nickname; img.width=72; img.height=72; img.loading="lazy";
      portrait.append(img);
    } else {
      const tag = make("span","rpx-sticker-tag",""); tag.setAttribute("role","img"); tag.setAttribute("aria-label","빈 이름표");
      portrait.append(tag);
    }
    sheet.append(portrait);
    const notes=make("dl","rpx-sticker-lines");
    for (const {q,opt} of rows) {
      const line=make("div"); line.dataset.question=q.id; line.dataset.answer=opt.id;
      line.append(make("dt","",shortTitles[q.id]),make("dd","",opt.label)); notes.append(line);
    }
    sheet.append(notes);
    return details(ch.title+" 스티커 펼치기",sheet,"rpx-chapter-sticker");
  }
  function chapterPanel(ch, answers, state, onChange, characterKey) {
    const panel = make("div","rpx-chapter");
    const prior = priorEvidence(ch,answers);
    if (prior.length) {
      const intro = {
        class:"달리기는 클래스에서 배우고 싶어요.", coach:"코치에게 따로 배우고 싶어요.", solo:"혼자 해 보면서 배우고 싶어요.",
      };
      const first = prior[0], line = ch.id === "practice" && intro[answers.learning]
        ? intro[answers.learning] : "‘"+first.question+"’에 ‘"+first.answer+"’라고 답했어요.";
      panel.append(make("p","rpx-narrative",line),details("앞에서 고른 답",evidenceList([first])));
    }
    const current = make("div"), reading = make("div","rpx-reading");
    const live = make("p","rpx-note"); live.setAttribute("role","status");
    function showReading() {
      reading.replaceChildren();
      const entries = [];
      const frames = new Map();
      for (const q of ch.questions) {
        for (const opt of selected(q,state)) {
          entries.push({field:q.id,value:opt.id,question:q.text,answer:opt.label});
          if (opt.image && opt.caption && sceneDescriptions[opt.image]) frames.set(opt.image,opt);
        }
      }
      if (!entries.length) return;
      reading.append(make("h4","","이 장면에서 나는"));
      const used = new Set();
      const available = [...entries,...prior];
      for (const [condition, text] of storyLines[ch.id]) {
        const evidence = Object.entries(condition).map(([field,value]) =>
          available.find(entry => entry.field === field && entry.value === value));
        if (!evidence.every(Boolean)) continue;
        const block = make("div","rpx-reading-line");
        block.append(make("p","rpx-narrative",text),details("이 풀이에 담긴 답",evidenceList(evidence)));
        reading.append(block);
        evidence.forEach(entry => used.add(entry));
      }
      const remaining = entries.filter(entry => !used.has(entry));
      if (remaining.length) reading.append(evidenceList(remaining));
      for (const frame of frames.values()) {
        const figure = make("figure","rpx-scene"), img = make("img");
        img.loading = "lazy"; img.src = asset(art(frame.image)); img.alt = sceneDescriptions[frame.image];
        figure.append(img,make("figcaption","",frame.caption+" · "+frame.label));
        reading.append(figure);
      }
      const sticker=chapterSticker(ch,state,characterKey);
      if (sticker) reading.append(sticker);
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
  const storyLines = {
    weather:[
      [{summer:"less",winter:"outside"},"더운 여름엔 덜 뛰고 싶고 추운 겨울엔 밖에서 뛰고 싶어요."],
      [{snowExperience:"no",snow:"want"},"눈 오는 날엔 아직 뛰어 본 적이 없지만 길이 미끄럽지 않다면 한번 나가 보고 싶어요."],
      [{rainExperience:"no",rain:"want"},"비 오는 날엔 아직 뛰어 본 적이 없지만 가랑비가 내리면 한번 뛰어 보고 싶어요."],
    ],
    travel:[
      [{homeRoute:"compare",travelRoute:"explore"},"동네에선 같은 길을 뛰면 지난 기록과 비교하기 좋고 여행지에선 낯선 동네를 뛰며 둘러보고 싶어요."],
      [{homeRoute:"lit",travelRoute:"explore"},"동네에서 같은 길을 고를 땐 밤에도 밝아서 좋고 여행지에선 처음 보는 동네를 뛰며 구경하고 싶어요."],
    ],
    practice:[
      [{athlete:"now",eagerness:"reluctant"},"지금 선수로 훈련하고 있지만 요즘은 달릴 날이 별로 기다려지지 않아요."],
      [{freeDay:"want",restPressure:"worry"},"훈련이 없는 날에도 달리고 싶고 쉬는 날엔 준비가 모자랄까 마음이 쓰여요."],
    ],
    race:[
      [{ownFinish:"time",otherFinish:"celebrate"},"내 목표 기록을 놓치면 아쉽지만 친구가 천천히 완주한 날엔 끝까지 뛴 걸 먼저 축하하고 싶어요."],
    ],
    body:[
      [{watch:"after",goal:"speed"},"속도는 더 내고 싶고 기록은 다 뛴 뒤에 보고 싶어요."],
    ],
  };

  // Only the selected public sentence and explicitly consented preferences can enter a card link.
  // Published copy for the original four-field and card2 links (ddfe6ac).
  // Never repurpose an ID with a different meaning. Give future wording editions their own overrides.
  const words1 = {
    "quotes": {
      "i:distance-1": "조금 더 멀리 가는 게 좋아.",
      "i:distance-2": "여유가 있으면 한 바퀴 더 돌고 싶어.",
      "i:distance-3": "오래 달리는 날이 기다려져.",
      "i:speed-1": "짧은 구간에서 속도를 내 보는 게 좋아.",
      "i:speed-2": "발이 빨라지는 순간이 재밌어.",
      "i:speed-3": "잠깐 빠르게 달리는 날이 기다려져.",
      "i:numbers-1": "지금 페이스를 숫자로 보면 편해.",
      "i:numbers-2": "한 구간이 끝나면 걸린 시간을 보는 게 좋아.",
      "i:numbers-3": "뛰면서 중간 기록을 듣는 게 좋아.",
      "i:senses-1": "지금 페이스를 숨소리로 가늠하면 편해.",
      "i:senses-2": "뛰면서 다리가 가벼운지 살피는 게 좋아.",
      "i:senses-3": "발걸음으로 내 속도를 가늠하면 편해.",
      "i:familiar-1": "아는 길을 다시 뛰는 게 좋아.",
      "i:familiar-2": "자주 가는 코스라면 반가워.",
      "i:familiar-3": "갈림길에선 낯익은 쪽이 끌려.",
      "i:explore-1": "새 골목이 보이면 들어가 보고 싶어.",
      "i:explore-2": "처음 가는 코스라면 반가워.",
      "i:explore-3": "늘 뛰던 동네에서도 새 길을 찾고 싶어.",
      "i:plan-1": "나가기 전에 오늘 할 걸 정해 두면 편해.",
      "i:plan-2": "다음 주 뛸 날을 미리 정해 두고 싶어.",
      "i:plan-3": "여유 있는 날도 뛸 계획을 짜는 게 좋아.",
      "i:improvise-1": "일단 나가서 뛰며 정하는 게 편해.",
      "i:improvise-2": "다음에 뛸 날은 그날 가서 정하고 싶어.",
      "i:improvise-3": "뛰다가 내키는 대로 바꾸는 게 좋아.",
      "e:learning:class": "배우고 싶은 방식 · 클래스에서",
      "e:learning:coach": "배우고 싶은 방식 · 코치와 따로",
      "e:learning:solo": "배우고 싶은 방식 · 혼자 해 보기",
      "e:strength:endurance": "자신 있는 것 · 오래 달리기",
      "e:strength:speed": "자신 있는 것 · 속도 내기",
      "e:strength:steady": "자신 있는 것 · 고른 페이스",
      "e:strength:consistency": "자신 있는 것 · 꾸준히 나가기",
      "e:goal:distance": "다음 목표 · 거리 늘리기",
      "e:goal:speed": "다음 목표 · 속도 내기",
      "e:goal:consistency": "다음 목표 · 꾸준히 뛰기",
      "e:goal:finish": "다음 목표 · 대회 완주",
      "e:goal:technique": "다음 목표 · 자세 익히기",
      "s:summer:outside": "여름 · 여름에도 밖에서 뛰고 싶어",
      "s:summer:less": "여름 · 여름엔 덜 뛰고 싶어",
      "s:summer:indoor": "여름 · 실내에서 뛰고 싶어",
      "s:winter:outside": "겨울 · 겨울에도 밖에서 뛰고 싶어",
      "s:winter:less": "겨울 · 겨울엔 덜 뛰고 싶어",
      "s:winter:indoor": "겨울 · 실내에서 뛰고 싶어",
      "s:snowExperience:yes": "눈 오는 날의 경험 · 뛰어 봤어",
      "s:snowExperience:no": "눈 오는 날의 경험 · 아직 안 뛰어 봤어",
      "s:snow:want": "눈 오는 날의 마음 · 한번 뛰어 보고 싶어",
      "s:snow:maybe": "눈 오는 날의 마음 · 그날 가서 정하고 싶어",
      "s:snow:no": "눈 오는 날의 마음 · 밖에서는 별로 뛰고 싶지 않아",
      "s:rainExperience:yes": "비 오는 날의 경험 · 뛰어 봤어",
      "s:rainExperience:no": "비 오는 날의 경험 · 아직 안 뛰어 봤어",
      "s:rain:want": "비 오는 날의 마음 · 한번 뛰어 보고 싶어",
      "s:rain:maybe": "비 오는 날의 마음 · 그날 가서 정하고 싶어",
      "s:rain:no": "비 오는 날의 마음 · 밖에서는 별로 뛰고 싶지 않아",
      "s:time:morning": "좋아하는 시간대 · 아침",
      "s:time:day": "좋아하는 시간대 · 낮",
      "s:time:evening": "좋아하는 시간대 · 저녁이나 밤",
      "s:time:varies": "좋아하는 시간대 · 날마다 달라",
      "s:timeAvailable:rarely": "평일에 낼 수 있는 시간 · 거의 없어",
      "s:timeAvailable:short": "평일에 낼 수 있는 시간 · 30분 미만",
      "s:timeAvailable:hour": "평일에 낼 수 있는 시간 · 30분에서 한 시간",
      "s:timeAvailable:long": "평일에 낼 수 있는 시간 · 한 시간 이상",
      "s:timeAvailable:varies": "평일에 낼 수 있는 시간 · 날마다 달라",
      "s:travelRun:always": "여행 가방 · 여행 가면 꼭 뛰고 싶어서 챙겨",
      "s:travelRun:sometimes": "여행 가방 · 일정에 여유가 있으면 챙겨",
      "s:travelRun:rest": "여행 가방 · 여행 중엔 러닝도 쉬고 싶어",
      "s:travelRun:wish": "여행 가방 · 아직 해 본 적은 없는데 다음 여행엔 챙기고 싶어",
      "s:travelRun:limited": "여행 가방 · 뛰고는 싶은데 일정상 챙기기 어려워",
      "s:travelRun:disliked": "여행 가방 · 여행지에서 뛰어 봤는데 내 취향은 아니었어",
      "s:travelRoute:explore": "여행지 코스 · 처음 보는 동네를 뛰면서 둘러보고 싶어",
      "s:travelRoute:familiar": "여행지 코스 · 미리 알아본 길을 뛰고 싶어",
      "s:travelRoute:near": "여행지 코스 · 숙소 근처면 어디든 좋아",
      "s:homeRoute:compare": "동네 단골길 · 지난번과 기록을 비교하기 좋아",
      "s:homeRoute:lit": "동네 단골길 · 밤에도 밝아서 다니기 편해",
      "s:homeRoute:near": "동네 단골길 · 집에서 가까워",
      "s:homeRoute:fond": "동네 단골길 · 아는 길을 다시 뛰는 게 좋아",
      "s:homeRoute:different": "동네 단골길 · 같은 코스를 자주 뛰진 않아",
      "s:training:drills": "더 해 보고 싶은 훈련 · 러닝 드릴을 익혀 보고 싶어",
      "s:training:strength": "더 해 보고 싶은 훈련 · 달리기에 도움이 되는 근력 운동을 해 보고 싶어",
      "s:training:distance": "더 해 보고 싶은 훈련 · 달리는 거리를 늘려 보고 싶어",
      "s:training:speed": "더 해 보고 싶은 훈련 · 짧게 속도를 내며 달리고 싶어",
      "s:athlete:now": "선수 경험 · 지금 선수로 훈련하고 있어",
      "s:athlete:past": "선수 경험 · 예전에 선수로 훈련했어",
      "s:athlete:none": "선수 경험 · 선수로 훈련한 적은 없어",
      "s:freeDay:want": "훈련이 없는 날 · 일정이 없어도 뛰고 싶어",
      "s:freeDay:rest": "훈련이 없는 날 · 쉬는 날이 반가워",
      "s:freeDay:varies": "훈련이 없는 날 · 날마다 달라",
      "s:shortEasy:like": "짧고 느긋하게 뛰는 날 · 짧게 천천히 뛰고 오는 게 좋아",
      "s:shortEasy:dislike": "짧고 느긋하게 뛰는 날 · 그렇게 뛰어 봤는데 별로였어",
      "s:shortEasy:new": "짧고 느긋하게 뛰는 날 · 그렇게 뛰어 본 적은 없어",
      "s:shortEasy:limited": "짧고 느긋하게 뛰는 날 · 그렇게 뛰고 싶은데 요즘 여건이 안 돼",
      "s:shortEasy:varies": "짧고 느긋하게 뛰는 날 · 날마다 달라",
      "s:ownFinish:time": "내 완주 · 완주해도 목표 기록을 놓치면 아쉬워",
      "s:ownFinish:finish": "내 완주 · 시간보다 끝까지 뛴 게 더 기억에 남을 것 같아",
      "s:ownFinish:fun": "내 완주 · 천천히 뛰는 것도 대회를 즐기는 방법이야",
      "s:ownFinish:both": "내 완주 · 완주는 기쁜데 기록은 아쉬울 것 같아",
      "s:otherFinish:celebrate": "친구의 완주 · 끝까지 갔다는 얘기부터 축하하고 싶어",
      "s:otherFinish:ask": "친구의 완주 · 친구한테 어땠는지 먼저 듣고 싶어",
      "s:otherFinish:time": "친구의 완주 · 친구가 세운 목표 기록 얘기를 나누고 싶어",
      "s:watch:during": "뛰는 중에 보는 숫자 · 뛰면서 숫자를 보고 페이스를 조절하고 싶어",
      "s:watch:after": "뛰는 중에 보는 숫자 · 뛰는 동안엔 두고 끝나고 기록만 보고 싶어",
      "s:watch:without": "뛰는 중에 보는 숫자 · 기록 없이 뛰고 싶어",
      "s:watch:new": "뛰는 중에 보는 숫자 · 아직 써 본 적이 없어",
      "s:firstReason:fitness": "처음 뛰고 싶던 이유 · 체력을 기르고 싶었어",
      "s:firstReason:mood": "처음 뛰고 싶던 이유 · 나가서 머리를 식히고 싶었어",
      "s:firstReason:race": "처음 뛰고 싶던 이유 · 한번 대회를 완주해 보고 싶었어",
      "s:firstReason:company": "처음 뛰고 싶던 이유 · 같이 뛰자는 사람이 있었어",
      "s:firstReason:other": "처음 뛰고 싶던 이유 · 다른 이유였어"
    },
    "names": {
      "open": "내 러닝 취향",
      "unanswered": "지금까지 고른 답",
      "distance": "거리 | 성큼성큼 코끼리",
      "speed": "속도 | 질주 치타",
      "numbers": "숫자 | 문어",
      "senses": "감각 | 손수건 고양이",
      "familiar": "단골 | 동네 단골 강아지",
      "explore": "탐험 | 흰꼬리 여우",
      "plan": "계획 | 비버",
      "improvise": "즉흥 | 날개 편 앵무새",
      "distance+numbers": "거리·숫자 | 황제펭귄",
      "distance+senses": "거리·감각 | 타월 거북이",
      "speed+numbers": "속도·숫자 | 송골매",
      "speed+senses": "속도·감각 | 물살 타는 돌고래",
      "distance+familiar": "거리·단골 | 보온병 판다",
      "distance+explore": "거리·탐험 | 먼 바다 혹등고래",
      "speed+familiar": "속도·단골 | 돌아오는 제비",
      "speed+explore": "속도·탐험 | 선글라스 상어",
      "distance+plan": "거리·계획 | 배낭 멘 낙타",
      "distance+improvise": "거리·즉흥 | 한 모금 캥거루",
      "speed+plan": "속도·계획 | 운동화 챙긴 토끼",
      "speed+improvise": "속도·즉흥 | 후다닥 다람쥐",
      "numbers+familiar": "숫자·단골 | 고리꼬리 라쿤",
      "numbers+explore": "숫자·탐험 | 길 찾는 기린",
      "senses+familiar": "감각·단골 | 밴드 찬 코알라",
      "senses+explore": "감각·탐험 | 호랑나비",
      "numbers+plan": "숫자·계획 | 올빼미",
      "numbers+improvise": "숫자·즉흥 | 폴짝 개구리",
      "senses+plan": "감각·계획 | 곱슬 양",
      "senses+improvise": "감각·즉흥 | 둥실 해파리",
      "familiar+plan": "단골·계획 | 고슴도치",
      "familiar+improvise": "단골·즉흥 | 우리 동네 햄스터",
      "explore+plan": "탐험·계획 | 새 코스 찜한 카멜레온",
      "explore+improvise": "탐험·즉흥 | 훌쩍 떠나는 바다코끼리"
    },
    "company": {
      "chat": "얘기하면서 같이 뛰고 싶어",
      "own": "같이 출발해서 각자 뛰고 다시 만나고 싶어",
      "quiet": "말없이 발 맞춰 뛰고 싶어",
      "solo": "혼자 뛰고 나중에 얘기하는 게 좋아"
    }
  };
  const words2 = {...words1, quotes:{...words1.quotes,
    "i:numbers-1":"지금 뛰는 빠르기를 숫자로 보면 편해.",
    "i:senses-1":"숨소리로 내 속도를 가늠하면 편해.",
  }};
  const wordEditions = new Map([["w1", words1], ["w2", words2]]);
  const currentWords = "w2";
  const safeExtraIds = new Set(["strength","goal","learning"]);
  const extraHead = {strength:"자신 있는 것",goal:"다음 목표",learning:"배우고 싶은 방식"};
  function quoteText(id) {
    if (!id || id === "_") return "";
    const [source,field,value] = id.split(":");
    if (source === "i") {
      const item = model().items.find(i => i.id === field);
      return item && !value ? item.reading : "";
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
  // This order is part of the card3 wire format. Never derive the order from the quiz.
  const bagKeys = ["distance","speed","numbers","senses","familiar","explore","plan","improvise"]
    .flatMap(side => [1,2,3].map(n => side+"-"+n));
  function encodeBag(answers, allowed) {
    const flags = bagKeys.reduce((mask,key,index) =>
      answers[key] === 2 && allowed?.has(key) ? mask | (1 << index) : mask, 0);
    return flags ? flags.toString(16) : "_";
  }
  function packShare(result,include,quote,company,bag) {
    const states = include ? result.axes.map((a,i) => a.state === "direction"
      ? (a.direction === model().axes[i].sides[0].id ? "l" : "r") : chars[a.state]).join("") : "_";
    const id = quoteText(quote) ? quote : "_";
    const sides = result.defaultKey.split("+");
    const primary = include && sides.length === 2 ? window.RBPairArt?.shareKey(result,result.defaultName) : null;
    return "#pairs="+["card3",currentWords,bag,result.version,result.defaultKey,states,id,
      companion.options.some(opt => opt.id === company) ? company : "_",sides.includes(primary) ? primary : "_"].join("~");
  }
  function readShared(hash = location.hash) {
    if (typeof hash !== "string" || !hash.startsWith("#pairs=") || hash.length > 160) return null;
    const parts = hash.slice(7).split("~");
    const isV3 = parts[0] === "card3", isV2 = parts[0] === "card2";
    if (parts.length !== (isV3 ? 9 : isV2 ? 7 : 4)) return null;
    const wording = isV3 ? parts[1] : "w1";
    const words = wordEditions.get(wording);
    const bagCode = isV3 ? parts[2] : "_";
    if (!words || (bagCode !== "_" && !/^[1-9a-f][0-9a-f]{0,5}$/.test(bagCode))) return null;
    const [version,defaultKey,states,id,company = "_",primary = "_"] = parts.slice(isV3 ? 3 : isV2 ? 1 : 0);
    const m = model();
    if (version !== "pairs-1" || !Object.hasOwn(words.names,defaultKey) || (states !== "_" && !/^[lrbnmu]{4}$/.test(states))) return null;
    if (id !== "_" && !Object.hasOwn(words.quotes,id)) return null;
    if ((id.startsWith("i:") || bagCode !== "_") && defaultKey === "unanswered") return null;
    if (company !== "_" && !Object.hasOwn(words.company,company)) return null;
    const sides = defaultKey.split("+");
    if (states !== "_" && primary !== "_" && (sides.length !== 2 || !sides.includes(primary))) return null;
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
    const mask = bagCode === "_" ? 0 : parseInt(bagCode,16);
    const bag = bagKeys.filter((key,index) => mask & (1 << index))
      .map(key => ({key, text:words.quotes["i:"+key]}));
    return {version,wording,defaultKey,defaultName:words.names[defaultKey],axes,quote:words.quotes[id] || "",bag,
      companyText:words.company[company] || "",
      company:company === "_" ? null : company, art:states === "_" || primary === "_" ? null : primary};
  }
  function publicURL(result,include,quote,company,bag) {
    if (!["http:","https:"].includes(location.protocol)) return null;
    const url = new URL(location.pathname,location.origin);
    if (new URL(location.href).searchParams.get("edition")==="train") url.searchParams.set("edition","train");
    url.hash = packShare(result,include,quote,company,bag);
    return url.href;
  }
  async function copyText(value,host,isCurrent = () => true) {
    try {
      await navigator.clipboard.writeText(value);
      if (isCurrent()) host.replaceChildren(document.createTextNode("복사했어요."));
    } catch {
      if (!isCurrent()) return;
      const input = make("textarea","rpx-copy");
      input.setAttribute("aria-label","복사할 내용"); input.readOnly = true; input.value=value;
      host.replaceChildren(document.createTextNode("아래 내용을 선택해 복사해 주세요."),input); input.focus(); input.select();
    }
  }
  const companyPrompts = {
    "chat/chat":"다음에 뛰면서 무슨 얘기부터 할까?",
    "chat/own":"같이 출발할 때 얘기할까? 다 뛰고 만나서 얘기할까?",
    "chat/quiet":"뛰면서 얘기하는 시간이랑 말없이 발 맞추는 시간을 나눠 볼까?",
    "chat/solo":"이번엔 따로 뛰고 끝나면 전화로 얘기할까?",
    "own/own":"같이 출발해서 각자 뛰고 어디서 다시 만날까?",
    "own/quiet":"처음엔 나란히 뛰고 그다음엔 각자 뛰어 볼까?",
    "own/solo":"각자 뛴 뒤에 만나서 얘기할까? 아니면 연락만 할까?",
    "quiet/quiet":"다음엔 어디서 말없이 나란히 뛰어 볼까?",
    "quiet/solo":"이번엔 각자 뛰고 다음에 나란히 뛸 날을 잡아 볼까?",
    "solo/solo":"각자 뛰고 나서 오늘 어땠는지 한마디씩 보낼까?",
  };
  function companyComparison(shared,state) {
    const node = make("div","rpx-company-compare");
    const friend = companion.options.find(opt => opt.id === shared?.company);
    let agreed = null;
    function refresh() {
      node.replaceChildren();
      if (!friend) return;
      const mine = selected(companion,state)[0];
      if (mine?.id !== agreed) agreed = null;
      node.append(make("p","rpx-note","친구가 고른 답 · "+(shared.companyText || friend.label)));
      if (!mine) {
        node.append(make("p","rpx-note","내 동행 방식도 고르면 여기서 친구 답과 비교할 수 있어요."));
      } else if (!agreed) {
        node.append(button("내 답도 나란히 보기",()=>{agreed=mine.id;refresh();}));
      } else {
        const prompt = companyPrompts[[mine.id,friend.id].sort().join("/")];
        const status = make("p","rpx-note"); status.setAttribute("role","status");
        node.append(make("p","rpx-note","내가 고른 답 · "+mine.label),
          make("p","rpx-speech",prompt),button("이 말 복사",()=>copyText(prompt,status)),status);
      }
    }
    refresh();
    return {node,refresh};
  }
  function sharedBag(shared,answers) {
    const box = make("section","rpx-shared-bag");
    function bagHeading(level,title) {
      const heading=make(level,"rpx-bag-title"), img=make("img");
      img.src=asset("assets/lap/bag.webp"); img.alt=""; img.width=32; img.height=32;
      heading.append(img,document.createTextNode(title)); return heading;
    }
    const heading=bagHeading("h4","친구가 열어 준 가방");
    box.append(heading);
    if (!shared.bag?.length) {
      box.append(make("p","rpx-note","이 링크에는 가방 속 답을 담지 않았어요."));
      return box;
    }
    const list = make("ul","rpx-bag-notes");
    shared.bag.forEach(entry => list.append(make("li","",entry.text)));
    box.append(list);
    if (!answers) return box;
    const mine = model().items.filter(item => answers[item.id] === 2);
    if (!mine.length) return box;
    const compare = button("내 가방도 펼쳐 보기",() => {
      const sharedIds = new Set(shared.bag.map(entry => entry.key));
      const common=mine.filter(item => sharedIds.has(item.id)).map(item => item.reading);
      list.remove(); compare.remove(); heading.textContent="우리 가방 나란히";
      function notes(lines) {
        const items = make("ul","rpx-bag-notes");
        lines.forEach(text => items.append(make("li","",text)));
        return items;
      }
      if (common.length) box.append(make("h5","","둘 다 좋아한 답"),notes(common));
      const pair=make("div","rpx-bags-together");
      const groups=[
        ["내 가방", mine.filter(item => !sharedIds.has(item.id)).map(item => item.reading)],
        ["친구 가방", shared.bag.filter(entry => !mine.some(item => item.id === entry.key)).map(entry => entry.text)],
      ];
      for (const [label,lines] of groups) {
        const pouch=make("div","rpx-pouch");
        pouch.append(bagHeading("h5",label), lines.length ? notes(lines) :
          make("p","rpx-note","이쪽에만 있는 답은 없어요."));
        pair.append(pouch);
      }
      box.append(pair);
      box.append(make("p","rpx-note","친구가 링크에 담은 답만 함께 봐요. 내 답은 이 화면에만 보여요."));
    });
    box.append(compare);
    return box;
  }
  function compareSection(result,shared,answers) {
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
    node.append(status,sharedBag(shared,answers));
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
      const figure=make("figure","rpx-received-art");
      window.RBPairArt.mount(figure,picture);panel.append(figure);
      if(shared.quote) panel.append(make("p","rpx-speech",shared.quote));
      if (shared.companyText) panel.append(make("p","rpx-speech","친구가 고른 동행 방식 · "+shared.companyText));
      panel.append(sharedBag(shared));
      if (Object.hasOwn(model().characters,shared.defaultKey)) {
        let saved = false;
        try {
          localStorage.setItem(collectionPrefix + shared.defaultKey,"1");
          saved = true;
        } catch { /* Storage can be disabled in private browsing. */ }
        panel.append(make("p","rpx-note",saved ? "친구 도감에서 이 동물을 다시 볼 수 있어요." : "이 기기에 친구 도감을 저장할 수 없어요."));
      }
      panel.append(make("p","rpx-note",shared.axes.length ? "내 결과를 보면 친구와 함께 이야기할 짝을 찾을 수 있어요." : "친구가 네 짝 결과를 비공개로 뒀어요."));
    }
    panel.append(button("나도 해보기",()=>window.dispatchEvent(new Event("rb-pairs-start")),"rpx-primary"));
    host.append(panel);
  }

  const collectionPrefix = "runbti.friends.animal.";
  function collectionView() {
    const box = make("section","rpx-panel rpx-collection"), grid = make("ul","rpx-collection-grid");
    box.append(make("h2","","친구 동물 도감"),make("p","rpx-note","친구가 보낸 카드를 열면 여기서 다시 만날 수 있어요."));
    for (const [key,character] of Object.entries(model().characters)) {
      let met = false;
      try { met = localStorage.getItem(collectionPrefix + key) === "1"; } catch { /* Show unopened slots. */ }
      const slot = make("li",met ? "rpx-met" : "rpx-unmet");
      const img = make("img"), slug = key.replace("+","-");
      img.src = asset("assets/lap/"+(met ? "mini-" : "silhouette-")+slug+".webp");
      img.alt=""; img.loading="lazy"; img.width=48; img.height=48;
      if (met) {
        const body = make("div","rpx-met-card"), picture = make("figure","rpx-received-art");
        const entry = details("",body);
        entry.addEventListener("toggle",() => {
          if (entry.open && !picture.childElementCount) window.RBPairArt.mount(picture,artFor({defaultKey:key}));
        });
        entry.querySelector("summary").replaceChildren(img,make("span","",character.nickname));
        body.append(picture,make("p","",character.reading));
        slot.append(entry);
      } else {
        slot.setAttribute("aria-label","아직 만나지 않은 동물");
        slot.append(img);
      }
      grid.append(slot);
    }
    box.append(grid);
    return box;
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
  async function paint(result,title,format,quote,includeOrder=false) {
    const canvas=make("canvas"), ctx=canvas.getContext("2d");
    if (!ctx) throw Error("canvas");
    const W=1080,H=format==="story" ? 1920 : 1350;
    canvas.width=W; canvas.height=H;
    const chosen=artFor(result,title);
    const portrait=includeOrder ? chosen : artFor({defaultKey:chosen.key});
    const img=await window.RBPairArt.load(portrait.image);
    ctx.fillStyle="#f9f5e9";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#d54e39";ctx.fillRect(0,0,W,19);
    const topMargin=format==="story"?122:89;
    ctx.fillStyle="#202d39";ctx.font=font(46,800);ctx.fillText("RUN·BTI",64,topMargin);
    ctx.font=font(28,600);ctx.textAlign="right";ctx.fillText("내 러닝 성향",W-64,topMargin-4);ctx.textAlign="left";
    const pageWidth=W-128;
    ctx.font=font(72,800);
    const titleLines=fitText(ctx,title,pageWidth);
    ctx.font=font(35);
    const quoteLines=quote ? fitText(ctx,quote,pageWidth) : [];
    ctx.font=font(31);
    const captionLines=fitText(ctx,portrait.caption,pageWidth);
    const titleY=topMargin+(format==="story"?129:111);
    ctx.fillStyle="#1c2b32";ctx.font=font(72,800);
    titleLines.forEach((line,i)=>ctx.fillText(line,64,titleY+i*88));
    const top=titleY+titleLines.length*88-36;
    const footer=format==="story"?165:92;
    const bottom=H-footer-captionLines.length*44-quoteLines.length*52-(quote?91:26);
    const panelHeight=bottom-top;
    window.RBPairArt.draw(ctx,portrait,img,64,top,pageWidth,panelHeight);
    ctx.strokeStyle="#26343b";ctx.lineWidth=5;ctx.strokeRect(64,top,pageWidth,panelHeight);
    ctx.fillStyle="#444e56";ctx.font=font(31);
    captionLines.forEach((line,i)=>ctx.fillText(line,64,bottom+59+i*44));
    if(quote){
      const y=bottom+97+captionLines.length*44;
      ctx.fillStyle="#793925";ctx.font=font(26,700);ctx.fillText("내가 고른 답",64,y);
      ctx.fillStyle="#1c2b32";ctx.font=font(35);
      quoteLines.forEach((line,i)=>ctx.fillText(line,64,y+51+i*52));
    }
    ctx.fillStyle="#d34e37";ctx.fillRect(64,H-footer/2,76,8);
    canvas.setAttribute("aria-label",[title,quote,portrait.alt].filter(Boolean).join(". "));
    return canvas;
  }
  function capture(url,title,invoker,host) {
    const dlg=make("dialog","rpx-dialog"), img=make("img");
    const cleanup=()=>{dlg.remove();invoker?.focus();};
    const close=()=>{if(typeof dlg.close === "function")dlg.close();else cleanup();};
    img.src=url;img.alt=title+" 카드"; const closer=button("돌아가기",close);
    dlg.append(img,closer);host.append(dlg);dlg.addEventListener("close",cleanup,{once:true});
    dlg.addEventListener("click",ev=>{if(ev.target===dlg)close();});
    if(typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open","");
    return dlg;
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
    let activeCapture;
    const captureBtn=button("캡처 화면",()=>{if(cardImage)activeCapture=capture(cardImage,title,captureBtn,panel);});
    const quoteHost=make("div");
    let cardImage="",revision=0,linkRevision=0;
    const wrapper=details("카드 꾸미고 저장하기",panel,"rpx-card-shell");
    function clearLink() { linkRevision++;status.replaceChildren(); }
    function clearImage() {
      revision++;
      cardImage="";
      preview.replaceChildren();fallback.replaceChildren();
      if (activeCapture) {
        activeCapture.replaceChildren();
        activeCapture.remove();activeCapture=null;
      }
      captureBtn.disabled=true;
      download.removeAttribute("href");download.removeAttribute("download");download.setAttribute("aria-disabled","true");
    }
    async function renderCard() {
      clearImage();
      if (!wrapper.open) return;
      const renderId=revision;
      try {
        const canvas=await paint(result,title,prefs.format,quoteText(prefs.quote),prefs.include);
        if (renderId!==revision || !wrapper.isConnected) return;
        // A data URL keeps a long-pressable image available in browsers without a download action.
        cardImage=canvas.toDataURL("image/png");
        const img=make("img");img.src=cardImage;img.alt=canvas.getAttribute("aria-label");
        preview.replaceChildren(img);
        download.href=cardImage;download.download="런비티아이-"+title.replace(" | ","-")+"-"+(prefs.format==="story"?"스토리":"카드")+".png";
        download.removeAttribute("aria-disabled");captureBtn.disabled=false;fallback.textContent="";
      } catch {
        if(renderId!==revision || !wrapper.isConnected)return;
        preview.replaceChildren(make("p","",title));
        fallback.replaceChildren(document.createTextNode("카드 그림을 불러오지 못했어요. "),button("다시 불러오기",renderCard));
      }
    }
    function refreshQuotes() {
      const options=quoteOptions(answers,state);
      if(!options.some(([key])=>key===prefs.quote))prefs.quote="_";
      quoteHost.replaceChildren(select("카드에 넣을 한 줄",[["_","별명만 담기"],...options],prefs.quote,val=>{
        prefs.quote=val;clearLink();renderCard();
      }));
    }
    const consent=make("label","rpx-consent"),input=make("input");
    input.type="checkbox";input.name="sharePairResults";input.checked=prefs.include;
    input.onchange=()=>{prefs.include=input.checked;clearLink();renderCard();};
    const consentCopy=make("span","","네 짝 결과도 공개하기");
    const shareHint=result.defaultKey.includes("+")
      ? "카드에선 더 뚜렷한 취향의 표식이 커져요. 링크에선 네 짝 결과를 모두 볼 수 있어요."
      : "친구가 링크를 열면 네 짝 결과를 모두 볼 수 있어요.";
    consentCopy.append(make("small","rpx-note",shareHint));
    consent.append(input,consentCopy);
    const companyConsent=make("div");
    function refreshCompany() {
      const choice = selected(companion,state)[0];
      if (!choice || choice.id !== prefs.company) prefs.company = null;
      companyConsent.replaceChildren();
      if (!choice) return;
      const label=make("label","rpx-consent"), check=make("input");
      check.type="checkbox";check.checked=prefs.company === choice.id;
      check.onchange=()=>{prefs.company=check.checked?choice.id:null;clearLink();};
      label.append(check,document.createTextNode("동행 답도 링크에 담기 · "+choice.label));
      companyConsent.append(label);
    }
    const bagConsent=make("div");
    prefs.bag ??= new Set();
    let bagOpen=false;
    function refreshBag() {
      const liked = model().items.filter(item => answers[item.id] === 2);
      for (const id of prefs.bag) if (!liked.some(item => item.id === id)) prefs.bag.delete(id);
      bagConsent.replaceChildren();
      if (!liked.length) return;
      const options=make("div","rpx-bag-options");
      options.append(make("p","rpx-note","체크한 문장만 친구 가방에 보여요."));
      for (const item of liked) {
        const label=make("label","rpx-consent"), check=make("input");
        check.type="checkbox"; check.name="shareBag"; check.value=item.id; check.checked=prefs.bag.has(item.id);
        check.onchange=()=>{
          if (check.checked) prefs.bag.add(item.id); else prefs.bag.delete(item.id);
          clearLink();
        };
        label.append(check,document.createTextNode(item.reading)); options.append(label);
      }
      const toggle=button("친구에게 보여 줄 가방 속 답",()=>{
        bagOpen=!bagOpen; options.hidden=!bagOpen;
        toggle.setAttribute("aria-expanded",String(bagOpen));
      });
      toggle.setAttribute("aria-expanded",String(bagOpen)); options.hidden=!bagOpen;
      bagConsent.append(toggle,options);
    }
    refreshQuotes();refreshCompany();refreshBag();clearImage();
    controls.append(select("카드 크기",[["feed","4:5 피드"],["story","9:16 스토리"]],prefs.format,val=>{
      prefs.format=val;renderCard();
    }),quoteHost,consent);
    actions.append(download,captureBtn);
    const linkArea=make("div","rpx-link-area");
    const linkNameHint = title === result.defaultName ? "기본 별명 ‘"+result.defaultName+"’과 내가 담은 내용을 볼 수 있어요." :
      "내 이미지에는 ‘"+title+"’이 나와요. 친구 링크와 친구 도감에는 기본 별명 ‘"+result.defaultName+"’이 담겨요.";
    linkArea.append(make("h4","","친구에게 보낼 링크"),make("p","rpx-note",linkNameHint+" 이미 보낸 링크에는 보낼 때 고른 내용이 남아요."),companyConsent,bagConsent,
      button("링크 복사",()=>{
        const url=publicURL(result,prefs.include,prefs.quote,prefs.company,encodeBag(answers,prefs.bag));
        const current=++linkRevision;
        if (url) copyText(url,status,()=>current===linkRevision && panel.isConnected);
        else status.textContent="웹에서 열면 링크를 만들 수 있어요. 여기서는 카드를 이미지로 저장해 주세요.";
      }),status);
    controls.append(actions,fallback,linkArea);
    panel.append(preview,controls);
    wrapper.addEventListener("toggle",()=>{if(wrapper.open&&!cardImage)renderCard();});
    return {node:wrapper,refresh(){
      const previousQuote = prefs.quote;
      refreshQuotes();refreshCompany();refreshBag();clearLink();
      if (prefs.quote !== previousQuote) renderCard();
    }};
  }
  function mount(host,options) {
    const {result,answers={},storyState={},onStoryChange,shared}=options;
    const title=result.choices.find(c=>c.name===options.selectedName)?.name || result.defaultName;
    const card=studio(result,answers,storyState,title);
    const company = companyComparison(shared,storyState);
    const onChange=()=>{card.refresh();company.refresh();onStoryChange?.(storyState);};
    const topics=make("section","rpx-panel rpx-chapters");
    topics.append(make("h3","","내 러닝 이야기"));
    const characterKey = result.choices.find(c=>c.name===title)?.key || result.defaultKey;
    chapters.forEach(ch=>topics.append(chapterPanel(ch,answers,storyState,onChange,characterKey)));
    const together=make("section","rpx-panel rpx-together");
    together.append(make("h3","","러닝 궁합"));
    if(shared) together.append(compareSection(result,shared,answers));
    else together.append(make("p","rpx-note","친구 카드의 링크로 들어오면 두 사람의 취향을 나란히 볼 수 있어요."));
    together.append(details("누군가와 같이 뛴다면",choicePanel(companion,storyState,onChange)),company.node);
    host.replaceChildren(topics,card.node,together);
  }
  window.RBPairsExtras={mount,readShared,mountReceived,artFor,profilePreferences,archiveStories,collectionView};
})();
