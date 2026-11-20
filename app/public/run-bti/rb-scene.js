/* The onscreen scene, screenshot view and exported PNG all use this compositor.
   Draw with art embedded in window.RBAssets, or load the same relative WebP files. */
(() => {
  'use strict';

  const W = 1080;
  const ink = '#161b35';
  const paper = '#f8f9fd';
  const font = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  const packs = {base: '내 러닝 성향', buddy: '함께 뛰는 나', record: '기록을 보는 나'};
  const active = new WeakMap();
  const images = new Map();
  const light = [
    ['#c5d8c1', '#f0b479', '#7d966a'], ['#d3d8e7', '#e8a991', '#687e80'],
    ['#bbd9de', '#eed391', '#67969b'], ['#dbcba6', '#edb99d', '#a39c75'],
    ['#bec5c6', '#d9d4a4', '#628575'], ['#c8c3d9', '#e6a89c', '#767190']
  ];
  const effectKeys = ['lace', 'zip', 'steps', 'gravel', 'grass', 'splash', 'watch', 'camera',
    'paper', 'bottle', 'bell', 'leaf', 'wood', 'breath', 'tap', 'turn', 'stamp', 'reveal'];
  const ambientKeys = ['river', 'park', 'street', 'rain', 'track', 'night'];
  const labels = {
    pose: ['대표 자세', '달리는 순간', '마지막 장면'],
    background: ['새벽 하천', '붉은 노을', '동네 골목', '비 갠 공원', '운동장 트랙', '여름 나무길',
      '강변 다리', '겨울 산책로', '봄 벚꽃길', '가을 은행길', '바닷가', '달빛 천변'],
    frame: ['트랙 라인', '우표', '모서리 테이프', '노을 리본', '점선 코스', '사진 필름', '별자리', '물결', '바람결'],
    expression: ['웃음', '후련함', '집중', '반가움', '놀람', '졸림', '민망함', '뿌듯함', '두근거림',
      '먹먹함', '개운함', '평온함', '신남', '멍함', '궁금함', '힘듦', '수줍음', '감탄'],
    prop: ['손목시계', '종이 지도', '무선 이어폰', '러닝 캡', '투명 물병', '휴대폰', '빵 봉투', '메달', '손수건',
      '카메라', '헤드밴드', '러닝 벨트', '선글라스', '보온병', '바나나', '배번호', '에너지 젤', '손전등',
      '주황색 안전 고깔', '나침반', '접은 우비', '법랑 머그', '운동화 키링', '시리얼 바', '만보기', '비니', '러닝 장갑',
      '돌돌 만 수건', '헤드폰', '압화 수첩', '방수 파우치', '자전거 벨', '초시계', '카세트 플레이어', '바람막이',
      '벚꽃 가지', '테이크아웃 커피 두 잔', '호루라기', '연두색 신발끈', '하트 반사 배지', '초대장', '우정 팔찌',
      '손목 밴드', '기록 노트와 연필', '코스 엽서', '가을 낙엽', '즉석 사진', '잉크 도장'],
    effect: ['끈 묶기', '지퍼', '두 걸음', '자갈', '잔디', '물웅덩이', '워치', '셔터',
      '봉투', '물병', '자전거 벨', '나뭇잎', '나무 데크', '숨 고르기', '가볍게 누르기', '넘기기', '도장', '발견'],
    ambient: ['강변', '공원', '골목', '가랑비', '트랙', '밤길']
  };

  const bounded = (n, max, fallback = 0) => Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
  const two = n => String(n).padStart(2, '0');
  const clean = v => typeof v === 'string' ? v.trim() : '';
  const ease = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
  const actions = {
    snap:   {pattern: /셔터|사진|카메라/, fx: 'camera', dx: 7, tilt: -.035, dip: .03},
    glance: {pattern: /노을|풍경|하늘|골목|샛길|꽃|바다/, fx: 'leaf', dx: -16, tilt: -.06, dip: .015},
    watch:  {pattern: /시계|기록|거리|페이스|워치|km/i, fx: 'watch', dx: 6, tilt: .035, dip: .055},
    listen: {pattern: /노래|소리|목소리|음악|귀|듣/, fx: 'bell', dx: -7, tilt: -.085, dip: .015},
    wave:   {pattern: /인사|친구|함께|나란히|손 흔|반가/, fx: 'grass', dx: -22, tilt: .065, dip: .045},
    lace:   {pattern: /운동화|신발|끈|출발/, fx: 'lace', dx: 3, tilt: .085, dip: .16},
    stop:   {pattern: /멈|정지|걷/, fx: 'steps', dx: -56, tilt: -.04, dip: .055},
    breathe:{pattern: /숨|호흡|기분|쉬/, fx: 'breath', dx: 0, tilt: .017, dip: .06}
  };
  function selectAction(m) {
    if (Object.hasOwn(actions, m.action)) return m.action;
    const clue = [m.evidence, m.name, m.line].filter(v => typeof v === 'string').join(' ');
    return Object.keys(actions).find(key => actions[key].pattern.test(clue)) || 'breathe';
  }

  function normalize(m = {}) {
    return {
      charIndex: bounded(m.charIndex, 44, -1), pose: bounded(m.pose, 2),
      prop: bounded(m.prop, 47), background: bounded(m.background, 11),
      expression: bounded(m.expression, 17), frame: bounded(m.frame, 8),
      mode: m.mode === 'imagine' ? 'imagine' : 'experience',
      pack: Object.hasOwn(packs, m.pack) ? m.pack : 'base',
      name: clean(m.name) || '내 러닝 장면', line: clean(m.line),
      evidence: m.includeEvidence ? clean(m.evidence) : '',
      evidenceArt: m.includeEvidence && /^art\/o-(?:0\d|1\d|20)-[0-2]\.webp$/.test(m.evidenceArt)
        ? m.evidenceArt : null, action: selectAction(m)
    };
  }

  function assetURL(path) {
    const entries = window.RBAssets || {};
    const entry = entries[path] || entries['./' + path] || entries[path.replace(/^art\//, '')];
    return (typeof entry === 'string' ? entry : entry?.url || entry?.src) || path;
  }

  function load(path) {
    if (!path) return Promise.resolve(null);
    const href = assetURL(path);
    if (images.has(href)) {
      const cached = images.get(href);
      images.delete(href); images.set(href, cached);
      return cached;
    }
    const pending = new Promise(resolve => {
      const img = new Image();
      let finished = false;
      let timeout;
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        img.onload = img.onerror = null;
        if (!value) setTimeout(() => images.delete(href), 5000);
        resolve(value);
      };
      img.decoding = 'async';
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      timeout = setTimeout(() => finish(null), 7000);
      img.src = href;
    });
    images.set(href, pending);
    if (images.size > 32) images.delete(images.keys().next().value);
    return pending;
  }

  async function materials(m, animate) {
    const files = [
      'art/bg-' + two(m.background) + '.webp',
      m.charIndex < 0 ? null : 'art/runner-' + two(m.charIndex) + '-' + m.pose + '.webp',
      'art/prop-' + two(m.prop) + '.webp', 'art/face-' + two(m.expression) + '.webp',
      'art/frame-' + two(m.frame) + '.webp', 'art/fx-' + two((m.background + m.pose * 4) % 16) + '.webp',
      animate && m.charIndex >= 0 ? 'art/runner-' + two(m.charIndex) + '-' + (m.pose === 1 ? 0 : 1) + '.webp' : null,
      m.evidenceArt, m.charIndex >= 0 ? 'art/portrait-' + two(m.charIndex) + '.webp' : null
    ];
    const [bg, runner, prop, face, frame, fx, approach, evidenceArt, portrait] = await Promise.all(files.map(load));
    return {bg, runner, prop, face, frame, fx, approach, evidenceArt, portrait};
  }

  function layout(ratio, model) {
    const story = ratio === '9:16';
    const h = story ? 1920 : 1350;
    const room = model && !model.includeEvidence && !model.evidenceArt && !model.evidence;
    const shortCaption = model && clean(model.line).length < 37 && clean(model.name).length < 16;
    let extra = 0;
    if (room) extra = clean(model.line).length > 72 ? 54 : (story ? 150 : 112);
    else if (shortCaption) extra = story ? 90 : 62;
    const x = 44, y = story ? 192 : 114, w = W - x * 2, ah = (story ? 932 : 692) + extra;
    return {h, x, y, w, ah, story, header: story ? 144 : 76, bottom: story ? 1734 : 1290};
  }

  function hotspots(ratio = '4:5', model) {
    const {x, y, w, ah, h} = layout(ratio, model ? normalize(model) : null);
    return [['runner', .54, .50], ['prop', .79, .74], ['place', .83, .23]]
      .map(([id, u, v]) => ({id, x: (x + w * u) / W, y: (y + ah * v) / h}));
  }

  function borderPath(ctx, x, y, w, h, radius = 24) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawCover(ctx, image, x, y, w, h) {
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale, sh = h / scale;
    ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }

  function drawInside(ctx, image, x, y, w, h) {
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  function paperScene(ctx, x, y, w, h, idx) {
    const p = light[idx % light.length];
    const wash = ctx.createLinearGradient(x, y, x + w * .12, y + h);
    wash.addColorStop(0, p[0]); wash.addColorStop(.67, '#f2e8cc'); wash.addColorStop(1, p[2]);
    ctx.fillStyle = wash; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = p[1]; ctx.beginPath();
    ctx.arc(x + w * .77, y + h * .25, h * .117, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ridge = y + h * (.63 + i * .1);
      ctx.fillStyle = i === 1 ? '#e9d5ad' : p[2];
      ctx.globalAlpha = .58 + i * .17;
      ctx.beginPath(); ctx.moveTo(x, ridge);
      ctx.bezierCurveTo(x + w * .28, ridge - h * (.24 - i * .06), x + w * .6, ridge + h * .12, x + w, ridge - h * .06);
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function noRunner(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 200, size / 200);
    ctx.fillStyle = '#eee3bc'; ctx.strokeStyle = '#314b3c'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-62, 15); ctx.lineTo(-49, -21); ctx.lineTo(-31, -15);
    ctx.quadraticCurveTo(-14, 0, -1, -18); ctx.lineTo(19, 2);
    ctx.quadraticCurveTo(38, 22, 61, 23); ctx.quadraticCurveTo(78, 26, 74, 39);
    ctx.quadraticCurveTo(19, 47, -65, 33); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-64, 25); ctx.quadraticCurveTo(5, 41, 73, 32); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-19 + i * 10, -3 + i * 6); ctx.lineTo(-8 + i * 10, -10 + i * 6); ctx.stroke();
    }
    ctx.restore();
  }

  function portraitWindow(ctx, image, x, y, w, h) {
    const cut = Math.min(23, w * .08);
    const panel = () => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0);
      ctx.lineTo(w - cut, h); ctx.lineTo(0, h); ctx.closePath();
    };
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.translate(5, 7); panel(); ctx.fillStyle = 'rgba(18,22,50,.65)'; ctx.fill(); ctx.restore();
    ctx.save(); panel(); ctx.clip();
    const backdrop = ctx.createLinearGradient(0, h, w, 0);
    backdrop.addColorStop(0, '#adb9ef'); backdrop.addColorStop(.57, '#f2e8ff'); backdrop.addColorStop(1, '#d5edff');
    ctx.fillStyle = backdrop; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#888fc0'; ctx.beginPath(); ctx.moveTo(0, h * .72); ctx.lineTo(w * .18, h);
    ctx.lineTo(0, h); ctx.fill();
    // The production portrait is cropped from the very same runner sheet shown on the right.
    drawInside(ctx, image, (w - h * 1.05) / 2, -h * .025, h * 1.05, h * 1.05);
    ctx.restore(); panel(); ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  }

  function art(ctx, m, a, l, progress) {
    const {x, y, w, ah} = l;
    const arrive = ease(progress / .62);
    const touch = ease((progress - .16) / .52);
    const settle = ease((progress - .45) / .45);
    ctx.save(); borderPath(ctx, x, y, w, ah, 7); ctx.clip();
    if (a.bg) drawCover(ctx, a.bg, x, y, w, ah);
    else paperScene(ctx, x, y, w, ah, m.background);
    if (a.fx) {
      ctx.save(); ctx.globalAlpha = .25 + settle * .21;
      drawInside(ctx, a.fx, x + w * .53, y + ah * .055, w * .41, ah * .46); ctx.restore();
    }
    if (a.frame) ctx.drawImage(a.frame, x, y, w, ah);
    const size = Math.min(ah * .975, w * .89);
    const foot = y + ah * .958, cx = x + w * .535, act = actions[m.action];
    const beat = progress < .78 ? Math.sin(Math.PI * progress / .78) : 0;
    if (a.runner) {
      ctx.save();
      ctx.translate(cx + (1 - arrive) * act.dx, foot); ctx.rotate(beat * act.tilt);
      ctx.scale(1 + beat * act.dip * .17, 1 - beat * act.dip);
      const transition = a.approach ? ease((progress - .26) / .26) : 1;
      if (a.approach && transition < 1) {
        ctx.globalAlpha = (.65 + .35 * arrive) * (1 - transition);
        drawInside(ctx, a.approach, -size / 2, -size, size, size);
      }
      ctx.globalAlpha = transition;
      drawInside(ctx, a.runner, -size / 2, -size, size, size);
      ctx.restore();
    } else noRunner(ctx, cx, y + ah * .64, size * .87);
    const obj = Math.min(ah * .29, 217);
    if (a.prop) {
      ctx.save(); ctx.translate(x + w * .795, y + ah * .745 + (1 - touch) * 14);
      ctx.rotate(-.045 - (1 - touch) * .08); ctx.globalAlpha = .4 + .6 * touch;
      ctx.shadowColor = 'rgba(49,43,29,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
      drawInside(ctx, a.prop, -obj / 2, -obj / 2, obj, obj); ctx.restore();
    }
    const insetX = x + w * .049, insetY = y + ah * .072;
    const panelW = w * .285, panelH = Math.min(ah * .38, panelW * .89);
    if (a.portrait) {
      ctx.save(); ctx.globalAlpha = .5 + .5 * settle;
      portraitWindow(ctx, a.portrait, insetX, insetY, panelW, panelH); ctx.restore();
    }
    if (a.face) {
      const f = 56, chipX = insetX, chipY = insetY + (a.portrait ? panelH + 14 : 0);
      ctx.save(); ctx.globalAlpha = settle;
      setFont(ctx, 27, 780);
      const label = labels.expression[m.expression], chipW = f + ctx.measureText(label).width + 25;
      borderPath(ctx, chipX, chipY, chipW, f, 7);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.stroke();
      drawInside(ctx, a.face, chipX + 3, chipY + 3, f - 6, f - 6);
      ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, chipX + f + 6, chipY + f * .52);
      ctx.restore();
    }
    if (beat > 0 && ['snap', 'watch', 'listen', 'wave'].includes(m.action)) {
      const focus = m.action === 'watch' ? [.795, .745] : m.action === 'snap' ? [.8, .25] : [.54, .38];
      ctx.save(); ctx.translate(x + w * focus[0], y + ah * focus[1]); ctx.globalAlpha = beat * .56;
      ctx.strokeStyle = '#fffbea'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const r = 19 + (1 - beat) * 16 + i * 13;
        ctx.beginPath(); ctx.arc(0, 0, r, -.94, .58); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 3;
    borderPath(ctx, x + 1.5, y + 1.5, w - 3, ah - 3, 6); ctx.stroke(); ctx.restore();
  }

  const setFont = (ctx, size, weight = 600) => { ctx.font = weight + ' ' + size + 'px ' + font; };
  function cutLines(ctx, text, maxW) {
    const out = [];
    for (const para of text.split(/\r?\n/)) {
      let line = '';
      for (const word of para.trim().split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (ctx.measureText(candidate).width <= maxW) { line = candidate; continue; }
        if (line) { out.push(line); line = ''; }
        for (const char of Array.from(word)) {
          if (line && ctx.measureText(line + char).width > maxW) { out.push(line); line = ''; }
          line += char;
        }
      }
      out.push(line);
    }
    return out;
  }

  function fitted(ctx, text, width, maxRows, initial, min, weight) {
    let size = initial, lines;
    for (;;) {
      setFont(ctx, size, weight); lines = cutLines(ctx, text, width);
      if (lines.length <= maxRows || size === min) break;
      size = Math.max(min, size - 2);
    }
    if (lines.length > maxRows) {
      lines = lines.slice(0, maxRows);
      let tail = lines[maxRows - 1].trimEnd();
      while (tail && ctx.measureText(tail + '…').width > width) tail = Array.from(tail).slice(0, -1).join('');
      lines[maxRows - 1] = tail + '…';
    }
    return {size, lines};
  }

  function textBlock(ctx, text, {x, y, width, maxRows, size, min, weight, leading = 1.25}) {
    const block = fitted(ctx, text, width, maxRows, size, min, weight);
    const height = block.size * leading;
    for (const line of block.lines) { ctx.fillText(line, x, y); y += height; }
    return y;
  }

  function caption(ctx, text, x, y, width, available, initialSize) {
    const leading = 1.25;
    let rows, size = initialSize;
    for (; size >= 27; size -= 2) {
      setFont(ctx, size, 600); rows = cutLines(ctx, text, width);
      if (rows.length * size * leading <= available) {
        for (const row of rows) { ctx.fillText(row, x, y); y += size * leading; }
        return;
      }
    }
    // A pasted series of line breaks may not fit even at reading size on the card.
    // Flatten those breaks before abbreviating; the accessible label retains the source text.
    const compact = text.replace(/\s+/g, ' ');
    const maxRows = Math.max(1, Math.floor(available / (27 * leading)));
    textBlock(ctx, compact, {x, y, width, maxRows, size: 27, min: 27, weight: 600, leading});
  }

  function nameplate(ctx, title, x, y, width, story) {
    const inset = 22;
    const {size, lines} = fitted(ctx, title, width - inset * 2, 2, story ? 82 : 75, 51, 900);
    const rowStep = size * 1.18;
    const boxW = Math.min(width, Math.max(...lines.map(line => ctx.measureText(line).width)) + inset * 2);
    const boxH = rowStep * lines.length + 20;
    ctx.fillStyle = '#272641'; ctx.fillRect(x + 7, y + 7, boxW, boxH);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = '#171a32'; ctx.lineWidth = 4; ctx.strokeRect(x, y, boxW, boxH);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#161a30';
    lines.forEach((line, i) => ctx.fillText(line, x + inset, y + 10 + rowStep * (i + .52)));
    return y + boxH;
  }

  function render(ctx, m, a, l, progress, pixels) {
    const scale = pixels / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, l.h); ctx.fillStyle = paper; ctx.fillRect(0, 0, W, l.h);
    ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '900 46px "Arial Black", Arial, sans-serif'; ctx.fillText('RUN·BTI', 58, l.header);
    setFont(ctx, 32, 650); ctx.textAlign = 'right';
    ctx.fillText(packs[m.pack] + (m.mode === 'imagine' ? ' · 첫 러닝을 상상하며' : ''), W - 58, l.header);
    ctx.textAlign = 'left';
    art(ctx, m, a, l, progress);
    ctx.save(); ctx.globalAlpha = .38 + .62 * ease((progress - .42) / .52);
    const x = 64, width = W - x * 2;
    let y = nameplate(ctx, m.name, x, l.y + l.ah - 14, width, l.story);
    y += l.story ? 38 : 33;
    ctx.textBaseline = 'top'; ctx.fillStyle = '#323648';
    const withEvidence = Boolean(m.evidence || m.evidenceArt);
    if (m.line) {
      const available = Math.max(100, l.bottom - y - (withEvidence ? 145 : 0));
      caption(ctx, m.line, x, y, width, available, l.story ? 55 : 49);
    }
    if (withEvidence) {
      const by = l.bottom - 112;
      ctx.fillStyle = '#a6a5be';
      ctx.fillRect(Math.round(x * scale) / scale, Math.round((by - 17) * scale) / scale,
        Math.round(width * scale) / scale, Math.max(1, Math.round(2 * scale)) / scale);
      let inset = 0;
      if (a.evidenceArt) {
        ctx.save(); borderPath(ctx, x, by, 122, 112, 14); ctx.clip();
        ctx.fillStyle = '#e4e5f8'; ctx.fillRect(x, by, 122, 112);
        drawInside(ctx, a.evidenceArt, x, by, 122, 112); ctx.restore();
        inset = 145;
      }
      ctx.fillStyle = '#38405b';
      textBlock(ctx, '내가 고른 장면' + (m.evidence ? '  ·  ' + m.evidence : ''),
        {x: x + inset, y: by + 3, width: width - inset, maxRows: 3, size: 34, min: 27, weight: 600});
    }
    ctx.restore();
  }

  function setup(canvas, ratio, opts, model) {
    const l = layout(ratio, model);
    const pixels = Number.isFinite(opts.width) ? Math.max(260, Math.min(1440, Math.round(opts.width))) : 864;
    const height = Math.round(pixels * l.h / W);
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.aspectRatio = W + ' / ' + l.h;
    // Use the same rasterizer for the visible illustration and detached PNG canvas.
    // GPU-backed previews can otherwise differ in small Korean strokes and sticker shadows.
    const ctx = canvas.getContext('2d', {willReadFrequently: true, alpha: false});
    if (!ctx) throw new Error('이미지를 표시할 수 없어요.');
    return {l, pixels, ctx};
  }

  function skip(canvas) {
    active.get(canvas)?.finish?.();
  }

  async function paint(canvas, model, ratio, opts, animate) {
    skip(canvas);
    const ticket = {}; active.set(canvas, ticket);
    const m = normalize(model);
    const placeholder = !canvas.dataset.rbPainted || canvas.dataset.rbPainted !== ratio;
    const {ctx, l, pixels} = setup(canvas, ratio, opts, m);
    canvas.setAttribute('aria-label', [m.name, m.line, m.evidence].filter(Boolean).join(' · '));
    if (placeholder) render(ctx, m, {}, l, 1, pixels);
    canvas.dataset.rbPainted = ratio;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let skipped = false;
    ticket.finish = () => {
      skipped = true;
      if (active.get(canvas) === ticket) render(ctx, m, {}, l, 1, pixels);
    };
    const a = await materials(m, animate && !reduced);
    if (active.get(canvas) !== ticket) return;
    const show = p => render(ctx, m, a, l, p, pixels);
    if (!animate || reduced || skipped || document.hidden) {
      show(1); active.delete(canvas); return;
    }
    await new Promise(resolve => {
      let frame, timer, lastFrame = -Infinity;
      let done = false;
      const start = performance.now();
      ticket.finish = () => {
        if (done) return;
        done = true; cancelAnimationFrame(frame); clearTimeout(timer);
        document.removeEventListener('visibilitychange', afterVisibility);
        if (active.get(canvas) === ticket) { show(1); active.delete(canvas); }
        resolve();
      };
      const afterVisibility = () => { if (document.hidden) ticket.finish(); };
      const tick = now => {
        if (done) return;
        const p = Math.min(1, (now - start) / 1850);
        if (p >= 1) { ticket.finish(); return; }
        if (now - lastFrame >= 1000 / 30) { show(p); lastFrame = now; }
        frame = requestAnimationFrame(tick);
      };
      document.addEventListener('visibilitychange', afterVisibility);
      timer = setTimeout(ticket.finish, 2400);
      audio.ambient([0,0,2,3,4,1,0,1,1,1,0,5][m.background]);
      audio.effect(actions[m.action].fx);
      tick(start);
    });
  }

  const draw = (canvas, model, ratio = '4:5', opts = {}) => paint(canvas, model, ratio, opts, false);
  const motion = (canvas, model, ratio = '4:5', opts = {}) => paint(canvas, model, ratio, opts, true);

  async function blob(model, ratio = '4:5') {
    const canvas = document.createElement('canvas');
    await draw(canvas, model, ratio, {width: W});
    return new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지를 저장하지 못했어요. 캡처 화면을 열어 주세요.')), 'image/png');
    });
  }

  async function download(model, ratio = '4:5') {
    const file = await blob(model, ratio);
    const href = URL.createObjectURL(file), link = document.createElement('a');
    const filename = '런비티아이-' + ((clean(model.name) || '내-러닝').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 45)) + '-' + (ratio === '9:16' ? '스토리' : '카드') + '.png';
    try {
      link.href = href; link.download = filename; document.body.append(link); link.click();
    } finally {
      link.remove(); setTimeout(() => URL.revokeObjectURL(href), 30000);
    }
    return {width: W, height: layout(ratio).h, filename};
  }

  /* Local Web Audio foley. Each event is one short sound gesture. The mixer allows
     one active event over one continuous location and starts only after opt-in. */
  let ac, master, opted = false, foreground, bed;
  const buffers = new Map();
  function audioHost() {
    if (!ac) {
      const Host = window.AudioContext || window.webkitAudioContext;
      if (!Host) return null;
      ac = new Host(); master = ac.createGain(); master.gain.value = .45; master.connect(ac.destination);
    }
    return ac;
  }
  function halt(track) {
    if (!track) return;
    track.gain.disconnect();
    for (const node of track.nodes) { try { node.stop(); } catch {} node.disconnect(); }
    if (track.timer) clearTimeout(track.timer);
  }
  function stop() { halt(foreground); halt(bed); foreground = bed = null; }
  function setSound(on) {
    if (!on) {
      opted = false; stop(); if (ac?.state === 'running') ac.suspend().catch(() => {}); return false;
    }
    try {
      if (!audioHost()) return false;
      opted = true;
      if (ac.state === 'suspended') ac.resume().catch(() => { opted = false; stop(); });
    } catch { opted = false; }
    return opted;
  }
  function noise(seconds = 1) {
    if (buffers.has(seconds)) return buffers.get(seconds);
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate), data = b.getChannelData(0);
    let state = 0x5f3759df + seconds;
    for (let i = 0; i < data.length; i++) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      data[i] = (state / 0xffffffff) * 2 - 1;
    }
    buffers.set(seconds, b); return b;
  }
  function track() {
    const gain = ac.createGain(); gain.connect(master); return {gain, nodes: []};
  }
  function voice(t, kind, delay, dur, frequency, finishHz, strength, q) {
    const start = ac.currentTime + .005 + delay;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(strength, start + Math.min(.024, dur * .18));
    gain.gain.exponentialRampToValueAtTime(.0001, start + dur); gain.connect(t.gain);
    let s, filter;
    if (kind === 'noise') {
      s = ac.createBufferSource(); s.buffer = noise(); s.loop = true;
      filter = ac.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = q || .9;
      filter.frequency.setValueAtTime(frequency, start); filter.frequency.exponentialRampToValueAtTime(finishHz, start + dur);
      s.connect(filter); filter.connect(gain);
    } else {
      s = ac.createOscillator(); s.type = kind;
      s.frequency.setValueAtTime(frequency, start); s.frequency.exponentialRampToValueAtTime(finishHz, start + dur);
      s.connect(gain);
    }
    s.onended = () => {
      s.disconnect(); filter?.disconnect(); gain.disconnect();
      const i = t.nodes.indexOf(s);
      if (i >= 0) t.nodes.splice(i, 1);
    };
    s.start(start); s.stop(start + dur + .01); t.nodes.push(s);
  }
  const foley = {
    lace: [['noise',0,.16,2400,700,.23],['noise',.17,.12,3300,1500,.16]],
    zip: [['noise',0,.31,900,4100,.23,1.8]],
    steps: [['noise',0,.12,350,80,.55],['noise',.20,.15,500,86,.45]],
    gravel: [['noise',0,.16,1800,420,.42],['noise',.12,.16,1200,2600,.22]],
    grass: [['noise',0,.19,980,390,.28],['noise',.20,.15,1360,580,.23]],
    splash: [['noise',0,.26,540,2800,.36],['sine',.05,.11,540,210,.13]],
    watch: [['sine',0,.07,1090,930,.17],['sine',.09,.05,1360,1170,.12]],
    camera: [['noise',0,.045,3300,960,.45],['noise',.087,.06,1800,600,.32]],
    paper: [['noise',0,.1,2900,1400,.23],['noise',.09,.12,1550,3100,.18],['noise',.21,.09,2500,1000,.23]],
    bottle: [['sine',0,.17,680,590,.21],['noise',.115,.13,570,1000,.13]],
    bell: [['sine',0,.40,1460,1440,.13],['sine',0,.23,2270,2170,.055]],
    leaf: [['noise',0,.36,3800,1280,.14]],
    wood: [['triangle',0,.12,255,96,.30],['noise',.01,.05,700,240,.28]],
    breath: [['noise',0,.48,670,340,.17]],
    tap: [['sine',0,.075,630,360,.17]],
    turn: [['noise',0,.18,800,2680,.18],['noise',.10,.14,2300,730,.14]],
    stamp: [['triangle',0,.12,132,62,.27],['noise',0,.11,1100,210,.35]],
    reveal: [['sine',0,.25,392,392,.13],['sine',.13,.29,523,523,.10],['sine',.29,.48,659,659,.095]]
  };
  function effect(key = 'tap') {
    if (!opted || !ac || document.hidden) return;
    const score = foley[effectKeys.includes(key) ? key : effectKeys[bounded(key, 17, 14)]];
    halt(foreground); const t = track(); foreground = t;
    for (const note of score) voice(t, ...note);
    t.timer = setTimeout(() => { if (foreground === t) { halt(t); foreground = null; } }, 1000);
  }
  const weather = [[670,.42,.085],[1370,.75,.055],[280,.57,.084],[2100,.61,.088],[415,.95,.055],[3300,1.2,.046]];
  const distantSounds = [
    [['noise',0,.6,820,320,.62],['sine',.2,.11,740,450,.26]],
    [['sine',0,.075,2240,3090,.39],['sine',.13,.13,2670,1830,.29]],
    [['noise',0,.65,180,90,.83],['sine',.52,.21,1230,1170,.15]],
    [['noise',0,.08,2140,540,.78],['sine',.23,.08,1540,560,.28],['noise',.34,.06,1890,630,.65]],
    [['noise',0,.12,390,90,.85],['noise',.26,.11,310,85,.71]],
    [['sine',0,.055,3400,3560,.19],['sine',.08,.055,3420,3550,.16],['sine',.16,.07,3420,3480,.14]]
  ];
  function ambient(key = 'river') {
    if (!opted || !ac || document.hidden) return;
    const index = ambientKeys.includes(key) ? ambientKeys.indexOf(key) : bounded(key, 5);
    if (bed?.index === index) return;
    halt(bed); const t = track(); bed = t; t.index = index;
    const [freq, q, strength] = weather[index];
    const source = ac.createBufferSource(); source.buffer = noise(5); source.loop = true;
    const shade = ac.createBiquadFilter(); shade.type = 'bandpass'; shade.frequency.value = freq; shade.Q.value = q;
    const lfo = ac.createOscillator(), amount = ac.createGain();
    lfo.frequency.value = .08 + index * .019; amount.gain.value = freq * .16;
    lfo.connect(amount); amount.connect(shade.frequency);
    source.connect(shade); shade.connect(t.gain);
    t.gain.gain.setValueAtTime(.0001, ac.currentTime); t.gain.gain.linearRampToValueAtTime(strength, ac.currentTime + .24);
    lfo.start(); source.start(); t.nodes.push(source, lfo);
    let phrase = 0;
    const repeat = () => {
      if (bed !== t || !opted || document.hidden) return;
      for (const note of distantSounds[index]) voice(t, ...note);
      phrase++;
      t.timer = setTimeout(repeat, 2300 + ((phrase * 641 + index * 379) % 2600));
    };
    t.timer = setTimeout(repeat, 630 + 97 * index);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  const audio = {enabled: () => opted, set: setSound, effect, ambient, stop};
  window.RBScene = {draw, motion, skip, blob, download, hotspots, labels, effectKeys, ambientKeys, audio,
    actions: Object.keys(actions)};
})();
