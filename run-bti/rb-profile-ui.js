// The report uses the same local evidence as the result summary. It never reads a shared card.
window.RBProfileUI = (() => {
  "use strict";

  function countLine(profile) {
    return `검사 ${profile.quizCount}개 · 직접 고른 이야기 ${profile.storyCount}편`;
  }

  function summary(profile, {esc}) {
    if (!profile || (!profile.quizCount && !profile.storyCount)) return "";
    const first = profile.rows[0];
    const heading = first ? first.label : "내가 고른 장면";
    return `<section class="panel rb-profile-summary"><p class="rb-profile-meta">${countLine(profile)}</p>
      <h2>${esc(heading)}</h2>${first ? `<p>${esc(first.description)}</p>` : ""}
      <button type="button" class="btn light sm" data-story-act="profile">내 러닝 성향 보기</button></section>`;
  }

  // Only juxtapose genuinely different decisions about a related part of running.
  const comparisons = [
    ["plan", "adjust", "미리 정하고 싶을 때와 바꾸고 싶을 때"],
    ["goal", "body", "정한 곳까지 가고 싶은 날과 몸부터 살피는 날"],
    ["numbers", "scenery", "기록이 궁금할 때와 풍경에 눈이 갈 때"],
    ["numbers", "photo", "숫자를 확인할 때와 사진을 남길 때"],
    ["numbers", "reflect", "숫자로 남길 때와 한마디로 남길 때"],
    ["explore", "route", "새 길이 궁금할 때와 아는 길을 다시 볼 때"],
    ["conversation", "pace", "이야기를 나눌 때와 발을 맞출 때"],
    ["plan", "explore", "계획을 세울 때와 새 길이 궁금할 때"],
  ];

  function contrast(rows) {
    const indexed = new Map(rows.map(row => [row.signal, row]));
    for (const [a, b, title] of comparisons) {
      const left = indexed.get(a), right = indexed.get(b);
      if (!left || !right) continue;
      // Include a story, and use separate situations rather than two tags on the same decision.
      const pairs = [
        [left.storyEvidence, right.quizEvidence], [left.quizEvidence, right.storyEvidence],
        [left.storyEvidence, right.storyEvidence],
      ];
      for (const [l, r] of pairs) {
        for (const x of l) {
          const y = r.find(item => item.id !== x.id);
          if (y) return {title, pair: [x, y]};
        }
      }
    }
    return null;
  }

  function citation(e, esc) {
    const caption = e.choiceId ? e.title : [e.mode === "imagine" ? "첫 러닝 상상" : "", e.title, e.scene].filter(Boolean).join(" · ");
    return `<li><span>${esc(caption)}</span><p>${esc(e.answer)}${e.rating ? ` <small>· ${esc(e.rating)}</small>` : ""}</p></li>`;
  }

  function report(profile, {esc}) {
    const rows = profile?.rows || [];
    const heading = '<h1>내 러닝 성향</h1>';
    if (!rows.length) return `<article class="rb-profile-report">${heading}<p>검사에서 마음에 드는 답을 고르거나 이야기에서 내 결말을 골라 보세요. 어떤 선택을 했는지 여기에서 함께 볼 수 있어요.</p></article>`;
    const totals = r => r.quizEvidence.length + r.storyEvidence.length;
    const top = rows.slice(0, 4);
    const peak = Math.max(...top.map(totals));
    const chart = top.map(row => {
      const q = row.quizEvidence.length, s = row.storyEvidence.length;
      return `<li><div><b>${esc(row.label)}</b><small>검사 답 ${q}개 · 이야기 ${s}편</small></div>
        <div class="rb-profile-track" aria-hidden="true"><i style="width:${100*q/peak}%"></i><i style="width:${100*s/peak}%"></i></div></li>`;
    }).join("");
    const pair = contrast(rows);
    const extra = profile.quizCount && rows.find(row => row.relation === "story"
      && !pair?.pair.some(e => row.storyEvidence.includes(e)));
    const detail = rows.map((row, i) => {
      const proof = [...row.storyEvidence, ...row.quizEvidence];
      return `<details class="rb-profile-signal"${i===0 ? " open" : ""}><summary><b>${esc(row.label)}</b><small>답 ${proof.length}개</small></summary>
        <p>${esc(row.description)}</p><ul class="rb-profile-evidence">${proof.map(e => citation(e, esc)).join("")}</ul></details>`;
    }).join("");
    return `<article class="rb-profile-report"><header>${heading}<p class="rb-profile-meta">${countLine(profile)}</p></header>
      <section class="panel"><h2>내 답에서 보이는 모습</h2><p>${esc(rows[0].description)}</p>
        <ul class="rb-profile-chart">${chart}</ul><p class="rb-profile-key"><i></i>검사에서 고른 답 <i></i>이야기에서 고른 답</p>
        <p class="rb-profile-help">막대는 그 행동을 고른 횟수예요. 한 답에 두 행동이 담길 수도 있어요.</p></section>
      ${pair ? `<section class="panel"><h2>${esc(pair.title)}</h2><ul class="rb-profile-evidence rb-profile-pair">${pair.pair.map(e=>citation(e,esc)).join("")}</ul></section>` : ""}
      ${extra ? `<section class="panel"><h2>이야기에서 더 알게 된 점</h2><p>${esc(extra.description)}</p><ul class="rb-profile-evidence">${citation(extra.storyEvidence[0],esc)}</ul></section>` : ""}
      <section class="panel"><h2>어떤 답에서 나왔을까?</h2>${detail}</section>
      <p class="rb-profile-help">이 브라우저에 전에 남긴 답도 함께 봐요. 같은 이야기에서는 마지막에 고른 답 한 개만 담아요. 결말에서 답을 바꾸거나 성향에서 뺄 수 있어요.</p></article>`;
  }
  return {summary, report};
})();
