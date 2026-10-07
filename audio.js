/* =====================================================
   BLOCK BLAST - AUDIO
   Semua suara dibuat langsung dengan Web Audio API,
   jadi tidak perlu file mp3/wav tambahan.

   Cara pakai dari logic.js:
     GameAudio.init();        // WAJIB dipanggil dari tap/klik pengguna
     GameAudio.select();      // pilih blok
     GameAudio.place();       // taruh blok
     GameAudio.clear(lines);  // hancurkan baris/kolom
     GameAudio.invalid();     // salah taruh
     GameAudio.tick();        // detik terakhir
     GameAudio.timeout();     // waktu habis
     GameAudio.gameOver();
     GameAudio.startMusic() / stopMusic()
     GameAudio.toggleMute()   // return true jika sekarang mute

   Untuk mengganti nada musik, ubah MELODY / BASS di bawah.
   Untuk mengganti volume, ubah VOLUME.
===================================================== */

const GameAudio = (() => {

  const VOLUME = {
    master: 0.7,
    sfx: 0.25,
    music: 0.05
  };

  /* Melodi musik latar (Hz). 0 = diam. */
  const MELODY = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 698.46, 880.00, 698.46,
    523.25, 659.25, 783.99, 1046.5,
    880.00, 783.99, 659.25, 587.33
  ];

  const BASS = [130.81, 130.81, 146.83, 110.00];

  const STEP_MS = 260;

  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicOn = false;
  let step = 0;

  /* Ingat pilihan mute */
  try {
    muted = localStorage.getItem("bb_muted") === "1";
  } catch (e) { /* abaikan */ }


  /* ---------- Dasar ---------- */

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME.master;
      master.connect(ctx.destination);
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function tone(freq, dur, opts = {}) {
    if (!ctx || muted || !freq) return;

    const {
      type = "sine",
      vol = VOLUME.sfx,
      delay = 0,
      slideTo = null
    } = opts;

    const t0 = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }


  /* ---------- Efek suara ---------- */

  function select() {
    tone(660, 0.07, { type: "triangle" });
  }

  function place() {
    tone(220, 0.12, { type: "square", vol: 0.14, slideTo: 140 });
    tone(440, 0.08, { type: "triangle", delay: 0.02 });
  }

  function clear(lines = 1) {
    const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const count = Math.min(base.length, 2 + lines * 1);

    for (let i = 0; i < count; i++) {
      tone(base[i], 0.18, {
        type: "triangle",
        delay: i * 0.065,
        vol: 0.22
      });
    }

    if (lines >= 2) {
      tone(1046.5, 0.45, { type: "sine", delay: count * 0.065, vol: 0.18 });
    }
  }

  function invalid() {
    tone(160, 0.16, { type: "sawtooth", vol: 0.12, slideTo: 100 });
  }

  function start() {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => {
      tone(f, 0.14, { type: "triangle", delay: i * 0.08 });
    });
  }

  function tick() {
    tone(880, 0.05, { type: "square", vol: 0.1 });
  }

  function timeout() {
    tone(300, 0.25, { type: "sawtooth", vol: 0.16, slideTo: 120 });
    tone(200, 0.3, { type: "square", vol: 0.1, delay: 0.1, slideTo: 90 });
  }

  function gameOver() {
    [392, 349.23, 311.13, 261.63].forEach((f, i) => {
      tone(f, 0.32, { type: "sawtooth", vol: 0.14, delay: i * 0.2 });
    });
  }


  /* ---------- Musik latar ---------- */

  function musicStep() {
    if (!musicOn || !ctx || muted) return;

    const note = MELODY[step % MELODY.length];
    tone(note, 0.22, { type: "sine", vol: VOLUME.music });

    if (step % 4 === 0) {
      const bass = BASS[Math.floor(step / 4) % BASS.length];
      tone(bass, 0.9, { type: "triangle", vol: VOLUME.music * 1.2 });
    }

    step++;
  }

  function startMusic() {
    if (musicOn) return;
    musicOn = true;
    step = 0;
    musicTimer = setInterval(musicStep, STEP_MS);
  }

  function stopMusic() {
    musicOn = false;
    clearInterval(musicTimer);
    musicTimer = null;
  }


  /* ---------- Mute ---------- */

  function setMuted(value) {
    muted = value;

    if (master) {
      master.gain.value = muted ? 0 : VOLUME.master;
    }

    try {
      localStorage.setItem("bb_muted", muted ? "1" : "0");
    } catch (e) { /* abaikan */ }
  }

  function toggleMute() {
    setMuted(!muted);
    if (!muted) {
      init();
      select();
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }


  /* Hentikan suara saat tab/aplikasi disembunyikan */
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;

    if (document.hidden) {
      ctx.suspend();
    } else if (ctx.state === "suspended") {
      ctx.resume();
    }
  });


  return {
    init,
    select,
    place,
    clear,
    invalid,
    tick,
    timeout,
    start,
    gameOver,
    startMusic,
    stopMusic,
    toggleMute,
    isMuted
  };

})();
