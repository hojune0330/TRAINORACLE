// AI Inbox — coach view (8 athletes)

function Inbox() {
  const items = [
    { who: 'MIN-JI',  kind: 'unc',  color: 'var(--unc)',  t: 'D-5 강도 판단 불확실 — 신호 충돌', d: 'CK +18% vs RPE stable · AI 신뢰도 72%', ts: '14:20', meta: 'UNC · #J1 #Y2 #P3' },
    { who: 'JUN-WOO', kind: 'risk', color: 'var(--warn)', t: '3주 연속 CTL +14% — 부상 위험', d: '권고: 다음 사이클 볼륨 −15% · CAUTION mode 진입', ts: '09:42', meta: 'RISK · ramp rate' },
    { who: 'SOO-YEON',kind: 'pat',  color: 'var(--info)', t: 'VO2 세션 후 sleep latency 패턴', d: '최근 4회 D-5 후 평균 +38분 · 14일 데이터 누적', ts: '어제', meta: 'PATTERN · sleep' },
    { who: 'TAE-HO',  kind: 'rule', color: 'var(--err)',  t: 'R-2 위반 — MAIN을 D-3에 배치', d: '권고: D-5±1일로 이동 · 사이클 일정 자동 재계산 가능', ts: '어제', meta: 'RULE · R-2' },
    { who: 'DA-EUN',  kind: 'pass', color: 'var(--ok)',   t: 'Cycle 8 완료 · 9 Rules 9/9 pass', d: '다음 사이클 자동 생성 · 검토 후 승인 필요', ts: '2일전', meta: 'PASS · cycle done' },
    { who: 'HYE-WON', kind: 'lack', color: 'var(--ink-3)',t: 'LACK — 14일 미만 데이터 (입사 9일차)', d: 'Onboarding 완료 + 5일 추가 데이터 필요', ts: '3일전', meta: 'LACK · &lt; 14d' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', height: '100%', minHeight: 0 }}>
      {/* List */}
      <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
        <div style={{
          padding: '24px 28px 16px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>AI 인박스</h1>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            <b style={{ color: 'var(--ink)' }}>6</b> open · <b style={{ color: 'var(--ink)' }}>8</b> athletes
          </div>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16,
            padding: '14px 28px 14px 26px',
            borderBottom: '1px solid var(--hair)',
            borderLeft: `2px solid ${it.color}`,
            background: i === 0 ? 'var(--surface-2)' : 'transparent',
            cursor: 'pointer',
          }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.06em', color: 'var(--ink)',
            }}>{it.who}</span>
            <div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.005em' }}>{it.t}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.02em', lineHeight: 1.5 }} dangerouslySetInnerHTML={{__html: it.d}}></div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)',
                marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{it.meta}</div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{it.ts}</span>
          </div>
        ))}
      </div>

      {/* Right detail */}
      <div style={{ padding: '28px 26px', overflowY: 'auto' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          marginBottom: 14,
        }}>— Detail · MIN-JI</div>

        <h2 style={{
          fontFamily: 'var(--sans)', fontSize: 20, fontWeight: 500,
          letterSpacing: '-0.015em', margin: '0 0 12px',
        }}>D-5 강도 판단 불확실</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Verdict kind="unc" confidence={72} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>14:20 · 자동 이관</span>
        </div>

        <div style={{
          padding: 14, border: '1px solid var(--line)', background: 'var(--surface)',
          fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, letterSpacing: '-0.005em',
        }}>
          CK +18%로 fatigue marker가 올랐지만 RPE 5.8 / HR drift 2.1%는 안정.
          A_guide §4 — 신호 충돌 시 주관 신호 우선 → 강도 −10% 권장.
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600,
            marginBottom: 8,
          }}>— AI가 본 데이터 (12)</div>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)',
            fontVariantNumeric: 'tabular-nums',
            borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)',
          }}>
            <tbody>
              {[
                ['CK trend 14d', '+18%'],
                ['RPE 14d avg', '5.8 / 10'],
                ['Sleep 14d avg', '7h 02m'],
                ['HR drift last 4', '2.1%'],
              ].map(([l, v], i) => (
                <tr key={i} style={{ borderBottom: '1px dashed var(--hair)' }}>
                  <td style={{ padding: '7px 0', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" size="md">−10% 적용</Button>
          <Button variant="secondary" size="md">−15% 시도</Button>
          <Button variant="tertiary">민지와 대화</Button>
        </div>

        <div style={{
          marginTop: 28, padding: '12px 14px', background: 'var(--surface-2)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)',
          letterSpacing: '0.02em', lineHeight: 1.55,
        }}>
          <b style={{ color: 'var(--ink)' }}>Track record</b> — 이 종류 추천 30일 동의율 <b style={{ color: 'var(--ink)' }}>84%</b> (16/19) · 효과 일치 <b style={{ color: 'var(--ink)' }}>78%</b>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Inbox });
