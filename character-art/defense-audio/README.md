# Original defense sound effects

Recorded 2026-10-16 KST. `synthesize.mjs` is the source for three original
procedural PCM effects. The script constructs WAV headers and each sample
directly; it imports no sampled recordings, audio libraries or third-party clips.

| File | Synthesis | Duration | File bytes |
| --- | --- | ---: | ---: |
| `shot.wav` | Short descending sine chirp plus seeded noise, exponential decay | 0.08 s | 3,572 |
| `impact.wav` | 90 Hz sine plus seeded noise, exponential decay | 0.22 s | 9,746 |
| `build.wav` | Three rising sine notes, 523/659/784 Hz, sine amplitude envelope | 0.30 s | 13,274 |

All three are **22,050 Hz, mono, 16-bit signed little-endian PCM**, in RIFF/WAVE
containers. Their total file size is **26,592 bytes**, including WAV headers.
The generator resets its deterministic noise seed to 42 per effect and uses an
LCG for noise; it makes no network calls and uses no Tripo credits.

Reproduce from the repository root with a supported Node runtime:

```sh
node character-art/defense-audio/synthesize.mjs
```

Output goes to `app/public/game/defense-audio/`. Re-running overwrites these three
generated effect files. The script, the actual WAV headers, channels, sample
rates, bit depths, durations and byte sizes were inspected for this record.
This establishes source/format provenance; it does not establish subjective
audio balance or that sound is enabled in every browser. Integrated playback,
mute behavior and user-gesture audio unlock are game-runtime checks.

These are project-authored synthesized files. No third-party recording license
is required by their source, and this record does not assign a new blanket
public reuse license. Phaser's MIT license, Kenney's CC0 assets and Tripo output
terms are separate; none is automatically applied to these sounds.

Public attribution: [`app/public/game/defense-audio/CREDITS.md`](../../app/public/game/defense-audio/CREDITS.md).
