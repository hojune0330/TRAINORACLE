// TRAINORACLE v3 — Journal-first app
// 5 phone frames side-by-side, Tweaks toggle controls

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "homeVariant": "A",
  "logDetailVariant": "A",
  "trendsVariant": "A",
  "showAI": true,
  "encoding": "dot-code"
}/*EDITMODE-END*/;

function FrameRow() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [entryType, setEntryType] = React.useState('choose');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#E4E2DA',
      padding: '40px 30px',
      display: 'flex', flexDirection: 'column', gap: 20,
      fontFamily: 'var(--sans)', color: 'var(--ink)',
    }}>
      <Header />

      {/* Row of frames */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 40,
        padding: '0 0 30px', justifyContent: 'flex-start',
      }}>
        <MobileFrame label={`HOME · variant ${t.homeVariant}`}>
          <Home
            variant={t.homeVariant}
            showAI={t.showAI}
            encoding={t.encoding}
            onWriteLog={() => {}}
            onOpenDay={() => {}}
          />
        </MobileFrame>

        <MobileFrame label="LOG · CHOOSE">
          <LogEntry entryType="choose" onBack={() => {}} onDone={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · POST-SESSION">
          <LogEntry entryType="post-session" onBack={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · EVENING">
          <LogEntry entryType="evening" onBack={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · RACE">
          <LogEntry entryType="race" onBack={() => {}} />
        </MobileFrame>

        <div className="print-target">
          <MobileFrame label={`DETAIL · variant ${t.logDetailVariant}`}>
            <LogDetail variant={t.logDetailVariant} onBack={() => {}} />
          </MobileFrame>
        </div>

        <MobileFrame label={`TRENDS · variant ${t.trendsVariant}`}>
          <Trends variant={t.trendsVariant} onBack={() => {}} />
        </MobileFrame>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout variants">
          <TweakRadio label="Home" value={t.homeVariant} onChange={v => setTweak('homeVariant', v)}
            options={[
              { value: 'A', label: 'Journal' },
              { value: 'B', label: 'Data' },
              { value: 'C', label: 'Recall' },
            ]} />
          <TweakRadio label="Log detail" value={t.logDetailVariant} onChange={v => setTweak('logDetailVariant', v)}
            options={[
              { value: 'A', label: 'Journal' },
              { value: 'B', label: 'Dashboard' },
            ]} />
          <TweakRadio label="Trends" value={t.trendsVariant} onChange={v => setTweak('trendsVariant', v)}
            options={[
              { value: 'A', label: 'Scroll' },
              { value: 'B', label: 'Tabs' },
            ]} />
        </TweakSection>
        <TweakSection label="AI 보임">
          <TweakToggle label="AI 인사이트 표시" value={t.showAI} onChange={v => setTweak('showAI', v)} />
        </TweakSection>
        <TweakSection label="강도 인코딩">
          <TweakRadio label="스타일" value={t.encoding} onChange={v => setTweak('encoding', v)}
            options={[
              { value: 'dot-code', label: '도트+코드' },
              { value: 'chip',     label: '칩' },
              { value: 'glyph',    label: '도형' },
            ]} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function Header() {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 4px', marginBottom: 4, gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--ink)' }}>
          TRAIN<span style={{ display: 'inline-block', width: 4, height: 4, background: 'var(--brand)', borderRadius: '50%', margin: '0 2px', transform: 'translateY(-4px)' }}></span>O<span style={{ display: 'inline-block', width: 4, height: 4, background: 'var(--brand)', borderRadius: '50%', margin: '0 2px', transform: 'translateY(-4px)' }}></span>RACLE
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          v3 · journal-first · 모바일 우선
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
        letterSpacing: '0.04em', textAlign: 'right', lineHeight: 1.6, maxWidth: 380,
      }}>
        매일 들어와 일지 쓰고, 추이를 본다. <b style={{ color: 'var(--ink)' }}>오른쪽 아래 Tweaks</b>로 변형 전환.
        <br />손글씨 영역 = 사용자 입력 · UI 영역 = 모노 라벨 + 직각 박스
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<FrameRow />);
