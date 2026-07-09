// Sidebar — 220px desktop nav

function Sidebar({ active, onNavigate }) {
  const items = [
    { id: 'dashboard',  label: '대시보드',   shortcut: '⌘1' },
    { id: 'calendar',   label: '캘린더',     shortcut: '⌘2' },
    { id: 'session',    label: '오늘 세션',   shortcut: '⌘3' },
    { id: 'aichat',     label: 'AI 대화',    shortcut: '⌘4' },
    { id: 'inbox',      label: 'AI 인박스',   shortcut: '⌘5', badge: 3 },
    { id: 'analysis',   label: '분석',       shortcut: '⌘6' },
  ];
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid var(--line)',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 24px', borderBottom: '1px solid var(--hair)' }}>
        <div style={{
          fontFamily: 'var(--sans)', fontWeight: 600,
          fontSize: 15, letterSpacing: '0.04em', color: 'var(--ink)',
        }}>
          TRAIN<span style={{
            display: 'inline-block', width: 3, height: 3, background: 'var(--brand)',
            borderRadius: '50%', margin: '0 2px', transform: 'translateY(-4px)',
          }}></span>O<span style={{
            display: 'inline-block', width: 3, height: 3, background: 'var(--brand)',
            borderRadius: '50%', margin: '0 2px', transform: 'translateY(-4px)',
          }}></span>RACLE
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)',
          letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4,
        }}>v0.3.1 · 민지</div>
      </div>

      {/* Memory chip */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--hair)',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
        letterSpacing: '0.02em', lineHeight: 1.6,
      }}>
        <div style={{ color: 'var(--ink-4)', fontSize: 9, letterSpacing: '0.14em', marginBottom: 4 }}>CONTEXT</div>
        <div style={{ color: 'var(--ink)' }}>Cycle 7 · D-5/9.5</div>
        <div>어제 Z2 5.8km</div>
        <div>무릎 통증 3/5</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 8px' }}>
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id}
              onClick={() => onNavigate?.(it.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 10px',
                background: isActive ? 'var(--surface)' : 'transparent',
                border: 0,
                borderLeft: isActive ? '2px solid var(--ink)' : '2px solid transparent',
                color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                fontFamily: 'var(--sans)', fontSize: 13.5,
                cursor: 'pointer', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                fontWeight: isActive ? 500 : 400,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minWidth: 0 }}>
                {it.label}
                {it.badge && (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600,
                    color: '#fff', background: 'var(--err)',
                    padding: '1px 5px', letterSpacing: '0.04em',
                  }}>{it.badge}</span>
                )}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)',
                letterSpacing: '0.04em',
              }}>{it.shortcut}</span>
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '14px 18px', borderTop: '1px solid var(--hair)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--bg)',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>MJ</div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>김민지</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>5000m · 16:10</div>
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
