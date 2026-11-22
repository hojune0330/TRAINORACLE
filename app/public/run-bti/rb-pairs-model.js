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
        ] },
        { id: "speed", label: "속도파", questions: [
          "짧은 구간에서 속도를 내 보는 게 좋아?",
          "발이 빨라지는 순간이 재밌어?",
          "잠깐 빠르게 달리는 날이 기다려져?",
        ] },
      ],
      prompts: [
        "시간 넉넉한 날엔 어디까지 가 보고 싶어?",
        "한 바퀴 더 돌 때랑 속도가 붙을 때, 너는 언제 더 신나?",
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
        ] },
        { id: "senses", label: "감각파", questions: [
          "지금 페이스를 숨소리로 가늠하면 편해?",
          "뛰면서 다리가 가벼운지 살피는 게 좋아?",
          "발걸음으로 내 속도를 가늠하면 편해?",
        ] },
      ],
      prompts: [
        "뛰면서 제일 궁금한 숫자가 뭐야?",
        "중간 기록은 뛰면서 알려 줄까? 끝나고 같이 볼까?",
        "오늘 발이 가볍다는 걸 넌 언제 처음 느껴?",
      ],
    },
    {
      id: "routes", label: "단골과 탐험",
      sides: [
        { id: "familiar", label: "단골파", questions: [
          "아는 길을 다시 뛰는 게 좋아?",
          "자주 가는 코스라면 반가워?",
          "갈림길에선 낯익은 쪽이 끌려?",
        ] },
        { id: "explore", label: "탐험파", questions: [
          "새 골목이 보이면 들어가 보고 싶어?",
          "처음 가는 코스라면 반가워?",
          "늘 뛰던 동네에서도 새 길을 찾고 싶어?",
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
        ] },
        { id: "improvise", label: "즉흥파", questions: [
          "일단 나가서 뛰며 정하는 게 편해?",
          "다음에 뛸 날은 그날 가서 정하고 싶어?",
          "뛰다가 내키는 대로 바꾸는 게 좋아?",
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
      id: side.id + "-" + (index + 1), axisId: axis.id, sideId: side.id, text,
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

  const names = Object.assign(Object.create(null), {
    open: "내 러닝 취향", unanswered: "지금까지 고른 답",
    ...Object.fromEntries(axes.flatMap(axis => axis.sides.map(side => [side.id, side.label]))),
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
  });

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

  globalThis.RBPairsModel = { version, labels, axes, items, extras, names, evaluate, compare };
})();
