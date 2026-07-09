// 일지 전용 컴포넌트들. JournalPrimitives.

// ============== INDEX CARD (날짜 헤더) ==============
function IndexCard({ date, dow, weather, cycleDay, season }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--ink)',
      padding: '11px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 8,
      alignItems: 'baseline',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink)',
        }}>{date}</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)',
          letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2,
        }}>{dow}{weather ? ` · ${weather}` : ''}</div>
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
        letterSpacing: '0.06em', textAlign: 'right', lineHeight: 1.5,
      }}>
        {cycleDay && <div>{cycleDay}</div>}
        {season && <div>{season}</div>}
      </div>
    </div>
  );
}

// ============== MOOD STRIP (감정 5단계) ==============
function MoodStrip({ level = 3, showLabel = false }) {
  const labels = ['흐림', '무덤덤', '보통', '좋음', '최고'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className={`mood-strip m${level}`}>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
      </span>
      {showLabel && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: `var(--mood-${level})`,
          letterSpacing: '0.04em',
        }}>{labels[level - 1]}</span>
      )}
    </span>
  );
}

// ============== INTENSITY DOT GROUP ==============
// 한 세션의 강도 분포를 작은 도트 묶음으로 — Z1-Z7
function IntensityDots({ dist = {}, total }) {
  const order = ['base', 'lt', 'vo2', 'gly', 'atp', 'rest'];
  const colors = {
    base: '#4A8FC7', lt: '#B8A024', vo2: '#C7761C',
    gly: '#B8332E', atp: '#7A3FB5', rest: '#7A7A70',
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {order.map(k => {
        const v = dist[k];
        if (!v) return null;
        return (
          <span key={k} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: colors[k],
          }} title={`${k.toUpperCase()} ${v}`}></span>
        );
      })}
    </span>
  );
}

// ============== INTENSITY STACK BAR (주/월 누적) ==============
function IntensityStack({ data = {}, height = 14, total }) {
  const order = ['base', 'lt', 'vo2', 'gly', 'atp', 'rest'];
  const colors = {
    base: '#4A8FC7', lt: '#B8A024', vo2: '#C7761C',
    gly: '#B8332E', atp: '#7A3FB5', rest: '#7A7A70',
  };
  const sum = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{
      display: 'flex', height,
      border: '1px solid var(--ink)',
    }}>
      {order.map(k => {
        const v = data[k] || 0;
        if (!v) return null;
        return (
          <div key={k} style={{
            flex: v / sum,
            background: colors[k],
          }}></div>
        );
      })}
    </div>
  );
}

// ============== STAMP (PB / SB / DONE) ==============
function Stamp({ kind = 'pb', children }) {
  const className = `stamp ${kind === 'pb' ? 'red' : kind === 'sb' ? 'brand' : ''}`;
  return <span className={className}>{children}</span>;
}

// ============== PAIN DOT (부상 강도) ==============
function PainDot({ level = 1, size = 8 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      background: `var(--pain-${level})`,
      borderRadius: '50%',
      verticalAlign: 'middle',
    }}></span>
  );
}

// ============== SPARKLINE (mini line graph) ==============
function Sparkline({ data = [], width = 100, height = 24, color = 'var(--ink)', showLast = false }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((d - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  const last = data[data.length - 1];
  const lx = pad + (width - pad * 2);
  const ly = height - pad - ((last - min) / range) * (height - pad * 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.2" />
      {showLast && <circle cx={lx} cy={ly} r="2" fill={color} />}
    </svg>
  );
}

// ============== DELTA (변화량 표시) ==============
function Delta({ value, suffix = '', invert = false }) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  const positive = n > 0;
  const negative = n < 0;
  const goodIsUp = !invert;
  const color = (positive && goodIsUp) || (negative && !goodIsUp)
    ? 'var(--delta-up)'
    : (negative && goodIsUp) || (positive && !goodIsUp)
    ? 'var(--delta-down)'
    : 'var(--delta-flat)';
  const sign = positive ? '+' : '';
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10,
      color, fontWeight: 500,
      letterSpacing: '0.02em',
      fontVariantNumeric: 'tabular-nums',
    }}>{sign}{value}{suffix}</span>
  );
}

// ============== SECTION LABEL (작은) ==============
function SectionLb({ children, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 10, padding: '0 20px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
      }}>{children}</div>
      {action && (
        <button onClick={onAction} style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)',
          background: 'transparent', border: 0, cursor: 'pointer',
          textDecoration: 'underline', textUnderlineOffset: '3px',
          letterSpacing: '0.04em', padding: 0,
        }}>{action}</button>
      )}
    </div>
  );
}

Object.assign(window, {
  IndexCard, MoodStrip, IntensityDots, IntensityStack,
  Stamp, PainDot, Sparkline, Delta, SectionLb,
});
