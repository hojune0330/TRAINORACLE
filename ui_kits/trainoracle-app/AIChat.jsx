// AI Chat — desktop view

function AIChat() {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState([
    {
      role: 'user',
      text: 'D-5 VO2 세션, CK가 +18% 올랐는데 그대로 진행해도 될까요?',
      ts: '14:18',
    },
    {
      role: 'ai',
      verdict: 'unc', confidence: 72,
      ts: '14:20',
      body: (
        <>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
            CK +18% (above ±8% band) — fatigue marker raised <Cit n="J1" />.
            그러나 RPE 5.8 안정, HR drift 2.1% (band 내) <Cit n="Y2" />.
            A_guide §4 — 신호 충돌 시 주관 신호 우선 → <b>강도 −10% 권장 (3'20" → 3'25")</b>.
          </p>
          <table style={{
            width: '100%', borderCollapse: 'collapse', marginTop: 14,
            fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums',
            borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
          }}>
            <tbody>
              <tr style={{ borderBottom: '1px dashed var(--hair)' }}>
                <td style={{ padding: '7px 0', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CK trend (14d)</td>
                <td style={{ padding: '7px 0', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>+18%</td>
              </tr>
              <tr style={{ borderBottom: '1px dashed var(--hair)' }}>
                <td style={{ padding: '7px 0', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>RPE (14d avg)</td>
                <td style={{ padding: '7px 0', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>5.8 / 10</td>
              </tr>
              <tr>
                <td style={{ padding: '7px 0', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>HR drift (last 4 sessions)</td>
                <td style={{ padding: '7px 0', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>2.1%</td>
              </tr>
            </tbody>
          </table>
          <div style={{
            marginTop: 14, borderTop: '1px dashed var(--hair)', paddingTop: 10,
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600,
              marginBottom: 4,
            }}>— 다른 관점</div>
            Daniels (2026) <Cit n="P3" /> 는 CK만으로도 −15% 감량 권고. 보수적 접근 시 채택 가능.
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Ref n="J1" badge="J" t="A_guide §4.2" />
            <Ref n="Y2" badge="Y" t="Your 14d HR drift" />
            <Ref n="P3" badge="P" t="Daniels 2026 ch.7" />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <Button variant="primary" size="sm">−10% 적용</Button>
            <Button variant="secondary" size="sm">−15% 시도</Button>
            <Button variant="tertiary">근거 자세히 →</Button>
          </div>
        </>
      ),
    },
  ]);

  function send() {
    if (!input.trim()) return;
    setMessages(m => [...m, { role: 'user', text: input, ts: '14:24' }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, {
        role: 'ai', verdict: 'lack', ts: '14:24',
        body: (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)' }}>
            데모용 답변 — 실제 모델 연결 시 verdict + sources + alternative view가 자동 첨부됩니다.
          </p>
        ),
      }]);
    }, 600);
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '240px 1fr',
      height: '100%', minHeight: 0,
    }}>
      {/* Conversation list */}
      <div style={{ borderRight: '1px solid var(--line)', padding: '20px 0', overflowY: 'auto' }}>
        <div style={{
          padding: '0 16px 12px', fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
        }}>All conversations</div>
        {[
          { t: 'D-5 VO2 강도 판단', d: '오늘 14:18', active: true },
          { t: '대회 D-21 테이퍼 계획', d: '어제' },
          { t: '무릎 통증 — Z2 대체안', d: '3일전' },
          { t: '아침/저녁 세션 분리', d: '지난주' },
          { t: '5000m PB 16:10 환산', d: '2주전' },
        ].map((c, i) => (
          <div key={i} style={{
            padding: '10px 16px',
            background: c.active ? 'var(--surface-2)' : 'transparent',
            borderLeft: c.active ? '2px solid var(--ink)' : '2px solid transparent',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: c.active ? 500 : 400, letterSpacing: '-0.005em' }}>{c.t}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.04em' }}>{c.d}</div>
          </div>
        ))}
      </div>

      {/* Thread */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 22, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 5, height: 5, background: 'var(--brand)', borderRadius: '50%' }}></span>
            CONTEXT · 민지 · Cycle 7 · D-5/9.5 · CK +18% · RPE 5.8 · 무릎 3/5
          </div>
          {messages.map((m, i) => m.role === 'user' ? <UserMsg key={i} {...m} /> : <AIMsg key={i} {...m} />)}
        </div>

        {/* Composer */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 36px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--line)', padding: '4px 4px 4px 12px', background: 'var(--surface)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="장호준에게 질문하세요…"
              style={{
                flex: 1, border: 0, outline: 'none',
                fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
                background: 'transparent', padding: '10px 0',
              }}
            />
            <Button variant="primary" size="md" kbd="↵" onClick={send}>전송</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMsg({ text, ts }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
        letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600,
      }}>민지 · {ts}</div>
      <div style={{
        fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55,
        padding: '10px 14px', background: 'var(--surface-2)',
        border: '1px solid var(--line)', maxWidth: 620,
      }}>{text}</div>
    </div>
  );
}

function AIMsg({ verdict, confidence, ts, body }) {
  return (
    <div style={{ marginBottom: 24, padding: '14px 18px', borderLeft: '2px solid var(--ink)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, background: 'var(--brand)', borderRadius: '50%' }}></span>
          <span style={{ color: 'var(--ink)', fontWeight: 600, letterSpacing: '0.04em' }}>장호준 AI</span>
        </span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <Verdict kind={verdict} confidence={confidence} />
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span>{ts}</span>
      </div>
      {body}
    </div>
  );
}

function Cit({ n }) {
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', marginLeft: 2 }}>[{n}]</span>;
}

function Ref({ n, badge, t }) {
  const colors = { J: 'var(--brand)', P: 'var(--info)', Y: 'var(--ok)', C: 'var(--ink-3)' };
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', border: '1px solid var(--line)', padding: '3px 8px', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: colors[badge], border: `1px solid ${colors[badge]}`, padding: '0px 4px', fontSize: 9.5, fontWeight: 600 }}>{badge}</span>
      <b style={{ color: 'var(--ink)' }}>[{n}]</b>
      <span>{t}</span>
    </span>
  );
}

Object.assign(window, { AIChat });
