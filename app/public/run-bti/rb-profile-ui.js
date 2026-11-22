// Show what the person chose when both alternatives were available.
window.RBProfileUI = (() => {
  "use strict";

  function countLine(profile) {
    return `검사 ${profile.quizCount}개 · 직접 고른 이야기 ${profile.storyCount}편`;
  }

  function summary(profile, {esc}) {
    if (!profile || (!profile.quizCount && !profile.storyCount && !profile.motiveComparison)) return "";
    const direction = profile.direction;
    return `<section class="panel rb-profile-summary"><p class="rb-profile-meta">내가 고른 러닝 장면 · ${countLine(profile)}</p>
      <h2>${esc(direction.title)}</h2><p>${esc(direction.reason)}</p>
      ${window.RBRepresentative.html(profile, {esc}, true)}
      ${profile.posting && direction !== profile.posting ? `<p class="rb-post-summary"><b>러닝 인증</b> ${esc(profile.posting.title)}</p>` : ""}
      <button type="button" class="btn light sm" data-story-act="profile">내가 고른 장면 자세히 보기</button></section>`;
  }

  function citation(e, esc) {
    const caption = e.choiceId ? e.title : [e.mode === "imagine" ? "첫 러닝 상상" : "", e.title, e.scene].filter(Boolean).join(" · ");
    return `<li><span>${esc(caption)}</span><p>${esc(e.answer)}${e.rating ? ` <small>· ${esc(e.rating)}</small>` : ""}</p>${e.specific === false ? "<small>모든 보기에 들어 있는 행동이라 방향을 가를 때는 제외했어요.</small>" : ""}</li>`;
  }

  function choiceBar(label, n, total, kind, occasions, esc) {
    const bar = `<span class="rb-bar-heading"><span>${esc(label)}</span><b>${n}번</b></span>
      <span class="rb-compare-track" aria-hidden="true"><i class="rb-compare-${kind}" style="width:${100*n/total}%"></i></span>`;
    if (!n || !occasions?.length) return `<li class="rb-bar-static">${bar}</li>`;
    const proof = occasions.map(picks => {
      // One choice may describe several behaviors, but was still one answer to one scene.
      const answers = [...new Map(picks.map(e => [e.answer,e])).values()];
      if (!answers.length) return "";
      return citation({...answers[0],answer:answers.map(e=>e.answer).join(" / ")},esc);
    }).join("");
    return `<li><details class="rb-bar-detail"><summary aria-label="${esc(label)} ${n}번 · 내가 고른 답 보기">${bar}</summary>
      <ul class="rb-profile-evidence">${proof}</ul></details></li>`;
  }

  function storyImpact(profile, esc) {
    if (!profile.storyCount) return "";
    const traces = profile.rows.map(row => ({row, proof:row.storyEvidence.filter(e => e.specific)}))
      .filter(trace => trace.proof.length);
    const current = profile.direction;
    const before = profile.baseline;
    let finding = "이야기에서 직접 고른 답을 모았어요.";
    let shift = "";
    if (before) {
      const same = before.status === current.status && before.signals.length === current.signals.length &&
        before.signals.every(id => current.signals.includes(id));
      finding = same ? "이야기 답을 더해도 검사에서 나온 성향의 방향은 같아요." : "이야기 답을 더하면서 결과가 달라졌어요.";
      if (!same) {
        const verdict = dir => {
          const labels = dir.signals.map(id => profile.rows.find(r => r.signal === id)?.label).filter(Boolean).join(" · ");
          return esc(dir.title) + (labels && labels !== dir.title ? `<br><small>${esc(labels)}</small>` : "");
        };
        shift = `<dl class="rb-story-shift"><dt>검사 답만 봤을 때</dt><dd>${verdict(before)}</dd>
          <dt>이야기까지 더했을 때</dt><dd>${verdict(current)}</dd></dl>`;
      }
    }
    const detail = ({row,proof}) => {
      const quiz = row.quizEvidence.length;
      const where = quiz ? `검사 문항 ${quiz}개와 이야기 ${proof.length}편에서 골랐어요.` : `이야기 ${proof.length}편에서 골랐어요.`;
      return `<li><b>${esc(row.label)}</b><small>${where}</small><p>${esc(proof[0].title)} · “${esc(proof[0].answer)}”</p></li>`;
    };
    return `<section class="panel"><h2>이야기에서 더 알게 된 점</h2><p>${esc(finding)}</p>${shift}
      ${traces.length ? `<ul class="rb-story-proof">${traces.slice(0,2).map(detail).join("")}</ul>
      ${traces.length > 2 ? `<details class="rb-more-comparisons"><summary>이야기에서 고른 다른 행동 ${traces.length-2}개</summary><ul class="rb-story-proof">${traces.slice(2).map(detail).join("")}</ul></details>` : ""}` :
        "<p>고른 결말에는 다른 보기와 구별되는 행동이 없어서 대표 성향에 더하지 않았어요.</p>"}</section>`;
  }

  function comparison(c, esc) {
    const options = [
      [c.leftLabel + "만", c.leftOnly, "left"],
      [c.rightLabel + "만", c.rightOnly, "right"],
    ];
    if (c.both) options.push(["둘 다 담은 답", c.both, "both"]);
    if (c.other) options.push(["다른 답", c.other, "other"]);
    const breakdown = options.map(([label,n,kind]) => choiceBar(label,n,c.total,kind,c.answersBySide?.[kind],esc)).join("");
    const finding = c.winner ? `이 장면들에서는 ‘${c.winner === c.left ? c.leftLabel : c.rightLabel}’ 쪽을 더 자주 골랐어요.`
      : c.status === "sparse" ? "비교할 장면이 한 개라서 이번 선택만 보여 드려요."
      : c.both === c.total ? "매번 두 행동을 함께 골랐어요."
      : c.other === c.total ? "이 장면에서는 매번 다른 답을 골랐어요."
      : c.leftOnly === c.rightOnly ? "한쪽만 고른 횟수가 같아요."
      : "답이 나뉘어 어느 한쪽을 자주 골랐다고 보기는 어려워요.";
    return `<div class="rb-comparison"><h3>${esc(c.topic)}</h3><p>${esc(finding)}</p>
      <p class="rb-profile-meta">두 행동이 각각 보기에 나온 장면 ${c.total}개 · 검사 문항 ${c.quizCount}개 · 이야기 ${c.storyCount}편</p>
      <ul class="rb-compare-bars">${breakdown}</ul></div>`;
  }

  function report(profile, {esc}) {
    const heading = '<h1>내가 고른 러닝 장면</h1>';
    const rows = profile?.rows || [];
    if (!rows.length && !profile?.motiveComparison && !profile?.direction?.evidence?.length) return `<article class="rb-profile-report">${heading}
      <p>${esc(profile?.direction?.reason || "아직 성향을 설명할 답이 없어요.")}</p>
      <div class="actions"><button class="btn primary" data-act="start-exp">러닝 성향 테스트하기</button>
      <button class="btn light" data-story-act="shelf">러닝 이야기 고르기</button></div></article>`;
    const direction = profile.direction;
    const comparisons = (profile.comparisons || []).filter(c => c.total > 0);
    const shown = comparisons.slice(0, 2);
    const remaining = comparisons.slice(2);
    const motives = profile.motiveComparison;
    const posting = profile.posting;
    const mainIsPosting = posting && direction === posting;
    const postSection = posting ? `<section class="panel rb-posting" data-post-status="${esc(posting.status)}">
      <h2>러닝 인증에서 고른 것</h2>${mainIsPosting ? "" : `<p><strong>${esc(posting.title)}</strong></p><p>${esc(posting.reason)}</p>`}
      <p class="rb-profile-meta">네 가지 보기가 함께 나온 ${posting.total}개 장면에서 고른 답이에요. 막대를 누르면 그때 고른 답을 볼 수 있어요.</p>
      <ul class="rb-compare-bars rb-post-bars">${posting.counts.map(c => choiceBar(c.label,c.count,posting.total,"left",posting.evidence.filter(e=>e.signal===c.signal).map(e=>[e]),esc)).join("")}</ul>
      ${mainIsPosting ? "" : window.RBRepresentative.html({...profile,direction:posting},{esc})}</section>` : "";
    const detail = rows.map(row => {
      const proof = [...row.storyEvidence, ...row.quizEvidence];
      return `<details class="rb-profile-signal"><summary><b>${esc(row.label)}</b><small>답 ${proof.length}개</small></summary>
        <ul class="rb-profile-evidence">${proof.map(e => citation(e, esc)).join("")}</ul></details>`;
    }).join("");
    const imagined = rows.some(row => row.quizEvidence.some(e => e.mode === "imagine"));
    return `<article class="rb-profile-report"><header>${heading}<p class="rb-profile-meta">${countLine(profile)}${imagined ? "<br>첫 러닝을 상상하며 고른 답도 들어 있어요." : ""}</p></header>
      <section class="panel rb-verdict" data-direction-status="${esc(direction.status)}"><h2>${esc(direction.title)}</h2><p>${esc(direction.reason)}</p>
        ${window.RBRepresentative.html(profile, {esc})}</section>
      ${postSection}
      ${storyImpact(profile, esc)}
      ${shown.length ? `<section class="panel"><h2>두 행동을 고를 수 있었을 때</h2><p class="rb-profile-meta">막대를 누르면 어느 장면에서 고른 답인지 볼 수 있어요.</p>
        ${shown.map(c => comparison(c, esc)).join("")}${remaining.length ? `<details class="rb-more-comparisons"><summary>다른 비교 ${remaining.length}개 보기</summary>${remaining.map(c=>comparison(c,esc)).join("")}</details>` : ""}</section>` : ""}
      ${motives ? `<section class="panel"><h2>${esc(motives.title)}</h2><p>${esc(motives.reason)}</p>
        <ul class="rb-motive-means">${motives.rated.map(m=>`<li><span>${esc(m.name)}</span><b>${Number(m.mean).toFixed(1)} / 3점</b></li>`).join("")}</ul></section>` : ""}
      ${detail ? `<section class="panel"><h2>내가 고른 답 다시 보기</h2>${detail}</section>` : ""}
      <details class="panel rb-profile-method"><summary>결과를 낸 방법</summary>
        <p>이 브라우저에서 내가 고른 행동을 비교했어요. 한 이야기에서는 마지막으로 남긴 답 한 개를 써요. 결말에서 답을 바꾸거나 뺄 수 있어요.</p>
        <p>두 행동이 각각 보기에 나온 장면끼리 비교해요. 한쪽만 고른 횟수가 다른 쪽보다 두 번 이상 많고 전체 비교 장면의 절반을 넘으면 그쪽을 자주 골랐다고 표시해요. 둘 다 고른 장면은 따로 세요.</p>
        <p>달리는 이유는 내가 표시한 0~3점으로 살펴봐요. 같은 동기에 관한 두 문항에 모두 답했을 때 그 평균을 비교해요. 캐릭터 그림은 내가 고른 행동을 보여 주는 예시예요.</p>
        <p>문항의 주제에는 러닝 동기 연구를 참고했어요. 런비티아이 결과가 실제 러닝 습관을 얼마나 잘 설명하는지는 아직 검증 전이에요. <a href="https://pubmed.ncbi.nlm.nih.gov/8341836/" target="_blank" rel="noopener noreferrer">러닝 동기 연구 원문</a></p></details></article>`;
  }
  return {summary, report};
})();
