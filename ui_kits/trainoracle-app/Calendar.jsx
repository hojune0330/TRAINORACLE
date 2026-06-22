// Calendar — 9.5-cycle view (핵심 차별 화면)

function Calendar() {
  const cycles = [
    { num: 6, status: 'done', range: '05-15 → 05-24' },
    { num: 7, status: 'now',  range: '05-25 → 06-03' },
    { num: 8, status: 'next', range: '06-04 → 06-13' },
  ];

  function cellSession(day, sys, code, vol, isMain) {
    const dotColors = {
      base: '#4A8FC7', lt: '#B8A024', vo2: '#C7761C',
      gly: '#B8332E', atp: '#7A3FB5', rest: '#7A7A70',
    };
    return (
      <div style={{
        padding: '10px 8px', borderRight: '1px solid var(--line)',
        background: isMain ? 'var(--ink)' : 'transparent',
        color: isMain ? '#fff' : 'var(--ink)',
        minHeight: 96, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9.5,
          color: isMain ? 'rgba(255,255,255,.6)' : 'var(--ink-3)',
          letterSpacing: '0.08em', fontWeight: 500,
        }}>{day}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColors[sys] }}></span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
            color: isMain ? '#fff' : 'var(--ink)', letterSpacing: '0.04em',
          }}>{code}</span>
        </div>
        {vol && (
          <div style={{
            marginTop: 'auto', fontFamily: 'var(--mono)', fontSize: 10.5,
            color: isMain ? 'rgba(255,255,255,.7)' : 'var(--ink-3)',
            letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
          }}>{vol}</div>
        )}
        {isMain && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 8.5, color: '#fff',
            letterSpacing: '0.16em', marginTop: 3,
          }}>※ MAIN</div>
        )}
      </div>
    );
  }

  const days = [
    { d: 'D-1', sys: 'rest', c: 'REC', v: '—' },
    { d: 'D-2', sys: 'base', c: 'BA',  v: '5.8km' },
    { d: 'D-3', sys: 'base', c: 'BA',  v: '6.2km' },
    { d: 'D-4', sys: 'base', c: 'BA+', v: '7.4km' },
    { d: 'D-5', sys: 'vo2',  c: 'V2',  v: '10.4km', main: true },
    { d: 'D-6', sys: 'rest', c: 'Z1',  v: '5.0km', today: true },
    { d: 'D-7', sys: 'lt',   c: 'LT',  v: '9.6km' },
    { d: 'D-8', sys: 'base', c: 'BA',  v: '6.0km' },
    { d: 'D-9', sys: 'rest', c: 'OFF', v: '—' },
    { d: 'D-.5',sys: 'rest', c: '··',  v: '—' },
  ];

  return (
    <div style={{ padding: '28px 36px 80px', maxWidth: 1200, margin: '0 auto' }}>
      {/* View switcher */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24,
      }}>
        <h1 style={{
          fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 500,
          letterSpacing: '-0.025em', margin: 0,
        }}>캘린더</h1>
        <div style={{ display: 'flex', border: '1px solid var(--ink)' }}>
          {['Week', '9.5-Cycle', 'Timeline'].map((t, i) => (
            <button key={i} style={{
              padding: '8px 16px', fontFamily: 'var(--mono)', fontSize: 11,
              fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: i === 1 ? 'var(--ink)' : 'transparent',
              color: i === 1 ? 'var(--bg)' : 'var(--ink-2)',
              border: 0,
              borderRight: i < 2 ? '1px solid var(--ink)' : 0,
              cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Cycle list */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="9.5-day cycles · 2026 Q2" />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          border: '1px solid var(--line)',
        }}>
          {cycles.map((c, i) => {
            const isNow = c.status === 'now';
            return (
              <div key={i} style={{
                padding: '16px 18px',
                borderRight: i < 2 ? '1px solid var(--line)' : 0,
                background: isNow ? 'var(--surface-2)' : 'transparent',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
                }}>Cycle {c.num}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500,
                  color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                }}>{c.range}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10.5, color: isNow ? 'var(--brand)' : 'var(--ink-3)',
                  letterSpacing: '0.08em', marginTop: 6, textTransform: 'uppercase', fontWeight: 600,
                }}>
                  {c.status === 'done' ? '✓ 완료 · 9/9 pass' : c.status === 'now' ? '● 진행 중 · D-6' : '· 다음 사이클'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active cycle detail */}
      <div>
        <SectionHeader no="§" title="Cycle 7 · 일일 분해" action="이번 사이클 통계" />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)',
          border: '1px solid var(--ink)',
        }}>
          {days.map((d, i) => cellSession(d.d, d.sys, d.c, d.v, d.main))}
        </div>
        <div style={{
          marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-3)', letterSpacing: '0.04em',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>오늘 D-6 · 회복일 · 다음 자극 D-7 (LT, 24h)</span>
          <span>Total · 50.4 km · 5h 12m · TSS 542</span>
        </div>
      </div>

      {/* Energy distribution */}
      <div style={{ marginTop: 36 }}>
        <SectionHeader no="§" title="Energy distribution · this cycle" />
        <div style={{ height: 14, display: 'flex', border: '1px solid var(--ink)' }}>
          <div style={{ flex: 24, background: '#4A8FC7' }}></div>
          <div style={{ flex: 38, background: '#7A7A70' }}></div>
          <div style={{ flex: 21, background: '#C7761C' }}></div>
          <div style={{ flex: 17, background: '#B8A024' }}></div>
        </div>
        <div style={{
          marginTop: 8, display: 'flex', gap: 22, fontFamily: 'var(--mono)',
          fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em',
        }}>
          <span>● BA <b style={{ color: '#4A8FC7' }}>24%</b></span>
          <span>● REST <b style={{ color: '#5F6965' }}>38%</b></span>
          <span>● V2 <b style={{ color: '#C7761C' }}>21%</b></span>
          <span>● LT <b style={{ color: '#B8A024' }}>17%</b></span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Calendar });
