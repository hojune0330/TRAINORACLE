(() => {
  "use strict";

  // Original short bell phrases. Synthesized locally so the offline edition has the same soundtrack.
  const Audio = window.AudioContext || window.webkitAudioContext;
  const tunes = {
    quiz: [72, 0, 76, 74, 0, 67, 0, 0, 69, 0, 72, 67, 0, 0, 0, 0],
    result: [72, 76, 79, 0, 81, 0, 79, 76, 74, 0, 72],
  };
  const cues = {
    start: [67, 72], step: [48], station: [72, 76], bag: [79, 84],
    turn: [74, 77], finish: [72, 76, 79], bib: [84, 79],
  };
  let ctx, master, timer, position = 0, place = "home", enabled = false;

  function note(pitch, at, duration, level) {
    if (!pitch) return;
    const sound = ctx.createOscillator(), envelope = ctx.createGain();
    sound.type = "sine";
    sound.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    sound.connect(envelope);
    envelope.connect(master);
    sound.onended = () => { sound.disconnect(); envelope.disconnect(); };
    sound.start(at);
    sound.stop(at + duration + 0.02);
  }
  function stopMusic() { clearTimeout(timer); position = 0; }
  function tick() {
    if (!enabled || document.hidden || !tunes[place] || ctx.state !== "running") return;
    const tune = tunes[place], result = place === "result";
    note(tune[position++], ctx.currentTime, result ? 0.42 : 0.32, 0.041);
    if (position >= tune.length) {
      if (result) return;
      position = 0;
    }
    timer = setTimeout(tick, result ? 220 : 460);
  }
  function restart() { stopMusic(); tick(); }
  function toggle() {
    if (enabled) {
      enabled = false;
      stopMusic();
      master.gain.value = 0;
      return false;
    }
    if (!Audio) return false;
    try {
      if (!ctx) {
        ctx = new Audio();
        master = ctx.createGain();
        master.connect(ctx.destination);
      }
      enabled = true;
      master.gain.value = 0.65;
      ctx.resume().then(() => {
        if (enabled) { play("bib"); restart(); }
      }).catch(() => { enabled = false; stopMusic(); window.dispatchEvent(new Event("rb-lap-audio")); });
      return true;
    } catch { enabled = false; return false; }
  }
  function play(cue) {
    if (!enabled || document.hidden || ctx.state !== "running" || !cues[cue]) return;
    cues[cue].forEach((pitch, index) => note(pitch, ctx.currentTime + index * 0.082,
      cue === "step" ? 0.07 : 0.19, cue === "step" ? 0.045 : 0.085));
  }
  function scene(next) {
    if (place === next) return;
    place = next;
    restart();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopMusic(); if (master) master.gain.value = 0; }
    else if (enabled) { master.gain.value = 0.65; restart(); }
  });
  window.addEventListener("pagehide", () => { enabled = false; stopMusic(); if (master) master.gain.value = 0; });
  window.RBLapSound = { get enabled() { return enabled; }, toggle, scene, play };
})();
