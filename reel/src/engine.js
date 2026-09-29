// Timeline + beat engine and frame composition.
// REEL.render(ctx, t) draws one complete frame for time t (seconds); it keeps
// no state between frames, so frames can be rendered in any order.
(function () {
  'use strict';
  const CFG = window.REEL_CONFIG;
  const { clamp, lerp, inv } = K;
  const R = (window.REEL = { CFG, W: CFG.width, H: CFG.height, lines: [], analysis: null });

  // ── beats ───────────────────────────────────────────────────────────────
  let beats = [], downs = [], onsets = [], env = null;

  function bsearch(arr, t, key) {
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = key ? arr[mid][key] : arr[mid];
      if (v <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }
  R.beatPrev = (t) => { const i = bsearch(beats, t); return i < 0 ? -Infinity : beats[i]; };
  R.beatNext = (t) => { const i = bsearch(beats, t); return beats[i + 1] ?? Infinity; };
  R.beatIndex = (t) => bsearch(beats, t);
  R.pulse = (t, decay = 7) => { const b = R.beatPrev(t); return b === -Infinity ? 0 : Math.exp(-(t - b) * decay); };
  R.downPulse = (t, decay = 5) => { const i = bsearch(downs, t); return i < 0 ? 0 : Math.exp(-(t - downs[i]) * decay); };
  function envAt(arr, t) {
    const x = t * env.rate, i = Math.floor(x), f = x - i;
    const a = arr[clamp(i, 0, arr.length - 1)] || 0, b = arr[clamp(i + 1, 0, arr.length - 1)] || 0;
    return lerp(a, b, f);
  }
  R.level = (t) => (env ? envAt(env.rms, t) : 0.45 + 0.4 * R.pulse(t, 5));
  R.kick = (t) => (env ? Math.max(envAt(env.low, t), 0.6 * R.pulse(t, 9)) : R.pulse(t, 9));
  R.nearestBeat = (t, win) => {
    const i = bsearch(beats, t);
    let best = t, bd = win;
    for (const j of [i, i + 1]) {
      const b = beats[j];
      if (b != null && Math.abs(b - t) <= bd) { bd = Math.abs(b - t); best = b; }
    }
    return best;
  };
  R.nearestOnset = (t, win) => {
    let best = null, bs = -1;
    const i = bsearch(onsets, t + win, 't');
    for (let j = i; j >= 0 && onsets[j].t >= t - win; j--) {
      const o = onsets[j];
      const score = o.s * (1 - (Math.abs(o.t - t) / win) * 0.5);
      if (score > bs) { bs = score; best = o.t; }
    }
    return best;
  };

  // ── words & lines ───────────────────────────────────────────────────────
  function tokenize(text) {
    const out = [];
    for (const tok of text.split(/\s+/).filter(Boolean)) {
      if (!/[\p{L}\p{N}]/u.test(tok) && out.length) out[out.length - 1] += ' ' + tok;
      else out.push(tok);
    }
    return out;
  }
  function syllables(word) {
    const bare = word.replace(/[^\p{L}\p{N},]/gu, '').replace(/,$/, '');
    const map = CFG.syllables || {};
    for (const k of [word, bare, bare.toUpperCase(), bare.toLowerCase()]) if (map[k] != null) return map[k];
    if (/^\d/.test(bare)) return Math.max(2, bare.replace(/\D/g, '').length);
    const groups = bare.toLowerCase().match(/[aeiouy]+/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  function rebuild() {
    const L = CFG.lines;
    const hasAudio = R.hasAudio;
    const starts = L.map((l, i) => (i === 0 || !hasAudio ? l.start : R.nearestBeat(l.start, CFG.cutSnapWindow)));
    R.lines = L.map((l, i) => {
      const start = starts[i];
      const end = i < L.length - 1 ? starts[i + 1] : l.end;
      const toks = tokenize(l.text || '');
      const syl = toks.map(syllables);
      const total = syl.reduce((a, b) => a + b, 0) || 1;
      const dur = end - start;
      const lead = Math.min(0.14, dur * 0.05);
      const tail = Math.min(0.55, dur * 0.12);
      const span = dur - lead - tail;
      let acc = 0, prev = -Infinity;
      const words = toks.map((text, k) => {
        let t = l.times && l.times[k] != null ? l.times[k] : start + lead + (acc / total) * span;
        if (!(l.times && l.times[k] != null) && hasAudio && onsets.length) {
          const o = R.nearestOnset(t, CFG.snapWindow);
          if (o != null) t = o;
        }
        t = Math.max(t, prev + 0.07);
        prev = t;
        acc += syl[k];
        return { text, t };
      });
      words.forEach((w, k) => (w.t1 = k < words.length - 1 ? words[k + 1].t : end - tail * 0.3));
      return Object.assign({}, l, { start, end, words, index: i });
    });
  }

  R.setAnalysis = (a) => {
    R.hasAudio = !!(a && !a.synthetic);
    R.analysis = a || window.ReelAudio.grid(CFG.fallbackBpm, 0, CFG.duration + 2);
    beats = R.analysis.beats || [];
    downs = R.analysis.downbeats || [];
    onsets = R.analysis.onsets || [];
    env = R.analysis.env || null;
    rebuild();
  };

  R.lineAt = (t) => {
    let i = 0;
    while (i < R.lines.length - 1 && t >= R.lines[i + 1].start) i++;
    return R.lines[i];
  };

  // Broadcast score (runs tick on beats).
  R.chase = (t) => {
    const keys = CFG.chase.keys;
    const tb = Math.max(keys[0][0], Math.min(t, R.beatPrev(t) === -Infinity ? t : R.beatPrev(t) + 0.02));
    const balls = (ov) => Math.floor(ov) * 6 + Math.round((ov % 1) * 10);
    let k = 0;
    while (k < keys.length - 2 && tb >= keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1];
    const u = clamp((tb - a[0]) / (b[0] - a[0]));
    const runs = Math.round(lerp(a[1], b[1], u));
    const wk = u >= 1 ? b[2] : a[2];
    const bl = Math.round(lerp(balls(a[3]), balls(b[3]), u));
    return { runs, wk, overs: `${Math.floor(bl / 6)}.${bl % 6}`, need: Math.max(0, CFG.chase.target - runs), target: CFG.chase.target };
  };

  // ── state passed to scenes ──────────────────────────────────────────────
  function state(t, L) {
    const S = {
      t, L, id: L.id, start: L.start, end: L.end, d: L.end - L.start, lt: t - L.start,
      pulse: R.pulse(t), kick: R.kick(t), level: R.level(t), down: R.downPulse(t),
      w: (k) => (L.words[k] ? L.words[k].t : L.start),
      p: (t0, dur = 0.4, ease) => { const v = clamp((t - t0) / dur); return ease ? ease(v) : v; },
      since: (t0) => t - t0,
      hit: (t0, decay = 6) => (t >= t0 ? Math.exp(-(t - t0) * decay) : 0),
    };
    S.at = (k, dur = 0.4, ease = E.outCubic, delay = 0) => S.p(S.w(k) + delay, dur, ease);
    return S;
  }
  R.state = state;

  // ── composition ─────────────────────────────────────────────────────────
  let scratch = null;
  R.render = (ctx, tRaw) => {
    const t = clamp(tRaw, 0, CFG.duration - 1e-4);
    const W = R.W, H = R.H;
    const L = R.lineAt(t);
    const S = state(t, L);
    const scene = window.SCENES[L.id] || {};
    const fx = (scene.fx && scene.fx(S)) || {};
    S.fx = fx;

    // theme: cross-fade from the previous line's theme for 0.35 s
    const prev = R.lines[L.index - 1];
    let theme = WORLD.theme(L.theme);
    if (prev) theme = WORLD.mixTheme(WORLD.theme(prev.theme), theme, inv(L.start - 0.05, L.start + 0.35, t));
    if (fx.themeTo) theme = WORLD.mixTheme(theme, WORLD.theme(fx.themeTo), fx.themeMix ?? 1);
    S.theme = theme;

    // camera: beat breathing + cut punch + scene shake
    const cutPunch = S.hit(L.start, 7) * (L.index > 0 ? 0.05 : 0);
    const zoom = 1 + 0.012 * S.kick + cutPunch + (fx.zoom || 0);
    const sh = (fx.shake || 0) + 5 * S.down;
    const cx = K.noise(t * 38, 11) * sh, cy = K.noise(t * 38, 23) * sh;
    const rot = K.noise(t * 21, 37) * sh * 0.0009 + (fx.rot || 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    WORLD.background(ctx, t, theme, S);
    ctx.translate(W / 2 + cx, H / 2 + cy);
    ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    if (scene.draw) scene.draw(ctx, S);
    ctx.restore();

    ctx.save();
    WORLD.hud(ctx, t, S);
    if (CFG.showLyricStrip && scene.strip !== false) WORLD.lyricStrip(ctx, t, S);
    ctx.restore();

    // transitions around the boundary into the next line / from the previous one
    const next = R.lines[L.index + 1];
    for (const [a, b] of [[prev, L], [L, next]]) {
      if (!a || !b || !a.cut) continue;
      const tw = WORLD.transitionHalf(a.cut);
      const p = (t - b.start + tw) / (2 * tw);
      if (p > 0 && p < 1) {
        if (a.cut === 'glitch') {
          if (!scratch) scratch = K.canvas(W, H);
          const sc = scratch.getContext('2d');
          sc.setTransform(1, 0, 0, 1, 0, 0);
          sc.clearRect(0, 0, W, H);
          sc.drawImage(ctx.canvas, 0, 0);
        }
        WORLD.transition(ctx, a.cut, p, WORLD.theme(a.theme), WORLD.theme(b.theme), t, scratch);
      }
    }

    WORLD.post(ctx, t, S);
  };

  // ── fonts ───────────────────────────────────────────────────────────────
  R.ready = (async () => {
    const faces = window.REEL_FONTS || [];
    await Promise.all(faces.map(async (f) => {
      const bin = atob(f.data), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const face = new FontFace(f.family, buf, { style: f.style, weight: f.weight });
      await face.load();
      document.fonts.add(face);
    }));
    R.setAnalysis(null);
  })();
})();
