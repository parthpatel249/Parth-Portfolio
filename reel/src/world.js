// Stadium world, broadcast HUD, lyric strip, transitions and finishing.
(function () {
  'use strict';
  const { clamp, lerp, inv, rnd, TAU } = K;
  const W = window.REEL_CONFIG.width, H = window.REEL_CONFIG.height;
  const WORLD = (window.WORLD = {});

  const THEMES = {
    intro: { top: '#010208', bot: '#061233', glow: '#2f5bff', beam: '#d5e3ff', acc: '#ffc933', acc2: '#27c4ff', crowd: '#02040a', field: '#05301a' },
    wi: { top: '#10020a', bot: '#3d0719', glow: '#ff2f5f', beam: '#ffd9b0', acc: '#f6b40e', acc2: '#ff4d6d', crowd: '#0a0205', field: '#062a17' },
    ind: { top: '#010726', bot: '#0b2f8f', glow: '#2b6bff', beam: '#d8ecff', acc: '#ff8c1a', acc2: '#27c4ff', crowd: '#010416', field: '#063a1f' },
    sky: { top: '#00111d', bot: '#00507d', glow: '#16b6ff', beam: '#dff6ff', acc: '#27c4ff', acc2: '#ffc933', crowd: '#01070d', field: '#063a1f' },
    king: { top: '#080500', bot: '#2e1c00', glow: '#ffae00', beam: '#fff1c9', acc: '#ffc933', acc2: '#ff8c1a', crowd: '#070400', field: '#1a270a' },
    gold: { top: '#110900', bot: '#4a2e00', glow: '#ffcc33', beam: '#fff6d8', acc: '#ffe08a', acc2: '#ff8c1a', crowd: '#090500', field: '#1a270a' },
    flag: { top: '#000824', bot: '#0b2f8f', glow: '#ff9933', beam: '#ffffff', acc: '#ff9933', acc2: '#138808', crowd: '#010416', field: '#063a1f' },
  };
  WORLD.theme = (k) => THEMES[k] || THEMES.ind;
  const mixCache = new Map();
  WORLD.mixTheme = (a, b, t) => {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const q = Math.round(t * 40) / 40;
    const key = JSON.stringify([a.top, b.top, a.glow, b.glow, q]);
    let m = mixCache.get(key);
    if (!m) {
      m = {};
      for (const k in a) m[k] = K.mix(a[k], b[k], q);
      if (mixCache.size > 500) mixCache.clear();
      mixCache.set(key, m);
    }
    return m;
  };

  // ── background ──────────────────────────────────────────────────────────
  let vignette = null, grain = null;
  function lampTower(ctx, x, y, dir, on, th, t) {
    if (on <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir * 0.22);
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(-120, -70, 240, 150);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const lx = -96 + c * 48, ly = -46 + r * 48;
        const flick = 0.85 + 0.15 * Math.sin(t * 40 + r * 3 + c);
        ctx.fillStyle = K.rgba('#ffffff', on * flick);
        ctx.beginPath(); ctx.arc(lx, ly, 15, 0, TAU); ctx.fill();
        K.glow(ctx, lx, ly, 70, th.beam, on * 0.5);
      }
    }
    ctx.restore();
    K.glow(ctx, x, y, 420, th.beam, on * 0.45);
  }

  function beams(ctx, t, th, S, lights) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const towers = [[70, 150, 1, lights[0]], [W - 70, 150, -1, lights[1]]];
    for (const [tx, ty, dir, on] of towers) {
      if (on <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const base = Math.atan2(1250 - ty, W / 2 - tx + dir * (k - 1) * 260);
        const a = base + Math.sin(t * 0.45 + k * 2.1 + dir) * 0.16;
        const spread = 0.075 + 0.02 * k, len = 2300;
        const inten = on * (0.1 + 0.06 * S.kick) * (k === 1 ? 1.2 : 0.8);
        const g = ctx.createLinearGradient(tx, ty, tx + Math.cos(a) * len, ty + Math.sin(a) * len);
        g.addColorStop(0, K.rgba(th.beam, inten * 2.2));
        g.addColorStop(0.35, K.rgba(th.beam, inten));
        g.addColorStop(1, K.rgba(th.beam, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a - spread) * len, ty + Math.sin(a - spread) * len);
        ctx.lineTo(tx + Math.cos(a + spread) * len, ty + Math.sin(a + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function stands(ctx, t, th, S) {
    // tiered stand silhouette
    const y0 = 1270;
    const g = ctx.createLinearGradient(0, y0 - 60, 0, 1560);
    g.addColorStop(0, K.rgba(th.crowd, 0));
    g.addColorStop(0.25, K.rgba(th.crowd, 0.85));
    g.addColorStop(1, th.crowd);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 40);
    ctx.quadraticCurveTo(W / 2, y0 - 70, W, y0 + 40);
    ctx.lineTo(W, 1600); ctx.lineTo(0, 1600);
    ctx.closePath(); ctx.fill();
    // phone lights / camera flashes
    const flashBoost = S.kick;
    for (let i = 0; i < 170; i++) {
      const u = rnd(i, 1), v = rnd(i, 2);
      const x = u * W;
      const arc = Math.pow((x - W / 2) / (W / 2), 2) * 110;
      const y = y0 - 30 + arc + v * 250;
      const tw = Math.pow(Math.max(0, Math.sin(t * (1 + rnd(i, 3) * 3) + rnd(i, 4) * 50)), 12);
      const a = 0.12 + 0.7 * tw + (rnd(i, 5) < 0.18 ? flashBoost * 0.6 : 0);
      ctx.fillStyle = K.rgba(rnd(i, 6) < 0.5 ? '#ffffff' : th.beam, a * 0.8);
      ctx.fillRect(x, y, 3, 3);
      if (tw > 0.6) K.glow(ctx, x + 1, y + 1, 18, th.beam, (tw - 0.6) * 1.2);
    }
  }

  function field(ctx, t, th) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(W / 2, 2000, 1250, 520, 0, 0, TAU);
    const fg = ctx.createLinearGradient(0, 1480, 0, H);
    fg.addColorStop(0, K.mix(th.field, '#000000', 0.2));
    fg.addColorStop(1, K.mix(th.field, '#000000', 0.65));
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.clip();
    for (let k = 0; k < 9; k++) {
      if (k % 2) continue;
      const a = 1480 + Math.pow(k / 9, 1.6) * 460, b = 1480 + Math.pow((k + 1) / 9, 1.6) * 460;
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fillRect(0, a, W, b - a);
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(W / 2, 2000, 1180, 470, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.restore();
  }

  function bokeh(ctx, t, th) {
    for (let i = 0; i < 26; i++) {
      const sp = 20 + rnd(i, 9) * 60;
      const x = rnd(i, 7) * W + Math.sin(t * 0.3 + i) * 40;
      const y = ((((rnd(i, 8) * (H + 300) - t * sp) % (H + 300)) + H + 300) % (H + 300)) - 150;
      const r = 20 + rnd(i, 10) * 60;
      K.glow(ctx, x, y, r, i % 3 ? th.glow : th.acc, 0.08 + rnd(i, 11) * 0.1);
    }
  }

  function foregroundCrowd(ctx, t, th, S) {
    const n = 15;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (W / n) + (rnd(i, 21) - 0.5) * 40;
      const bounce = (S.kick * 18 + (S.fx.crowd || 0) * 24) * (0.4 + rnd(i, 22)) * Math.abs(Math.sin(t * 3 + i));
      const y = 1790 + rnd(i, 23) * 70 - bounce;
      const hr = 36 + rnd(i, 24) * 14;
      ctx.fillStyle = th.crowd;
      // raised arms for some
      if (rnd(i, 25) < 0.45) {
        const side = rnd(i, 26) < 0.5 ? -1 : 1;
        const sway = Math.sin(t * 4 + i) * 0.25;
        const ax = x + side * hr * 0.9, ay = y + hr * 0.9;
        const hx = ax + Math.sin(sway + side * 0.3) * 150, hy = ay - Math.cos(sway) * 190;
        ctx.strokeStyle = th.crowd; ctx.lineWidth = hr * 0.55; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = th.crowd;
        ctx.beginPath(); ctx.arc(hx, hy, hr * 0.42, 0, TAU); ctx.fill();
        if (rnd(i, 27) < 0.5) {
          ctx.fillStyle = '#e8f1ff';
          ctx.fillRect(hx - 9, hy - 16, 18, 28);
          K.glow(ctx, hx, hy - 2, 70, '#ffffff', 0.5 + 0.3 * Math.sin(t * 6 + i));
          ctx.fillStyle = th.crowd;
        }
      }
      ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
      K.rr(ctx, x - hr * 1.7, y + hr * 0.85, hr * 3.4, 300, hr * 0.9); ctx.fill();
      ctx.strokeStyle = K.rgba(th.glow, 0.55); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, hr, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
  }

  WORLD.background = (ctx, t, th, S) => {
    const fx = S.fx || {};
    ctx.fillStyle = K.vgrad(ctx, 0, H, [[0, th.top], [0.6, th.bot], [1, th.top]]);
    ctx.fillRect(0, 0, W, H);
    const lights = fx.lights || [1, 1];
    const lit = Math.max(lights[0], lights[1]);
    K.glow(ctx, W / 2, H * 0.42, 950 + 140 * S.level, th.glow, (0.28 + 0.22 * S.kick) * lit);
    beams(ctx, t, th, S, lights);
    lampTower(ctx, 70, 150, 1, lights[0], th, t);
    lampTower(ctx, W - 70, 150, -1, lights[1], th, t);
    stands(ctx, t, th, S);
    field(ctx, t, th);
    bokeh(ctx, t, th);
    foregroundCrowd(ctx, t, th, S);
    if (fx.dim) {
      ctx.fillStyle = `rgba(0,0,0,${fx.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // ── broadcast HUD ───────────────────────────────────────────────────────
  function glass(ctx, x, y, w, h, r, a = 0.72) {
    K.rr(ctx, x, y, w, h, r);
    ctx.fillStyle = `rgba(6,10,26,${a})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  WORLD.glass = glass;

  WORLD.hud = (ctx, t, S) => {
    const id = S.id;
    if (id === 'intro' || id === 'india' || id === 'finale') return;
    let show = 1;
    if (id === 'wi295') show = S.p(S.w(4) + 1.4, 0.4, E.outCubic);
    const lastLine = window.REEL.lines.find((l) => l.id === 'partner');
    if (lastLine) show *= 1 - inv(lastLine.end - 0.25, lastLine.end, t);
    if (show <= 0) return;
    const y = 214 - (1 - show) * 140;
    ctx.save();
    ctx.globalAlpha = show;
    // LIVE badge
    K.rr(ctx, 60, y, 126, 64, 14);
    ctx.fillStyle = '#e0142f'; ctx.fill();
    const blink = 0.55 + 0.45 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,255,255,${blink})`;
    ctx.beginPath(); ctx.arc(88, y + 32, 9, 0, TAU); ctx.fill();
    K.text(ctx, 'LIVE', 140, y + 32, { size: 38, fam: 'barlow', weight: 800, track: 3 });
    // score
    const wi = t < window.REEL.lines[2].start;
    const c = window.REEL.chase(t);
    const team = wi ? 'WI' : 'IND';
    const score = wi ? '295' : `${c.runs}/${c.wk}`;
    const overs = wi ? '50.0' : c.overs;
    glass(ctx, 198, y, 480, 64, 14);
    ctx.fillStyle = wi ? '#8a1538' : '#1f5bff';
    K.rr(ctx, 198, y, 14, 64, [14, 0, 0, 14]); ctx.fill();
    K.text(ctx, team, 232, y + 32, { size: 44, align: 'left', track: 2 });
    const bumped = 1 + 0.12 * S.pulse * (wi ? 0 : 1);
    K.text(ctx, score, 330, y + 32, { size: 46, align: 'left', fill: '#ffc933', sx: bumped, sy: bumped });
    K.text(ctx, `${overs} OV`, 520, y + 32, { size: 36, fam: 'barlow', weight: 700, align: 'left', fill: 'rgba(255,255,255,.75)', track: 1 });
    // target / need
    glass(ctx, 690, y, 330, 64, 14);
    const label = wi ? 'TARGET' : c.need > 0 ? 'NEED' : 'CHASED';
    const val = wi ? '296' : c.need > 0 ? String(c.need) : '✓';
    K.text(ctx, label, 716, y + 32, { size: 34, fam: 'barlow', weight: 800, align: 'left', fill: 'rgba(255,255,255,.7)', track: 3 });
    if (val === '✓') K.check(ctx, 920, y + 32, 44, '#19c16b', 0.2);
    else K.text(ctx, val, 994, y + 32, { size: 46, align: 'right', fill: '#ff8c1a' });
    ctx.restore();
  };

  // ── karaoke lyric strip ─────────────────────────────────────────────────
  WORLD.lyricStrip = (ctx, t, S) => {
    const L = S.L;
    if (!L.words.length) return;
    const inA = S.p(L.start + 0.05, 0.3, E.outCubic);
    const outA = 1 - S.p(L.end - 0.18, 0.18);
    const a = inA * outA;
    if (a <= 0) return;
    const y = 1432 + (1 - inA) * 40;
    const o = { size: 42, fam: 'barlow', weight: 800, italic: true, track: 1 };
    const full = L.words.map((w) => w.text.toUpperCase()).join(' ');
    let size = K.fit(ctx, full, o, 860);
    size = Math.max(30, size);
    const oo = Object.assign({}, o, { size, align: 'left' });
    const space = K.measure(ctx, ' ', oo) + 6;
    const widths = L.words.map((w) => K.measure(ctx, w.text.toUpperCase(), oo));
    const total = widths.reduce((s, v) => s + v, 0) + space * (widths.length - 1);
    const pw = total + 150;
    ctx.save();
    ctx.globalAlpha = a;
    glass(ctx, W / 2 - pw / 2, y - 44, pw, 88, 44, 0.66);
    // EQ bars
    const ex = W / 2 - pw / 2 + 38;
    for (let i = 0; i < 4; i++) {
      const hgt = 10 + 34 * clamp(S.level * (0.5 + 0.5 * Math.abs(Math.sin(t * (7 + i * 2.3) + i))) + S.kick * 0.3 * (i % 2));
      ctx.fillStyle = S.theme.acc;
      K.rr(ctx, ex + i * 11, y - hgt / 2, 7, hgt, 3); ctx.fill();
    }
    let x = W / 2 - total / 2 + 36;
    L.words.forEach((w, k) => {
      const on = t >= w.t, active = on && t < w.t1;
      const pop = on ? 1 + 0.12 * Math.exp(-(t - w.t) * 10) : 1;
      K.text(ctx, w.text.toUpperCase(), x + widths[k] / 2, y + 2, Object.assign({}, oo, {
        align: 'center',
        fill: active ? S.theme.acc : on ? '#ffffff' : 'rgba(255,255,255,.38)',
        glow: active ? S.theme.acc : null, blur: 18, sx: pop, sy: pop,
      }));
      x += widths[k] + space;
    });
    ctx.restore();
  };

  // ── transitions ─────────────────────────────────────────────────────────
  WORLD.transitionHalf = (type) => ({ ball: 0.3, iris: 0.32, glitch: 0.16, flash: 0.18, blackout: 0.2 }[type] || 0.24);

  WORLD.transition = (ctx, type, p, thA, thB, t, scratch) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (type === 'slash') {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.38);
      const bands = [[thB.acc2, 520, 0.16], [thB.acc, 900, 0.08], [K.mix(thB.top, '#000000', 0.2), 2500, 0]];
      for (const [col, bw, lead] of bands) {
        const q = E.inOutCubic(clamp(p + lead));
        const cx = lerp(-1250 - bw / 2, 1250 + bw / 2, q);
        ctx.fillStyle = col;
        ctx.fillRect(cx - bw / 2, -1600, bw, 3200);
      }
      // speed lines on the main band
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      const q = E.inOutCubic(p);
      const cx = lerp(-2500, 2500, q);
      for (let i = 0; i < 14; i++) ctx.fillRect(cx - 1200 + rnd(i, 3) * 2400, -1600 + i * 230, 300 + rnd(i, 4) * 500, 6);
    } else if (type === 'ball') {
      // a ball rushes at the lens, fills the frame, then flies past
      const q = E.inExpo(clamp(p / 0.55));
      const r = lerp(30, 1500, q);
      const out = clamp((p - 0.5) / 0.5);
      if (p < 0.55) {
        const x = lerp(W * 0.2, W / 2, q), y = lerp(H * 0.8, H / 2, q);
        K.streak(ctx, x - 400 * (1 - q), y + 700 * (1 - q), x, y, r * 0.9, '#ffffff', 0.5 * (1 - q));
        K.ball(ctx, x, y, r, t * 22, 0.6, { glowA: 0.6 });
      }
      if (out > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - out) * 0.95})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (type === 'flash') {
      const f = Math.pow(1 - Math.abs(p - 0.5) * 2, 2);
      ctx.fillStyle = `rgba(255,255,255,${f * 0.9})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(W / 2, H / 2);
      for (let i = 0; i < 40; i++) {
        const a = rnd(i, 5) * TAU, r0 = 200 + rnd(i, 6) * 300;
        ctx.strokeStyle = `rgba(255,255,255,${f * 0.5})`;
        ctx.lineWidth = 3 + rnd(i, 7) * 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * (r0 + 900 * f), Math.sin(a) * (r0 + 900 * f));
        ctx.stroke();
      }
    } else if (type === 'glitch') {
      const f = 1 - Math.abs(p - 0.5) * 2;
      const seed = Math.floor(t * 30);
      if (scratch) {
        for (let i = 0; i < 12; i++) {
          const y = rnd(i, seed) * H, h = 20 + rnd(i, seed + 1) * 160;
          const dx = (rnd(i, seed + 2) - 0.5) * 220 * f;
          ctx.drawImage(scratch, 0, y, W, h, dx, y, W, h);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? `rgba(255,0,80,${0.35 * f})` : `rgba(0,220,255,${0.35 * f})`;
        ctx.fillRect(0, rnd(i, seed + 7) * H, W, 4 + rnd(i, seed + 8) * 26);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,255,255,${Math.pow(f, 4) * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    } else if (type === 'iris') {
      const q = p < 0.5 ? 1 - E.inCubic(p * 2) : E.outCubic((p - 0.5) * 2);
      const r = q * 1150;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H * 0.42, Math.max(0, r), 0, TAU, true);
      ctx.fill('evenodd');
      K.ring(ctx, W / 2, H * 0.42, r, 10, thB.acc, 0.8 * (1 - Math.abs(p - 0.5) * 2));
    } else if (type === 'blackout') {
      const f = p < 0.5 ? E.inCubic(p * 2) : 1;
      ctx.fillStyle = `rgba(0,0,0,${f})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  // ── finishing ───────────────────────────────────────────────────────────
  WORLD.post = (ctx, t, S) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fx = S.fx || {};
    // light leaks
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, W * (0.1 + 0.08 * Math.sin(t * 0.4)), H * 0.12, 700, S.theme.acc, 0.1 + 0.08 * S.kick);
    K.glow(ctx, W * (0.92 - 0.06 * Math.sin(t * 0.33)), H * 0.8, 800, S.theme.glow, 0.1);
    ctx.globalCompositeOperation = 'source-over';
    if (!vignette) {
      vignette = K.canvas(W, H);
      const g = vignette.getContext('2d');
      const rg = g.createRadialGradient(W / 2, H * 0.46, H * 0.25, W / 2, H * 0.5, H * 0.72);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,.72)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vignette, 0, 0);
    if (!grain) {
      grain = [];
      for (let k = 0; k < 4; k++) {
        const c = K.canvas(360, 640), g = c.getContext('2d');
        const img = g.createImageData(360, 640);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = (rnd(i, k + 99) * 255) | 0;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        grain.push(c);
      }
    }
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.055;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grain[Math.floor(t * 30) % 4], 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (fx.flash) {
      ctx.fillStyle = `rgba(255,255,255,${clamp(fx.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const fade = Math.max(1 - inv(0, 0.35, t), inv(59.35, 59.95, t));
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };
})();
