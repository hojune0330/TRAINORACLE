// LogEntry — 일지 작성. 3 진입점 분리: post-session / evening / race
// Variants: A. 진입점 선택 시트, B. 단일 폼 (저녁용 종합)

function LogEntry({ entryType = 'choose', variant = 'A', onBack, onDone }) {
  if (entryType === 'choose') return <EntryChooser variant={variant} onBack={onBack} onPick={onDone} />;
  if (entryType === 'post-session') return <PostSessionForm onBack={onBack} onDone={onDone} />;
  if (entryType === 'evening') return <EveningCheckin onBack={onBack} onDone={onDone} />;
  if (entryType === 'race') return <RaceForm onBack={onBack} onDone={onDone} />;
  return null;
}

// ───────── Chooser: 3 진입점 분리 ─────────
function EntryChooser({ onBack, onPick }) {
  const opts = [
    { id: 'post-session', t: '훈련 후', d: '방금 끝낸 세션 기록', meta: 'POST · ~1분', mark: '↻' },
    { id: 'evening', t: '하루 마무리', d: '수면·체중·감정·통증 체크', meta: 'EVENING · ~2분', mark: '☾' },
    { id: 'race', t: '경기 직전/직후', d: '기록·심박·감정', meta: 'RACE · ~30초', mark: '▲' },
  ];
  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar onBack={onBack}>새 일지</TopBar>
      <div style={{ padding: '20px 20px 4px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          2026·06·22 MON · 18:42
        </div>
        <h1 style={{ fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: '6px 0 0' }}>어떤 일지를 쓰세요?</h1>
      </div>

      <div style={{ marginTop: 18 }}>
        {opts.map((o, i) => (
          <button key={o.id} onClick={() => onPick(o.id)} style={{
            width: '100%', textAlign: 'left',
            padding: '18px 20px',
            background: 'var(--surface)',
            border: 0, borderTop: '1px solid var(--ink)',
            borderBottom: i === opts.length - 1 ? '1px solid var(--ink)' : 0,
            cursor: 'pointer',
            display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 14, alignItems: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--brand)',
              fontWeight: 500, lineHeight: 1,
            }}>{o.mark}</span>
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.005em' }}>{o.t}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 3 }}>{o.d}</div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>{o.meta}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 20px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', lineHeight: 1.55 }}>
          이미 오늘 일지가 있어요. 같은 날에 여러 진입점으로 쓰면 한 페이지에 합쳐집니다.
        </div>
      </div>
    </div>
  );
}

// ───────── Post-session form ─────────
function PostSessionForm({ onBack, onDone }) {
  const [rpe, setRpe] = React.useState(7);
  const [memo, setMemo] = React.useState('');
  const [system, setSystem] = React.useState('vo2');
  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>훈련 후 · 기록</TopBar>

      {/* Index card mini */}
      <div style={{ padding: '14px 20px 0' }}>
        <IndexCard date="2026·06·22" dow="MON · 18:42" cycleDay="C7 · D-6" />
      </div>

      {/* Energy system picker */}
      <FormSec lb="강도 시스템">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'base', c: 'BA', n: 'BASE', color: '#4A8FC7' },
            { id: 'lt',   c: 'LT', n: 'LT',   color: '#B8A024' },
            { id: 'vo2',  c: 'V2', n: 'VO2',  color: '#C7761C' },
            { id: 'gly',  c: 'GL', n: 'GLY',  color: '#B8332E' },
            { id: 'atp',  c: 'AP', n: 'ATP',  color: '#7A3FB5' },
            { id: 'rest', c: 'RE', n: 'REST', color: '#7A7A70' },
          ].map(s => (
            <button key={s.id} onClick={() => setSystem(s.id)} style={{
              padding: '8px 12px', background: 'var(--surface)',
              border: system === s.id ? `1.5px solid ${s.color}` : '1px solid var(--line)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              borderRadius: 0,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }}></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{s.c}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{s.n}</span>
            </button>
          ))}
        </div>
      </FormSec>

      {/* Title */}
      <FormSec lb="세션 제목">
        <input type="text" defaultValue="6 × 1000m @ 3'20&quot;" style={inputStyle()} />
      </FormSec>

      {/* Meta row */}
      <FormSec lb="거리 · 시간 · 평균 페이스">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input type="text" defaultValue="10.4" style={{ ...inputStyle(), fontFamily: 'var(--mono)', textAlign: 'right' }} />
          <input type="text" defaultValue="62" style={{ ...inputStyle(), fontFamily: 'var(--mono)', textAlign: 'right' }} />
          <input type="text" defaultValue="3'24" style={{ ...inputStyle(), fontFamily: 'var(--mono)', textAlign: 'right' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          <span>km</span><span>min</span><span>/km</span>
        </div>
      </FormSec>

      {/* RPE */}
      <FormSec lb={`RPE · 주관 강도 (${rpe}/10)`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 0, border: '1px solid var(--ink)' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setRpe(n)} style={{
              padding: '12px 0', border: 0, cursor: 'pointer',
              background: rpe === n ? 'var(--ink)' : 'transparent',
              color: rpe === n ? 'var(--bg)' : 'var(--ink)',
              fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500,
              borderRight: n < 10 ? '1px solid var(--line)' : 0,
            }}>{n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          <span>매우 쉬움</span><span>최대</span>
        </div>
      </FormSec>

      {/* Memo + handwritten preview */}
      <FormSec lb="메모 · 손글씨처럼">
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="오늘 어땠는지 한 줄이라도..."
          rows={4}
          className="paper-grid"
          style={{
            ...inputStyle(), fontFamily: '"Caveat", "Gowun Dodum", cursive',
            fontSize: 18, lineHeight: 1.4, color: 'var(--ink-blue)',
            padding: '12px 14px', resize: 'none',
          }}
        />
      </FormSec>

      {/* Photo attachment row */}
      <FormSec lb="사진 · 시계 · 노트">
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, aspectRatio: '1', border: '1px dashed var(--line-2)',
              background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--ink-4)',
              cursor: 'pointer',
            }}>+</div>
          ))}
        </div>
      </FormSec>

      {/* Voice memo */}
      <FormSec lb="음성 메모">
        <button style={{
          width: '100%', padding: '14px',
          background: 'var(--surface)', border: '1px solid var(--line)',
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderRadius: 0,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--err)' }}></span>
          녹음 · 30초 자동 변환
        </button>
      </FormSec>

      {/* Sticky save */}
      <StickyBar onSave={() => onDone?.('post-session')} secondary="저녁에 마저 쓰기" />
    </div>
  );
}

// ───────── Evening checkin ─────────
function EveningCheckin({ onBack, onDone }) {
  const [sleep, setSleep] = React.useState(7.5);
  const [quality, setQuality] = React.useState(4);
  const [mood, setMood] = React.useState(3);
  const [painParts, setPainParts] = React.useState({ rKnee: 2 });
  const [weight, setWeight] = React.useState(53.7);
  const [hr, setHr] = React.useState(48);

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>저녁 체크인</TopBar>

      <div style={{ padding: '14px 20px 0' }}>
        <IndexCard date="2026·06·22" dow="MON · 22:15" cycleDay="C7 · D-6" />
      </div>

      <FormSec lb={`수면 · ${sleep}h`}>
        <input type="range" min="4" max="12" step="0.5" value={sleep}
          onChange={e => setSleep(parseFloat(e.target.value))}
          style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 4 }}>
          <span>4h</span><span>8h</span><span>12h</span>
        </div>
      </FormSec>

      <FormSec lb="수면 질">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: '1px solid var(--ink)' }}>
          {['최악', '나쁨', '보통', '좋음', '최고'].map((l, i) => (
            <button key={i} onClick={() => setQuality(i + 1)} style={{
              padding: '10px 0', border: 0,
              background: quality === i + 1 ? 'var(--ink)' : 'transparent',
              color: quality === i + 1 ? 'var(--bg)' : 'var(--ink)',
              fontFamily: 'var(--mono)', fontSize: 10.5,
              borderRight: i < 4 ? '1px solid var(--line)' : 0,
              cursor: 'pointer', letterSpacing: '0.04em',
            }}>{l}</button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="체중 · 안정시 심박">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <input type="text" value={weight} onChange={e => setWeight(e.target.value)} style={{ ...inputStyle(), fontFamily: 'var(--mono)', textAlign: 'right' }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 4 }}>kg · 어제 53.9 <Delta value="-0.2" suffix="kg" invert /></div>
          </div>
          <div>
            <input type="text" value={hr} onChange={e => setHr(e.target.value)} style={{ ...inputStyle(), fontFamily: 'var(--mono)', textAlign: 'right' }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 4 }}>bpm · 14d avg 49 <Delta value="-1" suffix="bpm" invert /></div>
          </div>
        </div>
      </FormSec>

      {/* Body diagram */}
      <FormSec lb="통증 부위 · 정도 (탭하여 표시)">
        <BodyDiagram selected={painParts} onChange={setPainParts} />
      </FormSec>

      {/* Mood */}
      <FormSec lb="오늘 감정">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {['흐림', '무덤덤', '보통', '좋음', '최고'].map((l, i) => (
            <button key={i} onClick={() => setMood(i + 1)} style={{
              padding: '14px 4px 10px',
              background: mood === i + 1 ? 'var(--surface)' : 'transparent',
              border: mood === i + 1 ? '1px solid var(--ink)' : '1px solid var(--line)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              borderRadius: 0,
            }}>
              <MoodStrip level={i + 1} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: mood === i + 1 ? 'var(--ink)' : 'var(--ink-3)', letterSpacing: '0.06em' }}>{l}</span>
            </button>
          ))}
        </div>
      </FormSec>

      <FormSec lb="오늘의 한 줄">
        <textarea
          placeholder="자유롭게..."
          rows={3}
          className="paper-grid"
          style={{
            ...inputStyle(),
            fontFamily: '"Caveat", "Gowun Dodum", cursive',
            fontSize: 18, lineHeight: 1.4, color: 'var(--ink-blue)',
            resize: 'none',
          }}
        />
      </FormSec>

      <StickyBar onSave={() => onDone?.('evening')} />
    </div>
  );
}

// ───────── Race form ─────────
function RaceForm({ onBack, onDone }) {
  const [stage, setStage] = React.useState('pre');
  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar onBack={onBack}>경기 · 빠른 점검</TopBar>

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{
          border: '2px solid var(--ink-blue)', padding: '12px 14px',
          background: 'var(--paper)',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'baseline',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-blue)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>RACE DAY</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 500, marginTop: 4, color: 'var(--ink)' }}>전국체전 · 5000m</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>잠실 트랙 · 2026·06·22 19:30</div>
          </div>
          <Stamp kind="brand">D-0</Stamp>
        </div>
      </div>

      {/* Stage toggle */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--ink)' }}>
          {['pre', 'post'].map((s, i) => (
            <button key={s} onClick={() => setStage(s)} style={{
              padding: '12px 0',
              background: stage === s ? 'var(--ink)' : 'transparent',
              color: stage === s ? 'var(--bg)' : 'var(--ink-2)',
              border: 0, borderRight: i === 0 ? '1px solid var(--ink)' : 0,
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
            }}>{s === 'pre' ? '경기 직전' : '경기 직후'}</button>
          ))}
        </div>
      </div>

      {stage === 'pre' ? (
        <>
          <FormSec lb="긴장도 · 1-10">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', border: '1px solid var(--ink)' }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button key={n} style={{
                  padding: '12px 0', border: 0,
                  background: n === 7 ? 'var(--ink-blue)' : 'transparent',
                  color: n === 7 ? '#fff' : 'var(--ink)',
                  borderRight: n < 10 ? '1px solid var(--line)' : 0,
                  fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </FormSec>
          <FormSec lb="컨디션 자기 평가">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {['흐림', '무덤덤', '보통', '좋음', '최고'].map((l, i) => (
                <button key={i} style={{
                  padding: '14px 4px 10px',
                  background: i === 3 ? 'var(--surface)' : 'transparent',
                  border: i === 3 ? '1px solid var(--ink)' : '1px solid var(--line)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'pointer', borderRadius: 0,
                }}>
                  <MoodStrip level={i + 1} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>{l}</span>
                </button>
              ))}
            </div>
          </FormSec>
          <FormSec lb="목표 페이스 · 전략">
            <input type="text" defaultValue="3'12&quot;/km · negative split" style={{ ...inputStyle(), fontFamily: 'var(--mono)' }} />
          </FormSec>
          <FormSec lb="혼잣말 한 줄">
            <textarea placeholder="레이스 전에 자신에게..." rows={3}
              className="paper-grid"
              style={{
                ...inputStyle(),
                fontFamily: '"Caveat", "Gowun Dodum", cursive',
                fontSize: 20, lineHeight: 1.35, color: 'var(--ink-blue)',
                resize: 'none',
              }} />
          </FormSec>
        </>
      ) : (
        <>
          <FormSec lb="기록">
            <input type="text" defaultValue="16:08.24" style={{ ...inputStyle(), fontFamily: 'var(--mono)', fontSize: 24, textAlign: 'center', fontWeight: 500, letterSpacing: '-0.02em' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              <span>이전 PB <b style={{ color: 'var(--ink)' }}>16:10.44</b></span>
              <Delta value="-2.2" suffix="s · PB" invert />
            </div>
          </FormSec>
          <FormSec lb="순위 · 결과">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="text" defaultValue="2위" style={inputStyle()} />
              <input type="text" defaultValue="결승 진출" style={inputStyle()} />
            </div>
          </FormSec>
          <FormSec lb="감정">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {['흐림', '무덤덤', '보통', '좋음', '최고'].map((l, i) => (
                <button key={i} style={{
                  padding: '14px 4px 10px',
                  background: i === 4 ? 'var(--surface)' : 'transparent',
                  border: i === 4 ? '1px solid var(--ink)' : '1px solid var(--line)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'pointer', borderRadius: 0,
                }}>
                  <MoodStrip level={i + 1} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>{l}</span>
                </button>
              ))}
            </div>
          </FormSec>
          <FormSec lb="레이스 메모">
            <textarea defaultValue="2000m부터 따라붙음. 마지막 200 스퍼트 컸음." rows={3}
              className="paper-grid"
              style={{
                ...inputStyle(),
                fontFamily: '"Caveat", "Gowun Dodum", cursive',
                fontSize: 18, lineHeight: 1.4, color: 'var(--ink-blue)',
                resize: 'none',
              }} />
          </FormSec>
          <div style={{ padding: '4px 20px 0' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Stamp kind="pb">PB · 5000m</Stamp>
              <Stamp kind="sb">SB · 2026</Stamp>
            </div>
          </div>
        </>
      )}

      <StickyBar onSave={() => onDone?.('race')} />
    </div>
  );
}

// ───────── BodyDiagram ─────────
function BodyDiagram({ selected = {}, onChange }) {
  const parts = [
    { id: 'rKnee',  x: 96,  y: 290, name: '오른 무릎' },
    { id: 'lKnee',  x: 124, y: 290, name: '왼 무릎' },
    { id: 'rCalf',  x: 96,  y: 350, name: '오른 종아리' },
    { id: 'lCalf',  x: 124, y: 350, name: '왼 종아리' },
    { id: 'rHam',   x: 96,  y: 240, name: '오른 햄스트링' },
    { id: 'lHam',   x: 124, y: 240, name: '왼 햄스트링' },
    { id: 'lBack',  x: 110, y: 150, name: '허리' },
    { id: 'rFoot',  x: 96,  y: 410, name: '오른 발' },
    { id: 'lFoot',  x: 124, y: 410, name: '왼 발' },
    { id: 'rShin',  x: 96,  y: 380, name: '정강이' },
  ];

  function cycle(id) {
    const cur = selected[id] || 0;
    const next = cur >= 5 ? 0 : cur + 1;
    const out = { ...selected };
    if (next === 0) delete out[id]; else out[id] = next;
    onChange?.(out);
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: '0 0 220px', position: 'relative', background: 'var(--paper)', padding: 8 }}>
        <svg viewBox="0 0 220 460" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', height: 'auto' }}>
          {/* Simple body silhouette */}
          <g fill="none" stroke="var(--ink-3)" strokeWidth="1.2">
            <circle cx="110" cy="60" r="22" />
            <line x1="110" y1="82" x2="110" y2="220" />
            <line x1="110" y1="100" x2="70" y2="170" />
            <line x1="110" y1="100" x2="150" y2="170" />
            <line x1="110" y1="220" x2="96" y2="420" />
            <line x1="110" y1="220" x2="124" y2="420" />
          </g>
          {parts.map(p => {
            const lvl = selected[p.id] || 0;
            return (
              <g key={p.id} onClick={() => cycle(p.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={lvl ? 9 : 6}
                  fill={lvl ? `var(--pain-${lvl})` : 'rgba(0,0,0,0)'}
                  stroke={lvl ? `var(--pain-${lvl})` : 'var(--ink-4)'}
                  strokeWidth={lvl ? 0 : 1.2} />
                {lvl > 0 && (
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700"
                    fill="#fff">{lvl}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
        <div style={{ marginBottom: 8, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>탭으로 1→5→해제</div>
        {Object.entries(selected).map(([id, lvl]) => {
          const p = parts.find(x => x.id === id);
          return p ? (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed var(--hair)' }}>
              <PainDot level={lvl} />
              <span style={{ color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 12.5 }}>{p.name}</span>
              <span style={{ marginLeft: 'auto', color: `var(--pain-${lvl})`, fontWeight: 600 }}>{lvl}/5</span>
            </div>
          ) : null;
        })}
        {!Object.keys(selected).length && <div style={{ color: 'var(--ink-4)' }}>통증 없음</div>}
      </div>
    </div>
  );
}

// ───────── Shared form bits ─────────
function FormSec({ lb, children }) {
  return (
    <div style={{ padding: '18px 20px 0' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)',
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
        marginBottom: 8,
      }}>{lb}</div>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    width: '100%', padding: '11px 12px',
    border: '1px solid var(--line)', background: 'var(--surface)',
    fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
    boxSizing: 'border-box', borderRadius: 0, outline: 'none',
  };
}

function TopBar({ onBack, children }) {
  return (
    <div style={{
      padding: '12px 16px', borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        background: 'transparent', border: 0, cursor: 'pointer',
        padding: 4, marginLeft: -4,
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)',
        letterSpacing: '0.06em',
      }}>← 뒤로</button>
      <div style={{
        flex: 1, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
        color: 'var(--ink)', letterSpacing: '0.14em', textTransform: 'uppercase',
        textAlign: 'center',
      }}>{children}</div>
      <div style={{ width: 48 }}></div>
    </div>
  );
}

function StickyBar({ onSave, secondary }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTop: '1px solid var(--ink)', background: 'var(--bg)',
      padding: '12px 16px', display: 'flex', gap: 8,
    }}>
      {secondary && (
        <button style={{
          flex: 1, padding: '14px', background: 'transparent',
          border: '1px solid var(--ink)', fontFamily: 'var(--mono)', fontSize: 11,
          letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
          color: 'var(--ink)', borderRadius: 0,
        }}>{secondary}</button>
      )}
      <button onClick={onSave} style={{
        flex: 2, padding: '14px', background: 'var(--ink)', color: 'var(--bg)',
        border: 0, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', borderRadius: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>저장 <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.65, letterSpacing: '0.14em' }}>↵</span></button>
    </div>
  );
}

Object.assign(window, { LogEntry, BodyDiagram });
