# Defense sound effects — source notice

`shot.wav`, `impact.wav` and `build.wav` are **original procedural PCM effects**
created for this project. Their source constructs every sample from sine waves
and deterministic seeded noise. No sampled recording, downloaded music,
third-party sound pack or generative-audio service is used.

- Format: RIFF/WAVE, 22,050 Hz, mono, 16-bit signed little-endian PCM.
- `shot.wav`: descending sine chirp and noise, 0.08 seconds, 3,572 bytes.
- `impact.wav`: 90 Hz sine and noise, 0.22 seconds, 9,746 bytes.
- `build.wav`: rising 523/659/784 Hz notes, 0.30 seconds, 13,274 bytes.
- Total: **26,592 bytes** across three WAV files.
- New Tripo tasks and additional Tripo credits for these effects: **0**.

[Generator and authoring record](https://github.com/hojune0330/TRAINORACLE/tree/main/character-art/defense-audio)

This is a provenance notice, not a new blanket public reuse license. The
separate [Phaser MIT license](../defense-v5/PHASER-LICENSE.txt),
[Kenney CC0 license](../kenney-td/License.txt), and
[Tripo/Blender visual-asset record](../defense-v5/CREDITS.md) apply to their
respective components and do not automatically license these audio files.
