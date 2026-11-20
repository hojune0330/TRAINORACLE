// A character illustrates a selected action. Its appearance never contributes to scoring.
window.RBRepresentative = (() => {
  "use strict";
  const packOffsets = {base:0, buddy:9, record:15};
  const roles = {
    explore:["샛길이 궁금한 러너", "o-00-0", "처음 보는 골목 쪽으로 고개를 돌린 모습이에요."],
    route:["지도를 펴는 러너", "runner-07-2", "지도를 펼쳐 길을 짚는 모습을 담았어요."],
    scenery:["풍경 앞에 멈추는 러너", "o-05-0", "걸음을 멈추고 하늘을 바라보는 모습이에요."],
    body:["몸의 느낌을 살피는 러너", "o-05-1", "잠깐 멈춰 숨을 고르는 모습을 담았어요."],
    numbers:["기록부터 보는 러너", "runner-15-0", "손목을 들어 시계를 확인하는 모습이에요."],
    plan:["미리 정해 두는 러너"],
    reset:["뛰고 나면 한결 가벼워지는 러너", "o-08-0", "달리기를 마치고 한숨 돌리는 모습을 담았어요."],
    reflect:["오늘을 기억하는 러너"],
    photo:["한 컷 남기는 러너", "runner-36-2", "휴대폰을 가로로 들고 사진을 찍는 모습이에요."],
    company:["같이 나서는 러너", "o-09-1", "두 사람이 나란히 달리는 모습을 담았어요."],
    conversation:["러닝 얘기를 나누는 친구"],
    encouragement:["응원을 주고받는 러너"],
    pace:["내 속도를 찾는 러너", "life-practice", "트랙을 따라 달리는 러너의 발걸음을 담았어요."],
    routine:["달릴 시간을 챙기는 러너"],
    goal:["정한 곳까지 가 보는 러너"],
    finish:["정한 코스를 마치는 러너", "life-finish", "트랙에서 달린 뒤 시계를 확인하는 모습이에요."],
    travel:["여행지도 내 발로 둘러보는 러너"],
    movement:["틈나면 몸을 움직이는 러너", "life-stairs", "일상에서 몸을 움직이는 예로 계단을 오르는 모습을 담았어요."],
    enjoyment:["달리는 시간이 기다려지는 러너"],
    adjust:["그날 사정에 맞춰 뛰는 러너"],
    solo:["혼자 뛸 시간을 챙기는 러너"],
    privacy:["누구와 나눌지 정하는 러너"],
    compare:["직접 비교해 보는 러너"],
    verify:["원문을 확인하는 러너", "runner-17-0", "휴대폰 화면을 들여다보는 모습을 담았어요."],
    log:["출발할 때 기록을 켜는 러너", "runner-17-0", "출발할 때 꺼낸 휴대폰을 그림에 담았어요."],
    pause:["가던 길에 잠시 멈추는 러너"],
    stamina:["계단에서 덜 숨차고 싶은 러너", "life-stairs", "평소 체력을 느끼는 장소로 계단을 담았어요."],
    weight:["달리는 이유로 체중 관리를 고른 나"],
  };
  // An episode cover is usable only for an ending it actually depicts.
  const sign = ["피켓을 든 응원 친구", "story-cheer", "멀리서도 친구가 볼 수 있게 피켓을 펼친 모습이에요."];
  const endings = {
    "seoul-cheer/nickname":sign,
    "seoul-cheer/snap":roles.photo,
    "watch-silent/friends-photo":roles.photo,
    "watch-silent/mobile":roles.log,
    "bib-night/cheer-sign":sign,
    "seoul-cheer/at-the-end":["간식을 챙기는 응원 친구", "prop-06", "피니시에서 친구에게 건넬 간식을 봉투로 표현했어요."],
    "bib-night/race-kit":["내일 입을 옷을 찍어 두는 러너", "runner-36-2", "무엇을 찍을지 고른 답에서 사진 찍는 동작을 가져왔어요."],
    "postcard-run/sunset":["풍경 사진을 남기는 러너", "o-17-0", "물가에서 휴대폰을 들고 풍경을 찍는 모습이에요."],
    "photo-permission/shadows":["그림자만 찍어 나누는 러너", "o-14-2", "얼굴 대신 나란히 선 두 사람의 그림자를 담았어요."],
    "photo-permission/private":["사진을 우리끼리 간직하는 러너"],
    "photo-permission/words":["오늘 일을 글로 남기는 러너", "o-17-2", "노트에 직접 한 줄 적는 모습을 담았어요."],
    "missed-week/set-time":["달력에 뛸 날을 잡는 러너", "o-13-1", "달력을 펼쳐 다음에 뛸 날을 고르는 모습이에요."],
    "shoe-counter/width":["두 신발을 비교하는 러너", "story-shoes", "매장에서 두 신발을 나란히 놓고 살피는 모습이에요."],
    "shoe-counter/go-home":["내 신발을 다시 신어 보는 러너"],
    "pack-light/just-walk":["여행지에서 걸어 보는 러너"],
    "postcard-run/voice":["그날 들은 소리를 전하는 러너"],
    "finish-reunion/later":["먼저 쉬고 나중에 통화하는 러너"],
    "watch-silent/landmark":["다리를 반환점으로 삼는 러너", "o-00-1", "다리를 앞에 두고 지도를 펼친 모습이에요."],
    "pack-light/pack-shoes":["여행 가방에 운동화를 챙기는 러너", "life-travel", "여행 가방을 펴고 짐을 챙기는 모습이에요."],
    "motive/pack-shoes":["여행 가방에 운동화를 챙기는 러너", "life-travel", "여행 가방을 펴고 짐을 챙기는 모습이에요."],
    "motive/new-town":["숙소 근처부터 둘러보는 러너", "o-00-0", "낯선 골목을 돌아보는 모습을 담았어요."],
    "motive/next-week":["달력에 뛸 날을 잡는 러너", "o-13-1", "달력에서 다음에 뛸 날을 고르는 모습이에요."],
    "motive/my-landmark":["반환점을 정하고 나서는 러너", "o-00-1", "반환점으로 삼을 다리를 그림에 담았어요."],
    "motive/previous-best":["지난 기록을 다시 보는 러너", "life-record", "휴대폰에서 달린 기록을 살피는 모습을 담았어요."],
  };
  function endingArt(story, choice) {
    const role = endings[story.id + "/" + choice.id];
    return role?.[1] ? {art:"art/" + role[1] + ".webp", alt:role[2]} : null;
  }

  function selectedQuizArt(e) {
    if (!Object.hasOwn(packOffsets, e.id) || !Number.isInteger(e.itemId)) return null;
    const question = window.RB.packs[e.id].questions[e.itemId];
    if (!question) return null;
    for (const chat of [false, true]) {
      const i = window.RB.answerOptions(question, e.mode, chat).indexOf(e.answer);
      if (i < 0) continue;
      const q = packOffsets[e.id] + e.itemId;
      return ["o-" + String(q).padStart(2, "0") + "-" + i, window.RB.actionCaptions[q][i]];
    }
    return null;
  }

  function illustrate(signal, evidence, label) {
    const specificRole = e => endings[e.id + "/" + (e.choiceId || e.itemId)];
    const special = evidence.find(e => e.choiceId && specificRole(e)) || evidence.find(e => specificRole(e));
    const e = special || evidence.find(item => item.choiceId) || evidence[0];
    if (!e) return null;
    const role = roles[signal] || [label || "내가 고른 행동"];
    const [sceneName, file, caption] = specificRole(e) || role;
    const distinct = evidence.filter(other => e.id !== other.id || e.itemId !== other.itemId);
    const moreEvidence = distinct.find(other => Boolean(e.choiceId) !== Boolean(other.choiceId)) || distinct[0];
    const name = moreEvidence && specificRole(moreEvidence)?.[0] !== sceneName ? role[0] : sceneName;
    const quiz = selectedQuizArt(e);
    const art = quiz?.[0] || file;
    const description = quiz ? quiz[1] : caption || "";
    return {signal, name, art:art ? "art/" + art + ".webp" : "", caption:description,
      alt:description, evidence:e, moreEvidence};
  }

  function select(profile) {
    const direction = profile.direction;
    const panels = [];
    for (const signal of new Set(direction.signals)) {
      const evidence = direction.evidence.filter(e => e.signal === signal);
      const panel = illustrate(signal, evidence, profile.rows.find(r => r.signal === signal)?.label);
      if (!panel) continue;
      // A single ending may describe two actions. Its identical drawing and quote belong together.
      if (!panels.some(p => p.name === panel.name && p.art === panel.art && p.evidence.id === panel.evidence.id &&
        p.evidence.choiceId === panel.evidence.choiceId && p.evidence.itemId === panel.evidence.itemId)) panels.push(panel);
    }
    return {status:direction.status, title:direction.title, reason:direction.reason, panels};
  }

  const source = e => e.choiceId ? e.title : [e.mode === "imagine" ? "첫 러닝 상상" : "", e.title, e.scene].filter(Boolean).join(" · ");
  const url = path => window.RBScene.assetURL(path);
  function panelHeading(rep) {
    if (rep.status === "sparse") return "이번에 고른 장면";
    if (rep.status === "repeated") return "여러 번 고른 행동";
    return rep.panels.length === 1 ? "내 답을 담은 캐릭터" : "내 답에 함께 나온 모습";
  }
  function html(profile, {esc}, compact = false) {
    const rep = select(profile);
    if (!rep.panels.length) return "";
    const proof = e => `<small>${esc(source(e))}${e.rating ? " · " + esc(e.rating) : ""}</small><p>“${esc(e.answer)}”</p>`;
    const frame = p => `<figure class="rb-rep-frame" data-rep-signal="${esc(p.signal)}">
      ${p.art ? `<img loading="lazy" src="${esc(url(p.art))}" alt="${esc(p.alt)}">` : ""}
      <figcaption><b>${esc(p.name)}</b>${p.art && !compact ? `<p>${esc(p.caption)}</p>` : ""}
      ${proof(p.evidence)}${p.moreEvidence && !compact ? proof(p.moreEvidence) : ""}</figcaption></figure>`;
    // Large profiles keep all represented directions visible by name in the compact summary.
    if (compact && rep.panels.length > 2) return `<div class="rb-rep rb-rep-compact"><strong>${esc(panelHeading(rep))}</strong><p>${rep.panels.map(p => esc(p.name)).join(" · ")}</p></div>`;
    return `<div class="rb-rep${compact ? " rb-rep-compact" : ""}"><h3>${esc(panelHeading(rep))}</h3>
      <div class="rb-rep-frames">${rep.panels.map(frame).join("")}</div>
      ${compact ? "" : `<label class="rb-rep-proof"><input type="checkbox" data-rep-proof> 저장할 이미지에 내가 고른 답도 넣기</label>
      <div class="actions"><button type="button" class="btn light sm" data-story-act="save-representative">성향 이미지 저장</button><button type="button" class="btn light sm" data-story-act="share-representative">이미지로 공유</button></div>`}</div>`;
  }
  function exportReason(rep) {
    if (rep.status === "clear" || rep.status === "tied" || rep.status === "mixed" || rep.status === "repeated") return rep.reason;
    return "이번에 고른 장면을 담았어요. 아직 어떤 행동을 더 자주 고르는지는 알기 어려워요.";
  }

  async function imageFile(profile, includeAnswers) {
    const rep = select(profile);
    if (!rep.panels.length) throw new Error("먼저 장면을 골라 주세요.");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const W = 960, margin = 52, gap = 24, columnCount = rep.panels.length === 1 ? 1 : 2;
    const cellWidth = (W - 2 * margin - gap * (columnCount - 1)) / columnCount;
    function lines(text, pixels, weight, width) {
      ctx.font = weight + " " + pixels + 'px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
      const output = [];
      let line = "";
      for (const char of text) {
        if (line && ctx.measureText(line + char).width > width) {
          output.push(line.trimEnd()); line = "";
        }
        line += char;
      }
      if (line.trim()) output.push(line.trim());
      return output;
    }
    const title = lines(rep.title, 46, 750, W - 2 * margin);
    const reason = lines(exportReason(rep), 25, 450, W - 2 * margin);
    const top = 142 + 62 * title.length + 39 * reason.length;
    const cells = await Promise.all(rep.panels.map(async p => {
      const img = p.art ? await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("그림을 불러오지 못했어요. 다시 시도해 주세요."));
        im.src = url(p.art);
      }) : null;
      const artH = img ? (columnCount === 1 ? 520 : 260) : 0;
      const w = cellWidth - 40;
      const name = lines(p.name, 29, 700, w);
      const caption = lines(p.caption, 23, 450, w);
      const quote = includeAnswers ? lines("“" + p.evidence.answer + "”", 24, 600, w) : [];
      const origin = includeAnswers ? lines(source(p.evidence), 20, 450, w) : [];
      const height = artH + name.length*39 + caption.length*33 + quote.length*35 + origin.length*29 + 52;
      return {img,artH,name,caption,quote,origin,height};
    }));
    let bottom = top;
    cells.forEach((cell, index) => {
      const col = index % columnCount;
      if (!col && index) bottom += Math.max(...cells.slice(index-columnCount,index).map(c => c.height)) + gap;
      cell.x = margin + col * (cellWidth + gap); cell.y = bottom;
    });
    const height = Math.max(...cells.map(c => c.y + c.height)) + 70;
    const scale = Math.min(1, 4096 / height);
    canvas.width = Math.round(W*scale); canvas.height = Math.ceil(height*scale);
    ctx.scale(scale, scale);
    ctx.textBaseline = "top"; ctx.fillStyle = "#f7f5f1"; ctx.fillRect(0,0,W,height);
    function write(rows, x, y, px, weight, ink, lineHeight) {
      ctx.fillStyle = ink; ctx.font = weight + " " + px + 'px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
      rows.forEach((text, i) => ctx.fillText(text,x,y+i*lineHeight));
      return y + rows.length*lineHeight;
    }
    write(["RUN·BTI   /   내 러닝 성향"],margin,44,24,700,"#974735",34);
    let y = write(title,margin,99,46,750,"#21273a",62);
    write(reason,margin,y+12,25,450,"#455068",39);
    for (const c of cells) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(c.x,c.y,cellWidth,c.height);
      if (c.img) {
        ctx.fillStyle = "#ede9df"; ctx.fillRect(c.x,c.y,cellWidth,c.artH);
        // Preserve gestures, hands and objects at the edges of the original composition.
        const factor = Math.min(cellWidth/c.img.naturalWidth,c.artH/c.img.naturalHeight);
        const w = c.img.naturalWidth*factor, h = c.img.naturalHeight*factor;
        ctx.drawImage(c.img, c.x+(cellWidth-w)/2, c.y+(c.artH-h)/2, w,h);
      }
      const left = c.x+20;
      y = write(c.name,left,c.y+c.artH+19,29,700,"#202536",39);
      y = write(c.caption,left,y+3,23,450,"#50596c",33);
      y = write(c.quote,left,y+6,24,600,"#202536",35);
      write(c.origin,left,y+3,20,450,"#596170",29);
    }
    write(["검사 " + profile.quizCount + "개 · 내가 고른 이야기 " + profile.storyCount + "편"],margin,height-46,20,450,"#515a67",30);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요.")), "image/png"));
    return new File([blob], "런비티아이-내-러닝-성향.png", {type:"image/png"});
  }

  async function send(profile, includeAnswers, share) {
    const file = await imageFile(profile, includeAnswers);
    if (share && navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file],title:"내 러닝 성향"});
      return "성향 이미지를 공유했어요.";
    }
    const link = document.createElement("a"), href = URL.createObjectURL(file);
    try {
      link.href = href; link.download = file.name; document.body.append(link); link.click();
    } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(href), 30000); }
    return share ? "공유할 성향 이미지를 저장했어요." : "성향 이미지를 저장했어요.";
  }
  return {select, html, endingArt, imageFile, send};
})();
