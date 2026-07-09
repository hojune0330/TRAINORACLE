// Session Detail — desktop view

function SessionDetail({ onBack }) {
  return (
    <div style={{ padding: '28px 36px 80px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 0, cursor: 'pointer',
          color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 'inherit',
          letterSpacing: 'inherit', textTransform: 'inherit', padding: 0,
        }}>← Dashboard</button>
        <span style={{ color: 'var(--ink-4)' }}>/</span>
        <span>Calendar / Cycle 7</span>
        <span style={{ color: 'var(--ink-4)' }}>/</span>
        <b style={{ color: 'var(--ink)', fontWeight: 500 }}>D-5 · 화요일 PM</b>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <MainMark />
          <EnergyTag system="vo2" name="VO2-Long" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
            CYCLE 7 · D-5 / 9.5 · 18:00
          </span>
        </div>
        <h1 style={{
          fontFamily: 'var(--sans)', fontSize: 36, fontWeight: 500,
          letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 4px',
          textWrap: 'balance', maxWidth: 820,
        }}>6 × 1000m @ VO2 pace</h1>
        <div style={{
          marginTop: 12, paddingLeft: 14, borderLeft: '2px solid var(--ink)',
          fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.55,
        }}>
          사이클 정점 세션. <b>2분 jog 회복</b> 사이에 1000m 6회. 마지막 2 rep에서 페이스 drift를 봅니다.
        </div>
      </div>

      {/* Metric grid */}
      <div style={{
        display: 'flex', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)',
        marginBottom: 28,
      }}>
        <MetricCell label="Volume" value="6.0" unit="km" sub="권고 5–8km" />
        <MetricCell label="Duration" value="62" unit="min" sub="incl. WU+CD" />
        <MetricCell label="Target pace" value={"3'20\""} unit="/km" sub={"±5\""} />
        <MetricCell label="Target HR" value="178" unit="bpm" sub="178–186" />
        <MetricCell label="TSS est." value="124" sub="cycle peak" />
      </div>

      {/* Why (AI) */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader no="§1" title="Why this session" action="출처 펼침" />
        <div style={{
          padding: '14px 16px', borderLeft: '2px solid var(--ink)', background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, background: 'var(--brand)', borderRadius: '50%' }}></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', fontWeight: 600, letterSpacing: '0.04em' }}>장호준 AI</span>
            </span>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <Verdict kind="recommend" confidence={87} />
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55, letterSpacing: '-0.005em' }}>
            Cycle 7의 D-5는 <b>VO2-Long</b> 자극일. 최근 14일 평균 TSB +12, CTL +2.1로 흡수 여력 있음
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 2, marginLeft: 2 }}>[Y1]</span>.
            5000m PB 16:10 기준 <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, background: 'var(--surface-2)', padding: '1px 5px', border: '1px solid var(--line)' }}>vVO2 = 5.18 m/s</span> → 1000m 환산 <b>3'13"</b>, 안전 마진 +7"로 <b>3'20"</b> 권장
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 2, marginLeft: 2 }}>[P2]</span>.
          </div>
          <div style={{
            marginTop: 12, borderTop: '1px dashed var(--hair)', paddingTop: 10,
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600,
              marginBottom: 4,
            }}>— 다른 관점</div>
            Daniels (2026)는 5000m PB의 95% 페이스를 권고 — 3'16". 보수적 접근 시 채택 가능.
          </div>
        </div>
      </div>

      {/* Protocol */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader no="§2" title="Protocol" action="편집" />
        {[
          { idx: '01', title: 'Warm-up', dur: '15 min · 2.8 km', detail: 'Easy jog 8min, drills 3min, strides 4×100m @ ~3\'05"', tag: 'base' },
          { idx: '02', title: 'Set A — 3 × 1000m', dur: '21 min · 3.0 km', detail: 'Target 3\'20" · 2min jog recovery · HR ceiling 186', tag: 'vo2', main: false },
          { idx: '03', title: 'Set B — 3 × 1000m', dur: '21 min · 3.0 km', detail: 'Drift watch: 마지막 2 rep ±3"', tag: 'vo2', main: true },
          { idx: '04', title: 'Cool-down', dur: '10 min · 1.5 km', detail: 'Easy jog + 5min static', tag: 'rest' },
        ].map((ph, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14,
            padding: '16px 0', borderBottom: '1px solid var(--line)',
            background: ph.main ? 'rgba(13,95,90,0.04)' : 'transparent',
            paddingLeft: ph.main ? 12 : 0,
            borderLeft: ph.main ? '2px solid var(--brand)' : '2px solid transparent',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)',
              letterSpacing: '0.04em', fontWeight: ph.main ? 600 : 500,
            }}>{ph.idx}
              {ph.main && <div style={{ fontSize: 9, marginTop: 4, color: 'var(--brand)', letterSpacing: '0.1em' }}>※ MAIN</div>}
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: ph.main ? 600 : 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{ph.title}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.04em' }}>{ph.dur}</div>
              <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{ph.detail}</div>
            </div>
            <EnergyTag system={ph.tag} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <Button variant="primary" size="lg" kbd="↵">세션 시작</Button>
        <Button variant="secondary" size="lg">코치에게 전달</Button>
        <Button variant="tertiary">편집</Button>
      </div>
    </div>
  );
}

Object.assign(window, { SessionDetail });
