// Dashboard — desktop main view

function Dashboard({ onOpenSession, onOpenChat }) {
  return (
    <div style={{ padding: '32px 36px 80px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
            marginBottom: 8,
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, background: 'var(--brand)',
              borderRadius: '50%', marginRight: 8, verticalAlign: 2,
            }}></span>
            2026-06-04 · 화요일 · 06:32 KST
          </div>
          <h1 style={{
            fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1.15, margin: 0,
          }}>민지, 좋은 아침이에요.</h1>
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)',
          letterSpacing: '0.04em', border: '1px solid var(--ink-3)',
          padding: '5px 10px',
        }}>NORMAL mode</div>
      </div>

      {/* Cycle rail */}
      <div style={{ marginTop: 36 }}>
        <SectionHeader no="§1" title="9.5-day cycle · Cycle 7" />
        <CycleRail today={5} />
        <div style={{
          marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-3)', letterSpacing: '0.04em',
        }}>
          오늘 D-6 · MAIN(VO2)에서 1일 경과 · 다음 LT(D-7)까지 1일
        </div>
      </div>

      {/* Today's session */}
      <div style={{ marginTop: 40 }}>
        <SectionHeader no="§2" title="오늘 세션" action="모두 보기" />
        <div style={{
          border: '1px solid var(--ink)', padding: '20px 22px',
          cursor: 'pointer', background: 'var(--surface)',
        }} onClick={onOpenSession}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
                letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>PM · 18:00</span>
              <EnergyTag system="rest" name="Recovery Z1" />
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
              letterSpacing: '0.04em',
            }}>30 min · 5.2 km</span>
          </div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 500,
            letterSpacing: '-0.02em', marginTop: 10, color: 'var(--ink)',
          }}>회복 조깅 (Z1)</div>
          <div style={{
            marginTop: 12, paddingLeft: 12, borderLeft: '2px solid var(--ink)',
            fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55,
          }}>
            Cycle 7, D-6 · 어제 D-5 MAIN (VO2-Long) follow-up. CK +18% over 2wks · <b>Rule 4</b> 적용 (주관 신호 우선).
          </div>
          <div style={{
            marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--hair)',
            display: 'flex', gap: 14, fontFamily: 'var(--mono)', fontSize: 12,
            color: 'var(--ink-3)',
          }}>
            <span>Target HR <b style={{ color: 'var(--ink)' }}>136–148</b></span>
            <span>Pace <b style={{ color: 'var(--ink)' }}>5'45"–6'10"</b></span>
            <span>RPE <b style={{ color: 'var(--ink)' }}>3–4</b></span>
          </div>
        </div>
      </div>

      {/* Validation pills + AI inbox */}
      <div style={{
        marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32,
      }}>
        <div>
          <SectionHeader no="§3" title="9 Rules · Cycle 7" action="자세히" />
          <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
            {[
              { st: 'ok',   c: 'R-3', t: 'Z1 회복 비율 21.4% (≥ 20%)' },
              { st: 'ok',   c: 'R-6', t: 'VO2 볼륨 6.0km (5–8km 권고)' },
              { st: 'warn', c: 'R-7', t: '드리프트 +4.2" (±3" 권고)' },
              { st: 'info', c: 'R-4', t: '주관 우선 적용 — RPE 안정' },
            ].map((v, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '20px 48px 1fr', gap: 12,
                padding: '11px 0', borderBottom: '1px dashed var(--hair)',
                alignItems: 'baseline',
              }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
                  color: v.st === 'ok' ? 'var(--ok)' : v.st === 'warn' ? 'var(--warn)' : 'var(--info)',
                }}>{v.st === 'ok' ? '✓' : v.st === 'warn' ? '!' : 'i'}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '0.06em',
                }}>{v.c}</span>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', letterSpacing: '-0.005em' }}>{v.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader no="§4" title="AI 인박스" action="전체 보기" />
          <div>
            {[
              { who: 'YOU', kind: 'unc', color: 'var(--unc)', t: 'D-5 강도 판단 불확실', d: 'CK +18% vs RPE stable · 72%' },
              { who: 'JUN-WOO', kind: 'risk', color: 'var(--warn)', t: '3주 연속 CTL +14%', d: 'CAUTION mode 권고 · 부상 위험' },
              { who: 'SOO-YEON', kind: 'pat', color: 'var(--info)', t: 'D-5 후 sleep latency 패턴', d: '14일 데이터 · 최근 4회 +38분' },
            ].map((it, i) => (
              <div key={i} onClick={onOpenChat} style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12,
                padding: '12px 12px 12px 10px',
                borderBottom: '1px solid var(--hair)',
                borderLeft: `2px solid ${it.color}`,
                cursor: 'pointer',
              }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600,
                  letterSpacing: '0.06em', color: 'var(--ink)', minWidth: 56,
                }}>{it.who}</span>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.005em' }}>{it.t}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.02em' }}>{it.d}</div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>14:20</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ marginTop: 40 }}>
        <SectionHeader no="§5" title="이번 주 KPI" />
        <div style={{
          display: 'flex', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)',
        }}>
          <MetricCell label="CTL · Fitness" value="62.4" sub="+2.1 · 7d" subKind="up" />
          <MetricCell label="ATL · Fatigue" value="48.2" sub="±0.3 · 7d" />
          <MetricCell label="TSB · Form" value="+14.2" sub="good shape" subKind="up" />
          <MetricCell label="Weekly TSS" value="612" sub="−4% vs avg" subKind="down" />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
