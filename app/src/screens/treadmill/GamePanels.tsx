/**
 * Game-side panels: tour map, character picker, and the menu sheet (settings / help / open source).
 * Everything here is game-only. Nothing reads or writes training data or reward points.
 */
import React from "react"
import { Check, ChevronLeft, ChevronRight, Footprints, Lock, MapPin, MoveUp, Pause, Star, X, ChevronsRight, Zap } from "lucide-react"
import { TOUR_CITIES, TOUR_SEASONS, citiesOf } from "../../domain/minigame/tour"
import type { TourCity, TourSeasonId } from "../../domain/minigame/tour"
import {
  MINIGAME_CHARACTERS, characterUnlocked, cityUnlocked, seasonUnlocked, totalStars, unlockLabel,
} from "../../domain/minigame/progress"
import type { MinigameProgress, MinigameSettings } from "../../domain/minigame/progress"
import type { MinigameStorageStatus } from "../../domain/minigame/progress-store"
import { TREADMILL_RULES, TREADMILL_UPGRADES } from "../../domain/minigame/treadmill"
import { drawRunner, gamePalette } from "./sprites"
import type { RunnerCharacter } from "./sprites"

export function CharacterPortrait({ character, size = 64, pose = "idle", label }: {
  readonly character: RunnerCharacter; readonly size?: number; readonly pose?: "idle" | "cheer" | "hit"; readonly label?: string
}) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const canvas = ref.current, context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * ratio; canvas.height = size * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, size, size)
    context.translate(size / 2, size * 0.9); context.scale(size / 90, size / 90)
    drawRunner(context, gamePalette(canvas), { pose, phase: 0, upgrades: [], character })
  }, [character, size, pose])
  return <canvas ref={ref} className="treadmill-game__mini-portrait" style={{ width: size, height: size }}
    {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />
}

function CityStars({ count }: { readonly count: number }) {
  return <span className="treadmill-game__city-stars" aria-label={`별 ${count}개`}>
    {[0, 1, 2].map(index => <Star key={index} size={13} aria-hidden="true" data-on={index < count || undefined} />)}
  </span>
}

export function TourMap({ progress, season, onSeason, onPlay, onPractice, status }: {
  readonly progress: MinigameProgress; readonly season: TourSeasonId
  readonly onSeason: (season: TourSeasonId) => void
  readonly onPlay: (city: TourCity) => void; readonly onPractice: () => void
  readonly status: MinigameStorageStatus
}) {
  const info = TOUR_SEASONS.find(item => item.id === season)!
  const open = seasonUnlocked(progress, season)
  const cities = citiesOf(season)
  const index = TOUR_SEASONS.findIndex(item => item.id === season)
  return <section className="treadmill-game__map" aria-labelledby="treadmill-map-title" data-season={season}>
    <div className="treadmill-game__map-head">
      <button type="button" className="treadmill-game__icon" disabled={index === 0} aria-label="이전 시즌" onClick={() => onSeason(TOUR_SEASONS[index - 1]!.id)}><ChevronLeft size={20} aria-hidden="true" /></button>
      <div>
        <h2 id="treadmill-map-title">{info.name}</h2>
        <p>{info.subtitle} · 모은 별 <strong>{totalStars(progress)}</strong>/{TOUR_CITIES.length * 3}</p>
      </div>
      <button type="button" className="treadmill-game__icon" disabled={index === TOUR_SEASONS.length - 1} aria-label="다음 시즌" onClick={() => onSeason(TOUR_SEASONS[index + 1]!.id)}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    {!open && <p className="treadmill-game__map-lock"><Lock size={14} aria-hidden="true" />{TOUR_SEASONS[index - 1]!.name.split(" · ")[1]}의 마지막 도시를 완주하면 열려요</p>}
    <ol className="treadmill-game__route">
      {cities.map((city, order) => {
        const unlocked = cityUnlocked(progress, city)
        const stars = progress.cities[city.id]?.stars ?? 0
        return <li key={city.id} data-side={order % 2 ? "right" : "left"}>
          <button type="button" className="treadmill-game__city" data-city={city.id} data-state={stars > 0 ? "done" : unlocked ? "open" : "locked"}
            disabled={!unlocked} onClick={() => onPlay(city)}
            aria-label={`${city.name}${unlocked ? "" : " (잠김)"} · ${city.tagline}${stars ? ` · 별 ${stars}개` : ""}`}>
            <b className="treadmill-game__city-pin" aria-hidden="true">{unlocked ? <MapPin size={18} /> : <Lock size={16} />}</b>
            <span className="treadmill-game__city-text">
              <strong>{city.name}<small>{city.country}</small></strong>
              <span>{city.tagline}</span>
              <CityStars count={stars} />
            </span>
          </button>
        </li>
      })}
    </ol>
    <div className="treadmill-game__map-foot">
      <button type="button" className="treadmill-game__ghost" onClick={onPractice}>러닝머신 연습</button>
      <span className="treadmill-game__sync" data-status={status}>{storageLabel(status)}</span>
    </div>
  </section>
}

export function storageLabel(status: MinigameStorageStatus): string {
  if (status === "SYNCED") return "계정에 저장됨"
  if (status === "SYNCING") return "계정에 저장 중…"
  if (status === "PENDING") return "이 기기에 저장 · 연결되면 계정에 올려요"
  if (status === "UPGRADE_REQUIRED") return "앱을 업데이트하면 계정에 저장돼요"
  if (status === "LOCAL_ONLY") return "이 기기에 저장 (계정 저장 준비 중)"
  return "이 기기에 저장"
}

export function CharacterPicker({ progress, selected, onSelect }: {
  readonly progress: MinigameProgress; readonly selected: string; readonly onSelect: (id: RunnerCharacter) => void
}) {
  return <div className="treadmill-game__characters" role="radiogroup" aria-label="캐릭터">
    {MINIGAME_CHARACTERS.map(character => {
      const open = characterUnlocked(progress, character.id)
      return <button type="button" key={character.id} role="radio" aria-checked={selected === character.id} disabled={!open}
        data-character={character.id} onClick={() => onSelect(character.id)}
        aria-label={`${character.name} · ${character.line}${open ? "" : ` · 잠김: ${unlockLabel(character.unlock)}`}`}>
        <CharacterPortrait character={character.id} size={56} />
        <strong>{character.name}</strong>
        <small>{open ? character.line : <><Lock size={10} aria-hidden="true" />{unlockLabel(character.unlock)}</>}</small>
        {selected === character.id && <i aria-hidden="true"><Check size={12} /></i>}
      </button>
    })}
  </div>
}

type Tab = "settings" | "help" | "licenses"

function Toggle({ label, hint, checked, onChange }: { readonly label: string; readonly hint?: string; readonly checked: boolean; readonly onChange: (value: boolean) => void }) {
  return <label className="treadmill-game__setting">
    <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.currentTarget.checked)} />
  </label>
}

function Choice<T extends string>({ label, hint, value, options, onChange }: {
  readonly label: string; readonly hint?: string; readonly value: T
  readonly options: readonly { value: T; label: string }[]; readonly onChange: (value: T) => void
}) {
  const name = React.useId()
  return <div className="treadmill-game__setting treadmill-game__setting--choice" role="radiogroup" aria-labelledby={`${name}-label`}>
    <span id={`${name}-label`}><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    <div>{options.map(option => <label key={option.value} data-on={value === option.value || undefined}>
      <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />{option.label}
    </label>)}</div>
  </div>
}

export function GameMenu({ progress, status, onClose, onSettings, onCharacter, onReset }: {
  readonly progress: MinigameProgress; readonly status: MinigameStorageStatus
  readonly onClose: () => void
  readonly onSettings: (patch: Partial<MinigameSettings>) => void
  readonly onCharacter: (id: RunnerCharacter) => void
  readonly onReset: () => Promise<boolean>
}) {
  const [tab, setTab] = React.useState<Tab>("settings")
  const [confirm, setConfirm] = React.useState(false)
  const [resetMessage, setResetMessage] = React.useState<string | null>(null)
  const close = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => { close.current?.focus() }, [])
  const s = progress.settings
  const tabs: readonly { id: Tab; label: string }[] = [{ id: "settings", label: "설정" }, { id: "help", label: "도움말" }, { id: "licenses", label: "오픈소스" }]
  return <div className="treadmill-game__sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }}>
    <section className="treadmill-game__sheet" role="dialog" aria-modal="true" aria-labelledby="treadmill-menu-title">
      <header>
        <h2 id="treadmill-menu-title">게임 메뉴</h2>
        <button ref={close} type="button" className="treadmill-game__icon" aria-label="메뉴 닫기" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="treadmill-game__tabs" role="tablist" aria-label="게임 메뉴">
        {tabs.map(item => <button type="button" key={item.id} role="tab" id={`treadmill-tab-${item.id}`} aria-selected={tab === item.id}
          aria-controls={`treadmill-panel-${item.id}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>

      {tab === "settings" && <div role="tabpanel" id="treadmill-panel-settings" aria-labelledby="treadmill-tab-settings" className="treadmill-game__panel">
        <h3>캐릭터</h3>
        <CharacterPicker progress={progress} selected={progress.character} onSelect={onCharacter} />
        <p className="treadmill-game__fine">캐릭터는 모습만 달라요. 속도·점프·판정은 모두 같아요.</p>
        <h3>소리와 진동</h3>
        <Toggle label="효과음" checked={s.sound} onChange={sound => onSettings({ sound })} />
        <Toggle label="진동" hint="부딪히거나 떨어질 때 (지원하는 기기만)" checked={s.vibration} onChange={vibration => onSettings({ vibration })} />
        <h3>화면</h3>
        <Choice label="시점" hint="도시 투어를 2.5D로 볼지 정해요" value={s.view} onChange={view => onSettings({ view })}
          options={[{ value: "auto", label: "2.5D 도시" }, { value: "flat", label: "클래식 옆모습" }]} />
        <Choice label="그래픽 효과" hint="낮음: 셰이더 배경을 끄고 입자를 줄여 배터리를 아껴요" value={s.effects} onChange={effects => onSettings({ effects })}
          options={[{ value: "high", label: "높음" }, { value: "low", label: "낮음" }]} />
        <Choice label="움직임 줄이기" hint="기기 설정을 따르거나, 게임에서만 화면 흔들림·날씨 움직임을 멈춰요" value={s.motion} onChange={motion => onSettings({ motion })}
          options={[{ value: "system", label: "기기 설정" }, { value: "reduce", label: "항상 줄이기" }]} />
        <h3>조작</h3>
        <Choice label="버튼 크기" value={s.controls} onChange={controls => onSettings({ controls })}
          options={[{ value: "normal", label: "보통" }, { value: "large", label: "크게" }]} />
        <Choice label="달리기 버튼 위치" value={s.runSide} onChange={runSide => onSettings({ runSide })}
          options={[{ value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" }]} />
        <Toggle label="점프 타이밍 표시" hint="바닥의 금색 띠가 빛날 때 점프하면 넘어요" checked={s.jumpGuide} onChange={jumpGuide => onSettings({ jumpGuide })} />
        <h3>저장</h3>
        <p className="treadmill-game__fine"><span className="treadmill-game__sync" data-status={status}>{storageLabel(status)}</span><br />
          별·도시 기록·캐릭터·설정만 저장해요. 게임 점수와 별은 실제 훈련 기록이나 포인트(P)와 연결되지 않아요.</p>
        {!confirm
          ? <button type="button" className="treadmill-game__ghost treadmill-game__danger" onClick={() => { setConfirm(true); setResetMessage(null) }}>투어 처음부터 다시 하기</button>
          : <div className="treadmill-game__confirm" role="alertdialog" aria-labelledby="treadmill-reset-title">
            <p id="treadmill-reset-title">모든 도시의 별과 기록을 지울까요? 캐릭터와 설정은 남아요.</p>
            <div className="treadmill-game__card-actions">
              <button type="button" className="treadmill-game__ghost" onClick={() => setConfirm(false)}>취소</button>
              <button type="button" className="treadmill-game__ghost treadmill-game__danger" onClick={() => {
                void onReset().then(ok => { setConfirm(false); setResetMessage(ok ? "투어 기록을 지웠어요." : "지금은 지울 수 없어요. 연결을 확인하고 다시 시도해 주세요.") })
              }}>지우기</button>
            </div>
          </div>}
        {resetMessage && <p className="treadmill-game__fine" role="status">{resetMessage}</p>}
      </div>}

      {tab === "help" && <div role="tabpanel" id="treadmill-panel-help" aria-labelledby="treadmill-tab-help" className="treadmill-game__panel treadmill-game__help">
        <h3>목표</h3>
        <p>각 도시는 10초짜리 구간 세 개예요. 바닥은 계속 뒤로 흐르니, 뒤쪽 끝으로 밀려 떨어지지 않게 버티면 완주예요.</p>
        <h3>조작</h3>
        <ul className="treadmill-game__rules">
          <li><b><Footprints size={18} aria-hidden="true" /></b><span><strong>달리기 꾹</strong>누르는 동안 앞으로 가고 에너지를 써요. 떼면 회복하지만 뒤로 밀려요.</span></li>
          <li><b><MoveUp size={18} aria-hidden="true" /></b><span><strong>점프</strong>장애물을 넘어요. 에너지 {TREADMILL_RULES.jumpCost}을 써요 (강화에 따라 달라져요).</span></li>
          <li><b><ChevronsRight size={18} aria-hidden="true" /></b><span><strong>대시</strong>짧게 빠르게 앞으로. 쓰고 나면 잠시 충전돼요.</span></li>
          <li><b><Pause size={18} aria-hidden="true" /></b><span><strong>일시정지</strong>오른쪽 위 버튼, 키보드 Esc·P. 다른 앱으로 가도 자동으로 멈춰요.</span></li>
        </ul>
        <p className="treadmill-game__fine">키보드: → 달리기 · Space/↑ 점프 · D 대시 · Esc 정지</p>
        <h3>구간</h3>
        <dl className="treadmill-game__glossary">
          <div><dt>낮 구간</dt><dd>기본 속도. 허들에 부딪히면 뒤로 밀리고 에너지가 줄어요.</dd></div>
          <div><dt>노을 구간</dt><dd>비·모래·꽃잎 길처럼 달려도 덜 나아가요. 앞쪽 공간을 미리 벌어 두세요.</dd></div>
          <div><dt>밤 구간</dt><dd>못판은 한 번만 닿아도 끝. 점프할 에너지를 남겨 두세요.</dd></div>
        </dl>
        <h3>강화</h3>
        <dl className="treadmill-game__glossary">
          {TREADMILL_UPGRADES.map(item => <div key={item.id}><dt>{item.name}</dt><dd>+ {item.benefit}<br />− {item.cost}</dd></div>)}
        </dl>
        <h3>별과 해금</h3>
        <ul className="treadmill-game__bullets">
          <li><Star size={12} aria-hidden="true" /> 완주 1개 · 한 번만 부딪히면 2개 · 부딪힘 없이 3개</li>
          <li>도시를 완주하면 다음 도시가 열려요. 부산을 완주하면 시즌 2 월드 투어가 열려요.</li>
          <li>도시 완주와 별 개수로 캐릭터가 열려요. 캐릭터는 모습만 달라요.</li>
          <li>도시가 뒤로 갈수록 바닥이 조금 빨라지고 장애물이 늘어요.</li>
        </ul>
        <h3>훈련과의 관계</h3>
        <p><Zap size={12} aria-hidden="true" /> 게임 에너지·점수·별은 게임 안에서만 쓰여요. 실제 훈련 기록·몸 상태·포인트(P)를 읽거나 바꾸지 않아요.</p>
      </div>}

      {tab === "licenses" && <div role="tabpanel" id="treadmill-panel-licenses" aria-labelledby="treadmill-tab-licenses" className="treadmill-game__panel">
        <p>이 게임의 캐릭터·도시·랜드마크 그림과 효과음은 TrainOracle이 코드로 직접 그리거나 합성했어요. 실제 건축물은 단순한 실루엣으로만 표현했어요. 아래 오픈소스를 사용해요.</p>
        <ul className="treadmill-game__licenses">
          {LICENSES.map(item => <li key={item.name}>
            <strong>{item.name} <small>{item.version}</small></strong>
            <span>{item.use}</span>
            <span>{item.license} · {item.copyright}</span>
            <a href={item.file} target="_blank" rel="noreferrer">라이선스 전문 보기</a>
          </li>)}
        </ul>
        <p className="treadmill-game__fine">앱 전체에 포함된 소프트웨어 전체 목록: 
          <a href="legal/third-party-notices.html" target="_blank" rel="noreferrer">오픈소스 소프트웨어 고지</a>(더보기에서도 볼 수 있어요)</p>
      </div>}
    </section>
  </div>
}

/** In-game notice for what the minigame ships. Versions follow app/package-lock.json (checked by a test). */
export const LICENSES = [
  { name: "shaders", version: "4.0.2", license: "MIT", copyright: "© 2026 Shader Effects Inc.", use: "WebGPU 하늘·완주 연출 (지원 기기에서만 내려받음)", file: "licenses/shaders-MIT.txt" },
  { name: "TypeGPU", version: "0.12.3", license: "MIT", copyright: "© 2025 Software Mansion", use: "shaders가 쓰는 WebGPU 도구", file: "licenses/typegpu-MIT.txt" },
  { name: "tinyest", version: "0.3.4", license: "MIT", copyright: "© 2025 Software Mansion", use: "TypeGPU가 쓰는 코드 변환 도구", file: "licenses/tinyest-MIT.txt" },
  { name: "typed-binary", version: "4.3.3", license: "MIT", copyright: "© 2022 Iwo Plaza", use: "TypeGPU가 쓰는 데이터 형식 도구", file: "licenses/typed-binary-MIT.txt" },
  { name: "tsover-runtime", version: "0.0.7", license: "Apache-2.0", copyright: "Software Mansion (TypeGPU 프로젝트)", use: "TypeGPU가 쓰는 연산자 런타임 (수정 없이 사용)", file: "licenses/tsover-runtime-Apache-2.0.txt" },
  { name: "Lucide", version: "0.468.0", license: "ISC", copyright: "© Lucide Contributors, Cole Bemis (Feather, MIT)", use: "버튼 아이콘", file: "licenses/lucide-ISC.txt" },
  { name: "Pretendard", version: "", license: "SIL OFL 1.1", copyright: "© 2021 Kil Hyung-jin", use: "글꼴", file: "fonts/Pretendard-LICENSE.txt" },
] as const
