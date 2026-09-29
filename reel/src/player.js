// Interactive preview + real-time export, and the hooks used by render.mjs.
(function () {
  'use strict';
  const R = window.REEL, CFG = R.CFG;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);

  // ── headless render hooks ───────────────────────────────────────────────
  R.frame = (t) => R.render(ctx, t);
  R.frameJPEG = (t, q = 0.93) => { R.render(ctx, t); return canvas.toDataURL('image/jpeg', q); };
  if (params.has('render')) {
    document.body.classList.add('render');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const status = (s) => ($('status').textContent = s);
  const audio = new Audio();
  audio.preload = 'auto';
  let hasAudio = false, playing = false, clockStart = 0, clockT = 0, rawAnalysis = null;
  let offset = CFG.audioOffset || 0;
  $('offset').value = offset;

  const now = () => {
    if (hasAudio) return audio.currentTime - offset;
    return playing ? clockT + (performance.now() - clockStart) / 1000 : clockT;
  };
  function seek(t) {
    t = Math.max(0, Math.min(CFG.duration, t));
    if (hasAudio) audio.currentTime = Math.max(0, t + offset);
    clockT = t; clockStart = performance.now();
  }
  function setPlaying(p) {
    playing = p;
    if (hasAudio) (p ? audio.play() : audio.pause());
    else { clockT = now(); clockStart = performance.now(); }
    $('play').textContent = p ? 'Pause' : 'Play';
  }

  function applyAnalysis() {
    if (!rawAnalysis) return;
    R.setAnalysis(ReelAudio.shift(rawAnalysis, offset));
  }

  async function loadAudio(blob, name) {
    status(`Analysing ${name}…`);
    const buf = await blob.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ac.decodeAudioData(buf.slice(0));
    ac.close();
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const d = decoded.getChannelData(c);
      for (let i = 0; i < d.length; i++) mono[i] += d[i] / decoded.numberOfChannels;
    }
    await new Promise((r) => setTimeout(r, 20));
    rawAnalysis = ReelAudio.analyze(mono, decoded.sampleRate);
    applyAnalysis();
    audio.src = URL.createObjectURL(blob);
    hasAudio = true;
    seek(0);
    status(`${name}: ${rawAnalysis.bpm} BPM, ${rawAnalysis.beats.length} beats, ${rawAnalysis.onsets.length} onsets detected. Cuts and words are snapped to the song.`);
  }

  $('file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadAudio(f, f.name).catch((err) => status('Could not decode audio: ' + err.message)); });
  const stage = $('stage');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault(); stage.classList.remove('dragging');
    const f = e.dataTransfer.files[0];
    if (f) loadAudio(f, f.name).catch((err) => status('Could not decode audio: ' + err.message));
  });
  $('play').onclick = () => setPlaying(!playing);
  $('restart').onclick = () => { seek(0); setPlaying(true); };
  $('scrub').addEventListener('input', (e) => seek(+e.target.value));
  $('offset').addEventListener('change', (e) => { const t = now(); offset = +e.target.value || 0; applyAnalysis(); seek(t); });
  canvas.addEventListener('click', () => setPlaying(!playing));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') seek(now() + 1);
    if (e.code === 'ArrowLeft') seek(now() - 1);
  });

  // Try a song placed next to the page (audio/song.mp3 etc.) when served over http.
  (async () => {
    await R.ready;
    if (location.protocol.startsWith('http')) {
      for (const n of ['song.mp3', 'song.m4a', 'song.wav', 'song.aac', 'song.ogg']) {
        try {
          const res = await fetch('audio/' + n);
          if (res.ok) { await loadAudio(await res.blob(), n); break; }
        } catch (_) { /* not present */ }
      }
    }
    requestAnimationFrame(loop);
  })();

  let recorder = null;
  function loop() {
    let t = now();
    if (t >= CFG.duration) {
      if (recorder) { recorder.stop(); recorder = null; }
      setPlaying(false); seek(CFG.duration - 0.001); t = CFG.duration - 0.001;
    }
    R.render(ctx, t);
    $('scrub').value = t;
    $('time').textContent = `${t.toFixed(2)} / ${CFG.duration.toFixed(2)}`;
    const L = R.lineAt(t);
    $('lyric').textContent = L.text || '';
    requestAnimationFrame(loop);
  }

  // Real-time export with MediaRecorder (MP4 where supported, else WebM).
  let mediaSource = null, actx = null, dest = null;
  $('export').onclick = async () => {
    if (recorder) return;
    const stream = canvas.captureStream(CFG.fps);
    if (hasAudio) {
      if (!actx) {
        actx = new AudioContext();
        mediaSource = actx.createMediaElementSource(audio);
        dest = actx.createMediaStreamDestination();
        mediaSource.connect(dest); mediaSource.connect(actx.destination);
      }
      await actx.resume();
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16e6, audioBitsPerSecond: 256e3 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'king-of-the-chase-reel.' + (mimeType.includes('mp4') ? 'mp4' : 'webm');
      a.click();
      status('Export finished — ' + a.download);
      $('export').disabled = false;
    };
    seek(0);
    recorder.start(250);
    setPlaying(true);
    $('export').disabled = true;
    status('Recording in real time… keep this tab visible for 60 s.');
  };
})();
