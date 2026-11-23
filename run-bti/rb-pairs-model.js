(() => {
  "use strict";

  const version = "pairs-1";
  const labels = ["별로 안 끌려", "그저 그래", "좋아", "아직 모르겠어"];

  // Array order is the published tie-breaker, irrespective of presentation order.
  const axes = [
    {
      id: "style", label: "거리와 속도",
      sides: [
        { id: "distance", label: "거리파", questions: [
          "조금 더 멀리 가는 게 좋아?",
          "여유가 있으면 한 바퀴 더 돌고 싶어?",
          "오래 달리는 날이 기다려져?",
        ], readings: [
          "조금 더 멀리 가는 게 좋아.",
          "여유가 있으면 한 바퀴 더 돌고 싶어.",
          "오래 달리는 날이 기다려져.",
        ] },
        { id: "speed", label: "속도파", questions: [
          "짧은 구간에서 속도를 내 보는 게 좋아?",
          "발이 빨라지는 순간이 재밌어?",
          "잠깐 빠르게 달리는 날이 기다려져?",
        ], readings: [
          "짧은 구간에서 속도를 내 보는 게 좋아.",
          "발이 빨라지는 순간이 재밌어.",
          "잠깐 빠르게 달리는 날이 기다려져.",
        ] },
      ],
      prompts: [
        "시간 넉넉한 날엔 어디까지 가 보고 싶어?",
        "같이 뛴다면 거리랑 속도 중에 뭐부터 맞춰 볼까?",
        "속도를 낼 때 특히 좋아하는 구간 있어?",
      ],
    },
    {
      id: "signals", label: "숫자와 감각",
      sides: [
        { id: "numbers", label: "숫자파", questions: [
          "지금 페이스를 숫자로 보면 편해?",
          "한 구간이 끝나면 걸린 시간을 보는 게 좋아?",
          "뛰면서 중간 기록을 듣는 게 좋아?",
        ], readings: [
          "지금 페이스를 숫자로 보면 편해.",
          "한 구간이 끝나면 걸린 시간을 보는 게 좋아.",
          "뛰면서 중간 기록을 듣는 게 좋아.",
        ] },
        { id: "senses", label: "감각파", questions: [
          "지금 페이스를 숨소리로 가늠하면 편해?",
          "뛰면서 다리가 가벼운지 살피는 게 좋아?",
          "발걸음으로 내 속도를 가늠하면 편해?",
        ], readings: [
          "지금 페이스를 숨소리로 가늠하면 편해.",
          "뛰면서 다리가 가벼운지 살피는 게 좋아.",
          "발걸음으로 내 속도를 가늠하면 편해.",
        ] },
      ],
      prompts: [
        "러닝 기록에서 숫자 하나만 본다면 뭐가 궁금해?",
        "중간 기록은 뛰면서 알려 줄까? 끝나고 같이 볼까?",
        "뛰는 날 몸이 가벼운지 어떻게 알아?",
      ],
    },
    {
      id: "routes", label: "단골과 탐험",
      sides: [
        { id: "familiar", label: "단골파", questions: [
          "아는 길을 다시 뛰는 게 좋아?",
          "자주 가는 코스라면 반가워?",
          "갈림길에선 낯익은 쪽이 끌려?",
        ], readings: [
          "아는 길을 다시 뛰는 게 좋아.",
          "자주 가는 코스라면 반가워.",
          "갈림길에선 낯익은 쪽이 끌려.",
        ] },
        { id: "explore", label: "탐험파", questions: [
          "새 골목이 보이면 들어가 보고 싶어?",
          "처음 가는 코스라면 반가워?",
          "늘 뛰던 동네에서도 새 길을 찾고 싶어?",
        ], readings: [
          "새 골목이 보이면 들어가 보고 싶어.",
          "처음 가는 코스라면 반가워.",
          "늘 뛰던 동네에서도 새 길을 찾고 싶어.",
        ] },
      ],
      prompts: [
        "몇 번을 가도 또 뛰고 싶은 길 있어?",
        "단골길 근처에서 둘 다 처음 가는 길을 찾아볼까?",
        "아직 안 가 봤는데 꼭 뛰어 보고 싶은 길 있어?",
      ],
    },
    {
      id: "planning", label: "계획과 즉흥",
      sides: [
        { id: "plan", label: "계획파", questions: [
          "나가기 전에 오늘 할 걸 정해 두면 편해?",
          "다음 주 뛸 날을 미리 정해 두고 싶어?",
          "여유 있는 날도 뛸 계획을 짜는 게 좋아?",
        ], readings: [
          "나가기 전에 오늘 할 걸 정해 두면 편해.",
          "다음 주 뛸 날을 미리 정해 두고 싶어.",
          "여유 있는 날도 뛸 계획을 짜는 게 좋아.",
        ] },
        { id: "improvise", label: "즉흥파", questions: [
          "일단 나가서 뛰며 정하는 게 편해?",
          "다음에 뛸 날은 그날 가서 정하고 싶어?",
          "뛰다가 내키는 대로 바꾸는 게 좋아?",
        ], readings: [
          "일단 나가서 뛰며 정하는 게 편해.",
          "다음에 뛸 날은 그날 가서 정하고 싶어.",
          "뛰다가 내키는 대로 바꾸는 게 좋아.",
        ] },
      ],
      prompts: [
        "다음에 같이 뛸 때 뭘 미리 정해 두면 편해?",
        "어디까지 정해 두고 뭐는 그날 고를까?",
        "일단 만나서 그날 끌리는 대로 뛰어 볼까?",
      ],
    },
  ];

  const items = axes.flatMap(axis => axis.sides.flatMap(side =>
    side.questions.map((text, index) => ({
      id: side.id + "-" + (index + 1), axisId: axis.id, sideId: side.id, text, reading: side.readings[index],
    }))
  ));

  function extra(id, text, choices, multiple = false) {
    return {
      id, text, multiple,
      options: choices.map(([key, label, sensitive = false]) => ({ id: key, label, sensitive })),
    };
  }

  const unknown = ["unknown", "아직 모르겠어"];
  const extras = [
    extra("learning", "어떻게 배우는 게 좋아?", [
      ["class", "클래스에서"], ["coach", "코치와 따로"], ["solo", "혼자 해 보기"], unknown,
    ]),
    extra("distanceLevel", "이 중에서 쉬지 않고 뛰어 본 가장 긴 거리는?", [
      ["notYet", "아직 안 뛰어 봤어"], ["under3", "3km 미만"], ["3k", "3km"],
      ["5k", "5km"], ["10k", "10km"], ["21k", "21km 이상"], ["unknown", "잘 모르겠어"],
    ]),
    extra("strength", "달릴 때 뭐가 제일 자신 있어?", [
      ["endurance", "오래 달리기"], ["speed", "속도 내기"], ["steady", "고른 페이스"],
      ["consistency", "꾸준히 나가기"], ["other", "다른 게 있어"], unknown,
    ]),
    extra("challenge", "어느 구간이 힘들게 느껴져?", [
      ["start", "뛰기 시작할 때"], ["middle", "중간쯤"], ["finish", "끝날 무렵"],
      ["varies", "날마다 달라"], ["none", "딱히 없어"], unknown,
    ]),
    extra("goal", "다음엔 뭘 잘하고 싶어?", [
      ["distance", "거리 늘리기"], ["speed", "속도 내기"], ["consistency", "꾸준히 뛰기"],
      ["finish", "대회 완주"], ["technique", "자세 익히기"], ["other", "다른 목표"], unknown,
    ]),
    extra("motives", "요즘은 어떤 이유로 뛰고 싶어?", [
      ["health", "건강과 체력"], ["weight", "체중 관리", true], ["refresh", "기분 전환"],
      ["routine", "생활 리듬"], ["record", "기록 단축"], ["competition", "경쟁"],
      ["finish", "완주"], ["company", "함께하는 재미"], ["recognition", "인정받는 기분", true],
      ["enjoyment", "달리기 자체가 좋아"], ["other", "다른 이유"], unknown,
    ], true),
    extra("eagerness", "요즘 달릴 날이 얼마나 기다려져?", [
      ["eager", "기다려져"], ["neutral", "그저 그래"], ["reluctant", "별로 안 기다려져"], unknown,
    ]),
  ];

  // An animal's props describe the illustration. Only the liked answers describe a runner's actions.
  const characters = {
    "distance": { nickname: "성큼성큼 코끼리", reading: "길게 달리는 날이 좋아.", art: "코끼리 · 물병" },
    "speed": { nickname: "질주 치타", reading: "뛰다가 속도가 붙을 때가 재밌어.", art: "치타 · 배번호" },
    "numbers": { nickname: "문어", reading: "내가 어떻게 뛰었는지 숫자로 알면 더 재밌어.", art: "문어 · 데이터 워치" },
    "senses": { nickname: "손수건 고양이", reading: "뛰면서 내 몸이 어떤지 느껴 보는 게 좋아.", art: "고양이 · 손수건" },
    "familiar": { nickname: "동네 단골 강아지", reading: "다시 뛰어도 아는 길이 반가워.", art: "강아지 · 코스 키링" },
    "explore": { nickname: "흰꼬리 여우", reading: "처음 보는 길은 한번 뛰어 보고 싶어.", art: "여우 · 접이식 지도" },
    "plan": { nickname: "비버", reading: "뛸 계획을 미리 정해 두면 마음이 편해.", art: "비버 · 러닝 다이어리" },
    "improvise": { nickname: "날개 편 앵무새", reading: "어떻게 뛸지는 그날 정하는 게 편해.", art: "앵무새 · 러닝 캡" },
    "distance+numbers": { nickname: "황제펭귄", reading: "오래 달리는 게 좋고 내 달리기를 숫자로 보는 재미도 있어.", art: "황제펭귄 · 초시계" },
    "distance+senses": { nickname: "타월 거북이", reading: "오래 뛰고 싶어. 뛰는 동안 내 몸이 어떤지도 궁금해.", art: "거북이 · 스포츠 타월" },
    "speed+numbers": { nickname: "송골매", reading: "속도가 붙는 맛도 좋고 내가 어떻게 뛰었는지 숫자로 아는 것도 좋아.", art: "송골매 · 구간 기록표" },
    "speed+senses": { nickname: "물살 타는 돌고래", reading: "속도를 내는 것도 좋고 달릴 때 몸에서 느껴지는 변화도 재밌어.", art: "돌고래 · 지느러미 밴드" },
    "distance+familiar": { nickname: "보온병 판다", reading: "길게 뛰는 게 좋아. 코스는 아는 길이면 더 반가워.", art: "판다 · 보온병" },
    "distance+explore": { nickname: "먼 바다 혹등고래", reading: "길게 달리는 날이 좋아. 처음 보는 길도 궁금해.", art: "혹등고래 · 코스 엽서" },
    "speed+familiar": { nickname: "돌아오는 제비", reading: "아는 길은 또 뛰어도 좋고 속도가 붙는 순간도 좋아해.", art: "제비 · 릴레이 배턴" },
    "speed+explore": { nickname: "선글라스 상어", reading: "속도 내는 재미도 있고 새 길을 찾아가는 재미도 있어.", art: "상어 · 스포츠 선글라스" },
    "distance+plan": { nickname: "배낭 멘 낙타", reading: "오래 달리는 게 좋아. 뛸 계획은 미리 잡아 두면 편해.", art: "쌍봉낙타 · 트레일 배낭" },
    "distance+improvise": { nickname: "한 모금 캥거루", reading: "오래 뛰는 게 좋아. 어떻게 뛸지는 그날 정하고 싶어.", art: "캥거루 · 접는 물컵" },
    "speed+plan": { nickname: "운동화 챙긴 토끼", reading: "달릴 땐 속도 내는 재미가 있고 뛸 건 미리 정해 두면 편해.", art: "토끼 · 러닝화 한 짝" },
    "speed+improvise": { nickname: "후다닥 다람쥐", reading: "속도 내는 걸 좋아해. 오늘 어떻게 뛸지는 그때 가서 정할래.", art: "다람쥐 · 호루라기" },
    "numbers+familiar": { nickname: "고리꼬리 라쿤", reading: "아는 길에서 뛰는 게 편해. 내가 어떻게 뛰었는지 숫자로 아는 것도 좋아.", art: "라쿤 · 만보기" },
    "numbers+explore": { nickname: "길 찾는 기린", reading: "안 가 본 길이 궁금해. 내 달리기를 숫자로 보는 재미도 있어.", art: "기린 · 갈림길에서 확인하는 러닝 워치" },
    "senses+familiar": { nickname: "밴드 찬 코알라", reading: "익숙한 길이 반갑고 달릴 때 내 몸이 어떤지 살피는 게 좋아.", art: "코알라 · 손목 밴드" },
    "senses+explore": { nickname: "호랑나비", reading: "새 길에 들어서는 재미도 있고 뛰면서 몸의 변화를 느끼는 재미도 있어.", art: "호랑나비 · 압화 수첩" },
    "numbers+plan": { nickname: "올빼미", reading: "뛸 계획은 미리 잡고 싶어. 내 달리기도 숫자로 보면 감이 와.", art: "올빼미 · 랩 기록 노트" },
    "numbers+improvise": { nickname: "폴짝 개구리", reading: "어떻게 뛸지는 그날 정할래. 내가 어떻게 뛰었는지는 숫자로 알고 싶어.", art: "개구리 · 방향을 틀며 확인하는 러닝 워치" },
    "senses+plan": { nickname: "곱슬 양", reading: "뛸 건 미리 정해 두는 게 편해. 달릴 땐 내 몸이 어떤지도 살피고 싶어.", art: "양 · 스트레칭 매트" },
    "senses+improvise": { nickname: "둥실 해파리", reading: "뛸 건 그날 정하는 게 편해. 달리면서 내 몸이 어떤지 느껴 보는 것도 좋아.", art: "해파리 · 실리콘 링" },
    "familiar+plan": { nickname: "고슴도치", reading: "코스는 익숙한 데가 좋고 뛸 계획은 미리 정해 두는 게 편해.", art: "고슴도치 · 훈련 달력" },
    "familiar+improvise": { nickname: "우리 동네 햄스터", reading: "뛰는 곳은 아는 데가 좋아. 거기서 어떻게 뛸지는 그날 정할래.", art: "햄스터 · 강변 쉼터의 한강라면" },
    "explore+plan": { nickname: "새 코스 찜한 카멜레온", reading: "처음 가는 길이 궁금해. 뛸 계획은 미리 정해 두는 게 좋아.", art: "카멜레온 · 등산 스틱 한 개" },
    "explore+improvise": { nickname: "훌쩍 떠나는 바다코끼리", reading: "처음 가는 길이 좋아. 어떻게 뛸지도 그날 가서 정하는 게 재밌어.", art: "바다코끼리 · 여행 가방" },
  };
  const sideCodes = Object.fromEntries(axes.flatMap(axis => axis.sides.map(side => [side.id, side.label.slice(0, -1)])));
  const names = Object.assign(Object.create(null), { open: "내 러닝 취향", unanswered: "지금까지 고른 답" });
  for (const [key, character] of Object.entries(characters)) {
    names[key] = key.split("+").map(side => sideCodes[side]).join("·") + " | " + character.nickname;
  }

  // Some archives saved the visible title before character keys were persisted.
  const previousTitles = { ...Object.fromEntries(axes.flatMap(axis => axis.sides.map(side => [side.id,side.label]))) };
  const titleWords = { distance:"장거리", speed:"스피드", familiar:"단골길", explore:"새 길", plan:"계획형", improvise:"즉흥형" };
  for (const key of Object.keys(characters).filter(key => key.includes("+"))) {
    const [a,b] = key.split("+");
    previousTitles[key] = a === "numbers" || a === "senses"
      ? titleWords[b] + " " + previousTitles[a] : titleWords[a] + " " + previousTitles[b];
  }

  // Earlier local archives stored the displayed Korean title instead of the key.
  const legacyTitles = {
    "distance+numbers": "숫자 보며 한 바퀴 더", "distance+senses": "발걸음 느끼며 길게",
    "speed+numbers": "속도 내는 숫자파", "speed+senses": "속도 내는 감각파",
    "distance+familiar": "단골길 한 바퀴 더", "distance+explore": "새 길로 한 바퀴 더",
    "speed+familiar": "단골길 속도파", "speed+explore": "속도 내는 탐험가",
    "distance+plan": "미리 정하고 길게", "distance+improvise": "내키면 한 바퀴 더",
    "speed+plan": "계획대로 속도 내기", "speed+improvise": "내킬 때 속도 내기",
    "numbers+familiar": "단골길 숫자파", "numbers+explore": "숫자 보는 탐험가",
    "senses+familiar": "단골길 감각파", "senses+explore": "발걸음 느끼는 탐험가",
    "numbers+plan": "미리 정하는 숫자파", "numbers+improvise": "뛰며 정하는 숫자파",
    "senses+plan": "미리 정하는 감각파", "senses+improvise": "뛰며 정하는 감각파",
    "familiar+plan": "계획대로 단골길", "familiar+improvise": "일단 단골길부터",
    "explore+plan": "계획 있는 탐험가", "explore+improvise": "발길 닿는 탐험가",
  };

  const axisOrder = Object.fromEntries(axes.map((axis, index) => [axis.id, index]));
  const sideItems = new Map(axes.flatMap(axis =>
    axis.sides.map(side => [side.id, items.filter(item => item.sideId === side.id)])
  ));

  function scoreSide(side, answers) {
    let sum = 0;
    let lows = 0;
    const answered = [];
    const evidence = [];
    for (const item of sideItems.get(side.id)) {
      const value = answers[item.id];
      if (value !== 0 && value !== 1 && value !== 2) continue;
      sum += value;
      answered.push(item.id);
      if (value === 0) lows++;
      if (value === 2) evidence.push(item.id);
    }
    return {
      id: side.id, label: side.label, count: answered.length, sum,
      mean: answered.length ? sum / answered.length : null,
      likes: evidence.length, lows, evidence, answered,
    };
  }

  function scoreAxis(axis, answers) {
    const sides = axis.sides.map(side => scoreSide(side, answers));
    const [left, right] = sides;
    let state = "insufficient";
    let direction = null;
    let gap = null;
    if (left.count >= 2 && right.count >= 2) {
      // With two or three ratings per side, sixths compare means and ties exactly.
      const signedSixths = left.sum * (6 / left.count) - right.sum * (6 / right.count);
      gap = Math.abs(signedSixths) / 6;
      const higher = signedSixths >= 0 ? left : right;
      if (left.likes >= 2 && right.likes >= 2) state = "both";
      else if (left.lows >= 2 && right.lows >= 2) state = "neither";
      else if (gap >= 0.5 && higher.likes >= 2) {
        state = "direction";
        direction = higher.id;
      } else state = "middle";
    }
    return { id: axis.id, label: axis.label, sides, state, direction, gap };
  }

  function titleKey(first, second) {
    return axisOrder[first.id] < axisOrder[second.id]
      ? first.direction + "+" + second.direction
      : second.direction + "+" + first.direction;
  }

  function evaluate(answers = {}) {
    const checked = answers && typeof answers === "object" ? answers : {};
    const results = axes.map(axis => scoreAxis(axis, checked));
    const anyAnswered = results.some(axis => axis.sides.some(side => side.count > 0));
    const ranked = results.filter(axis => axis.direction)
      .sort((a, b) => b.gap - a.gap || axisOrder[a.id] - axisOrder[b.id]);
    let keys;
    if (ranked.length < 2) {
      keys = [ranked[0]?.direction || (anyAnswered ? "open" : "unanswered")];
    } else {
      keys = [];
      const cutoff = ranked[1].gap;
      for (let i = 0; i < ranked.length && ranked[i].gap === ranked[0].gap; i++) {
        for (let j = i + 1; j < ranked.length && ranked[j].gap >= cutoff; j++) {
          keys.push(titleKey(ranked[i], ranked[j]));
        }
      }
    }
    const defaultKey = keys[0];
    const choices = keys.map(key => {
      const included = key.split("+");
      const evidence = ranked.filter(axis => included.includes(axis.direction)).flatMap(axis =>
        axis.sides.find(side => side.id === axis.direction).evidence
      );
      return { key, name: names[key], evidence };
    });
    return {
      version, axes: results, defaultKey, defaultName: names[defaultKey],
      choices, evidence: choices[0].evidence, anyAnswered,
    };
  }

  function choiceFor(result, saved) {
    return result.choices.find(choice => choice.key === saved || choice.name === saved ||
      (typeof saved === "string" && (legacyTitles[choice.key] === saved || previousTitles[choice.key] === saved))) || result.choices[0];
  }

  const sideTopics = {
    distance: "거리", speed: "속도", numbers: "숫자", senses: "몸의 감각",
    familiar: "익숙한 길", explore: "새 길", plan: "계획", improvise: "즉흥",
  };

  // Each item keeps its own first-person reading; it is offered only for a positive answer.
  function likedClaim(item, answers) {
    if (answers[item.id] !== 2) return null;
    return { text: item.reading, evidence: [{id:item.id, value:2}] };
  }

  function sideReading(side, answers) {
    const sideQuestions = sideItems.get(side.id);
    const likes = sideQuestions.map(item => likedClaim(item, answers)).filter(Boolean);
    const evidence = side.answered.map(id => ({id, value:answers[id]}));
    const topic = sideTopics[side.id] + " 쪽";
    let text = "";
    if (side.count === sideQuestions.length && side.lows === side.count) {
      text = topic + " 세 문항에 모두 ‘별로 안 끌려’라고 답했어요.";
    } else if (side.count === sideQuestions.length && !side.likes && !side.lows) {
      text = topic + " 세 문항에 모두 ‘그저 그래’라고 답했어요.";
    } else if (new Set(evidence.map(entry => entry.value)).size > 1) {
      const counts = [2, 1, 0].map(value => ({value, count:evidence.filter(entry => entry.value === value).length}));
      text = topic + "은 " + counts.filter(entry => entry.count).map(entry =>
        "‘" + labels[entry.value] + "’ " + entry.count + "개").join(", ") + "였어요.";
    }
    return {summary: text ? {text, evidence} : null, likes};
  }

  function resultReason(result, answers, selected = result.defaultKey) {
    const choice = choiceFor(result, selected);
    const sides = choice.key.split("+");
    if (sides.every(id => Object.hasOwn(sideTopics, id))) {
      return sides.map(id => sideTopics[id] + " 쪽").join("과 ") +
        (sides.length > 1 ? "에서 각각" : "에서") + " 두 문항 이상에 ‘좋아’라고 답했어요.";
    }
    for (const axis of result.axes) {
      // Even without a directional nickname, a clear dislike is worth reporting.
      if (axis.sides.some(side => side.count === 3 && side.lows === 3)) {
        return axis.sides.map(side => sideReading(side, answers).summary?.text).filter(Boolean).join(" ");
      }
    }
    const both = result.axes.filter(axis => axis.state === "both").map(axis => axis.label);
    if (both.length) return both.join(" · ") + "에서 양쪽 모두 두 문항 이상에 ‘좋아’라고 답했어요.";
    const neither = result.axes.filter(axis => axis.state === "neither").map(axis => axis.label);
    if (neither.length) return neither.join(" · ") + "에서 양쪽 모두 두 문항 이상에 ‘별로 안 끌려’라고 답했어요.";
    if (!result.anyAnswered) return items.some(item => answers[item.id] === "unknown") ?
      "‘아직 모르겠어’로 남긴 문항에는 점수를 매기지 않았어요." : "아직 성향 문항에서 고른 답이 없어요.";
    if (result.axes.every(axis => axis.state === "insufficient")) return "두 쪽을 비교하기엔 아직 고른 답이 적어요.";
    const summary = result.axes.flatMap(axis => axis.sides.map(side => sideReading(side, answers).summary)).find(Boolean);
    return summary?.text || "이번 답만으로는 어느 쪽이 더 좋은지 정하기 어려워요.";
  }

  function likedSides(result, axis) {
    if (!result) return [];
    if (result.state === "both") return axis.sides;
    if (result.state === "direction") return axis.sides.filter(side => side.id === result.direction);
    return [];
  }

  function compare(mine, theirs) {
    if (mine?.version !== version || theirs?.version !== version ||
        !Array.isArray(mine.axes) || !Array.isArray(theirs.axes)) return [];
    const lines = [];
    for (const axis of axes) {
      const first = mine.axes.find(row => row?.id === axis.id);
      const second = theirs.axes.find(row => row?.id === axis.id);
      const mineLiked = likedSides(first, axis);
      const theirsLiked = likedSides(second, axis);
      if (!mineLiked.length || !theirsLiked.length) continue;
      if (mineLiked.length === 1 && theirsLiked.length === 1) {
        const right = axis.sides[1].id;
        const index = Number(mineLiked[0].id === right) + Number(theirsLiked[0].id === right);
        lines.push({ axisId: axis.id, kind: "question", text: axis.prompts[index] });
      } else {
        const common = mineLiked.filter(side => theirsLiked.includes(side));
        const label = common.map(side => side.label.slice(0, -1)).join(" · ");
        lines.push({ axisId: axis.id, kind: "common", text: "두 사람 모두 ‘" + label + "’ 쪽을 좋아한다고 답했어요." });
      }
    }
    return lines;
  }

  globalThis.RBPairsModel = { version, labels, axes, items, extras, names, characters, evaluate, compare,
    choiceFor, sideReading, resultReason };
})();
