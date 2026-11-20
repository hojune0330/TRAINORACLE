// Original Korean self-reflection items. The response summaries describe this run,
// not population norms. Source domains and editorial extensions are documented separately.
(() => {
  "use strict";

  const motives = {
    enjoyment: {
      name: "취미로 달리는 재미", line: "쉬는 날이면 또 뛰고 싶어. 달리는 시간이 재밌거든.",
      imagineLine: "쉬는 날 뭐 하지? 강바람 맞으면서 뛰는 것도 재밌을 것 같아.",
      action: "기분 좋게 달릴 수 있을 것 같은 길을 하나 골라 보세요.", art: "art/o-03-0.webp",
    },
    routine: {
      name: "내 생활 리듬", line: "늘 뛰던 시간에 동네 한 바퀴 돌면 하루가 제자리를 찾는 느낌이야.",
      imagineLine: "저녁 먹기 전에 동네 한 바퀴 도는 시간을 만들어 볼래.",
      action: "다음에 나가기 편한 날을 달력에 표시해 보세요.", art: "art/life-afterwork.webp",
    },
    reset: {
      name: "머리 식히기", line: "자꾸 그 생각이 날 땐 바람 좀 쐬고 와야겠어.",
      action: "바깥 공기를 쐬고 싶은 곳을 떠올려 보세요.", art: "art/o-08-0.webp",
    },
    health: {
      name: "건강과 체력", line: "오래 앉아 있었네. 오늘은 몸을 좀 움직이고 싶어.",
      imagineLine: "오래 앉아 있는 날도 많으니까 가볍게 달리면서 몸을 좀 움직여 볼래.",
      action: "오늘 밖에 나갈 때 신을 운동화를 꺼내 보세요.", art: "art/life-stairs.webp",
    },
    weight: {
      name: "체중 관리", line: "요즘 체중을 관리하고 싶어. 달리기도 내 방법 중 하나야.",
      imagineLine: "체중을 관리할 방법을 찾다가 달리기도 한번 해 보고 싶어졌어.",
      action: "다녀오면 오늘 움직인 시간을 한 줄 적어 보세요.", art: "art/o-17-1.webp",
    },
    training: {
      name: "훈련과 기술 연습", line: "오늘은 처음부터 끝까지 비슷한 속도로 갈 수 있을지 궁금해.",
      action: "이번에 연습해 보고 싶은 걸 하나 적어 보세요.", art: "art/life-practice.webp",
    },
    achievement: {
      name: "해냈다는 기분", line: "오늘은 저 다리까지. 내가 정한 데까지 가면 뿌듯할 것 같아.",
      action: "오늘 어디까지 다녀오면 뿌듯할지 골라 보세요.", art: "art/o-07-1.webp",
    },
    finish: {
      name: "내 속도로 완주", line: "오늘 정한 코스를 내 속도로 끝까지 가 보고 싶어.",
      action: "뛰어 보고 싶은 코스의 출발점과 도착점을 지도에서 찾아보세요.", art: "art/o-06-1.webp",
    },
    personalBest: {
      name: "내 최고 기록", line: "지난번이랑 같은 거리에서 내 기록에 한 번 더 도전해 볼래.",
      imagineLine: "첫 기록을 남겨 두면 다음엔 같은 거리를 얼마나 빨리 뛸지 궁금할 것 같아.",
      action: "다음에도 같은 거리에서 기록을 재고 싶은 코스를 골라 보세요.", art: "art/life-record.webp",
    },
    encouragement: {
      name: "응원과 동기부여", line: "나도 나갈까 망설일 때 친구가 보내 주는 한마디가 힘이 돼.",
      imagineLine: "첫날은 좀 망설여질 것 같아. 친구가 같이 해 보자고 하면 용기가 나겠어.",
      action: "나가기 망설여질 때 연락하고 싶은 사람을 떠올려 보세요.", art: "art/o-01-2.webp",
    },
    belonging: {
      name: "함께 뛰는 즐거움", line: "뛰면서 밀린 얘기 좀 하고 싶어. 같이 나갈래?",
      action: "함께 뛰고 싶은 사람에게 편한 날이 있는지 물어보세요.", art: "art/o-09-0.webp",
    },
    travel: {
      name: "여행지 구경", line: "이번 여행엔 운동화도 챙길래. 숙소 근처부터 뛰어서 돌아보고 싶어.",
      imagineLine: "여행 가면 숙소 근처 골목부터 뛰어 볼래. 뭐가 있을지 궁금해.",
      action: "여행지 지도에서 숙소를 나와 가 보고 싶은 길을 하나 찾아보세요.", art: "art/life-travel.webp",
    },
  };

  function item(id, motive, text, imagine) {
    return { id, motive, text, imagine };
  }

  const groups = [
    {
      id: "everyday", title: "평소에 뛰러 나갈 때", art: "art/life-afterwork.webp",
      context: "집에 와서 가방을 내려놨어요. 저녁 먹기까지 삼십 분쯤 남았고 운동화는 바로 옆에 있어요.",
      items: [
        item("free-afternoon", "enjoyment", "쉬는 날 뭐 할까 싶으면 재미 삼아 뛰러 나가.", "쉬는 날 즐길 취미로 달리기를 해 보고 싶어."),
        item("usual-hour", "routine", "늘 뛰던 시간이 되면 그때 한 바퀴 돌아야 하루가 익숙하게 흘러가.", "하루 중 나만의 러닝 시간을 정해 두고 싶어."),
        item("off-my-mind", "reset", "하루 종일 신경 쓰이던 일을 잠깐 잊고 싶어서 나가.", "자꾸 같은 생각이 들 때 바깥을 뛰면서 머리를 식히고 싶어."),
        item("looking-forward", "enjoyment", "뛰는 시간 자체가 즐거워서 다음에 뛸 날이 기다려져.", "바깥에서 내 발로 달리는 게 어떤 재미일지 궁금해."),
        item("next-week", "routine", "다음 주 일정을 짤 때 달릴 시간을 따로 빼 두고 싶어.", "한 주 일정을 짤 때 달리는 날도 넣어 보고 싶어."),
        item("clear-head", "reset", "뛰고 나면 머리가 좀 맑아져. 다음에 답답할 때도 그 생각에 나가.", "머리가 복잡했던 날에 조금이라도 개운해진다면 또 뛰러 나갈 것 같아."),
      ],
    },
    {
      id: "body", title: "운동을 고를 때", art: "art/life-stairs.webp",
      context: "계단 끝이 보여요. 남은 몇 칸을 마저 오르고 잠깐 서서 숨을 골라요.",
      items: [
        item("desk-day", "health", "오래 앉아 있던 날엔 몸을 좀 움직여 두고 싶어서 달려.", "오래 앉아 있는 날이 많아서 달리기로 몸을 좀 움직여 보고 싶어."),
        item("weight-goal", "weight", "체중을 줄이거나 지금처럼 유지하고 싶어서 달리기를 골랐어.", "체중을 줄이거나 지금처럼 유지하는 데 도움이 되면 달리기를 해 보고 싶어."),
        item("daily-stamina", "health", "평소 계단을 오를 때 숨이 덜 차면 좋겠다는 생각에 뛰어.", "계단을 오를 때 숨이 덜 차도록 체력을 길러 보고 싶어."),
        item("weight-week", "weight", "체중을 관리하려고 마음먹은 주에는 달릴 시간도 따로 잡아.", "체중을 관리하기로 한다면 한 주 일정에 달리기도 넣고 싶어."),
      ],
    },
    {
      id: "practice", title: "오늘 뭘 해 볼지 정할 때", art: "art/life-practice.webp",
      context: "운동장 첫 바퀴를 돌아 주황색 고깔 옆을 지나요. 한 바퀴 더 돌 시간은 충분해요.",
      items: [
        item("practice-pace", "training", "속도 조절처럼 따로 연습해 보고 싶은 게 있어서 뛰러 나가.", "속도 조절처럼 하나씩 배워 가면서 달리는 게 끌려."),
        item("my-landmark", "achievement", "내가 정한 곳까지 다녀오면 뿌듯할 것 같아서 신발을 신어.", "내가 정한 곳까지 다녀왔다는 기분을 느껴 보고 싶어."),
        item("training-plan", "training", "짧게 뛰는 날과 길게 뛰는 날을 나눠 계획대로 연습해 보고 싶어.", "짧게 뛰는 날부터 차근차근 훈련 계획을 따라 해 보고 싶어."),
        item("kept-promise", "achievement", "뛰고 돌아와서 ‘오늘 나랑 한 약속은 지켰네’ 싶을 때 또 하고 싶어져.", "작게 정한 목표라도 내 힘으로 해냈다고 느끼면 또 나가고 싶을 것 같아."),
      ],
    },
    {
      id: "race", title: "완주와 기록을 떠올릴 때", art: "art/life-finish.webp",
      context: "운동장 흰 선이 다시 보여요. 한 바퀴를 마치고 걸음을 늦추면서 손목시계를 눌러요.",
      items: [
        item("finish-line", "finish", "혼자 뛰는 날에도 처음 정한 거리는 내 속도로 끝까지 가 보고 싶어.", "첫 목표는 공원 한 바퀴야. 내 속도로 끝까지 돌아보고 싶어."),
        item("previous-best", "personalBest", "같은 거리를 내 최고 기록보다 빨리 뛰어 보고 싶어서 시간을 재.", "같은 거리를 두 번 뛰면 지난 기록을 깨 보고 싶을 것 같아."),
        item("race-prep", "finish", "대회를 앞두고 연습할 때는 내 발로 결승선을 지나는 순간을 떠올려.", "뛰고 싶은 대회가 생기면 내 발로 결승선을 지나려고 연습하고 싶어."),
        item("another-attempt", "personalBest", "내 최고 기록에 몇 초 모자랐으면 다음에 한 번 더 도전하고 싶어.", "내 최고 기록을 아깝게 놓치면 같은 거리에서 다시 도전하고 싶을 것 같아."),
      ],
    },
    {
      id: "company", title: "누군가와 달리기 얘기를 할 때", art: "art/o-01-2.webp",
      context: "신발을 신을까 말까 하는데 친구한테 톡이 와요. “나 지금 강변인데 너도 나올래?”",
      items: [
        item("nudge", "encouragement", "뛸까 말까 망설이다 친구가 ‘나도 나왔어’ 하면 운동화를 신게 돼.", "나가기 망설여질 때 친구가 ‘나도 나왔어’ 하면 나도 한번 뛰어 볼 것 같아."),
        item("catch-up", "belonging", "친구랑 밀린 얘기를 나누며 보내는 시간이 좋아서 같이 뛰어.", "친구랑 밀린 얘기 나눌 겸 같이 뛰어 보고 싶어."),
        item("cheer", "encouragement", "뛰고 왔다고 했을 때 누가 ‘잘 다녀왔네’ 해 주면 다음번에도 나가고 싶어져.", "처음 뛰고 왔다고 했을 때 누가 ‘잘 다녀왔네’ 해 주면 또 나가고 싶을 것 같아."),
        item("familiar-faces", "belonging", "러닝 모임에서 얼굴 아는 사람들을 다시 만나는 게 반가워서 나가.", "같은 길에서 뛰는 사람들과 안면을 트는 재미도 있을 것 같아."),
      ],
    },
    {
      id: "away", title: "여행 가방을 쌀 때", art: "art/life-travel.webp",
      context: "내일 아침엔 여행 일정을 조금 비워 뒀어요. 가방 한쪽에 운동화 한 켤레 들어갈 자리가 남았네요.",
      items: [
        item("pack-shoes", "travel", "여행 가방에 운동화를 넣는 건 숙소 근처 골목을 뛰어서 구경하고 싶어서야.", "여행지에서 숙소 근처 골목을 구경하며 처음 뛰어 보는 것도 끌려."),
        item("new-town", "travel", "여행 중 빈 시간이 나면 가 보지 않은 곳을 뛰어서 둘러보는 게 재밌어.", "낯선 도시에서 아침 시간이 비면 달리면서 동네를 돌아보고 싶어."),
      ],
    },
  ];

  const scale = [
    { value: 0, label: "전혀 아니야" }, { value: 1, label: "조금 그래" },
    { value: 2, label: "꽤 그래" }, { value: 3, label: "정말 그래" },
  ];

  function score(answers = {}) {
    const totals = Object.fromEntries(Object.keys(motives).map(id => [id, { total: 0, count: 0 }]));
    const coverage = { answered: 0, na: 0, unsure: 0, skipped: 0, unanswered: 0 };
    for (const group of groups) {
      for (const question of group.items) {
        const value = answers?.[question.id];
        if (Number.isInteger(value) && value >= 0 && value <= 3) {
          totals[question.motive].count++;
          totals[question.motive].total += value;
          coverage.answered++;
        } else if (value === "na" || value === "unsure") {
          coverage[value]++;
        } else if (value === "skip") {
          coverage.skipped++;
        } else {
          coverage.unanswered++;
        }
      }
    }
    const profiles = Object.entries(totals).map(([id, { total, count }]) => ({
      id, name: motives[id].name, total, count, mean: count ? total / count : null,
      status: ["empty", "single", "complete"][count],
    }));
    // The two matching scenes need clear endorsement on average. A tie stays a tie.
    const supported = profiles.filter(p => p.status === "complete" && p.mean >= 2);
    const highest = Math.max(0, ...supported.map(p => p.mean));
    const leaders = supported.filter(p => p.mean === highest).map(p => p.id);
    const singles = profiles.filter(p => p.status === "single" && p.mean >= 2).map(p => p.id);
    return { profiles, leaders, singles, coverage };
  }

  window.RBMotives = { title: "나는 왜 달릴까?", groups, motives, scale, score };
})();
