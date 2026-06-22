// TRAINORACLE — reusable primitives
// All styles come from ../../colors_and_type.css

const ENERGY = {
  base: { c: 'BA', name: 'BASE', cls: 'base' },
  lt:   { c: 'LT', name: 'Lactate', cls: 'lt' },
  vo2:  { c: 'V2', name: 'VO2-Long', cls: 'vo2' },
  gly:  { c: 'GL', name: 'Glycolytic', cls: 'gly' },
  atp:  { c: 'AP', name: 'ATP-PC', cls: 'atp' },
  rest: { c: 'RE', name: 'Recovery', cls: 'rest' },
};

function EnergyTag({ system = 'vo2', name }) {
  const e = ENERGY[system] || ENERGY.vo2;
  return (
    <span className={`etag ${e.cls}`}>
      <span className="d"></span>
      <span className="c">{e.c}</span>
      <span className="n">{name || e.name}</span>
    </span>
  );
}

function MainMark() {
  return <span className="main-mark">MAIN</span>;
}

function Verdict({ kind = 'recommend', confidence }) {
  const labels = {
    confirm: 'CONFIRM',
    recommend: 'RECOMMEND',
    unc: 'UNC',
    lack: 'LACK',
  };
  return (
    <span className={`verdict ${kind}`}>
      {labels[kind]}{confidence != null ? ` · ${confidence}%` : ''}
    </span>
  );
}

function Button({ variant = 'primary', size = 'md', kbd, children, onClick, ...rest }) {
  const base = {
    fontFamily: 'var(--sans)',
    fontWeight: 500,
    letterSpacing: '0.005em',
    border: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: 0,
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, minHeight: 32 },
    md: { padding: '11px 18px', fontSize: 13.5, minHeight: 44 },
    lg: { padding: '14px 22px', fontSize: 14.5, minHeight: 52 },
  };
  const variants = {
    primary: { background: 'var(--ink)', color: 'var(--bg)' },
    secondary: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink)' },
    tertiary: {
      background: 'transparent', color: 'var(--ink)',
      textDecoration: 'underline', textUnderlineOffset: '3px',
      padding: '11px 4px', fontFamily: 'var(--mono)', fontSize: 12,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    },
    danger: { background: 'transparent', color: 'var(--err)', border: '1px solid var(--err)' },
  };
  return (
    <button
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onClick={onClick}
      {...rest}
    >
      {children}
      {kbd && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          background: variant === 'primary' ? 'rgba(255,255,255,.18)' : 'var(--surface-2)',
          border: variant === 'primary' ? '1px solid rgba(255,255,255,.3)' : '1px solid var(--line)',
          padding: '1px 6px', marginLeft: 4,
        }}>{kbd}</span>
      )}
    </button>
  );
}

function MetricCell({ label, value, unit, sub, subKind }) {
  const subColors = { up: 'var(--ok)', down: 'var(--err)', warn: 'var(--warn)' };
  return (
    <div style={{
      padding: '14px 14px',
      borderRight: '1px solid var(--hair)',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)',
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500,
        color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 6,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.05,
      }}>
        {value}{unit && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: subColors[subKind] || 'var(--ink-3)',
          marginTop: 4, letterSpacing: '0.04em',
        }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ no, title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)',
        letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>
        {no && <b style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{no} · </b>}
        {title}
      </div>
      {action && (
        <button onClick={onAction} style={{
          fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)',
          cursor: 'pointer', letterSpacing: '0.04em',
          textDecoration: 'underline', textUnderlineOffset: '3px',
          background: 'transparent', border: 0, padding: 0,
        }}>{action}</button>
      )}
    </div>
  );
}

function CycleRail({ today = 5 }) {
  const cells = [
    { day: 'D-1', dot: 'rest', label: 'REC' },
    { day: 'D-2', dot: 'base', label: 'BA' },
    { day: 'D-3', dot: 'base', label: 'BA' },
    { day: 'D-4', dot: 'base', label: 'BA+' },
    { day: 'D-5', dot: 'vo2',  label: 'V2', main: true },
    { day: 'D-6', dot: 'rest', label: 'Z1' },
    { day: 'D-7', dot: 'lt',   label: 'LT' },
    { day: 'D-8', dot: 'base', label: 'BA' },
    { day: 'D-9', dot: 'rest', label: 'OFF' },
    { day: 'D-.5',dot: 'rest', label: '··' },
  ];
  const dotColors = {
    base: '#4A8FC7', lt: '#B8A024', vo2: '#C7761C',
    gly: '#B8332E', atp: '#7A3FB5', rest: '#7A7A70',
  };
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)',
      border: '1px solid var(--ink)',
    }}>
      {cells.map((c, i) => {
        const isToday = (i + 1) === today + 1; // 1-indexed
        const isMain = c.main;
        return (
          <div key={i} style={{
            padding: '14px 6px 12px', textAlign: 'center',
            borderRight: i < 9 ? '1px solid var(--line)' : 0,
            background: isMain ? 'var(--ink)' : (isToday ? 'var(--surface-2)' : 'transparent'),
            color: isMain ? '#fff' : 'var(--ink)',
            minHeight: 84, display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: isMain ? 'rgba(255,255,255,.6)' : 'var(--ink-3)',
              letterSpacing: '0.08em', fontWeight: 500,
            }}>{c.day}</div>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: dotColors[c.dot],
            }}></div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              fontWeight: c.main ? 600 : 500,
              color: isMain ? '#fff' : (c.dot === 'rest' ? 'var(--ink-3)' : 'var(--ink)'),
              letterSpacing: '0.04em',
            }}>{c.label}</div>
            {isMain && (
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9, color: '#fff',
                letterSpacing: '0.14em', marginTop: -2,
              }}>※ MAIN</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  ENERGY, EnergyTag, MainMark, Verdict, Button, MetricCell, SectionHeader, CycleRail,
});
