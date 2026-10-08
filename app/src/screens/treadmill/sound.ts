/**
 * Tiny synthesized game sounds (WebAudio oscillators). No audio files, no network.
 * The AudioContext is created only after a user gesture and only when sound is on.
 */
export type GameSound = "tick" | "go" | "jump" | "land" | "hit" | "clearHazard" | "stage" | "win" | "lose" | "tap"

type Note = { f: number; to?: number; t: number; d: number; type?: OscillatorType; v?: number }
const SOUNDS: Record<GameSound, Note[]> = {
  tick: [{ f: 660, t: 0, d: 0.08, type: "square", v: 0.08 }],
  go: [{ f: 880, t: 0, d: 0.18, type: "square", v: 0.1 }],
  jump: [{ f: 420, to: 820, t: 0, d: 0.12, type: "triangle", v: 0.16 }],
  land: [{ f: 160, to: 90, t: 0, d: 0.06, type: "sine", v: 0.12 }],
  hit: [{ f: 180, to: 60, t: 0, d: 0.22, type: "sawtooth", v: 0.14 }],
  clearHazard: [{ f: 990, t: 0, d: 0.06, type: "square", v: 0.06 }, { f: 1320, t: 0.05, d: 0.08, type: "square", v: 0.06 }],
  stage: [523, 659, 784].map((f, i) => ({ f, t: i * 0.09, d: 0.14, type: "square" as const, v: 0.08 })),
  win: [523, 659, 784, 1047, 784, 1047].map((f, i) => ({ f, t: i * 0.11, d: 0.18, type: "square" as const, v: 0.08 })),
  lose: [{ f: 392, to: 196, t: 0, d: 0.5, type: "triangle", v: 0.14 }],
  tap: [{ f: 740, t: 0, d: 0.04, type: "sine", v: 0.08 }],
}

let context: AudioContext | null = null

export function playGameSound(sound: GameSound, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    context ??= new Ctor()
    if (context.state === "suspended") void context.resume()
    const now = context.currentTime
    for (const note of SOUNDS[sound]) {
      const osc = context.createOscillator(), gain = context.createGain()
      osc.type = note.type ?? "sine"
      osc.frequency.setValueAtTime(note.f, now + note.t)
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, now + note.t + note.d)
      gain.gain.setValueAtTime(0.0001, now + note.t)
      gain.gain.exponentialRampToValueAtTime(note.v ?? 0.1, now + note.t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d)
      osc.connect(gain).connect(context.destination)
      osc.start(now + note.t); osc.stop(now + note.t + note.d + 0.02)
    }
  } catch { /* sound is optional */ }
}
