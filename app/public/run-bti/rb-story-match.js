// Editorial links between actions in the quizzes and situations in the story catalog.
window.RBStoryMatch = (() => {
  "use strict";

  // One row per scene, in the same order as the three answers shown in RB.packs.
  const sceneSignals = {
    base: [
      ["explore", "goal", "company"],
      ["scenery", "goal", "company"],
      ["explore", "goal", "company"],
      ["scenery", "body", "numbers"],
      ["scenery", "body", "numbers"],
      ["scenery", "body", "numbers"],
      ["reset", "goal", "conversation"],
      ["reflect", "landmark", "photo"],
      ["reset", "goal", "conversation"],
    ],
    buddy: [
      ["conversation", "company", "route"],
      ["conversation", "pace", "route"],
      ["conversation", "pace", "scenery"],
      ["conversation", "pace", "scenery"],
      ["conversation", "plan", "scenery"],
      ["conversation", "plan", "photo"],
    ],
    record: [
      ["route", "numbers", "reflect"],
      ["route", "numbers", "reflect"],
      ["photo", "numbers", "reflect"],
      ["photo", "numbers", "reflect"],
      ["route", "compare", "conversation"],
      ["route", "compare", "conversation"],
    ],
  };

  // The optional record question has a stable ID. Existing six-item answers concern
  // personal records and cannot tell us what the respondent would actually post.
  const postQuestion = {
    id:"after-run-sharing", scene:"이번 달 러닝을 돌아볼 때",
    prompt:"이번 달에 뛴 날들을 돌아봤어. SNS에 딱 하나 올린다면 뭘 고를래?",
    imagine:"첫 러닝이 이번 달에 제일 기억에 남았어. SNS에 딱 하나 올린다면 뭘 고를래?",
    choices:[
      {signal:"postStats", short:"기록 화면만", label:"거리랑 시간이 나온 기록 화면만 올려",
        character:"러닝 기록만 올리는 러너", art:"art/post-stats.webp", caption:"사진 없이 달린 코스만 보이는 러닝 앱 화면이에요."},
      {signal:"postSelfie", short:"내 셀카", label:"막 뛰고 난 내 얼굴이 나온 셀카를 올려",
        character:"뛰고 난 내 모습을 올리는 러너", art:"art/post-selfie.webp", caption:"달리기를 마치고 찍은 셀카예요."},
      {signal:"postScenery", short:"풍경 사진", label:"뛰다가 본 풍경 사진을 올려",
        character:"달리다 본 풍경을 올리는 러너", art:"art/bg-00.webp", caption:"사람이 나오지 않은 강변 풍경이에요."},
      {signal:"keepPrivate", short:"올리지 않기", label:"오늘 뛴 건 따로 안 올려",
        character:"오늘은 안 올리는 러너", art:"", caption:"이번에 고른 답은 ‘따로 올리지 않기’예요."},
    ],
  };
  const postingSignals = new Set(postQuestion.choices.map(c => c.signal));

  // Use the specific motive item: a self-set distance need not involve a race,
  // and an interest in weight management alone says nothing about a preferred activity.
  const motiveSignals = {
    "free-afternoon": "enjoyment", "looking-forward": "enjoyment",
    "usual-hour": "routine", "next-week": "plan",
    "off-my-mind": "reset", "clear-head": "reset",
    "desk-day": "movement", "daily-stamina": "stamina", "weight-week": "plan",
    "practice-pace": "pace", "training-plan": "plan",
    "my-landmark": "goal", "kept-promise": "goal",
    "finish-line": "goal", "race-prep": "finish",
    "previous-best": "personalBest", "another-attempt": "personalBest",
    "nudge": "encouragement", "cheer": "encouragement",
    "catch-up": "conversation", "familiar-faces": "company",
    "pack-shoes": "travel", "new-town": "travel",
  };

  // These are descriptions of choices, not measured personality traits.
  const themes = {
    explore: ["낯선 길 가 보기", "안 가 본 곳에 뭐가 있는지 궁금해하는 답을 골랐어요."],
    route: ["길과 위치 확인하기", "위치를 확인하거나 길을 찾아보는 답을 골랐어요."],
    scenery: ["주변 풍경 보기", "길에서 눈에 띈 풍경을 한 번 더 보는 쪽에 마음이 갔어요."],
    body: ["몸의 느낌 살피기", "뛰거나 걸을 때 몸에 어떤 느낌이 드는지 살피는 쪽을 골랐어요."],
    numbers: ["거리와 시간 확인하기", "얼마나 왔는지 또는 몇 분 걸렸는지 살피는 답을 골랐어요."],
    landmark: ["어디까지 갔는지 남기기", "달려서 어디까지 갔는지 적어 두는 답을 골랐어요."],
    personalBest: ["내 최고 기록에 도전하기", "같은 거리에서 내 최고 기록에 도전하고 싶다고 답했어요."],
    plan: ["미리 정해 두기", "언제 어떻게 뛸지 미리 정하는 쪽을 골랐어요."],
    reset: ["잠깐 머리 식히기", "신경 쓰이던 일을 잠시 내려놓는 시간에 마음이 갔어요."],
    reflect: ["그날의 느낌 남기기", "달린 날을 어떻게 기억할지 생각해 봤어요."],
    photo: ["사진으로 남기기", "사진을 찍거나 보여 주는 쪽을 골랐어요."],
    company: ["누군가와 함께하기", "같이 뛰거나 걷는 사람이 있는 장면에 마음이 갔어요."],
    conversation: ["얘기 주고받기", "방금 겪은 일이나 궁금한 걸 누군가에게 건네는 답을 골랐어요."],
    encouragement: ["응원 주고받기", "누군가에게 힘을 보태거나 응원을 받는 장면을 골랐어요."],
    pace: ["편한 속도 찾기", "얼마나 빠르게 갈지 발걸음에 맞춰 보는 쪽을 골랐어요."],
    routine: ["달리는 시간 챙기기", "일상에서 달릴 시간을 어떻게 챙길지 생각해 봤어요."],
    goal: ["정한 곳까지 가 보기", "오늘 가기로 한 데까지 내 발로 다녀오는 데 마음이 갔어요."],
    finish: ["정한 코스 마치기", "처음 정한 데까지 가서 마치는 답을 골랐어요."],
    travel: ["여행지에서 동네 구경하기", "여행지에서 걷거나 뛰며 동네를 돌아보는 데 마음이 갔어요."],
    movement: ["틈날 때 몸 움직이기", "잠깐이라도 걸어 보거나 뛰어 보는 쪽을 골랐어요."],
    enjoyment: ["달리는 재미 챙기기", "달리면서 내가 즐길 만한 일을 골랐어요."],
    adjust: ["상황에 맞게 바꾸기", "그날 사정에 맞춰 다른 방법을 고른 장면이 있어요."],
    solo: ["혼자 보낼 시간 갖기", "혼자 뛰거나 잠깐 혼자 쉴 시간을 골랐어요."],
    privacy: ["누구에게 보여 줄지 정하기", "내 기록이나 사진을 어디까지 보여 줄지 정하는 답을 골랐어요."],
    compare: ["차이를 비교해 보기", "두 기록이나 두 조건이 어떻게 다른지 비교하는 답을 골랐어요."],
    verify: ["원문에서 확인하기", "들은 얘기를 원문에서 직접 확인하는 쪽을 골랐어요."],
    log: ["러닝 기록 켜기", "출발할 때 기록을 켜는 답을 골랐어요."],
    pause: ["가던 길에 잠깐 멈추기", "그 자리에서 잠깐 멈추는 답을 골랐어요."],
    stamina: ["일상 체력 기르기", "평소 계단에서 숨이 덜 차면 좋겠다고 답했어요."],
    // Kept in the personal report only when the person explicitly endorses a weight item.
    weight: ["체중 관리", "달리고 싶은 이유로 체중 관리를 꼽았어요."],
    postStats: ["기록 화면만 올리기", "거리와 시간이 나온 기록 화면만 올리는 답을 골랐어요."],
    postSelfie: ["내 셀카 올리기", "내 얼굴이 나온 셀카를 올리는 답을 골랐어요."],
    postScenery: ["풍경 사진 올리기", "뛰다가 본 풍경을 찍어 올리는 답을 골랐어요."],
    keepPrivate: ["따로 올리지 않기", "오늘 뛴 건 따로 올리지 않는 답을 골랐어요."],
  };

  function quizObservations(packId, record) {
    if (!record) return [];
    const rows = [];
    const mode = modeOf(record.mode);
    if (packId === "record" || packId === "base") {
      const choice = postQuestion.choices.find(c => c.signal === record.postChoice);
      if (choice) {
        const evidence = {id:packId,title:window.RB.packs[packId].title,scene:postQuestion.scene,
          itemId:postQuestion.id,mode,answer:choice.label};
        rows.push({signal:choice.signal,evidence,leading:true,weight:1});
      }
    }
    if (!record.answers) return rows;
    if (packId === "motive") {
      const {groups, score, scale, title} = window.RBMotives;
      const {leaders, singles} = score(record.answers);
      const supported = leaders.length ? leaders : singles;
      for (const group of groups) {
        for (const item of group.items) {
          const value = record.answers[item.id];
          if (value !== 2 && value !== 3) continue;
          const evidence = {
            id: packId, title, scene: group.title, itemId: item.id, mode,
            answer: mode === "imagine" ? item.imagine : item.text,
            rating: scale.find(option => option.value === value).label,
          };
          const signal = motiveSignals[item.id];
          const leading = supported.includes(item.motive);
          if (signal) rows.push({signal, evidence, leading, weight: value});
          if (item.motive === "weight") rows.push({signal: "weight", evidence, leading: false, weight: value});
        }
      }
      return rows;
    }
    if (!Object.hasOwn(sceneSignals, packId) || !Array.isArray(record.answers)) return rows;
    const pack = window.RB.packs[packId];
    const result = window.RB.score(packId, record.answers, mode, record.chatScenes);
    pack.questions.forEach((question, q) => {
      const picks = record.answers[q];
      if (!Array.isArray(picks)) return;
      const options = window.RB.answerOptions(question, mode, record.chatScenes);
      const chosen = [...new Set(picks.filter(i => Number.isInteger(i) && i >= 0 && i <= 2))].slice(0, 2);
      for (const i of chosen) {
        const signal = sceneSignals[packId][q]?.[i];
        if (!signal) continue;
        const evidence = {id: packId, title: pack.title, scene: question.scene, itemId: q, answer: options[i], mode};
        rows.push({signal, evidence, leading: result.leaders[question.domain].includes(i), weight: 1});
      }
    });
    return rows;
  }

  // Compare like decisions only when two separate options offered the alternatives.
  // A question may contribute to several different comparisons, once to each.
  const pairs = [
    ["달리면서 살핀 것", "numbers", "scenery"], ["달리면서 살핀 것", "numbers", "body"],
    ["달리면서 살핀 것", "scenery", "body"], ["기록으로 남길 것", "numbers", "photo"],
    ["기록으로 남길 것", "numbers", "reflect"], ["기록으로 남길 것", "photo", "reflect"],
    ["기록을 다시 볼 때", "numbers", "route"], ["기록을 다시 볼 때", "compare", "route"],
    ["다시 달리고 싶은 이유", "explore", "goal"],
    ["누구와 어떻게 뛸지", "solo", "company"], ["같이 달릴 때", "conversation", "pace"],
    ["계획이 바뀌는 순간", "plan", "adjust"], ["응원하러 갈 때", "encouragement", "photo"],
    ["잠깐 멈출지 정할 때", "pause", "goal"],
  ];

  function comparisonsFor(occasions) {
    const result = [];
    for (const [topic, left, right] of pairs) {
      const counts = {leftOnly:0, rightOnly:0, both:0, other:0, quizCount:0, storyCount:0};
      const evidence = [];
      const answersBySide = {left:[],right:[],both:[],other:[]};
      const seen = new Set();
      for (const occasion of occasions) {
        const canPickAlone = (a, b) => occasion.options.some(tags => tags.includes(a) && !tags.includes(b));
        if (!canPickAlone(left, right) || !canPickAlone(right, left)) continue;
        if (occasion.event && seen.has(occasion.event)) continue;
        if (occasion.event) seen.add(occasion.event);
        const hasLeft = occasion.picks.some(e => e.signal === left);
        const hasRight = occasion.picks.some(e => e.signal === right);
        const side = hasLeft ? (hasRight ? "both" : "leftOnly") : (hasRight ? "rightOnly" : "other");
        counts[side]++;
        answersBySide[side === "leftOnly" ? "left" : side === "rightOnly" ? "right" : side].push(occasion.picks);
        counts[occasion.story ? "storyCount" : "quizCount"]++;
        evidence.push(...occasion.picks.filter(e => e.signal === left || e.signal === right));
      }
      if (!counts.leftOnly && !counts.rightOnly && !counts.both) continue;
      const total = counts.quizCount + counts.storyCount;
      const gap = Math.abs(counts.leftOnly - counts.rightOnly);
      const maximum = Math.max(counts.leftOnly, counts.rightOnly);
      // A descriptive display rule: two net exclusive choices and an absolute majority.
      const clear = gap >= 2 && maximum > total / 2;
      const winner = clear ? (counts.leftOnly > counts.rightOnly ? left : right) : null;
      const status = total === 1 ? "sparse" : clear ? "clear" : gap === 0 ? "tied" : "mixed";
      result.push({topic, left, right, leftLabel:themes[left][0], rightLabel:themes[right][0],
        ...counts, total, status, winner, evidence, answersBySide});
    }
    const order = {clear:0, tied:1, mixed:2, sparse:3};
    return result.sort((a,b) => order[a.status] - order[b.status]
      || Math.max(b.leftOnly,b.rightOnly) - Math.max(a.leftOnly,a.rightOnly) || b.both-a.both
      || b.total-a.total || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
  }

  function postingProfile(occasions) {
    const counts = postQuestion.choices.map(c => ({signal:c.signal,label:c.short,count:0}));
    const evidence = [];
    let quizCount = 0, storyCount = 0;
    const seen = new Set();
    for (const {options, picks, story, event} of occasions) {
      // A selfie can be taken, saved, or posted. Count only decisions that explicitly
      // offer all four posting choices on equal terms, one action per alternative.
      const offered = options.map(tags => tags.filter(tag => postingSignals.has(tag)));
      if (offered.length !== counts.length || offered.some(tags => tags.length !== 1) ||
          new Set(offered.flat()).size !== counts.length) continue;
      const choices = picks.filter(e => postingSignals.has(e.signal));
      if (choices.length !== 1) continue;
      if (event && seen.has(event)) continue;
      if (event) seen.add(event);
      const [choice] = choices;
      counts.find(c => c.signal === choice.signal).count++;
      evidence.push(choice);
      if (story) storyCount++; else quizCount++;
    }
    const total = evidence.length;
    if (!total) return null;
    const chosen = counts.filter(c => c.count).sort((a,b) => b.count-a.count);
    const most = chosen[0], leaders = chosen.filter(c => c.count === most.count);
    const gap = most.count - (chosen[1]?.count || 0);
    const status = total === 1 ? "sparse" : leaders.length > 1 ? "tied" :
      most.count > total/2 && gap >= 2 ? "clear" : "mixed";
    const represented = status === "mixed" ? chosen : leaders;
    const names = represented.map(c => c.label).join(" · ");
    const title = status === "sparse" ? "이번에 고른 답 · " + names :
      status === "clear" ? themes[most.signal][0] :
      status === "tied" ? "같은 횟수로 고른 답 · " + names : "장면에 따라 다르게 골랐어요";
    const tally = chosen.map(c => `‘${c.label}’ ${c.count}번`).join(", ");
    const reason = total === 1 ? `내가 답한 한 장면에서는 ‘${most.label}’ 쪽을 골랐어요.` :
      `러닝을 공유할지 정하는 장면 ${total}개에서 ${tally} 골랐어요.`;
    return {status,title,reason,signals:represented.map(c => c.signal),evidence,
      counts,total,quizCount,storyCount};
  }

  function compareMotives(record) {
    if (!record) return null;
    const rated = window.RBMotives.score(record.answers).profiles.filter(p => p.count === 2)
      .sort((a,b) => b.mean-a.mean || a.id.localeCompare(b.id));
    if (!rated.length) return null;
    const leaders = rated.filter(p => p.mean === rated[0].mean);
    const names = leaders.map(p => p.name);
    if (rated.length === 1) {
      const [only] = rated;
      const scope = record.mode === "imagine" ? "첫 러닝을 상상하며 답한" : "답한";
      return {title:only.name, reason:`${scope} ‘${only.name}’ 두 문항의 평균은 3점 만점에 ${only.mean}점이에요. 두 문항 모두 답한 동기는 이 한 가지예요.`,leaders,rated};
    }
    const title = leaders.length === rated.length ? "답한 동기들의 평균이 같아요"
      : names.length === 1 ? names[0] : "같은 평균을 받은 동기가 있어요";
    const prefix = record.mode === "imagine" ? "첫 러닝을 상상하며 두 문항씩 답한" : "두 문항씩 답한";
    const reason = leaders.length === rated.length ? `${prefix} 동기 ${rated.length}개가 모두 3점 만점에 평균 ${rated[0].mean}점이에요.`
      : `${prefix} 동기 ${rated.length}개 중 ‘${names.join("’, ‘")}’의 평균이 ${rated[0].mean}점으로 가장 높아요. 만점은 3점이에요.`;
    return {title,reason,leaders,rated};
  }

  function comparisonReason(c) {
    let reason = `두 행동을 따로 고를 수 있었던 ${c.total}개 장면에서 ‘${c.leftLabel}’만 ${c.leftOnly}번, ‘${c.rightLabel}’만 ${c.rightOnly}번 골랐어요.`;
    if (c.both) reason += ` 두 행동을 함께 고른 장면은 ${c.both}개예요.`;
    if (c.other) reason += ` 둘 다 고르지 않은 장면은 ${c.other}개예요.`;
    return reason;
  }

  function decideDirection(comparisons, rows, motive, storyCount, quizCount) {
    const clear = comparisons.filter(c => c.status === "clear");
    if (clear.length) {
      const contrasts = clear.filter((c,i) => clear.findIndex(other => other.winner === c.winner) === i);
      const winners = new Set(contrasts.map(c => c.winner));
      // When two actions were always selected together, a third alternative cannot break their tie.
      const joined = comparisons.filter(c => c.both >= 2 && !c.leftOnly && !c.rightOnly &&
        (winners.has(c.left) || winners.has(c.right)) &&
        [c.left,c.right].every(id=>rows.find(r=>r.signal===id)?.specificCount === c.both));
      const signals = [...new Set([...winners,...joined.flatMap(c=>[c.left,c.right])])];
      const together = signals.length === 2 && joined.length === 1;
      const title = together ? "같은 두 행동을 나란히 골랐어요" : signals.length === 1 ? themes[signals[0]][0] : "자주 고른 행동이 두 가지 이상이에요";
      const details = [...joined,...contrasts];
      const reason = details.slice(0,2).map(comparisonReason).join(" ");
      const evidence = [...joined.flatMap(c=>c.evidence),...contrasts.flatMap(c => c.evidence.filter(e => e.signal === c.winner))];
      return {status:together ? "tied" : signals.length === 1 ? "clear" : "mixed", signals,title,reason,evidence,comparison:details[0]};
    }
    const balanced = comparisons.filter(c => c.status === "tied" && (c.leftOnly || c.both >= 2)
      && (c.leftOnly+c.rightOnly+c.both) > c.total/2);
    const repeated = rows.filter(r => r.specificCount >= 2);
    const close = comparisons.filter(c => c.status === "mixed" && c.leftOnly && c.rightOnly);
    if (balanced.length || close.length) {
      const unresolved = [...balanced,...close];
      return {status:close.length ? "mixed" : "tied", signals:[...new Set(unresolved.flatMap(c=>[c.left,c.right]))],
        title:close.length ? "자주 고른 행동이 한쪽으로 모이지 않았어요" : "같은 횟수로 고른 행동이 있어요",
        reason:unresolved.slice(0,2).map(comparisonReason).join(" "),evidence:unresolved.flatMap(c=>c.evidence),comparison:unresolved[0]};
    }
    const hasSpecificAction = rows.some(row => row.storyEvidence.some(e=>e.specific) || row.quizEvidence.some(e=>e.id !== "motive"));
    if (motive && (motive.leaders[0].mean >= 2 || !hasSpecificAction)) {
      const winners = new Set(motive.leaders.map(p => p.id));
      const items = window.RBMotives.groups.flatMap(g => g.items).filter(it => winners.has(it.motive));
      const winningIds = new Set(items.map(it => it.id));
      const evidence = rows.flatMap(row => row.quizEvidence.filter(e => e.id === "motive" && winningIds.has(e.itemId)));
      const low = motive.leaders[0].mean < 2;
      const signals = low ? [] : [...new Set(evidence.map(e => e.signal))];
      return {status:low ? "sparse" : motive.leaders.length === 1 ? "clear" : "tied",
        title:low ? "답한 동기의 평균이 모두 2점 미만이에요" : motive.title,
        reason:motive.reason,signals,evidence:low ? [] : evidence};
    }
    if (repeated.length) {
      const labels = repeated.slice(0,2).map(r => `‘${r.label}’ ${r.specificCount}번`).join(", ");
      return {status:"repeated",signals:repeated.map(r => r.signal),title:"다른 장면에서도 같은 행동을 골랐어요",
        reason:`서로 다른 장면에서 반복해 고른 행동은 ${labels}${repeated.length > 2 ? " 등이에요." : "이에요."} 이 횟수는 각 행동을 몇 번 골랐는지 보여 줘요.`,
        evidence:repeated.flatMap(r => [...r.storyEvidence,...r.quizEvidence].filter(e => e.specific))};
    }
    const evidence = rows.flatMap(row => [...row.storyEvidence,...row.quizEvidence].filter(e => e.specific));
    const signals = [...new Set(evidence.map(e=>e.signal))];
    const n = new Set(evidence.map(e=>JSON.stringify([e.id,e.itemId ?? e.choiceId]))).size;
    if (!rows.length && quizCount) return {status:"sparse",signals:[],title:"답한 동기 중 2점 이상을 준 문항은 없어요",
      reason:"‘꽤 그래’나 ‘정말 그래’를 고른 동기 문항이 생기면 그 답을 여기에 담아요.", evidence:[]};
    if (!rows.length) return {status:"none",signals:[],title:"아직 비교할 답이 없어요",
      reason:storyCount ? "고른 결말에는 서로 구별할 수 있는 행동 단서가 없어요." : "기억나는 러닝 장면이나 관심 있는 이야기에서 답을 골라 보세요.", evidence:[]};
    return {status:"sparse",signals,title:n === 1 ? "지금은 한 장면에서 고른 행동이에요" : "아직 어느 쪽을 자주 고르는지 가르기 어려워요",
      reason:n === 1 ? `‘${evidence[0].scene}’에서 고른 답은 ${[...new Set(evidence.map(e=>e.answer))].map(answer=>`“${answer}”`).join(" / ")}예요. 이 행동을 다른 장면에서도 고르면 여기에 함께 보여 드려요.`
        : n ? "고른 행동이 한 번씩 나왔어요. 같은 선택이 반복되면 여기에서 알려 드려요." : "이 장면에서는 어떤 보기를 골라도 같은 행동이 들어가요. 지금은 고른 답만 남겼어요.",
      evidence};
  }

  function modeOf(value) {
    return value === "experience" || value === "imagine" ? value : "unspecified";
  }

  function latestPost(records) {
    const packs = ["record","base"].filter(id => {
      const r = records?.[id];
      return r && (r.postChoice || r.postQuestionSkipped || r.postChoiceAt);
    });
    const time = id => records[id].postChoiceAt ?? records[id].date ?? 0;
    return packs.sort((a,b) => time(b) - time(a))[0] || null;
  }

  function eventKey(story) {
    if (story.eventKey) return "event/" + story.eventKey;
    if (!story.source?.url) return "scene/" + story.id;
    const [path, search = ""] = story.source.url.split("#")[0].split("?");
    const query = search.split("&").filter(p => p && !/^(?:utm_[^=]+|fbclid|gclid)=/i.test(p)).sort().join("&");
    const url = path.replace(/\/$/,"") + (query ? "?" + query : "");
    return "source/" + url + (story.source.kind === "weather" ? "/" + (story.validFrom || story.source.asOf) : "");
  }

  function profile(catalog, records = {}, readPick = () => null, requestedMode) {
    const saved = (catalog || []).map(story => {
      const raw = readPick(story.id);
      const entry = typeof raw === "string" ? {choiceId:raw} : raw;
      return {story, entry};
    }).filter(({entry}) => entry?.choiceId && !entry.excluded);
    const firstRecord = Object.values(records || {}).find(Boolean);
    const mode = requestedMode === undefined ? modeOf(firstRecord ? firstRecord.mode : saved[0]?.entry.mode) : modeOf(requestedMode);
    records = Object.fromEntries(Object.entries(records || {}).filter(([,record]) => record && modeOf(record.mode) === mode));
    const groups = new Map();
    const occasions = [];
    function add(signal, field, evidence) {
      if (!Object.hasOwn(themes, signal)) return;
      if (!groups.has(signal)) groups.set(signal, {signal, label: themes[signal][0], quizEvidence: [], storyEvidence: []});
      groups.get(signal)[field].push({...evidence,signal});
    }
    let quizCount = 0;
    const postPack = latestPost(records);
    for (const packId of ["base", "buddy", "record", "motive"]) {
      const observations = quizObservations(packId, records?.[packId]).filter(row => row.evidence.itemId !== postQuestion.id || packId === postPack);
      if (observations.length || (packId === "motive" && records?.motive?.answers &&
          window.RBMotives.score(records.motive.answers).coverage.answered > 0)) quizCount++;
      const questions = new Map();
      for (const {signal, evidence} of observations) {
        evidence.specific = true;
        add(signal, "quizEvidence", evidence);
        if (packId === "motive") continue;
        if (!questions.has(evidence.itemId)) questions.set(evidence.itemId, []);
        questions.get(evidence.itemId).push({...evidence,signal});
      }
      for (const [q,picks] of questions) {
        const signals = q === postQuestion.id ? postQuestion.choices.map(c => c.signal) : sceneSignals[packId][q];
        occasions.push({story:false,options:signals.map(tag => [tag]),picks});
      }
    }
    const answered = new Set();
    // Newest decision about a given event takes precedence only for the alternatives
    // actually offered together. A different question in the same event still counts.
    const seenSignal = new Map(), events = new Set();
    saved.sort((a,b) => (b.entry.at || 0) - (a.entry.at || 0) || a.story.id.localeCompare(b.story.id));
    for (const {story, entry} of saved) {
      if (modeOf(entry.mode) !== mode) continue;
      if (answered.has(story.id)) continue;
      const snapshot = entry.snapshot;
      const choice = snapshot?.choice?.id === entry.choiceId ? snapshot.choice : story.choices?.find(c => c.id === entry.choiceId);
      if (!choice) continue;
      answered.add(story.id);
      const event = snapshot?.event || eventKey(story);
      events.add(event);
      const evidence = {id:story.id,choiceId:choice.id,title:snapshot?.title || story.title,scene:snapshot?.prompt || story.prompt,
        answer:choice.label,mode,version:entry.version || 1};
      // An episode's cover tags describe the premise, not the action the reader chose.
      const options = snapshot?.options || story.choices.map(c => c.signals || []);
      const seen = seenSignal.get(event) || new Set();
      const picks = [];
      for (const signal of new Set(choice.signals || [])) {
        const picked = {...evidence,signal,specific:options.some(tags=>!tags.includes(signal))};
        if (!seen.has(signal)) add(signal, "storyEvidence", picked);
        picks.push(picked);
      }
      for (const signal of new Set(options.flat())) {
        if (options.some(tags => !tags.includes(signal))) seen.add(signal);
      }
      seenSignal.set(event, seen);
      occasions.push({story:true,options,picks,event});
    }
    const rows = [...groups.values()];
    for (const row of rows) {
      const stories = row.storyEvidence.filter(e=>e.specific).length;
      row.relation = row.quizEvidence.length ? (stories ? "both" : "quiz") : "story";
      const quiz = row.quizEvidence.every(e => e.mode === "imagine") ? "첫 러닝을 상상한 검사" : "러닝 검사";
      const scope = row.relation === "both" ? `${quiz}와 이야기 ${stories}편에서`
        : stories ? `이야기 ${stories}편에서` : `${quiz}에서`;
      row.specificCount = [...row.quizEvidence,...row.storyEvidence].filter(e => e.specific).length;
      row.description = row.specificCount ? `${scope} ${themes[row.signal][1]}`
        : `이야기 ${row.storyEvidence.length}편에서는 어느 답을 골라도 ‘${row.label}’이 들어가요. 여기에는 내가 고른 답만 남겼어요.`;
    }
    rows.sort((a,b) => b.specificCount-a.specificCount || a.signal.localeCompare(b.signal));
    const comparisons = comparisonsFor(occasions);
    const motiveComparison = compareMotives(records?.motive);
    const posting = postingProfile(occasions);
    const otherRows = posting ? rows.filter(row => !postingSignals.has(row.signal)) : rows;
    const other = decideDirection(comparisons,otherRows,motiveComparison,answered.size,quizCount);
    const postingLeads = posting && ((!otherRows.some(r => r.specificCount) && !motiveComparison) ||
      (posting.total >= 2 && (other.status === "none" || other.status === "sparse")));
    const direction = postingLeads ? posting : other;
    let baseline = null;
    if (quizCount && answered.size) {
      const {status, signals, title} = profile([], records, undefined, mode).direction;
      baseline = {status, signals, title};
    }
    return {mode,rows,storyCount:answered.size,eventCount:events.size,quizCount,comparisons,direction,motiveComparison,baseline,posting,postPack};
  }

  function quizReason(evidence) {
    const answer = evidence.answer.replace(/^“(.*)”$/, "$1").replace(/“/g, "‘").replace(/”/g, "’");
    const intro = evidence.mode === "imagine" ? "첫 러닝을 상상하며" : "검사에서";
    return evidence.rating ? `${intro} ‘${evidence.rating}’라고 답했어요. “${answer}”`
      : `${intro} 이렇게 골랐어요. “${answer}”`;
  }

  function recommend(stories, packId, record, options = {}) {
    const {profile: mine, readPick = () => null, today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)} = options;
    const evidence = new Map();
    for (const row of quizObservations(packId, record)) {
      if (!row.leading) continue;
      if (row.evidence.itemId === postQuestion.id && mine && mine.postPack !== packId) continue;
      const old = evidence.get(row.signal);
      if (!old) evidence.set(row.signal, {strength: row.weight, reason: quizReason(row.evidence)});
      else old.strength += row.weight;
    }
    for (const row of mine?.rows || []) {
      if (row.signal === "weight") continue;
      const specificStories = row.storyEvidence.filter(e => e.specific !== false);
      const story = specificStories[0];
      let match = evidence.get(row.signal);
      if (packId === "profile" && row.quizEvidence.length) {
        match = {strength: row.quizEvidence.length, reason: quizReason(row.quizEvidence[0])};
        evidence.set(row.signal, match);
      }
      if (!story) continue;
      if (match) {
        match.strength += specificStories.length;
        match.reason += ` ‘${story.title}’에서도 비슷하게 골랐어요.`;
      } else {
        evidence.set(row.signal, {strength: specificStories.length, reason: `‘${story.title}’에서 고른 답이에요. “${story.answer}”`});
      }
    }
    const read = new Set((mine?.rows || []).flatMap(row => row.storyEvidence.map(e => e.id)));
    const visitedCategories = new Set(), usedEvents = new Set(), seenIds = new Set();
    for (const story of stories || []) {
      if (readPick(story.id)) seenIds.add(story.id);
      if (!read.has(story.id)) continue;
      visitedCategories.add(story.category);
      usedEvents.add(eventKey(story));
    }
    const eligible = (stories || []).filter(story => !story.archived && !seenIds.has(story.id) && !usedEvents.has(eventKey(story)) &&
      !(story.validFrom && story.validFrom > today) && !(story.validUntil && story.validUntil < today) && story.choices?.length);
    const candidates = eligible.map(story => {
      const options = story.choices.map(c => c.signals || []);
      const offered = [...new Set(options.flat())].filter(tag => options.some(tags => !tags.includes(tag)));
      const matched = offered.filter(tag => evidence.has(tag))
        .sort((a,b) => evidence.get(b).strength - evidence.get(a).strength);
      return {story, matched, offered};
    });
    const similar = candidates.filter(c => c.matched.length).sort((a,b) =>
      evidence.get(b.matched[0]).strength - evidence.get(a.matched[0]).strength)[0];
    const picks = [];
    if (similar) picks.push({story:similar.story,label:"다른 날에도 그렇게 할까?",
      reason:evidence.get(similar.matched[0]).reason});
    const others = candidates.filter(c => !similar || (eventKey(c.story) !== eventKey(similar.story) && c.story.category !== similar.story.category));
    others.sort((a,b) => Number(visitedCategories.has(a.story.category)) - Number(visitedCategories.has(b.story.category)) ||
      Number(a.matched.length > 0) - Number(b.matched.length > 0));
    for (const candidate of others) {
      if (picks.length === 2) break;
      if (picks.some(p => p.story.category === candidate.story.category || eventKey(p.story) === eventKey(candidate.story))) continue;
      picks.push({story:candidate.story, label:picks.length ? "다른 주제도 골라 볼까?" : "이 장면이라면?",
        reason:candidate.story.prompt});
    }
    return picks;
  }

  return {profile, recommend, postQuestion, modeOf, eventKey, latestPost};
})();
