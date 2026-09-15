/* ============ audio.js — синтезированный звук (без файлов) ============ */
(function () {
  'use strict';
  const { $ } = U;

  let ctx = null;
  let master = null, sfxGain = null;
  let enabled = localStorage.getItem('roireaper.sound') !== '0';
  let volume = parseFloat(localStorage.getItem('roireaper.volume') || '0.7');
  let musicOn = localStorage.getItem('roireaper.music') === '1';
  let musicTimer = null;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
  }

  function resume() { try { ensure(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} }

  function tone({ freq = 440, to = null, type = 'sine', dur = 0.12, gain = 0.2, when = 0, attack = 0.005 }) {
    if (!enabled) return;
    ensure();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  function noise({ dur = 0.15, gain = 0.18, when = 0, filterFreq = 1200, type = 'lowpass', q = 1 }) {
    if (!enabled) return;
    ensure();
    const t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  const SFX = {
    ui() { tone({ freq: 520, to: 660, type: 'triangle', dur: 0.06, gain: 0.08 }); },
    tab() { tone({ freq: 380, to: 470, type: 'triangle', dur: 0.07, gain: 0.09 }); },
    click() {
      noise({ dur: 0.05, gain: 0.10, filterFreq: 2600, type: 'bandpass', q: 2 });
      tone({ freq: 190, to: 120, type: 'sawtooth', dur: 0.07, gain: 0.09 });
    },
    tick() { tone({ freq: 1250, type: 'square', dur: 0.03, gain: 0.05 }); },
    coin() {
      tone({ freq: 880, type: 'square', dur: 0.06, gain: 0.08 });
      tone({ freq: 1320, type: 'square', dur: 0.1, gain: 0.07, when: 0.06 });
    },
    buy() {
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.11, gain: 0.09, when: i * 0.06 }));
    },
    deny() { tone({ freq: 220, to: 110, type: 'sawtooth', dur: 0.22, gain: 0.12 }); },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.10, when: i * 0.08 }));
    },
    bigwin() {
      [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.2, gain: 0.1, when: i * 0.1 }));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.2, gain: 0.1, when: i * 0.11 }));
    },
    card() { noise({ dur: 0.05, gain: 0.06, filterFreq: 3000, type: 'highpass' }); },
    caseSpin() { tone({ freq: 300, to: 900, type: 'sawtooth', dur: 0.5, gain: 0.05 }); },
    explode() {
      noise({ dur: 0.4, gain: 0.25, filterFreq: 700, type: 'lowpass' });
      tone({ freq: 120, to: 40, type: 'sawtooth', dur: 0.4, gain: 0.15 });
    },
    hit() {
      noise({ dur: 0.1, gain: 0.18, filterFreq: 1500, type: 'lowpass' });
      tone({ freq: 160, to: 80, type: 'square', dur: 0.1, gain: 0.12 });
    },
    dash() { tone({ freq: 240, to: 720, type: 'sine', dur: 0.18, gain: 0.1 }); noise({ dur: 0.12, gain: 0.06, filterFreq: 2400, type: 'highpass' }); },
    reel() { tone({ freq: 950 + Math.random() * 200, type: 'square', dur: 0.025, gain: 0.035 }); },
    reveal() {
      tone({ freq: 400, to: 900, type: 'triangle', dur: 0.25, gain: 0.1 });
      [660, 990].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.18, gain: 0.07, when: 0.1 + i * 0.09 }));
    },
    rare() {
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.25, gain: 0.09, when: i * 0.07 }));
      noise({ dur: 0.5, gain: 0.05, filterFreq: 6000, type: 'highpass', when: 0.1 });
    },
    buzz() {
      tone({ freq: 150, to: 130, type: 'sawtooth', dur: 0.12, gain: 0.07 });
      noise({ dur: 0.08, gain: 0.05, filterFreq: 900, type: 'bandpass' });
    }
  };

  // Очень лёгкий «гудящий» эмбиент-луп
  function startMusic() {
    if (!musicOn) return;
    ensure();
    stopMusic();
    const scale = [220, 261.63, 293.66, 329.63, 392, 440];
    let step = 0;
    musicTimer = setInterval(() => {
      if (!enabled || !musicOn || document.hidden) return;
      const f = scale[step % scale.length] * (step % 12 < 6 ? 1 : 0.5);
      tone({ freq: f, type: 'sine', dur: 0.9, gain: 0.035 });
      if (step % 4 === 0) tone({ freq: f / 2, type: 'triangle', dur: 1.2, gain: 0.04 });
      step++;
    }, 750);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  function setEnabled(v) {
    enabled = v; localStorage.setItem('roireaper.sound', v ? '1' : '0');
    if (v) { resume(); if (musicOn) startMusic(); } else stopMusic();
    syncBtn();
  }
  function setVolume(v) { volume = v; localStorage.setItem('roireaper.volume', v); if (master) master.gain.value = v; }
  function setMusic(v) { musicOn = v; localStorage.setItem('roireaper.music', v ? '1' : '0'); if (v) startMusic(); else stopMusic(); }
  function syncBtn() { const b = $('#soundBtn'); if (b) b.textContent = enabled ? '🔊' : '🔇'; }

  document.addEventListener('pointerdown', resume, { once: false });
  document.addEventListener('keydown', resume, { once: false });

  window.Snd = { play: (n) => { try { resume(); SFX[n] && SFX[n](); } catch (e) {} },
    setEnabled, setVolume, setMusic, get enabled() { return enabled; }, get volume() { return volume; }, get musicOn() { return musicOn; }, syncBtn };
})();
