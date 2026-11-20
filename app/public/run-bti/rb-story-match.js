// Editorial links between actions in the quizzes and situations in the story catalog.
window.RBStoryMatch = (() => {
  "use strict";

  // One row per scene, in the same order as the three answers shown in RB.packs.
  const sceneSignals = {
    base: [
      ["explore", "goal", "company"],
      ["scenery", "plan", "company"],
      ["explore", "goal", "plan"],
      ["scenery", "body", "numbers"],
      ["scenery", "body", "numbers"],
      ["scenery", "body", "numbers"],
      ["reset", "goal", "conversation"],
      ["reflect", "numbers", "photo"],
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
      ["route", "numbers", "conversation"],
      ["route", "numbers", "conversation"],
    ],
  };

  // Use the specific motive item: a self-set distance need not involve a race,
  // and an interest in weight management alone says nothing about a preferred activity.
  const motiveSignals = {
    "free-afternoon": "enjoyment", "looking-forward": "enjoyment",
    "usual-hour": "routine", "next-week": "plan",
    "off-my-mind": "reset", "clear-head": "reset",
    "desk-day": "movement", "daily-stamina": "movement", "weight-week": "plan",
    "practice-pace": "pace", "training-plan": "plan",
    "my-landmark": "goal", "kept-promise": "goal",
    "finish-line": "goal", "race-prep": "finish",
    "previous-best": "numbers", "another-attempt": "numbers",
    "nudge": "encouragement", "cheer": "encouragement",
    "catch-up": "conversation", "familiar-faces": "company",
    "pack-shoes": "travel", "new-town": "travel",
  };

  // These are descriptions of choices, not measured personality traits.
  const themes = {
    explore: ["낯선 길 가 보기", "안 가 본 곳에 뭐가 있는지 궁금해하는 답을 골랐어요."],
    route: ["달릴 길 확인하기", "어디로 가는지 길을 확인하거나 그 길을 다시 찾는 답을 골랐어요."],
    scenery: ["주변 풍경 보기", "길에서 눈에 띈 풍경을 한 번 더 보는 쪽에 마음이 갔어요."],
    body: ["몸의 느낌 살피기", "뛰거나 걸을 때 몸에 어떤 느낌이 드는지 살피는 쪽을 골랐어요."],
    numbers: ["거리와 시간 확인하기", "얼마나 멀리 갔는지 또는 몇 분 걸렸는지 살피는 답을 골랐어요."],
    plan: ["미리 정해 두기", "언제 어떻게 뛸지 미리 정하는 쪽을 골랐어요."],
    reset: ["잠깐 머리 식히기", "신경 쓰이던 일을 잠시 내려놓는 시간에 마음이 갔어요."],
    reflect: ["그날의 느낌 남기기", "달린 날을 어떻게 기억할지 생각해 봤어요."],
    photo: ["사진으로 남기기", "나중에 다시 볼 장면을 사진으로 남기는 쪽을 골랐어요."],
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
    compare: ["조건을 바꿔 비교해 보기", "한 가지를 바꿔 보고 전과 어떻게 다른지 비교하는 답을 골랐어요."],
    verify: ["원문에서 확인하기", "들은 얘기를 원문에서 직접 확인하는 쪽을 골랐어요."],
    // Kept in the personal report only when the person explicitly endorses a weight item.
    weight: ["체중 관리", "달리고 싶은 이유로 체중 관리를 꼽았어요."],
  };

  function quizObservations(packId, record) {
    if (!record?.answers) return [];
    const rows = [];
    const mode = record.mode === "imagine" ? "imagine" : "experience";
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

  function profile(catalog, records = {}, readPick = () => null) {
    const groups = new Map();
    function add(signal, field, evidence) {
      if (!Object.hasOwn(themes, signal)) return;
      if (!groups.has(signal)) groups.set(signal, {signal, label: themes[signal][0], quizEvidence: [], storyEvidence: []});
      groups.get(signal)[field].push(evidence);
    }
    let quizCount = 0;
    for (const packId of ["base", "buddy", "record", "motive"]) {
      const observations = quizObservations(packId, records?.[packId]);
      if (observations.length) quizCount++;
      for (const {signal, evidence} of observations) add(signal, "quizEvidence", evidence);
    }
    const answered = new Set();
    for (const story of catalog || []) {
      if (answered.has(story.id)) continue;
      const picked = readPick(story.id);
      const choice = story.choices?.find(c => c.id === picked);
      if (!choice) continue;
      answered.add(story.id);
      const evidence = {id: story.id, choiceId: choice.id, title: story.title, scene: story.prompt, answer: choice.label, mode: null};
      // An episode's cover tags describe the premise, not the action the reader chose.
      for (const signal of new Set(choice.signals || [])) add(signal, "storyEvidence", evidence);
    }
    const rows = [...groups.values()];
    for (const row of rows) {
      const stories = row.storyEvidence.length;
      row.relation = stories ? (row.quizEvidence.length ? "both" : "story") : "quiz";
      const quiz = row.quizEvidence.every(e => e.mode === "imagine") ? "첫 러닝을 상상한 검사" : "러닝 검사";
      const scope = row.relation === "both" ? `${quiz}와 이야기 ${stories}편에서`
        : stories ? `이야기 ${stories}편에서` : `${quiz}에서`;
      row.description = `${scope} ${themes[row.signal][1]}`;
    }
    rows.sort((a, b) => Number(b.relation === "both") - Number(a.relation === "both") ||
      b.storyEvidence.length - a.storyEvidence.length || b.quizEvidence.length - a.quizEvidence.length);
    return {rows, storyCount: answered.size, quizCount};
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
      const old = evidence.get(row.signal);
      if (!old) evidence.set(row.signal, {strength: row.weight, reason: quizReason(row.evidence)});
      else old.strength += row.weight;
    }
    for (const row of mine?.rows || []) {
      if (row.signal === "weight") continue;
      const story = row.storyEvidence[0];
      let match = evidence.get(row.signal);
      if (packId === "profile" && row.quizEvidence.length) {
        match = {strength: row.quizEvidence.length, reason: quizReason(row.quizEvidence[0])};
        evidence.set(row.signal, match);
      }
      if (!story) continue;
      if (match) {
        match.strength += row.storyEvidence.length;
        match.reason += ` ‘${story.title}’에서도 비슷하게 골랐어요.`;
      } else {
        evidence.set(row.signal, {strength: row.storyEvidence.length, reason: `‘${story.title}’에서 고른 답이에요. “${story.answer}”`});
      }
    }
    const choices = [];
    for (const story of stories || []) {
      if ((story.validFrom && story.validFrom > today) || (story.validUntil && story.validUntil < today)) continue;
      if (!Array.isArray(story.signals)) continue;
      const matches = story.signals.filter(tag => evidence.has(tag));
      const picked = readPick(story.id);
      const read = story.choices?.some(c => c.id === picked) || false;
      for (const tag of matches) {
        const {reason, strength} = evidence.get(tag);
        choices.push({story, tag, read, reason, strength, order: story.signals.indexOf(tag), overlap: matches.length});
      }
    }
    function rank(a, b) {
      const dated = story => Number(Boolean(story.validFrom || story.validUntil));
      const date = story => story.source?.asOf || story.validFrom || "";
      return Number(a.read) - Number(b.read) || b.strength - a.strength || a.order - b.order || b.overlap - a.overlap ||
        dated(b.story) - dated(a.story) || date(b.story).localeCompare(date(a.story));
    }
    choices.sort(rank);
    if (!choices.length) return [];
    const first = choices[0];
    const others = choices.filter(c => c.story.id !== first.story.id && c.tag !== first.tag);
    others.sort((a, b) => rank(a, b) ||
      Number(a.story.category === first.story.category) - Number(b.story.category === first.story.category));
    return [first, ...others.slice(0, 1)].map(({story, reason}) => ({story, reason}));
  }

  return {profile, recommend};
})();
