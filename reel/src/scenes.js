// Scene choreography, one per lyric line (see config.js).
// S.w(k) = time the k-th word of the line is sung; S.at(k, dur) = 0..1 reveal.
(function () {
  'use strict';
  const { clamp, lerp, inv, rnd, TAU } = K;
  const W = 1080, H = 1920;
  const C = K.C;

  // ── shared helpers ──────────────────────────────────────────────────────
  // Lay out words on one line; each appears when it is sung.
  function row(ctx, S, items, cx, y, o, anim = 'up') {
    const widths = items.map(([, s, ex]) => K.measure(ctx, s, Object.assign({}, o, ex)));
    const gap = (o.gap ?? 0.24) * (o.size || 100);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = o.rowAlign === 'left' ? cx : cx - total / 2;
    items.forEach(([k, s, ex], i) => {
      const w = widths[i];
      const p = S.at(k, o.dur ?? (anim === 'slam' ? 0.3 : 0.34), E.linear, o.delay ?? 0);
      if (p > 0) {
        const oo = Object.assign({}, o, ex, { align: 'center' });
        let dy = 0, sc = 1, a = 1;
        if (anim === 'up') { const e = E.outCubic(p); dy = (1 - e) * 60; a = e; }
        else if (anim === 'slam') { sc = lerp(2.1, 1, E.outExpo(p)); a = clamp(p * 4); }
        else if (anim === 'pop') { sc = E.outBack(p, 2.4); a = clamp(p * 3); }
        const beat = 1 + (o.beat ?? 0.03) * S.pulse;
        oo.sx = oo.sy = sc * beat;
        oo.alpha = (oo.alpha ?? 1) * a;
        K.text(ctx, s, x + w / 2, y + dy, oo);
      }
      x += w + gap;
    });
    return total;
  }

  function spotlight(ctx, x, y0, spread, len, color, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, K.rgba(color, a));
    g.addColorStop(1, K.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 40, y0); ctx.lineTo(x + 40, y0);
    ctx.lineTo(x + spread, y0 + len); ctx.lineTo(x - spread, y0 + len);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function rays(ctx, x, y, n, r, rot, color, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.rotate(rot);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, K.rgba(color, a)); g.addColorStop(1, K.rgba(color, 0));
    ctx.fillStyle = g;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a0 + (TAU / n) * 0.45);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function shockRing(ctx, x, y, S, t0, color, maxR = 520, dur = 0.7) {
    const p = S.p(t0, dur);
    if (p <= 0 || p >= 1) return;
    const e = E.outCubic(p);
    K.ring(ctx, x, y, lerp(40, maxR, e), lerp(26, 2, e), color, 1 - p);
  }

  function confetti(ctx, S, t0, x0, y0, n, colors, power = 1) {
    const tau = S.t - t0;
    if (tau <= 0 || tau > 3) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd(i, 1) - 0.5) * 2.6;
      const sp = (500 + rnd(i, 2) * 1300) * power;
      const drag = Math.exp(-tau * 1.2);
      const x = x0 + Math.cos(a) * sp * (1 - drag) / 1.2 + Math.sin(tau * 5 + i) * 20;
      const y = y0 + Math.sin(a) * sp * (1 - drag) / 1.2 + 320 * tau * tau;
      const alpha = 1 - K.inv(1.8, 3, tau);
      if (alpha <= 0 || y > H + 50) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tau * (4 + rnd(i, 3) * 8));
      ctx.scale(1, Math.cos(tau * (6 + rnd(i, 4) * 6)));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-9, -5, 18, 10);
      ctx.restore();
    }
  }

  function fireworks(ctx, S, t0, x0, y0, colors, n = 70) {
    const tau = S.t - t0;
    if (tau <= 0 || tau > 1.9) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x0, y0, 260, colors[0], 0.5 * Math.exp(-tau * 6));
    const pos = (i, u) => {
      const a = rnd(i, 9) * TAU, sp = 140 + Math.pow(rnd(i, 8), 0.5) * 420;
      const d = (sp * (1 - Math.exp(-u * 3))) / 3 * 1.8;
      return [x0 + Math.cos(a) * d, y0 + Math.sin(a) * d * 0.9 + 110 * u * u];
    };
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const al = (1 - tau / 1.9) * (0.65 + 0.35 * Math.sin(tau * 34 + i * 1.7));
      if (al <= 0) continue;
      const col = colors[i % colors.length];
      const [x, y] = pos(i, tau), [px, py] = pos(i, Math.max(0, tau - 0.12));
      ctx.strokeStyle = K.rgba(col, al * 0.8);
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      K.glow(ctx, x, y, 18, col, al);
      ctx.fillStyle = K.rgba('#ffffff', al);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.restore();
  }

  function jersey(ctx, cx, y0, w, fill, name, num, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(cx, y0);
    ctx.scale(w, w);
    ctx.beginPath();
    ctx.moveTo(-0.12, 0);
    ctx.quadraticCurveTo(0, 0.07, 0.12, 0);
    ctx.lineTo(0.33, 0.04); ctx.lineTo(0.52, 0.24); ctx.lineTo(0.41, 0.36); ctx.lineTo(0.31, 0.28);
    ctx.lineTo(0.31, 0.98); ctx.lineTo(-0.31, 0.98); ctx.lineTo(-0.31, 0.28);
    ctx.lineTo(-0.41, 0.36); ctx.lineTo(-0.52, 0.24); ctx.lineTo(-0.33, 0.04);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 0.006; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke();
    ctx.restore();
    K.text(ctx, name, cx, y0 + w * 0.2, { size: w * 0.14, alpha: a * 1.4, track: w * 0.012 });
    K.text(ctx, num, cx, y0 + w * 0.52, { size: w * 0.44, fill: 'none', stroke: 'rgba(255,255,255,.9)', lw: 6, alpha: a * 1.4 });
  }

  function chip(ctx, x, y, w, h, label, value, a, s, accent) {
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.globalAlpha *= a;
    WORLD.glass(ctx, -w / 2, -h / 2, w, h, 24, 0.7);
    ctx.fillStyle = accent;
    ctx.fillRect(-w / 2 + 24, h / 2 - 6, w - 48, 4);
    if (value === 'CHASED') {
      K.text(ctx, '296', -22, -22, { size: 74, fill: 'gold' });
      K.check(ctx, 80, -22, 64, '#19c16b', 0.22);
    } else K.text(ctx, value, 0, -22, { size: 74, fill: 'gold', maxW: w - 30 });
    K.text(ctx, label, 0, 44, { size: 28, fam: 'barlow', weight: 800, track: 5, alpha: 0.8 });
    ctx.restore();
  }

  const SCENES = (window.SCENES = {});

  // ── 0:00 intro — lights, ball to camera, title ─────────────────────────
  SCENES.intro = {
    fx(S) {
      const hit = 2.2;
      const flick = (t0) => (S.t < t0 ? 0 : S.t < t0 + 0.25 ? (Math.sin(S.t * 90) > 0 ? 1 : 0.2) : 1);
      return { lights: [flick(0.3), flick(0.62)], shake: 36 * S.hit(hit, 5), flash: 0.9 * S.hit(hit, 7), zoom: 0.05 * S.hit(hit, 4), dim: 0.3 * (1 - S.p(0.3, 0.8)) };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const a1 = S.p(0.55, 0.5, E.outCubic) * (1 - S.p(2.0, 0.2));
      K.text(ctx, 'INDIA  ×  WEST INDIES', W / 2, 600, { size: 62, fam: 'barlow', weight: 800, track: lerp(40, 12, a1), alpha: a1 });
      K.text(ctx, 'ONE DAY INTERNATIONAL', W / 2, 675, { size: 32, fam: 'barlow', weight: 700, track: 14, alpha: a1 * 0.8, fill: th.acc });
      if (t >= 0.95 && t < 2.2) {
        const p = (t - 0.95) / 1.25;
        const pos = (u) => {
          const q = E.inCubic(u);
          return [540 + Math.sin(u * 5) * 150 * (1 - q), 1060 - 160 * q, 9 * Math.pow(70, q)];
        };
        for (let k = 8; k >= 1; k--) {
          const u = Math.max(0, p - k * 0.025);
          const [x, y, r] = pos(u);
          K.glow(ctx, x, y, r * 1.5, '#bcd8ff', 0.12 * (1 - k / 9));
        }
        const [px, py] = pos(Math.max(0, p - 0.06));
        const [x, y, r] = pos(p);
        K.streak(ctx, px, py, x, y, r * 0.8, '#dce9ff', 0.5);
        K.ball(ctx, x, y, r, t * 26, 0.5);
      }
      if (t >= 2.2) {
        const ca = 1 - S.p(2.3, 0.7);
        if (ca > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * ca})`;
          ctx.lineCap = 'round';
          for (let i = 0; i < 18; i++) {
            let a = (i / 18) * TAU + rnd(i, 3) * 0.25, x = 540, y = 900, len = 0;
            ctx.lineWidth = 5 - 3 * rnd(i, 4);
            ctx.beginPath(); ctx.moveTo(x, y);
            for (let s = 0; s < 6; s++) {
              const L = 70 + rnd(i, s + 10) * 110;
              a += (rnd(i, s + 20) - 0.5) * 0.5;
              x += Math.cos(a) * L; y += Math.sin(a) * L; len += L;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          for (const rr of [110, 240]) {
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 18; i++) {
              const a = (i / 18) * TAU, j = rr * (0.85 + rnd(i, rr) * 0.3);
              i ? ctx.lineTo(540 + Math.cos(a) * j, 900 + Math.sin(a) * j) : ctx.moveTo(540 + Math.cos(a) * j, 900 + Math.sin(a) * j);
            }
            ctx.stroke();
          }
          ctx.restore();
        }
        const p = S.p(2.2, 0.4);
        const sc = lerp(2.2, 1, E.outExpo(p));
        const a = clamp(p * 4);
        rays(ctx, 540, 930, 18, 1100, t * 0.2, th.acc, 0.1 * a);
        K.text(ctx, 'KING OF', W / 2, 790, { size: 118, fam: 'barlow', weight: 900, italic: true, track: 12, sx: sc, sy: sc, alpha: a });
        K.text(ctx, 'THE CHASE', W / 2, 975, { size: 270, maxW: 930, fill: 'gold', glow: '#ff9d00', blur: 44, sx: sc, sy: sc, alpha: a, sheen: S.p(2.5, 0.5) * 1.4 - 0.2 });
        const p2 = S.p(2.45, 0.35, E.outCubic);
        K.text(ctx, 'IND  vs  WI  ·  295 TO CHASE', W / 2, 1150, { size: 44, fam: 'barlow', weight: 800, track: 10, alpha: p2, fill: 'rgba(255,255,255,.85)' });
      }
    },
  };

  // ── 0:03 "West Indies ne banaye, 295 ka score" ──────────────────────────
  SCENES.wi295 = {
    fx(S) {
      const done = S.w(4) + 1.1;
      return { shake: 16 * S.hit(done, 6) + 26 * S.hit(S.w(5), 7), flash: 0.3 * S.hit(done, 9) };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      K.text(ctx, 'WI', W / 2 + Math.sin(t * 0.4) * 30, 880, { size: 1000, fill: 'none', stroke: K.rgba(th.acc2, 0.13), lw: 5 });
      K.letters(ctx, 'WEST INDIES', W / 2, 455, { size: 176, track: 6, glow: 'rgba(0,0,0,.6)', blur: 20 }, (i) => {
        const k = i < 4 ? 0 : 1, j = i < 4 ? i : i - 5;
        const p = S.p(S.w(k) + j * 0.045, 0.42, E.outCubic);
        return { a: p, x: (1 - p) * 140, s: 1 + 0.03 * S.pulse, fill: i < 4 ? '#ffffff' : 'gold' };
      });
      row(ctx, S, [[2, 'NE'], [3, 'BANAYE,']], W / 2, 585, { size: 86, fam: 'barlow', weight: 900, italic: true, track: 4 });

      const tb = S.w(4) - 0.32;
      if (t >= tb) {
        const pb = S.p(tb, 0.45, (x) => E.outBack(x, 1.4));
        const by = lerp(-520, 670, pb);
        K.panel(ctx, 90, by, 900, 430, { accent: th.acc, glowA: 0.35 + 0.4 * S.pulse });
        K.text(ctx, 'WEST INDIES  ·  50 OVERS', W / 2, by + 68, { size: 38, fam: 'barlow', weight: 800, track: 8, fill: th.acc });
        const pc = S.p(S.w(4), 1.1, E.outExpo);
        K.roll(ctx, 295 * pc, W / 2, by + 228, { size: 262, digits: 3, fill: 'chrome', glow: pc >= 1 ? th.acc : '#ffffff', blur: 30 + 30 * S.hit(S.w(4) + 1.1, 3) });
        const ps = S.p(S.w(4) + 1.0, 0.4, E.outCubic);
        K.text(ctx, 'RUN RATE 5.90', 290, by + 372, { size: 36, fam: 'barlow', weight: 700, track: 4, alpha: ps * 0.85 });
        K.text(ctx, 'INNINGS CLOSED', 790, by + 372, { size: 36, fam: 'barlow', weight: 700, track: 4, alpha: ps * 0.85, fill: th.acc });
        for (let i = 0; i < 16; i++) {
          const tau = t - (S.w(4) + 1.1);
          if (tau < 0 || tau > 0.8) break;
          const a = rnd(i, 4) * TAU, d = tau * (300 + rnd(i, 5) * 500);
          K.sparkle(ctx, 540 + Math.cos(a) * (180 + d), by + 228 + Math.sin(a) * (80 + d * 0.5), 18, 1 - tau / 0.8, th.acc);
        }
      }
      const ps = S.at(5, 0.3, E.linear);
      if (ps > 0) K.stamp(ctx, 'KA SCORE!', W / 2, 1195, { size: 104, color: '#ffffff', rot: -0.07, s: lerp(2.4, 1, E.outExpo(ps)), alpha: clamp(ps * 4), track: 8 });
      const pt = S.p(S.w(6) + 0.45, 0.4, E.outBack);
      if (pt > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(pt);
        const y = 1318 + (1 - pt) * 60;
        K.rr(ctx, W / 2 - 330, y - 38, 660, 76, 38);
        ctx.fillStyle = K.vgrad(ctx, y - 38, y + 38, K.GRADS.saffron); ctx.fill();
        K.text(ctx, 'INDIA NEED 296 TO WIN', W / 2, y, { size: 46, fam: 'barlow', weight: 800, track: 4, fill: '#1a0b00' });
        ctx.restore();
      }
    },
  };

  // ── 0:09 "India boli — Bhai, tension nahi… we want more!" ───────────────
  SCENES.wantmore = {
    fx(S) {
      return { shake: 38 * S.hit(S.w(7), 5) + 10 * S.hit(S.w(5), 8) + 10 * S.hit(S.w(6), 8), crowd: S.t > S.w(7) ? 1 : 0, zoom: 0.05 * S.hit(S.w(7), 5) };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      // chat header
      const ph = S.at(0, 0.45, (x) => E.outBack(x, 2));
      if (ph > 0) {
        ctx.save();
        ctx.translate(150, 470); ctx.scale(ph, ph);
        ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.save(); ctx.clip();
        K.flag(ctx, 0, 0, 180, 120, t, 0.6);
        ctx.restore();
        K.ring(ctx, 0, 0, 58, 6, '#ffffff');
        ctx.restore();
        const a = clamp(ph);
        K.text(ctx, 'INDIA', 232, 450, { size: 64, align: 'left', alpha: a, track: 2 });
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#1d9bf0'; K.burstPath(ctx, 408, 448, 22, 26, 10); ctx.fill();
        K.check(ctx, 408, 448, 26, '#fff', 0.22);
        ctx.restore();
        const typing = t < S.w(2);
        ctx.fillStyle = '#19c16b';
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(240, 508, 7, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        K.text(ctx, typing ? 'typing…' : 'online', 256, 508, { size: 32, fam: 'barlow', weight: 500, align: 'left', alpha: a * 0.75 });
      }
      // typing dots
      const pt = S.at(1, 0.25) * (1 - S.at(2, 0.12));
      if (pt > 0) {
        ctx.save(); ctx.globalAlpha = pt;
        K.bubblePath(ctx, 90, 560, 200, 100, 40, 110, 690, 30);
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
        for (let i = 0; i < 3; i++) {
          const b = Math.max(0, Math.sin(t * 9 - i * 0.9));
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(150 + i * 40, 610 - b * 12, 11, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      // message bubble
      const pm = S.at(2, 0.4, (x) => E.outBack(x, 1.6));
      if (pm > 0) {
        ctx.save();
        ctx.translate(110, 820); ctx.scale(pm, pm); ctx.translate(-110, -820);
        K.bubblePath(ctx, 90, 555, 690, 250, 44, 110, 850, 50);
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
        ctx.fillStyle = K.vgrad(ctx, 555, 805, [[0, '#3b7bff'], [1, '#1238c7']]); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.restore();
        row(ctx, S, [[2, 'BHAI,']], 130, 625, { size: 92, fam: 'barlow', weight: 900, italic: true, rowAlign: 'left' });
        row(ctx, S, [[3, 'TENSION'], [4, 'NAHI…', { fill: th.acc }]], 130, 735, { size: 92, fam: 'barlow', weight: 900, italic: true, rowAlign: 'left' });
      }
      // deal-with-it face
      const pf = S.at(3, 0.45, (x) => E.outBack(x, 2.2));
      if (pf > 0) {
        const pg = S.at(4, 0.55, E.linear);
        K.face(ctx, 895, 690, 105 * pf, 'cool', t, { glassesY: lerp(-260, 0, E.outBounce(pg)), rot: Math.sin(t * 3) * 0.06, cap: '#1f5bff' });
        const pc = S.at(4, 0.3, E.outBack, 0.45);
        if (pc > 0) {
          ctx.save(); ctx.globalAlpha = clamp(pc);
          K.rr(ctx, 895 - 118, 822, 236, 50, 25); ctx.fillStyle = '#19c16b'; ctx.fill();
          K.text(ctx, 'CHILL MODE: ON', 895, 847, { size: 30, fam: 'barlow', weight: 800, track: 2, fill: '#04210f' });
          ctx.restore();
        }
      }
      row(ctx, S, [[5, 'WE'], [6, 'WANT']], W / 2, 985, { size: 158, track: 4, glow: 'rgba(0,0,0,.5)', blur: 18 }, 'slam');
      const pmore = S.at(7, 0.32, E.linear);
      if (pmore > 0) {
        const sc = lerp(3, 1, E.outExpo(pmore)) * (1 + 0.06 * S.pulse);
        for (let e = 0; e < 3; e++) {
          const b = R_beatAge(t, e);
          if (b == null) continue;
          const q = clamp(b / 0.6);
          K.text(ctx, 'MORE!', W / 2, 1210, { size: 330, fill: 'none', stroke: K.rgba(th.acc, 0.6 * (1 - q)), lw: 6, sx: 1 + q * 0.35, sy: 1 + q * 0.35 });
        }
        K.text(ctx, 'MORE!', W / 2, 1210, { size: 330, fill: 'saffron', glow: th.acc, blur: 50, sx: sc, sy: sc, alpha: clamp(pmore * 4), stroke: '#fff3', lw: 4, sheen: ((t - S.w(7)) % 1.2) - 0.1 });
      }
    },
  };
  // age of the (n-th previous) beat, for echo rings
  function R_beatAge(t, n) {
    let b = REEL.beatPrev(t);
    for (let i = 0; i < n && b !== -Infinity; i++) b = REEL.beatPrev(b - 1e-3);
    return b === -Infinity ? null : t - b;
  }

  // ── 0:14 "Gill ne century maari, batting full tight" ────────────────────
  SCENES.gill = {
    fx(S) { return { shake: 16 * S.hit(S.w(3), 7) + 20 * S.hit(S.w(6), 6), flash: 0.3 * S.hit(S.w(2) + 0.5, 9) }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      jersey(ctx, W / 2 + Math.sin(t * 0.5) * 12, 360, 980 + S.lt * 12, K.vgrad(ctx, 360, 1330, [[0, '#2a8cff'], [1, '#062a6b']]), '', '77', 0.16);
      K.letters(ctx, 'GILL', W / 2, 455, { size: 250, track: 12, fill: '#ffffff', glow: th.acc, blur: 40 }, (i) => {
        const p = S.p(S.w(0) + i * 0.06, 0.45);
        return { a: clamp(p * 3), y: -(1 - E.outBounce(p)) * 320, s: 1 + 0.04 * S.pulse };
      });
      // century ring
      const cx = 540, cy = 850;
      const pr = S.at(1, 0.4, E.outBack, 0.1);
      if (pr > 0) {
        K.text(ctx, 'CENTURY', cx, 604, { size: 52, fam: 'barlow', weight: 800, track: lerp(60, 20, clamp(pr)), fill: th.acc, alpha: clamp(pr) });
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(pr, pr);
        K.glow(ctx, 0, 0, 380, th.acc, 0.35 + 0.2 * S.pulse);
        ctx.rotate(t * 0.6);
        ctx.setLineDash([22, 18]); K.ring(ctx, 0, 0, 212, 14, th.acc2, 0.55);
        ctx.setLineDash([]);
        ctx.rotate(-t * 1.4);
        K.ring(ctx, 0, 0, 182, 6, '#ffffff', 0.8);
        ctx.restore();
        const pc = S.p(S.w(2), 0.55, E.outCubic);
        K.roll(ctx, 100 * pc, cx, cy, { size: 205, digits: 3, fill: 'gold', glow: '#ff9d00', blur: 34, sx: pr, sy: pr, dimLeading: false });
        shockRing(ctx, cx, cy, S, S.w(2) + 0.55, th.acc2, 560);
        shockRing(ctx, cx, cy, S, S.w(3), '#ffffff', 640);
      }
      // celebration balls
      const tau = t - S.w(3);
      if (tau > 0 && tau < 1.2) {
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.5, d = 230 + tau * 1100;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + 300 * tau * tau;
          K.streak(ctx, cx + Math.cos(a) * (d - 220), cy + Math.sin(a) * (d - 220), x, y, 22, '#ffffff', 0.6 * (1 - tau / 1.2));
          K.ball(ctx, x, y, 26, t * 20 + i, 0.4, { glowA: 0.4 });
        }
      }
      const pmaa = S.at(3, 0.3, E.linear);
      if (pmaa > 0) K.text(ctx, 'MAARI!', 845, 1005, { size: 118, fam: 'bangers', track: 3, fill: th.acc2, stroke: '#101010', lw: 12, shadow: { x: 8, y: 10, color: '#101010' }, rot: -0.12, sx: lerp(2, 1, E.outExpo(pmaa)), sy: lerp(2, 1, E.outExpo(pmaa)), alpha: clamp(pmaa * 4) });
      row(ctx, S, [[4, 'BATTING']], W / 2 - 120, 1105, { size: 112, fam: 'barlow', weight: 900, italic: true, track: 6 });
      // FULL TIGHT squeeze
      const pf = S.at(5, 0.3);
      if (pf > 0) {
        const sq = S.at(6, 0.55, E.outElastic);
        const track = lerp(42, -3, sq);
        const o = { size: 196, track, fill: 'gold', glow: '#ff9d00', blur: 30 };
        const w = K.measure(ctx, 'FULL TIGHT', o);
        const sy = 1 + 0.12 * S.hit(S.w(6), 7) + 0.03 * S.pulse;
        K.text(ctx, 'FULL TIGHT', W / 2, 1268, Object.assign(o, { alpha: pf, sy, sx: 1 - 0.05 * S.hit(S.w(6), 7) }));
        if (sq > 0) {
          const hx = w / 2 + 40, cap = 196 * 0.8;
          ctx.save();
          ctx.globalAlpha = clamp(sq * 2);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14; ctx.lineCap = 'square';
          for (const s of [-1, 1]) {
            const bx = W / 2 + s * hx;
            ctx.beginPath();
            ctx.moveTo(bx - s * 34, 1268 - cap / 2 - 10); ctx.lineTo(bx, 1268 - cap / 2 - 10);
            ctx.lineTo(bx, 1268 + cap / 2 + 10); ctx.lineTo(bx - s * 34, 1268 + cap / 2 + 10);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
  };

  // ── 0:19 "Phir King Kohli aaya — game ki badli sight!" ─────────────────
  SCENES.king = {
    fx(S) {
      const land = S.w(1) + 0.55;
      const fq = S.p(S.w(4) - 0.14, 0.3);
      return {
        dim: 0.6 * (1 - S.p(S.w(1), 0.6)) * (fq < 0.5 ? 1 : 0),
        shake: 28 * S.hit(land, 6) + 22 * S.hit(S.w(7), 6) + 14 * S.hit(S.w(4) + 0.02, 8),
        flash: 0.45 * S.hit(land, 10) + 0.25 * S.hit(S.w(4) + 0.02, 12),
        themeTo: 'ind', themeMix: fq >= 0.5 ? 1 : 0,
      };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const fq = S.p(S.w(4) - 0.14, 0.3, E.inOutCubic);
      const sx = Math.max(0.02, Math.abs(Math.cos(fq * Math.PI)));
      ctx.save();
      ctx.translate(W / 2, 0); ctx.scale(sx, 1); ctx.translate(-W / 2, 0);
      if (fq < 0.5) this.a(ctx, S, th, t); else this.b(ctx, S, th, t);
      ctx.restore();
    },
    a(ctx, S, th, t) {
      spotlight(ctx, W / 2, -60, 520, 1500, '#fff1c9', 0.16 * S.at(0, 0.5));
      K.text(ctx, '18', W / 2, 870, { size: 1050, fill: 'none', stroke: K.rgba('#ffc933', 0.12 * S.at(1, 0.6)), lw: 5 });
      const p0 = S.at(0, 0.5, E.outCubic);
      K.text(ctx, 'PHIR…', W / 2, 372, { size: 70, fam: 'barlow', weight: 800, italic: true, track: lerp(70, 30, p0), alpha: p0 * (1 - 0.75 * S.at(1, 0.5)) });
      const pc = S.at(1, 0.6, E.linear);
      if (pc > 0) {
        const cy = lerp(-300, 575, E.outBounce(pc));
        K.crown(ctx, W / 2, cy, 290, { rot: Math.sin(t * 2) * 0.04, sheen: ((t - S.w(1)) % 1.6) / 1.2 });
        shockRing(ctx, W / 2, 590, S, S.w(1) + 0.55, '#ffc933', 600);
        for (let i = 0; i < 26; i++) {
          const tau = t - (S.w(1) + 0.55);
          if (tau < 0 || tau > 1.4) break;
          const a = rnd(i, 5) * TAU, d = tau * (200 + rnd(i, 6) * 520);
          K.sparkle(ctx, W / 2 + Math.cos(a) * d, 570 + Math.sin(a) * d * 0.7 - tau * 120, 14 + rnd(i, 7) * 12, 1 - tau / 1.4, '#ffc933');
        }
      }
      const pk = S.at(1, 0.35, E.linear, 0.12);
      if (pk > 0) K.text(ctx, 'KING', W / 2, 815, { size: 340, fill: 'gold', glow: 'rgba(0,0,0,.55)', blur: 40, sx: lerp(1.7, 1, E.outExpo(pk)) * (1 + 0.035 * S.pulse), sy: lerp(1.7, 1, E.outExpo(pk)) * (1 + 0.035 * S.pulse), alpha: clamp(pk * 3), sheen: ((t - S.w(1) - 0.4) % 1.5) });
      const pko = S.at(2, 0.45, E.outCubic);
      if (pko > 0) K.text(ctx, 'KOHLI', W / 2, 1035, { size: 170, track: lerp(90, 18, pko), alpha: pko, glow: 'rgba(255,255,255,.5)', blur: 24 });
      const pa = S.at(3, 0.35, E.outCubic);
      if (pa > 0) {
        const m = K.text(ctx, 'AAYA —', W / 2, 1180, { size: 104, fam: 'barlow', weight: 900, italic: true, track: 6, fill: th.acc2, alpha: pa });
        ctx.fillStyle = th.acc2;
        ctx.fillRect(W / 2 - m.w / 2, 1250, m.w * S.at(3, 0.4, E.outCubic, 0.1), 10);
      }
    },
    b(ctx, S, th, t) {
      K.text(ctx, '18', W / 2, 880, { size: 1050, fill: 'none', stroke: K.rgba('#ffffff', 0.1), lw: 5 });
      K.crown(ctx, W / 2, 400, 150, { rot: Math.sin(t * 2) * 0.05, glowA: 0.3 });
      K.text(ctx, 'KING KOHLI', W / 2, 505, { size: 84, fill: 'gold', track: 10 });
      row(ctx, S, [[4, 'GAME'], [5, 'KI']], W / 2, 690, { size: 134, fam: 'barlow', weight: 900, italic: true, track: 4 }, 'up');
      row(ctx, S, [[6, 'BADLI']], W / 2, 905, { size: 280, fill: 'saffron', glow: '#ff6a00', blur: 40, track: 6 }, 'slam');
      const ps = S.at(7, 0.3, E.linear);
      if (ps > 0) {
        const sc = lerp(1.9, 1, E.outExpo(ps));
        const off = 26 * S.hit(S.w(7), 3.5) + 5 * S.pulse;
        const base = { size: 300, track: 6, sx: sc, sy: sc, alpha: clamp(ps * 4) };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        K.text(ctx, 'SIGHT!', W / 2 - off, 1150, Object.assign({}, base, { fill: '#ff2050' }));
        K.text(ctx, 'SIGHT!', W / 2 + off, 1150, Object.assign({}, base, { fill: '#00d5ff' }));
        ctx.restore();
        K.text(ctx, 'SIGHT!', W / 2, 1150, Object.assign({}, base, { fill: 'ice' }));
      }
    },
  };

  // ── 0:24 "Bowler ne socha — Kohli ko rok lenge aaj" ────────────────────
  SCENES.bowler = {
    fx(S) { return { shake: 20 * S.hit(S.w(5), 7) + 8 * S.hit(S.w(3), 9) }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      row(ctx, S, [[0, 'BOWLER'], [1, 'NE'], [2, 'SOCHA —', { fill: th.acc }]], W / 2, 395, { size: 88, fam: 'barlow', weight: 900, italic: true, track: 4 });
      const pf = S.at(0, 0.45, (x) => E.outBack(x, 2));
      const fx = 175, fy = 985 + Math.sin(t * 2.4) * 8;
      // thought cloud
      const pc = S.at(2, 0.45, (x) => E.outBack(x, 1.8));
      if (pc > 0) {
        ctx.save();
        ctx.translate(fx, fy); ctx.scale(pc, pc); ctx.translate(-fx, -fy);
        ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 40;
        K.cloud(ctx, 580, 690, 355, 175, '#fbfbff', 'rgba(20,0,10,.35)', 5, fx + 40, fy - 120, 1);
        ctx.shadowColor = 'transparent';
        // tactics field
        const gx = 450, gy = 700;
        ctx.beginPath(); ctx.ellipse(gx, gy, 150, 118, 0, 0, TAU);
        ctx.fillStyle = '#1e8a47'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#0f5a2c'; ctx.stroke();
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.ellipse(gx, gy, 88, 68, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#d9b77a'; ctx.fillRect(gx - 9, gy - 34, 18, 68);
        // batter "K"
        ctx.fillStyle = '#1f5bff';
        ctx.beginPath(); ctx.arc(gx, gy - 38, 16, 0, TAU); ctx.fill();
        K.text(ctx, 'K', gx, gy - 38, { size: 20, fill: '#fff' });
        K.crown(ctx, gx, gy - 64, 30, { glow: false });
        const fielders = [[-120, -40], [-100, 60], [-40, 100], [60, 95], [115, 40], [125, -45], [70, -95], [-30, -100], [-70, -10]];
        fielders.forEach(([dx, dy], i) => {
          const pi = S.p(S.w(2) + 0.25 + i * 0.07, 0.25, E.outBack);
          if (pi <= 0) return;
          ctx.fillStyle = '#b3123f';
          ctx.beginPath(); ctx.arc(gx + dx, gy + dy, 11 * pi, 0, TAU); ctx.fill();
          const pa = S.p(S.w(3) + i * 0.08, 0.45, E.outCubic);
          if (pa > 0 && i % 2 === 0) {
            ctx.strokeStyle = 'rgba(179,18,63,.85)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
            ctx.beginPath(); ctx.moveTo(gx + dx, gy + dy);
            ctx.lineTo(lerp(gx + dx, gx, pa * 0.8), lerp(gy + dy, gy - 38, pa * 0.8)); ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        const pp = S.at(3, 0.35, E.outBack);
        if (pp > 0) {
          K.text(ctx, 'PLAN A:', 750, 625, { size: 58, fam: 'bangers', fill: '#6d0c2a', track: 2, alpha: clamp(pp), sx: pp, sy: pp });
          K.text(ctx, 'ROK LO!', 752, 722, { size: 92, fam: 'bangers', fill: '#e0142f', track: 2, alpha: clamp(pp), sx: pp, sy: pp, rot: -0.06 });
        }
        ctx.restore();
      }
      if (pf > 0) {
        K.face(ctx, fx, fy, 100 * pf, 'think', t, { cap: '#8a1538', rot: -0.08 + Math.sin(t * 1.7) * 0.05 });
      }
      row(ctx, S, [[3, 'KOHLI'], [4, 'KO']], 640, 1015, { size: 168, track: 4, glow: 'rgba(0,0,0,.6)', blur: 20 }, 'slam');
      row(ctx, S, [[5, 'ROK'], [6, 'LENGE'], [7, 'AAJ']], W / 2, 1172, { size: 150, track: 4, fill: 'gold', glow: 'rgba(0,0,0,.6)', blur: 20 }, 'slam');
      const pt = S.at(5, 0.35, E.outCubic);
      if (pt > 0) K.tape(ctx, W / 2 + lerp(-1500, 0, pt), 1312, 1500, 84, -0.05, 'ROK LO  •  NO RUNS', t * 160);
    },
  };

  // ── 0:29 "Kohli ne bola — Pehle ball toh daal!" ────────────────────────
  SCENES.daal = {
    fx(S) { return { shake: 34 * S.hit(S.w(6), 5) + 8 * S.hit(S.w(3), 9), flash: 0.3 * S.hit(S.w(6), 10), zoom: 0.04 * S.hit(S.w(6), 5), crowd: S.t > S.w(6) ? 1 : 0 }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const pf = S.at(0, 0.45, (x) => E.outBack(x, 2));
      if (pf > 0) K.face(ctx, 165, 485, 84 * pf, 'king', t, { crown: true, rot: Math.sin(t * 2) * 0.05 });
      row(ctx, S, [[0, 'KOHLI', { fill: 'gold' }], [1, 'NE'], [2, 'BOLA —']], 285, 455, { size: 84, fam: 'barlow', weight: 900, italic: true, rowAlign: 'left', track: 3 });
      K.text(ctx, '↳ replying to @bowler', 290, 530, { size: 34, fam: 'barlow', weight: 500, align: 'left', alpha: 0.6 * S.at(1, 0.4) * (1 - S.at(3, 0.2)) });
      const ptype = S.at(0, 0.3, E.outBack, 0.35) * (1 - S.at(3, 0.15));
      if (ptype > 0) {
        ctx.save();
        ctx.translate(540, 880); ctx.scale(ptype, ptype);
        K.bubblePath(ctx, -170, -85, 340, 170, 85, -120, 130, 50);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        for (let i = 0; i < 3; i++) {
          const b = Math.max(0, Math.sin(t * 9 - i * 0.9));
          ctx.fillStyle = '#1f5bff';
          ctx.beginPath(); ctx.arc(-70 + i * 70, -b * 16, 22, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      const pb = S.at(3, 0.4, (x) => E.outBack(x, 1.8));
      if (pb > 0) {
        ctx.save();
        ctx.translate(540, 900); ctx.scale(pb, pb); ctx.rotate(Math.sin(t * 1.5) * 0.03);
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40;
        K.burstPath(ctx, 0, 0, 330, 415, 18, t * 0.25, 0.22, 7);
        ctx.fillStyle = '#ffd21f'; ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 12; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
        K.burstPath(ctx, 0, 0, 275, 340, 18, t * 0.25 + 0.1, 0.18, 9);
        ctx.fillStyle = '#fff3a8'; ctx.fill();
        ctx.restore();
      }
      const comic = { fam: 'bangers', stroke: '#111', lw: 14, shadow: { x: 9, y: 11, color: '#111' }, track: 3, rot: -0.05 };
      row(ctx, S, [[3, 'PEHLE']], 540, 755, Object.assign({ size: 150, fill: '#ffffff' }, comic), 'pop');
      row(ctx, S, [[4, 'BALL'], [5, 'TOH']], 540, 895, Object.assign({ size: 150, fill: '#ffffff' }, comic), 'pop');
      const pd = S.at(6, 0.3, E.linear);
      if (pd > 0) {
        const sc = lerp(2.6, 1, E.outExpo(pd)) * (1 + 0.05 * S.pulse);
        K.text(ctx, 'DAAL!', 540, 1062, Object.assign({}, comic, { size: 240, fill: '#ff2d4b', lw: 18, sx: sc, sy: sc, alpha: clamp(pd * 4) }));
      }
      // laughing reactions
      const tau = t - S.w(6);
      if (tau > 0) {
        for (let i = 0; i < 16; i++) {
          const d = rnd(i, 1) * 0.5;
          const u = tau - d;
          if (u <= 0) continue;
          const x = 60 + rnd(i, 2) * 960 + Math.sin(u * 3 + i) * 30;
          const y = -120 + u * (700 + rnd(i, 3) * 500);
          if (y > 1500) continue;
          K.face(ctx, x, y, 34 + rnd(i, 4) * 26, 'laugh', t + i, { rot: u * (rnd(i, 5) - 0.5) * 6, shadow: false });
        }
        const pl = clamp(tau / 0.35);
        const bounce = Math.abs(Math.sin(tau * 9)) * 30 * Math.exp(-tau * 1.2);
        K.face(ctx, 860, 1225 - bounce, 118 * E.outBack(pl, 2.5), 'laugh', t, { rot: Math.sin(tau * 14) * 0.18 });
        const pl2 = clamp((tau - 0.15) / 0.35);
        if (pl2 > 0) K.face(ctx, 205, 1240, 90 * E.outBack(pl2, 2.5), 'laugh', t + 0.3, { rot: -Math.sin(tau * 12) * 0.2 });
        const ph = clamp((tau - 0.3) / 0.3);
        if (ph > 0) K.text(ctx, 'HAHAHA', 540, 1245, { size: 90, fam: 'bangers', fill: th.acc, stroke: '#111', lw: 10, track: 4, rot: 0.04, sx: E.outBack(ph, 2), sy: E.outBack(ph, 2) });
      }
    },
  };

  // ── 0:33 "139 not out, bat kare shine" ─────────────────────────────────
  SCENES.notout = {
    fx(S) { return { shake: 16 * S.hit(S.w(0) + 1.0, 6) + 10 * S.hit(S.w(3) + 0.3, 8), flash: 0.25 * S.hit(S.w(5), 9) }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      rays(ctx, 540, 640, 22, 1200, t * 0.15, th.acc, 0.12 + 0.06 * S.pulse);
      const pc = S.p(S.w(0), 1.0, E.outExpo);
      const land = S.w(0) + 1.0;
      const sheenX = t > land ? lerp(150, 950, ((t - land) % 1.4) / 0.9) : null;
      const r = K.roll(ctx, 139 * pc, 510, 640, { size: 430, digits: 3, fill: 'gold', glow: '#ff9d00', blur: 40 + 40 * S.hit(land, 4), sheenX });
      const ps = S.at(1, 0.35, (x) => E.outBack(x, 2.5));
      if (ps > 0) K.text(ctx, '*', 510 + r.w / 2 + 70, 520, { size: 240, fill: 'gold', sx: ps, sy: ps, rot: t * 0.8, glow: '#ff9d00' });
      const pn = S.at(1, 0.4, (x) => E.outBack(x, 2));
      if (pn > 0) {
        const s = pn * (1 + 0.05 * S.pulse);
        ctx.save(); ctx.translate(540, 905); ctx.scale(s, s);
        K.rr(ctx, -230, -56, 460, 112, 56);
        ctx.fillStyle = '#ffffff'; ctx.shadowColor = K.rgba(th.acc, 0.8); ctx.shadowBlur = 40; ctx.fill();
        ctx.shadowColor = 'transparent';
        row(ctx, S, [[1, 'NOT'], [2, 'OUT']], 0, 0, { size: 86, fill: '#07123a', track: 8, beat: 0 }, 'pop');
        ctx.restore();
      }
      // the bat swings in with ghost frames
      const pbat = S.at(3, 0.5, E.linear);
      if (pbat > 0) {
        const angAt = (p) => lerp(-2.2, 0.32, E.outBack(clamp(p), 1.3));
        for (let g = 5; g >= 1; g--) {
          const pg = pbat - g * 0.05;
          if (pg <= 0 || pbat >= 1) continue;
          ctx.save(); ctx.globalAlpha = 0.12 * (1 - g / 6);
          K.bat(ctx, 815, 1175, 600, angAt(pg), {});
          ctx.restore();
        }
        K.glow(ctx, 815, 1175, 420, th.acc, 0.35 * S.at(5, 0.4));
        K.bat(ctx, 815, 1175, 600, angAt(pbat) + Math.sin(t * 2) * 0.02, { sheen: S.at(5, 0.7, E.inOutCubic) * 1.2 - 0.1 + (t > S.w(5) + 0.8 ? ((t - S.w(5) - 0.8) % 1.5) - 0.2 : 0) });
      }
      row(ctx, S, [[3, 'BAT'], [4, 'KARE']], 360, 1095, { size: 100, fam: 'barlow', weight: 900, italic: true, track: 6, glow: 'rgba(0,0,0,.7)', blur: 20 });
      const psh = S.at(5, 0.4, E.linear);
      if (psh > 0) {
        const sc = lerp(1.6, 1, E.outExpo(psh));
        K.text(ctx, 'SHINE', 360, 1255, { size: 210, fill: 'chrome', glow: '#ffffff', blur: 40, sx: sc, sy: sc, alpha: clamp(psh * 3), track: 10, sheen: ((t - S.w(5)) % 1.1) * 1.3 - 0.2 });
        for (let i = 0; i < 9; i++) {
          const ph = Math.sin(t * (3 + rnd(i, 2) * 3) + i * 2);
          if (ph <= 0) continue;
          K.sparkle(ctx, 110 + rnd(i, 3) * 880, 1000 + rnd(i, 4) * 330, 16 + 22 * ph, ph * psh, '#ffffff', t);
        }
      }
    },
  };

  // ── 0:38 "15,000 ODI runs — King crossed the line!" ────────────────────
  SCENES.fifteen = {
    tapeY: 1000,
    crownY(S) {
      const u = S.p(S.w(3), Math.max(0.4, S.w(4) + 0.25 - S.w(3)), E.inOutCubic);
      return lerp(1330, 860, u);
    },
    breakT(S) {
      // first moment the crown passes the tape (searched on the same curve)
      const a = S.w(3), b = S.w(4) + 0.25;
      for (let x = a; x <= b; x += 1 / 120) {
        const T = REEL.state(x, S.L);
        if (this.crownY(T) < this.tapeY) return x;
      }
      return b;
    },
    fx(S) { const bt = this.breakT(S); return { shake: 26 * S.hit(bt, 6) + 12 * S.hit(S.w(0) + 1.2, 7), flash: 0.4 * S.hit(bt, 9), crowd: S.t > bt ? 1 : 0 }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const pl = S.at(0, 0.4, E.outCubic);
      K.text(ctx, 'ODI RUNS', W / 2, 415, { size: 58, fam: 'barlow', weight: 800, track: lerp(60, 24, pl), fill: th.acc, alpha: pl * (0.6 + 0.4 * S.at(1, 0.3)), sx: 1 + 0.15 * S.hit(S.w(1), 8), sy: 1 + 0.15 * S.hit(S.w(1), 8) });
      const pc = S.p(S.w(0), 1.2, E.outExpo);
      const land = S.w(0) + 1.2;
      K.roll(ctx, 15000 * pc, W / 2, 585, { size: 250, digits: 5, commas: true, fill: 'chrome', glow: pc >= 1 ? th.acc : '#ffffff', blur: 30 + 40 * S.hit(land, 4), alpha: pl });
      // progress bar with milestones
      const bx = 120, bw = 840, by = 752;
      ctx.save(); ctx.globalAlpha = pl;
      K.rr(ctx, bx, by - 13, bw, 26, 13); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
      K.rr(ctx, bx, by - 13, Math.max(26, bw * pc), 26, 13);
      ctx.fillStyle = K.vgrad(ctx, by - 13, by + 13, K.GRADS.gold); ctx.fill();
      K.glow(ctx, bx + bw * pc, by, 70, th.acc, 0.8);
      ['5K', '10K', '15K'].forEach((lb, i) => {
        const x = bx + (bw * (i + 1)) / 3;
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 2, by + 18, 4, 16);
        K.text(ctx, lb, x, by + 56, { size: 30, fam: 'barlow', weight: 800, track: 2, align: i === 2 ? 'right' : 'center', alpha: pc * 3 > i + 1 ? 1 : 0.4 });
      });
      ctx.restore();
      // finish line + crown
      const ty = this.tapeY, bt = this.breakT(S);
      const posts = [[70, 1], [1010, -1]];
      ctx.fillStyle = '#e8ecf5';
      for (const [px] of posts) { K.rr(ctx, px - 8, ty - 60, 16, 180, 8); ctx.fill(); }
      const broken = t >= bt;
      const drawTape = (x0, x1, pivotX, swing) => {
        ctx.save();
        ctx.translate(pivotX, ty); ctx.rotate(swing);
        const len = x1 - x0;
        const g = ctx.createLinearGradient(0, -14, 0, 14);
        g.addColorStop(0, '#ff5a6e'); g.addColorStop(1, '#b0001e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.quadraticCurveTo(len / 2, 18, len, -12); ctx.lineTo(len, 12); ctx.quadraticCurveTo(len / 2, 42, 0, 12);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      if (!broken) {
        drawTape(70, 1010, 70, 0);
        K.text(ctx, 'FINISH', W / 2, ty + 18, { size: 22, fam: 'barlow', weight: 800, track: 8, alpha: 0.85 });
      } else {
        const u = t - bt;
        const sw = 1.35 * (1 - Math.exp(-u * 4) * Math.cos(u * 9));
        drawTape(70, 540, 70, sw);
        ctx.save(); ctx.translate(1010, 0); ctx.scale(-1, 1); drawTape(0, 470, 0, sw); ctx.restore();
      }
      const pcr = S.at(3, 0.25);
      if (pcr > 0) {
        const cy = this.crownY(S);
        K.glow(ctx, W / 2, cy + 120, 200, th.acc, 0.5 * pcr);
        K.streak(ctx, W / 2, cy + 260, W / 2, cy + 40, 50, th.acc, 0.35 * (t < bt + 0.3 ? 1 : 0));
        K.crown(ctx, W / 2, cy, 170 * clamp(pcr * 2), { rot: Math.sin(t * 3) * 0.06, sheen: ((t * 0.8) % 1.2) });
      }
      confetti(ctx, S, bt, W / 2, ty, 120, ['#ff9933', '#ffffff', '#138808', '#ffc933', '#1f5bff']);
      row(ctx, S, [[3, 'KING', { fill: 'gold' }], [4, 'CROSSED']], W / 2, 1160, { size: 150, track: 4, glow: 'rgba(0,0,0,.6)', blur: 20 }, 'slam');
      row(ctx, S, [[5, 'THE'], [6, 'LINE!', { fill: th.acc2 }]], W / 2, 1305, { size: 118, fam: 'barlow', weight: 900, italic: true, track: 6 }, 'up');
    },
  };

  // ── 0:42 "Nine sixes, boundaries ki baarish" ───────────────────────────
  SCENES.sixes = {
    count(S) {
      const a = S.w(0), b = Math.max(S.w(2) - 0.05, a + 0.9);
      const u = clamp((S.t - a) / (b - a)) * 9;
      const i = Math.min(9, Math.floor(u));
      const f = i >= 9 ? 0 : E.outCubic(clamp((u - i) / 0.6));
      return { v: Math.min(9, i + f), a, step: (b - a) / 9 };
    },
    fx(S) {
      const c = this.count(S);
      let sh = 0;
      for (let k = 0; k < 9; k++) sh += 7 * S.hit(c.a + (k + 1) * c.step, 12);
      return { shake: sh + 22 * S.hit(S.w(4), 6), crowd: S.t > S.w(2) ? 1 : 0 };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const c = this.count(S);
      // rain
      const tr = t - S.w(2) + 0.2;
      if (tr > 0) {
        const ra = clamp(tr * 3);
        ctx.save();
        ctx.strokeStyle = K.rgba('#bff0ff', 0.25 * ra); ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 70; i++) {
          const sp = 1600 + rnd(i, 1) * 900;
          const y = ((rnd(i, 2) * 2200 + tr * sp) % 2200) - 200;
          const x = rnd(i, 3) * 1300 - 110 - y * 0.12;
          ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 70);
        }
        ctx.stroke();
        ctx.restore();
        for (let i = 0; i < 26; i++) {
          const d = rnd(i, 6) * 0.9;
          const u = tr - d;
          if (u <= 0) continue;
          const sp = 900 + rnd(i, 7) * 700;
          const y = -140 + ((u * sp + 0) % 2100);
          const x = 40 + rnd(i, 8) * 1000 - y * 0.12;
          if (rnd(i, 9) < 0.55) {
            K.streak(ctx, x + 18, y - 160, x, y, 14, '#dff6ff', 0.4 * ra);
            K.ball(ctx, x, y, 20 + rnd(i, 10) * 10, t * 15 + i, 0.4, { glowA: 0.25 });
          } else {
            K.text(ctx, rnd(i, 11) < 0.5 ? '4' : '6', x, y, { size: 70 + rnd(i, 12) * 50, fill: rnd(i, 13) < 0.5 ? th.acc : th.acc2, alpha: 0.85 * ra, glow: 'rgba(0,0,0,.5)', blur: 12 });
          }
        }
      }
      const p0 = S.at(0, 0.3, E.outCubic);
      if (p0 > 0) {
        K.glow(ctx, 300, 620, 320, th.acc, 0.3 + 0.2 * S.pulse);
        K.roll(ctx, c.v, 300, 625, { size: 500, digits: 1, fill: 'ice', glow: th.acc, blur: 40, alpha: p0, sx: 1 + 0.04 * S.pulse, sy: 1 + 0.04 * S.pulse });
      }
      row(ctx, S, [[0, 'NINE']], 560, 515, { size: 100, fam: 'barlow', weight: 900, italic: true, track: 6, rowAlign: 'left' });
      row(ctx, S, [[1, 'SIXES,', { fill: 'ice' }]], 552, 690, { size: 210, track: 4, rowAlign: 'left', glow: th.acc, blur: 30 }, 'slam');
      // tally of nine balls
      for (let i = 0; i < 9; i++) {
        const x = 140 + i * 100, y = 935;
        const lit = c.v >= i + 1 - 1e-3;
        const pa = S.p(S.w(0) - 0.1 + i * 0.03, 0.3, E.outBack);
        if (pa <= 0) continue;
        if (!lit) K.ring(ctx, x, y, 32 * pa, 4, '#ffffff', 0.35);
        else {
          K.ball(ctx, x, y, 32, i * 0.7 + t * 2, 0.5, { glowA: 0.5 });
          K.text(ctx, '6', x, y - 72, { size: 48, fill: th.acc, glow: th.acc, blur: 16 });
          const tl = t - (c.a + (i + 1) * c.step);
          if (tl > 0 && tl < 0.9) {
            const yy = y - tl * 1600;
            K.streak(ctx, x, y - 20, x, yy, 18, '#ffffff', 0.5 * (1 - tl / 0.9));
            K.ball(ctx, x, yy, 24, t * 30, 0.4, { glowA: 0.4 });
          }
        }
      }
      row(ctx, S, [[2, 'BOUNDARIES'], [3, 'KI']], W / 2, 1105, { size: 104, fam: 'barlow', weight: 900, italic: true, track: 4, glow: 'rgba(0,0,0,.7)', blur: 18 });
      const pb = S.at(4, 0.1);
      if (pb > 0) {
        K.letters(ctx, 'BAARISH!', W / 2, 1272, { size: 240, track: 8, fill: 'ice', glow: th.acc, blur: 30 }, (i) => {
          const p = S.p(S.w(4) + i * 0.05, 0.55, E.linear);
          return { a: clamp(p * 5), y: -(1 - E.outBounce(p)) * 420, sy: 1 + 0.15 * S.hit(S.w(4) + i * 0.05 + 0.2, 10) };
        });
        for (let i = 0; i < 8; i++) {
          const x = W / 2 - 400 + i * 114;
          const p = S.p(S.w(4) + i * 0.05 + 0.2, 0.5, E.outCubic);
          if (p <= 0 || p >= 1) continue;
          ctx.save(); ctx.globalAlpha = (1 - p) * 0.7;
          ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, 1370, 20 + p * 80, 6 + p * 16, 0, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
    },
  };

  // ── 0:46 "West Indies ke bowlers ki — badhti gayi khwaish!" ────────────
  const WISHES = ['Bas ek wicket please…', 'Ek dot ball de do yaar', 'Kohli ko neend aa jaye', 'Baarish ho jaye!', 'Ghar jaana hai…'];
  SCENES.khwaish = {
    times(S) { return [S.w(4), S.w(5), S.w(6), S.w(7), S.w(7) + 0.5]; },
    fx(S) { return { shake: 22 * S.hit(S.w(7), 6) }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      row(ctx, S, [[0, 'WEST'], [1, 'INDIES'], [2, 'KE']], W / 2, 395, { size: 82, fam: 'barlow', weight: 900, italic: true, track: 4 });
      row(ctx, S, [[3, 'BOWLERS'], [4, 'KI —']], W / 2, 500, { size: 124, track: 4, fill: 'gold', glow: 'rgba(0,0,0,.6)', blur: 18 }, 'slam');
      const times = this.times(S);
      const pp = S.at(3, 0.45, E.outBack, 0.15);
      if (pp > 0) {
        const shown = times.reduce((n, tt) => n + E.outCubic(S.p(tt, 0.3)), 0);
        const px = 140, py = 600, pw = 680, ph = 132 + 78 * shown + 20;
        ctx.save();
        ctx.translate(px + pw / 2, py); ctx.rotate(-0.035); ctx.scale(clamp(pp), clamp(pp)); ctx.translate(-pw / 2, 0);
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
        K.rr(ctx, 0, 0, pw, ph, 14); ctx.fillStyle = '#fff8e4'; ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(40,90,200,.22)'; ctx.lineWidth = 2;
        for (let y = 120; y < ph; y += 78) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(220,40,60,.5)';
        ctx.beginPath(); ctx.moveTo(78, 0); ctx.lineTo(78, ph); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#c9c1a8';
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(120 + k * 90, 0, 12, 0, TAU); ctx.fill(); }
        K.text(ctx, 'WISHLIST', 110, 70, { size: 70, fam: 'bangers', fill: '#8a1538', align: 'left', track: 3 });
        K.text(ctx, '(bowlers only)', 395, 78, { size: 32, fam: 'barlow', weight: 500, fill: '#6b6250', align: 'left' });
        times.forEach((tt, k) => {
          const p = S.p(tt, 0.4, E.outCubic);
          if (p <= 0) return;
          const y = 120 + 78 * k + 42;
          ctx.save();
          ctx.globalAlpha = clamp(p * 2);
          ctx.strokeStyle = '#3a3a52'; ctx.lineWidth = 4;
          ctx.strokeRect(30, y - 17, 34, 34);
          ctx.beginPath(); ctx.rect(96, y - 40, 560 * p, 80); ctx.clip();
          K.text(ctx, `${k + 1}. ${WISHES[k]}`, 100, y, { size: 50, fam: 'barlow', weight: 800, italic: true, fill: '#1b1b2e', align: 'left' });
          ctx.restore();
        });
        ctx.restore();
        const jit = Math.sin(t * 40) * 3;
        K.face(ctx, 890 + jit, 660, 96 * E.outBack(clamp(pp), 2), 'sweat', t, { cap: '#8a1538', rot: 0.12 + Math.sin(t * 2.2) * 0.05 });
      }
      row(ctx, S, [[5, 'BADHTI'], [6, 'GAYI']], W / 2, 1200, { size: 98, fam: 'barlow', weight: 900, italic: true, track: 6, glow: 'rgba(0,0,0,.7)', blur: 20 });
      const pk = S.at(7, 0.3, E.linear);
      if (pk > 0) {
        const sc = lerp(2.2, 1, E.outExpo(pk)) * (1 + 0.04 * S.pulse);
        K.text(ctx, 'KHWAISH!', W / 2, 1318, { size: 165, fill: 'fire', glow: '#ff5a00', blur: 36, track: 6, sx: sc, sy: sc, alpha: clamp(pk * 4) });
      }
    },
  };

  // ── 0:50 "Gill aur Kohli — partnership zabardast" ──────────────────────
  SCENES.partner = {
    fx(S) { return { shake: 32 * S.hit(S.w(4), 5) + 16 * S.hit(S.w(3) + 0.25, 8), flash: 0.35 * S.hit(S.w(3) + 0.25, 10), crowd: S.t > S.w(4) ? 1 : 0 }; },
    draw(ctx, S) {
      const t = S.t, th = S.theme;
      const pl = S.at(0, 0.45, E.outCubic), pr = S.at(2, 0.45, E.outCubic);
      const top = 360, bot = 1090;
      const left = () => { ctx.beginPath(); ctx.moveTo(-60, top); ctx.lineTo(630, top); ctx.lineTo(480, bot); ctx.lineTo(-60, bot); ctx.closePath(); };
      const right = () => { ctx.beginPath(); ctx.moveTo(650, top); ctx.lineTo(1140, top); ctx.lineTo(1140, bot); ctx.lineTo(500, bot); ctx.closePath(); };
      if (pl > 0) {
        ctx.save(); ctx.translate(lerp(-800, 0, pl), 0);
        left();
        ctx.fillStyle = K.vgrad(ctx, top, bot, [[0, '#2f7bff'], [1, '#0a2372']]); ctx.fill();
        ctx.clip();
        K.text(ctx, '77', 270, 840, { size: 560, fill: 'none', stroke: 'rgba(255,255,255,.28)', lw: 6 });
        K.text(ctx, 'GILL', 265, 540, { size: 190, track: 6, glow: 'rgba(0,0,0,.4)', blur: 20, sx: 1 + 0.03 * S.pulse, sy: 1 + 0.03 * S.pulse });
        ctx.restore();
      }
      if (pr > 0) {
        ctx.save(); ctx.translate(lerp(800, 0, pr), 0);
        right();
        ctx.fillStyle = K.vgrad(ctx, top, bot, [[0, '#ffd45a'], [1, '#e06a00']]); ctx.fill();
        ctx.clip();
        K.text(ctx, '18', 830, 840, { size: 560, fill: 'none', stroke: 'rgba(40,20,0,.3)', lw: 6 });
        K.text(ctx, 'KOHLI', 845, 540, { size: 150, track: 4, fill: '#10194a', sx: 1 + 0.03 * S.pulse, sy: 1 + 0.03 * S.pulse });
        K.crown(ctx, 845, 410, 90, { glow: false });
        ctx.restore();
      }
      if (pl >= 1 && pr > 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = K.rgba('#ffffff', clamp((pr - 0.5) * 2)); ctx.lineWidth = 6;
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.moveTo(640, top); ctx.lineTo(490, bot); ctx.stroke();
        ctx.restore();
      }
      const pa = S.at(1, 0.35, (x) => E.outBack(x, 2.4));
      if (pa > 0) {
        ctx.save(); ctx.translate(608, 470); ctx.scale(pa, pa);
        ctx.fillStyle = '#0b0b16'; ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.fill();
        K.ring(ctx, 0, 0, 62, 5, '#ffffff');
        K.text(ctx, 'AUR', 0, 0, { size: 46, fam: 'barlow', weight: 900, italic: true, track: 2 });
        ctx.restore();
      }
      // crossed bats clash
      const pb = S.at(3, 0.3, E.linear);
      if (pb > 0) {
        const clash = S.w(3) + 0.25;
        const sp = lerp(1.2, 0.6, E.outBack(clamp(pb), 2));
        K.glow(ctx, 565, 860, 360, '#ffffff', 0.5 * S.hit(clash, 3) + 0.15);
        K.bat(ctx, 565, 860, 470, -sp, { grip: '#27c4ff' });
        K.bat(ctx, 565, 860, 470, sp, { grip: '#ff8c1a' });
        for (let i = 0; i < 14; i++) {
          const tau = t - clash;
          if (tau < 0 || tau > 0.7) break;
          const a = rnd(i, 8) * TAU, d = tau * (400 + rnd(i, 9) * 600);
          K.sparkle(ctx, 565 + Math.cos(a) * d, 760 + Math.sin(a) * d, 16, 1 - tau / 0.7, '#ffe08a', a);
        }
      }
      row(ctx, S, [[3, 'PARTNERSHIP']], W / 2, 1168, { size: 100, fam: 'barlow', weight: 900, italic: true, track: 10, glow: 'rgba(0,0,0,.7)', blur: 20 });
      const pz = S.at(4, 0.3, E.linear);
      if (pz > 0) {
        shockRing(ctx, W / 2, 1310, S, S.w(4) + 0.1, th.acc, 700);
        const sc = lerp(2.5, 1, E.outExpo(pz)) * (1 + 0.05 * S.pulse);
        K.text(ctx, 'ZABARDAST!', W / 2, 1310, { size: 196, maxW: 960, fill: 'fire', glow: '#ff5a00', blur: 40, stroke: '#2a0a00', lw: 8, rot: -0.04, sx: sc, sy: sc, alpha: clamp(pz * 4), sheen: ((t - S.w(4)) % 1.2) - 0.1 });
      }
    },
  };

  // ── 0:54 "INDIA! INDIA!" ────────────────────────────────────────────────
  SCENES.india = {
    strip: false,
    fx(S) { return { shake: 30 * S.hit(S.w(0), 6) + 30 * S.hit(S.w(1), 6), flash: 0.35 * S.hit(S.w(0), 10) + 0.35 * S.hit(S.w(1), 10), zoom: 0.03 * S.kick, crowd: 1 }; },
    draw(ctx, S) {
      const t = S.t;
      K.flag(ctx, W / 2, H / 2, 1500, 2700, t * 1.6, 1.1);
      ctx.fillStyle = 'rgba(0,0,30,.18)'; ctx.fillRect(-100, -100, W + 200, H + 200);
      const txt = { size: 300, track: 8, fill: '#ffffff', stroke: '#000080', lw: 18, shadow: { x: 0, y: 16, color: 'rgba(0,0,40,.45)', blur: 20 } };
      [[0, 600], [1, 1330]].forEach(([k, y]) => {
        const p = S.at(k, 0.28, E.linear);
        if (p <= 0) return;
        const sc = lerp(2.4, 1, E.outExpo(p)) * (1 + 0.05 * S.pulse);
        K.text(ctx, 'INDIA!', W / 2, y, Object.assign({}, txt, { sx: sc, sy: sc, alpha: clamp(p * 4), rot: k ? 0.03 : -0.03 }));
      });
    },
  };

  // ── 0:55 finale — the King ──────────────────────────────────────────────
  SCENES.finale = {
    t0(S) { return S.start; },
    land(S) { return S.start + 1.35; },
    fx(S) {
      const land = this.land(S);
      return { dim: 0.55 - 0.2 * S.p(land, 1), lights: [0.35 + 0.4 * S.p(land, 0.5), 0.35 + 0.4 * S.p(land, 0.5)], shake: 28 * S.hit(land, 5), flash: 0.5 * S.hit(land, 8), zoom: 0.035 * S.p(S.start, 5, E.inOutCubic) };
    },
    draw(ctx, S) {
      const t = S.t, th = S.theme, s0 = S.start, land = this.land(S);
      spotlight(ctx, W / 2, -80, 560, 1600, '#fff1c9', 0.32);
      // gold dust
      ctx.save();
      for (let i = 0; i < 70; i++) {
        const sp = 40 + rnd(i, 1) * 120;
        const y = 1500 - (((t - s0) * sp + rnd(i, 2) * 1400) % 1400);
        const x = 540 + (rnd(i, 3) - 0.5) * 900 + Math.sin(t + i) * 20;
        K.glow(ctx, x, y, 8 + rnd(i, 4) * 14, '#ffc933', 0.5 * rnd(i, 5));
      }
      ctx.restore();
      rays(ctx, 540, 560, 24, 1300, t * 0.12, '#ffc933', 0.1 * S.p(land, 0.8));
      const pc = S.p(s0 + 0.15, 1.2, E.inOutCubic);
      if (pc > 0) {
        const cy = lerp(-260, 520, pc);
        K.crown(ctx, W / 2, cy, 310, { rot: Math.sin(t * 1.6) * 0.05 * (1 - pc * 0.6), sheen: ((t - s0) % 1.6) / 1.2, glowA: 0.7 });
      }
      shockRing(ctx, W / 2, 560, S, land, '#ffc933', 700, 0.9);
      shockRing(ctx, W / 2, 560, S, land + 0.1, '#ffffff', 520, 0.7);
      K.letters(ctx, 'KING', W / 2, 820, { size: 380, track: 14, fill: 'gold', glow: '#ff9d00', blur: 60 }, (i) => {
        const p = S.p(land + 0.1 + i * 0.12, 0.4, E.linear);
        return { a: clamp(p * 4), s: lerp(1.9, 1, E.outExpo(p)) * (1 + 0.03 * S.pulse) };
      });
      const sweep = t - (land + 1.0);
      if (sweep > 0) K.text(ctx, 'KING', W / 2, 820, { size: 380, track: 14, fill: 'rgba(0,0,0,0)', sheen: (sweep % 1.6) * 1.1 - 0.2, sheenA: 0.9, sx: 1 + 0.03 * S.pulse, sy: 1 + 0.03 * S.pulse });
      const pk = S.p(land + 0.7, 0.6, E.outCubic);
      K.text(ctx, 'KOHLI', W / 2, 1030, { size: 96, fam: 'barlow', weight: 800, track: lerp(90, 40, pk), alpha: pk });
      const chips = [['NOT OUT', '139*'], ['ODI RUNS', '15,000'], ['CHASED', 'CHASED']];
      chips.forEach(([label, value], i) => {
        const p = S.p(land + 1.2 + i * 0.25, 0.45, E.linear);
        chip(ctx, 230 + i * 310, 1175, 290, 160, label, value, clamp(p * 3), E.outBack(p, 1.8), ['#ffc933', '#27c4ff', '#19c16b'][i]);
      });
      const pr = S.p(land + 2.0, 0.6, E.outCubic);
      if (pr > 0) {
        const w = 760 * pr;
        ['#ff9933', '#ffffff', '#138808'].forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(W / 2 - w / 2, 1298 + i * 8, w, 7); });
        K.text(ctx, 'INDIA!  INDIA!', W / 2, 1368, { size: 50, fam: 'barlow', weight: 800, italic: true, track: 20, alpha: pr * 0.9 });
      }
      fireworks(ctx, S, land + 1.1, 230, 330, ['#ffc933', '#ff9933', '#ffffff']);
      fireworks(ctx, S, land + 1.6, 850, 290, ['#138808', '#ffffff', '#ff9933']);
      fireworks(ctx, S, land + 2.2, 540, 220, ['#ffc933', '#27c4ff', '#ffffff']);
    },
  };
})();
