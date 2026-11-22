(() => {
  "use strict";

  const axes = [
    {id:"recovery", label:"회복"}, {id:"record", label:"기록"},
    {id:"social", label:"함께"}, {id:"explore", label:"탐색"}
  ];

  // Each row keeps the questionnaire, the spoken card line and its licensed
  // interpretation together. Never use one item's dialogue for another item.
  function scene(id, title, art, rows) {
    return {
      id, title, image:"art/q-" + art + ".webp",
      items:rows.map(([text, wish, line, reading, wishReading], index) => ({
        id:id + "-" + axes[index].id, axisId:axes[index].id, text, wish, line, reading, wishReading
      }))
    };
  }
  const scenes = [
    scene("door", "현관 앞", "00", [
      ["머리 좀 식히려고 나가.", "머리가 복잡할 때 바람 쐬러 나가고 싶어.", "머리 좀 식히고 올게.", "머리 좀 식히고 싶은 날 운동화를 꺼내요.", "마음이 복잡한 날 바람 쐬러 나가는 첫 러닝을 떠올렸어요."],
      ["나가기 전에 지난번에 몇 km 뛰었는지 봐.", "다음번에 나갈 땐 첫날 몇 km 뛰었는지 보고 싶어.", "지난번에 몇 km 뛰었더라?", "문을 나서기 전에 지난번에 달린 거리부터 찾아봐요.", "다시 뛰러 갈 때 꺼내 보고 싶은 건 첫날 달린 거리예요."],
      ["같이 뛰기로 한 사람이 있어서 나가.", "같이 뛰기로 약속하고 나가고 싶어.", "나 이제 나가. 거기서 봐!", "같이 뛰기로 한 사람이 있으면 밖에 나갈 이유가 생겨요.", "첫날엔 같이 뛰기로 한 사람과 약속을 잡고 나가고 싶어요."],
      ["저번에 본 골목 끝이 궁금해서 나가.", "저번에 본 골목이 어디로 이어지는지 보러 가고 싶어.", "저번에 못 가 본 그 길로 가 볼까?", "한번 눈여겨본 골목은 어디로 이어지는지 궁금해서 뛰러 나가요.", "전에 지나치며 봐 둔 골목 끝까지 가 보는 쪽에 마음이 가요."]
    ]),
    scene("start", "뛰기 시작한 지 5분", "03", [
      ["딴생각이 자꾸 나면 발소리에 귀를 기울여.", "딴생각이 날 땐 내 발소리를 들어 보고 싶어.", "잠깐 내 발소리나 들어 볼까.", "딴생각이 따라오면 발소리에 귀를 기울여요.", "딴생각이 나는 순간에는 발소리에 귀를 기울여 보고 싶어요."],
      ["뛰기 시작하고 몇 분 지났는지 봐.", "뛰기 시작하고 몇 분 지났는지 확인하고 싶어.", "지금 몇 분째지?", "뛰기 시작하고 얼마나 지났는지 시간을 확인해요.", "첫 러닝 중에 궁금한 건 뛰기 시작한 지 몇 분 됐는지예요."],
      ["이 길을 같이 뛰면 좋을 사람이 떠올라.", "같이 뛰면 좋을 사람을 떠올리며 달리고 싶어.", "다음에 여기 같이 뛰면 좋겠다.", "길을 달리다 보면 여기를 같이 뛰고 싶은 사람이 떠올라요.", "첫 코스를 뛰면서 다음에 함께 오고 싶은 사람을 떠올려 보고 싶어요."],
      ["처음 보는 갈림길이 나오면 그쪽을 한번 들여다봐.", "처음 보는 갈림길이 나오면 그쪽을 들여다보고 싶어.", "잠깐만. 저쪽은 뭐가 있지?", "처음 보는 갈림길에선 그쪽에 뭐가 있는지 들여다봐요.", "낯선 갈림길에서 그쪽을 한번 들여다보는 모습을 골랐어요."]
    ]),
    scene("pause", "잠깐 멈춘 사이", "05", [
      ["잠깐 서서 마음을 가라앉혀.", "잠깐 멈춘 김에 마음을 가라앉히고 싶어.", "잠깐 여기서 마음 좀 가라앉히자.", "뛰다가 멈출 일이 생기면 그 틈에 마음을 가라앉혀요.", "달리다가 서게 되면 그 틈에 마음을 가라앉히고 싶어요."],
      ["멈춘 김에 여기까지 몇 분 걸렸는지 봐.", "멈춘 김에 여기까지 몇 분 걸렸는지 보고 싶어.", "여기까지 몇 분 걸렸나 한번 보자.", "잠깐 멈춘 사이 여기까지 걸린 시간을 챙겨 봐요.", "멈춰 있는 동안 여기까지 달린 시간을 보고 싶어요."],
      ["옆 사람이랑 하던 얘기를 마저 해.", "같이 뛰는 사람이랑 하던 얘기를 마저 하고 싶어.", "그래서 그다음엔 어떻게 됐어?", "발은 잠깐 멈춰도 옆 사람과 나누던 이야기는 계속해요.", "잠깐 서는 동안 옆 사람과 하던 얘기를 이어 가고 싶어요."],
      ["건너편에 처음 보는 길이 있으면 어디로 가는 길인지 살펴봐.", "건너편에 처음 보는 길이 있으면 어디로 이어지는지 보고 싶어.", "저 길로 가면 어디가 나올까?", "멈춰 서면 건너편의 낯선 길이 어디로 이어지는지 살펴봐요.", "잠깐 서 있을 때 눈길이 가는 쪽은 건너편의 낯선 길이에요."]
    ]),
    scene("home", "신발을 벗으며", "06", [
      ["나갈 때 신경 쓰이던 일이 아직 마음에 걸리는지 생각해 봐.", "나갈 때 신경 쓰였던 일이 아직 마음에 걸리는지 살펴보고 싶어.", "아까 신경 쓰이던 일은 지금 좀 어떤가?", "집에 오면 아까 마음에 걸리던 일이 지금은 어떤지 돌아봐요.", "러닝을 마친 뒤 집에서 아까 신경 쓰이던 마음을 다시 살펴보고 싶어요."],
      ["다 뛰고 나면 오늘 달린 거리부터 확인해.", "다 뛰고 나면 오늘 몇 km 달렸는지 보고 싶어.", "오늘은 몇 km 뛰었지?", "달리기를 마치고 가장 먼저 확인하는 건 오늘 뛴 거리예요.", "첫 러닝을 마치면 얼마나 뛰었는지 거리를 보고 싶어요."],
      ["친구한테 오늘 러닝은 어땠냐고 물어봐.", "친구한테도 오늘 러닝은 어땠냐고 물어보고 싶어.", "넌 오늘 뛰어 보니까 어땠어?", "내 러닝을 마친 뒤에는 친구가 어떻게 뛰었는지도 물어봐요.", "내가 뛴 날 친구의 러닝은 어땠는지도 물어보고 싶어요."],
      ["오늘 처음 지나간 곳을 나중에 찾을 수 있게 표시해 둬.", "처음 지나간 곳을 다시 찾을 수 있게 표시해 두고 싶어.", "여긴 다시 오게 표시해 두자.", "처음 지나간 곳을 나중에 다시 찾을 수 있게 표시해 둬요.", "처음 지나간 곳을 기억해 뒀다가 다시 찾아가고 싶어요."]
    ]),
    scene("evening", "그날 저녁", "08", [
      ["뛰기 전이랑 지금이랑 기분이 얼마나 달라졌나 떠올려.", "뛰기 전과 지금 기분이 어떻게 다른지 떠올려 보고 싶어.", "나가기 전이랑 지금이랑 기분이 좀 다른가?", "저녁이 되면 뛰기 전과 지금의 기분을 견줘 봐요.", "밤이 되면 첫 러닝 전후에 내 기분이 어떻게 달랐는지 떠올리고 싶어요."],
      ["오늘 걸린 시간이랑 지난번 시간을 비교해.", "다시 뛰는 날엔 첫날과 얼마나 차이 나는지 시간을 비교해 보고 싶어.", "지난번이랑 시간이 얼마나 차이 나지?", "그날 뛴 시간을 지난번 기록 옆에 놓고 비교해요.", "첫날에 걸린 시간을 남겨 뒀다가 다음번과 비교해 보고 싶어요."],
      ["친구랑 각자 오늘 뛴 얘기를 나눠.", "친구랑 각자 오늘 뛴 얘기를 나누고 싶어.", "나 오늘 뛰고 왔어. 넌 어땠어?", "저녁에는 친구와 각자 뛰면서 겪은 일을 나눠요.", "첫 러닝을 마친 날 저녁에 친구와 서로의 러닝 얘기를 나누고 싶어요."],
      ["오늘 지나친 길 중 다음에 가 보고 싶은 곳을 떠올려.", "오늘 지나친 길 중 다음에 가 보고 싶은 곳을 떠올리고 싶어.", "아까 지나친 거기 다음에 가 봐야지.", "그날 지나친 길 가운데 다음에 가 보고 싶은 곳을 떠올려요.", "첫날 지나친 곳 중에 다시 가 보고 싶은 길을 떠올려 보고 싶어요."]
    ]),
    scene("next", "다음에 또 뛸 때", "02", [
      ["하루 종일 신경 쓰인 일이 있으면 달릴 시간을 내.", "하루 종일 신경 쓰인 일이 있으면 뛰러 갈 시간을 내고 싶어.", "오늘은 좀 뛰고 와야겠어.", "신경 쓰이는 일이 온종일 머리에 남은 날에는 달릴 시간을 내요.", "하루 종일 마음이 쓰이는 날에 달릴 시간을 내 보고 싶어요."],
      ["다음에 얼마나 뛸지 정할 때 지난 기록을 펴 봐.", "다음에 얼마나 뛸지 정할 때 첫 기록을 펴 보고 싶어.", "다음엔 얼마나 뛸까? 지난 기록 좀 보자.", "다음 거리를 정할 땐 지난 러닝 기록을 꺼내 봐요.", "다음번 뛸 거리를 정할 때 첫 기록을 다시 펼쳐 보고 싶어요."],
      ["다음엔 같이 뛰자고 먼저 연락해.", "다음엔 같이 뛰자고 먼저 연락하고 싶어.", "다음엔 같이 뛸래?", "다음 러닝 약속은 같이 뛰자고 먼저 연락해서 잡아요.", "첫날이 지나면 먼저 연락해서 다음 러닝 약속을 잡고 싶어요."],
      ["다음에 가 볼 새 코스를 찾아봐.", "다음에 가 볼 새 코스를 찾아보고 싶어.", "다음엔 어디로 가 볼까?", "다음에 뛰러 갈 때도 가 본 적 없는 코스를 찾아봐요.", "첫날이 지나면 다음에 가 볼 새 코스를 찾아보고 싶어요."]
    ])
  ];

  // Keys use the published axis order, not the order of the highest raw scores.
  // Each character is illustrated by a different original three-pose sheet.
  const actors = [
    ["recovery", "하온", "마음을 살피는 러너", 12],
    ["record", "도윤", "기록을 챙기는 러너", 16],
    ["social", "이담", "친구를 떠올리는 러너", 27],
    ["explore", "루리", "새 길이 궁금한 러너", 1],
    ["recovery+record", "하진", "기분과 기록을 돌아보는 러너", 43],
    ["recovery+social", "다온", "마음과 안부를 챙기는 러너", 21],
    ["recovery+explore", "소이", "바람 쐬러 나온 골목 탐험가", 0],
    ["record+social", "재하", "친구와 기록을 챙기는 러너", 24],
    ["record+explore", "도은", "새 길에서도 기록을 챙기는 러너", 37],
    ["social+explore", "이솔", "새 길과 친구를 떠올리는 러너", 32],
    ["recovery+record+social", "시우", "기분과 기록과 안부를 챙기는 러너", 17],
    ["recovery+record+explore", "유주", "기분도 거리도 새 길도 궁금한 러너", 6],
    ["recovery+social+explore", "해원", "마음과 친구와 새 길을 살피는 러너", 33],
    ["record+social+explore", "선재", "친구도 코스도 기록도 챙기는 러너", 8],
    ["recovery+record+social+explore", "모아", "네 가지를 고루 즐기는 러너", 34]
  ];
  const cast = Object.fromEntries(actors.map(([id, name, nickname, number]) => {
    const n = String(number).padStart(2, "0");
    const soyi = id === "recovery+explore";
    const background = id.includes("explore") ? "02" : id.includes("social") ? "06" : id.includes("record") ? "04" : "00";
    return [id, {id, name, nickname, portrait:"art/portrait-" + n + ".webp",
      image:soyi ? "art/reading-soyi.webp" : "art/runner-" + n + "-0.webp", background:"art/bg-" + background + ".webp"}];
  }));

  const minCount = 4;
  // Means repeat in sixths and fifths. Compare before any display rounding.
  const epsilon = 1e-9;
  function evaluate(answers, mode = "experience") {
    if (!["experience","imagine"].includes(mode) ||
        !Array.isArray(answers) || answers.length !== scenes.length ||
        !Array.from(answers).every(row => Array.isArray(row) && row.length === axes.length &&
          Array.from(row).every(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 5)))) {
      throw new RangeError("여섯 장면에 네 답씩 넣어 주세요. 답은 1~5점이나 빈칸이에요.");
    }
    const imagined = mode === "imagine";
    const scored = axes.map(({id, label}, column) => {
      const responses = scenes.map((entry, sceneIndex) => {
        const item = entry.items[column];
        return {sceneIndex, axisId:id, itemId:item.id, value:answers[sceneIndex][column], text:imagined ? item.wish : item.text};
      });
      const valid = responses.filter(response => response.value !== null);
      const mean = valid.length >= minCount ? valid.reduce((sum, response) => sum + response.value, 0) / valid.length : null;
      return {id, label, count:valid.length, mean, responses, evidence:valid.filter(response => response.value >= 4)};
    });
    const ranked = scored.filter(axis => axis.mean !== null).sort((a, b) => b.mean - a.mean);
    const result = {mode, version:"reading-1", axes:scored, status:"pending", character:null, line:"",
      paragraphs:[], primary:null, secondary:null, joint:[], gap:null, certainty:null};
    if (ranked.length < 3) return result;
    const [top, second, third] = ranked;
    result.gap = top.mean - second.mean;
    if (!ranked.some(axis => axis.evidence.length)) {
      result.status = "low";
      return result;
    }
    const average = ranked.reduce((sum, axis) => sum + axis.mean, 0) / ranked.length;
    const spread = top.mean - ranked[ranked.length - 1].mean;
    const balanced = ranked.length === 4 && average >= 4 - epsilon && spread < 0.5 - epsilon &&
      ranked.every(axis => axis.evidence.length);
    const leading = balanced ? scored : scored.filter(axis => axis.mean !== null && top.mean - axis.mean < 0.25 - epsilon);
    if (!balanced && (leading.length === 4 || leading.some(axis => !axis.evidence.length))) {
      result.status = "observed";
      return result;
    }
    result.character = cast[leading.map(axis => axis.id).join("+")];
    if (balanced || leading.length > 1) {
      result.status = balanced ? "balanced" : "joint";
      result.joint = leading.map(axis => axis.id);
      result.certainty = "close";
    } else {
      result.status = "primary";
      result.primary = top.id;
      result.secondary = second.mean - third.mean > epsilon && second.evidence.length ? second.id : null;
      result.certainty = result.gap >= 0.75 - epsilon ? "clear" : "lean";
    }

    // Use only strongly endorsed actions. For tied actions prefer the earlier
    // scene, so replay yields the same quotation and the same character.
    const columnOf = id => axes.findIndex(axis => axis.id === id);
    const byStrength = (a, b) => b.value - a.value || a.sceneIndex - b.sceneIndex;
    const itemFor = evidence => scenes[evidence.sceneIndex].items[columnOf(evidence.axisId)];
    const textFor = evidence => imagined ? itemFor(evidence).wishReading : itemFor(evidence).reading;
    const doorPair = result.character.id === "recovery+explore" && leading.every(axis => axis.evidence.some(e => e.sceneIndex === 0));
    const anchors = leading.map(axis => doorPair
      ? axis.evidence.find(e => e.sceneIndex === 0)
      : [...axis.evidence].sort(byStrength)[0]);
    const voice = doorPair ? anchors.find(e => e.axisId === "explore") : [...anchors].sort(byStrength)[0];
    result.line = imagined ? itemFor(voice).wish : itemFor(voice).line;
    result.lineItemId = voice.itemId;
    result.paragraphs.push({
      title:imagined ? "내가 떠올린 첫 러닝" : "내가 달릴 때",
      text:anchors.map(textFor).join(" "), itemIds:anchors.map(e => e.itemId)
    });
    const used = new Set(anchors.map(e => e.itemId));
    if (result.secondary) {
      const axis = scored[columnOf(result.secondary)];
      const evidence = [...axis.evidence].sort(byStrength)[0];
      result.paragraphs.push({title:"함께 고른 모습", text:textFor(evidence), itemIds:[evidence.itemId]});
      used.add(evidence.itemId);
    }
    // Give a later, independently endorsed scene its own place in the
    // reading. One statement cannot establish a repeated pattern.
    const extra = leading.flatMap(axis => axis.evidence).filter(e => !used.has(e.itemId));
    const nextCourse = extra.find(e => e.itemId === "next-explore" && used.has("door-explore"));
    const detail = nextCourse || extra.sort(byStrength)[0];
    if (detail) {
      const earlier = anchors.find(anchor => anchor.axisId === detail.axisId);
      const paragraph = {title:scenes[detail.sceneIndex].title, text:textFor(detail), itemIds:[detail.itemId]};
      if (nextCourse) {
        paragraph.title = "나도 몰랐던 한 가지";
        paragraph.text = imagined
          ? "첫날에 가 보고 싶은 골목을 골랐고 다음 러닝에도 새 코스를 고르고 싶다고 했어요. 두 번의 러닝을 떠올릴 때 공통으로 궁금했던 건 달릴 길이었어요."
          : "궁금했던 골목에 한번 가 보는 걸로 끝나지 않아요. 다음 러닝을 생각할 때도 새 코스를 찾아봐요.";
        paragraph.itemIds.unshift(earlier.itemId);
      }
      result.paragraphs.push(paragraph);
    }
    return result;
  }

  globalThis.RBReadingModel = {version:"reading-1", axes, scenes, cast, evaluate};
})();
