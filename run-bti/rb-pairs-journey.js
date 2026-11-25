(() => {
  "use strict";
  const model = window.RBPairsModel;
  const stops = [
    ["door", "현관"], ["track", "트랙 입구"], ["lap", "첫 바퀴"], ["fork", "갈림길"],
    ["turn", "반환점"], ["dusk", "해 질 녘"], ["straight", "마지막 직선"], ["finish", "결승"],
  ];
  const byAxis = {style:1, signals:2, routes:3, planning:5};
  const stagePages = [0,1,1,2,2,3,3,4,5,6,6,6];
  const poses = ["tie","ready","run","look","wave","look","run","give"];
  const poseAlt = {tie:"운동화 끈을 묶는 신입",ready:"빈 이름표를 달고 출발을 기다리는 신입",
    run:"트랙을 달리는 신입",look:"주위를 둘러보는 신입",wave:"손을 흔드는 신입",give:"가방을 건네는 신입"};
  const terrain = {
    distance:"멀리 이어진 트랙", speed:"짧은 직선 트랙", numbers:"숫자가 뜨는 전광판",
    senses:"발자국 옆에 그려진 물결", familiar:"낯익은 표지판", explore:"새 골목으로 난 길",
    plan:"미리 그려 둔 코스", improvise:"그날 정하는 코스", both:"두 길이 만나는 곳",
  };
  const tags = {
    style:{distance:"곡선",speed:"직선",both:"합류"},
    signals:{numbers:"숫자",senses:"물결",both:"나란히"},
    routes:{familiar:"단골길",explore:"새 길",both:"두 갈래"},
    planning:{plan:"미리",improvise:"그날",both:"두 길"},
  };
  const symbols = {
    distance:"M4 19c10 1 20-3 20-11 0-3-2-4-5-4H9 M5 14c8 0 13-2 13-6",
    speed:"M3 20 22 4 M10 20 25 8 M2 13l9-8",
    numbers:"M3 6h22v14H3z M8 10v6 M13 10h5v6h-5z",
    senses:"M2 14h5l3-7 4 12 3-7h8",
    familiar:"M4 13 13 5l10 8 M7 11v9h13v-9",
    explore:"M4 22l7-7 1-8 M11 15l10-5 M17 9l5 0-1 5",
    plan:"M4 7h20v15H4z M4 11h20 M8 4v5 M20 4v5 M10 16l3 3 5-5",
    improvise:"M4 21c-1-5 2-11 8-10s5 7 8 3l4-7 M19 7l5-1v5",
    both:"M4 4c0 8 9 7 9 17 M23 4c0 8-10 7-10 17",
    neutral:"M4 18h20 M7 13l2-2m4 2 2-2m4 2 2-2",
    class:"M3 15v5h6v-5 M11 14v6h6v-6 M19 15v5h6v-5 M4 11h4 M12 9h4 M20 11h4",
    coach:"M4 19v-7c0-1 8-1 8 0v7 M16 19v-9c0-1 8-1 8 0v9 M6 7h4 M18 5h4",
    solo:"M9 20v-8c0-2 9-2 9 0v8 M11 7h5",
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function image(file, className, alt = "", size = 96) {
    const path = "assets/lap/" + file + ".webp";
    const url = window.RBScene?.assetURL?.(path) || window.RBAssets?.[path] || path;
    return '<img width="'+size+'" height="'+size+'" class="'+className+'" src="'+esc(url)+'" alt="'+esc(alt)+'" decoding="async">';
  }
  function mark(key) {
    return '<svg width="29" height="26" viewBox="0 0 28 26" aria-hidden="true"><path d="'+
      symbols[key]+'" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function passedAxes(pages, page) {
    return model.axes.filter(axis => !pages.slice(page).some(items => items.some(item => item.axisId === axis.id)));
  }
  function branch(axis) {
    if (axis.direction) return axis.direction;
    return axis.state === "both" ? "both" : "neutral";
  }
  function learning(answers) {
    return {class:"클래스에서",coach:"코치와 따로",solo:"혼자 해 보기"}[answers.learning] || "";
  }
  function likes(answers, axes = model.axes) {
    return model.items.filter(item => axes.some(axis => axis.id === item.axisId) && answers[item.id] === 2);
  }
  function bag(answers, axes, title = "내 가방") {
    const items = likes(answers,axes);
    return '<details class="lap-bag" data-lap-bag><summary>'+image("bag","lap-bag-icon","",36)+
      '<span>'+esc(title)+'</span><span class="lap-open" aria-hidden="true"></span></summary>'+
      image("rookie-bag","lap-unzip","",52)+
      (items.length ? '<ul>'+items.map(item => '<li data-lap-item="'+item.id+'">'+mark(item.sideId)+
        '<span>'+esc(item.reading)+'</span></li>').join("")+'</ul>'
        : '<p>‘좋아’라고 고른 답이 생기면 여기에 담겨요.</p>')+'</details>';
  }
  function course(stage) {
    return '<ol class="lap-course" aria-label="첫 바퀴 코스">'+stops.map(([id,name],index) =>
      '<li class="'+(index<stage?"past":"")+'"'+(index===stage?' aria-current="step"':'')+
      '><span aria-hidden="true"></span><span class="fp-sr">'+name+'</span></li>').join("")+'</ol>';
  }
  function cover() {
    return '<figure class="lap-cover"><div class="lap-cover-paint">'+
      image("stage-door","lap-cover-back","",700)+image("rookie-tie","lap-cover-rookie","빈 이름표를 단 신입이 현관 앞에서 운동화 끈을 묶고 있어요.",260)+
      '</div></figure>';
  }
  function board(key) {
    const known = Object.hasOwn(model.characters,key);
    const sample = known ? [key] : ["distance+numbers","speed+senses","speed+explore"];
    return '<details class="lap-board"><summary><span class="lap-shadow-peek" aria-hidden="true">'+
      sample.map(id=>image("silhouette-"+id.replace("+","-"),"lap-shadow","",28)).join("")+'</span>'+
      (known?"그림자판에서 내 친구 보기":"동물 그림자 펼쳐 보기")+'</summary><div class="lap-shadows" aria-label="러닝부 동물 서른두 마리">'+
      Object.keys(model.characters).map(id => '<span'+(known && key === id?' class="lap-found"':'')+'>'+
        image("silhouette-"+id.replace("+","-"),"lap-shadow",known && key===id?model.characters[id].nickname:"",48)+'</span>').join("")+'</div></details>';
  }
  // These four spectators depend only on the stop and never on the runner's
  // answers. Each member of the original cast appears once along a lap.
  function spectators(stage) {
    const cast = Object.keys(model.characters);
    return '<div class="lap-spectators" aria-hidden="true">'+[0,1,2,3].map(offset=>{
      const key = cast[((stage*4+offset)*7)%cast.length];
      return image("face-"+key.replace("+","-"),"lap-face","",32);
    }).join("")+'</div>';
  }
  function goalFlag(answers) {
    const item = model.extras.find(item=>item.id==="goal");
    const chosen = item.options.find(option=>option.id===answers.goal);
    if (!chosen || chosen.id==="other" || chosen.id==="unknown") return "";
    return '<span class="lap-goal-flag" data-lap-goal="'+esc(chosen.id)+'"><small>다음 목표</small>'+esc(chosen.label)+'</span>';
  }
  function stageImage(stage, keyName, badge = "", flag = "") {
    const name = stops[stage][0];
    return '<div class="lap-vignette" data-lap-stage="'+name+'"><div class="lap-tableau">'+image("stage-"+name,"lap-backdrop","",360)+
      image("rookie-"+poses[stage],"lap-rookie",poseAlt[poses[stage]],96)+
      (keyName ? '<span class="lap-sign" data-lap-branch="'+keyName+'" aria-hidden="true">'+mark(keyName)+'</span>' : '')+
      (badge ? '<span class="lap-scene-word">'+esc(badge)+'</span>' : '')+'</div></div>'+flag;
  }
  function quiz(page, pages, answers) {
    const here = stagePages[page];
    const passed = passedAxes(pages,page);
    const crossed = passed.find(axis => pages[page-1]?.some(item => item.axisId === axis.id));
    const scored = crossed && model.evaluate(answers).axes.find(axis => axis.id === crossed.id);
    const displayStage = crossed ? byAxis[crossed.id] : here;
    const key = scored ? branch(scored) : "";
    const route = scored && key !== "neutral" ? terrain[key] : "";
    const meeting = page===1 ? learning(answers) : "";
    const description = scored && route ? stops[displayStage][1]+" · "+route :
      meeting ? "배우고 싶은 방식 · "+meeting : "";
    return '<section class="lap-trip'+(here===6?' lap-compact':'')+'" aria-label="첫 바퀴">'+course(here)+
      '<div class="lap-stop-label"><strong>'+stops[here][1]+'</strong>'+spectators(here)+'</div>'+
      stageImage(here,meeting?answers.learning:key,scored && key!=="neutral"?tags[scored.id][key]:"",page===11?goalFlag(answers):"")+
      (description?'<p class="lap-receipt"'+(scored?' data-lap-result="'+scored.id+'"':'')+'>'+esc(description)+'</p>':'')+
      (here===4?board(null):'')+
      bag(answers,passed)+'</section>';
  }
  function changeNote(previousKey, choice, result) {
    if (!previousKey || previousKey===choice.key || !model.characters[previousKey]) return "";
    const title = model.characters[previousKey].nickname;
    if (!model.characters[choice.key]) return '<p class="lap-change">지난번엔 ‘'+esc(title)+'’ 카드가 나왔어요. 이번 답으로는 별명을 정하기 어려워요.</p>';
    const retained = result.axes.filter(axis => previousKey.split("+").includes(axis.direction) && !choice.key.split("+").includes(axis.direction))
      .map(axis => axis.sides.find(side => side.id===axis.direction).label.replace(/파$/, ""));
    const winners = choice.key.split("+").map(id => model.axes.flatMap(axis => axis.sides).find(side=>side.id===id).label.replace(/파$/, ""));
    return '<p class="lap-change">지난번엔 ‘'+esc(title)+'’ 카드가 나왔어요. '+
      (retained.length ? esc(retained.join("·"))+' 쪽도 여전히 좋아해요. ' : '')+
      '이번 답에서는 '+esc(winners.join("·"))+' 쪽이 더 뚜렷해요.</p>';
  }
  function courseBook(result) {
    return '<details class="lap-book"><summary>내가 지나온 길 다시 보기</summary><ol>'+
      result.axes.map(axis=>{
        const stage = byAxis[axis.id], key = branch(axis);
        const place = stops[stage][1];
        const reading = key==="neutral" ? {neither:"두 쪽 다 덜 끌렸어요.",middle:"이번 답에서는 한쪽으로 기울지 않았어요.",
          insufficient:"이곳에서는 아직 취향을 정하기 어려워요."}[axis.state] : terrain[key];
        return '<li>'+stageImage(stage,key)+
          '<p><b>'+place+'</b><span>'+esc(reading)+'</span></p></li>';
      }).join("")+'</ol></details>';
  }
  function finish(answers, key, result) {
    const character = model.characters[key];
    return '<div class="lap-finish">'+course(7)+
      '<div class="lap-stop-label"><strong>결승</strong>'+spectators(7)+'</div>'+
      '<div class="lap-vignette" data-lap-stage="finish"><div class="lap-tableau">'+image("stage-finish","lap-backdrop","",360)+
      image(character?"rookie-give":"rookie-wave","lap-rookie","빈 이름표를 달고 결승에 도착한 신입")+
      (character ? image("bag","lap-handoff","",42)+
        image("mini-"+key.replace("+","-"),"lap-mate",character.nickname) : "")+'</div></div>'+goalFlag(answers)+
      bag(answers,model.axes)+board(key)+courseBook(result)+'</div>';
  }
  window.RBPairsJourney = {cover,quiz,finish,bag,likes,passedAxes,branch,changeNote};
})();
