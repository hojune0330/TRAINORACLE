// TRAINORACLE — App root

function TopBar({ title, crumb }) {
  return (
    <div style={{
      padding: '14px 36px',
      borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 18,
      background: 'rgba(250,250,247,.92)',
      backdropFilter: 'blur(10px)',
      flexShrink: 0,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {crumb}
      </div>
      <div style={{ flex: 1 }}></div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
        letterSpacing: '0.04em',
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <span><b style={{ color: 'var(--ink)' }}>⌘K</b> 빠른 검색</span>
        <span style={{ width: 1, height: 14, background: 'var(--line)' }}></span>
        <span>2026-06-04 · KST</span>
      </div>
    </div>
  );
}

function App() {
  const [route, setRoute] = React.useState(() => {
    try { return localStorage.getItem('to_route') || 'dashboard'; } catch { return 'dashboard'; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('to_route', route); } catch {}
  }, [route]);

  const crumbs = {
    dashboard: 'DASHBOARD',
    calendar:  'CALENDAR / 9.5-CYCLE',
    session:   'TODAY / SESSION',
    aichat:    'AI CHAT / 장호준 AI',
    inbox:     'AI INBOX',
    analysis:  'ANALYSIS',
  };

  const view = (() => {
    switch (route) {
      case 'dashboard': return <Dashboard onOpenSession={() => setRoute('session')} onOpenChat={() => setRoute('aichat')} />;
      case 'session':   return <SessionDetail onBack={() => setRoute('dashboard')} />;
      case 'calendar':  return <Calendar />;
      case 'aichat':    return <AIChat />;
      case 'inbox':     return <Inbox />;
      case 'analysis':  return <Placeholder title="분석" />;
      default:          return null;
    }
  })();

  return (
    <div style={{
      display: 'flex',
      height: '100vh', minHeight: 720,
      background: 'var(--bg)',
      fontFamily: 'var(--sans)', color: 'var(--ink)',
    }}>
      <Sidebar active={route} onNavigate={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar crumb={crumbs[route]} />
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {view}
        </main>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div style={{ padding: '60px 36px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
        marginBottom: 14,
      }}>— Placeholder</div>
      <h1 style={{ fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{title}</h1>
      <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.55 }}>
        이 화면은 아직 구현되지 않았습니다. 디자인 시스템 v0.3.1 — 다음 sprint에서 추가 예정.
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
