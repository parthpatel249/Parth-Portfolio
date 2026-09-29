// Drawing kit: math, easing, colour, typography and vector icons.
// Everything is a pure function of its inputs so any frame can be rendered
// in isolation (scrubbing, parallel rendering).
(function () {
  'use strict';
  const K = (window.K = {});
  const TAU = (K.TAU = Math.PI * 2);

  // ── math ────────────────────────────────────────────────────────────────
  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.inv = (a, b, x) => K.clamp((x - a) / (b - a));
  K.smooth = (t) => t * t * (3 - 2 * t);
  K.rnd = (i, s = 0) => {
    let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s | 0) + 0x632be5ab, 0xc2b2ae35);
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
    x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
  };
  K.noise = (t, s = 0) => {
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    return K.lerp(K.rnd(i, s), K.rnd(i + 1, s), u) * 2 - 1;
  };

  const E = (window.E = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
    outBounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  });

  // ── colour ──────────────────────────────────────────────────────────────
  const rgbCache = {};
  K.rgb = (hex) => {
    if (rgbCache[hex]) return rgbCache[hex];
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  };
  K.rgba = (hex, a) => {
    const [r, g, b] = K.rgb(hex);
    return `rgba(${r},${g},${b},${K.clamp(a).toFixed(3)})`;
  };
  K.mix = (a, b, t) => {
    const A = K.rgb(a), B = K.rgb(b);
    const c = A.map((v, i) => Math.round(K.lerp(v, B[i], K.clamp(t))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  K.C = {
    navy: '#040a1c', blue: '#1f5bff', cyan: '#27c4ff', saffron: '#ff8c1a', gold: '#ffc933',
    white: '#ffffff', green: '#16a34a', maroon: '#7a1030', wiGold: '#f6b40e', red: '#ff2d4b',
    ink: '#0b0b12',
  };

  // ── canvases ────────────────────────────────────────────────────────────
  K.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  const glowCache = {};
  K.glowSprite = (color) => {
    if (glowCache[color]) return glowCache[color];
    const c = K.canvas(256, 256), g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, K.rgba(color, 1));
    rg.addColorStop(0.25, K.rgba(color, 0.55));
    rg.addColorStop(0.6, K.rgba(color, 0.12));
    rg.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    return (glowCache[color] = c);
  };
  K.glow = (ctx, x, y, r, color, a = 1) => {
    if (a <= 0.002 || r <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(K.glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  // ── typography ──────────────────────────────────────────────────────────
  K.FAM = { anton: 'Anton', barlow: 'Barlow Condensed', bangers: 'Bangers' };
  K.font = (size, fam = 'anton', weight = 400, italic = false) =>
    `${italic ? 'italic ' : ''}${weight} ${Math.max(1, size).toFixed(2)}px "${K.FAM[fam] || fam}"`;

  const capCache = {};
  K.cap = (ctx, fam = 'anton', weight = 400, italic = false) => {
    const key = fam + weight + italic;
    if (capCache[key]) return capCache[key];
    ctx.save();
    ctx.font = K.font(200, fam, weight, italic);
    ctx.letterSpacing = '0px';
    const m = ctx.measureText('H');
    ctx.restore();
    return (capCache[key] = m.actualBoundingBoxAscent / 200 || 0.7);
  };

  const GRADS = {
    gold: [[0, '#fff6cf'], [0.3, '#ffd84a'], [0.5, '#e4a41b'], [0.53, '#b27409'], [0.78, '#ffdf7a'], [1, '#a76a06']],
    chrome: [[0, '#ffffff'], [0.45, '#e3ebf8'], [0.5, '#8b9dbd'], [0.56, '#cbd7ec'], [1, '#ffffff']],
    saffron: [[0, '#ffe0a8'], [0.45, '#ffa02e'], [1, '#e04e00']],
    blue: [[0, '#bfe4ff'], [0.45, '#3f8bff'], [1, '#1236c9']],
    fire: [[0, '#fff1a8'], [0.4, '#ffb21e'], [1, '#ff3d00']],
    maroon: [[0, '#ffd1dc'], [0.4, '#d23a62'], [1, '#6d0c2a']],
    ice: [[0, '#ffffff'], [0.5, '#bff0ff'], [1, '#39b8ff']],
  };
  K.GRADS = GRADS;
  K.vgrad = (ctx, y0, y1, stops) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  function resolveFill(ctx, fill, x0, y0, x1, y1) {
    if (typeof fill === 'function') return fill(ctx, x0, y0, x1, y1);
    if (Array.isArray(fill)) return K.vgrad(ctx, y0, y1, fill);
    if (GRADS[fill]) return K.vgrad(ctx, y0, y1, GRADS[fill]);
    return fill;
  }
  K.resolveFill = resolveFill;

  function setFont(ctx, size, o) {
    ctx.font = K.font(size, o.fam || 'anton', o.weight || 400, !!o.italic);
    ctx.letterSpacing = (o.track || 0) * (size / (o.size || 100)) + 'px';
  }

  K.measure = (ctx, str, o) => {
    ctx.save();
    setFont(ctx, o.size || 100, o);
    const w = ctx.measureText(str).width - (o.track || 0);
    ctx.restore();
    return w;
  };

  // Size that fits `str` into maxW (never above o.size).
  K.fit = (ctx, str, o, maxW) => {
    const w = K.measure(ctx, str, o);
    return w > maxW ? (o.size || 100) * (maxW / w) : o.size || 100;
  };

  // Draw text vertically centred on the cap-height at (x, y).
  K.text = function (ctx, str, x, y, o = {}) {
    let size = o.size || 100;
    const fam = o.fam || 'anton', weight = o.weight || 400, italic = !!o.italic;
    let track = o.track || 0;
    ctx.save();
    ctx.font = K.font(size, fam, weight, italic);
    ctx.letterSpacing = track + 'px';
    let w = ctx.measureText(str).width - track;
    if (o.maxW && w > o.maxW) {
      const k = o.maxW / w;
      size *= k; track *= k;
      ctx.font = K.font(size, fam, weight, italic);
      ctx.letterSpacing = track + 'px';
      w = o.maxW;
    }
    const cap = K.cap(ctx, fam, weight, italic) * size;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.skew) ctx.transform(1, 0, o.skew, 1, 0, 0);
    if (o.sx != null || o.sy != null) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    const align = o.align || 'center';
    const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    const by = cap / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha *= o.alpha ?? 1;
    if (ctx.globalAlpha <= 0.002) { ctx.restore(); return { w, cap, size }; }

    if (o.shadow) {
      const s = o.shadow;
      ctx.save();
      ctx.fillStyle = s.color || 'rgba(0,0,0,.6)';
      if (s.blur) { ctx.shadowColor = s.color; ctx.shadowBlur = s.blur; }
      if (o.stroke && o.lw) { ctx.lineJoin = 'round'; ctx.strokeStyle = s.color; ctx.lineWidth = o.lw; ctx.strokeText(str, x0 + (s.x || 0), by + (s.y || 0)); }
      ctx.fillText(str, x0 + (s.x || 0), by + (s.y || 0));
      ctx.restore();
    }
    const style = o.fill === 'none' ? null : resolveFill(ctx, o.fill ?? '#fff', x0, -cap / 2, x0 + w, cap / 2);
    if (o.glow) {
      ctx.save();
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.blur ?? 34;
      ctx.fillStyle = style || o.glow;
      ctx.globalAlpha *= o.glowA ?? 1;
      ctx.fillText(str, x0, by);
      ctx.restore();
    }
    if (o.stroke && o.lw) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = resolveFill(ctx, o.stroke, x0, -cap / 2, x0 + w, cap / 2);
      ctx.lineWidth = o.lw;
      ctx.strokeText(str, x0, by);
    }
    if (style) {
      ctx.fillStyle = style;
      ctx.fillText(str, x0, by);
    }
    if (o.sheen != null && o.sheen > -0.5 && o.sheen < 1.5) {
      // A diagonal light band that only lands inside the glyphs.
      const sx = x0 - w * 0.4 + o.sheen * w * 1.8, bw = Math.max(60, w * 0.18);
      const g = ctx.createLinearGradient(sx - bw, -cap, sx + bw, cap);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${o.sheenA ?? 0.85})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillText(str, x0, by);
    }
    ctx.restore();
    return { w, cap, size };
  };

  // Per-letter kinetic text. fx(i, n, ch) -> {x, y, s, r, a} offsets.
  const layoutCache = new Map();
  K.letters = function (ctx, str, x, y, o, fx) {
    const size = o.size || 100;
    const key = str + '|' + K.font(size, o.fam, o.weight, o.italic) + '|' + (o.track || 0);
    let L = layoutCache.get(key);
    if (!L) {
      ctx.save();
      ctx.font = K.font(size, o.fam || 'anton', o.weight || 400, !!o.italic);
      ctx.letterSpacing = (o.track || 0) + 'px';
      const chars = [...str], xs = [];
      let prevW = 0;
      for (let i = 0; i < chars.length; i++) {
        const wi = ctx.measureText(chars.slice(0, i + 1).join('')).width;
        xs.push([prevW, wi - (o.track || 0)]);
        prevW = wi;
      }
      ctx.restore();
      L = { chars, xs, w: prevW - (o.track || 0) };
      if (layoutCache.size > 600) layoutCache.clear();
      layoutCache.set(key, L);
    }
    const align = o.align || 'center';
    const x0 = align === 'center' ? -L.w / 2 : align === 'right' ? -L.w : 0;
    const n = L.chars.length;
    const lo = Object.assign({}, o, { align: 'center', track: 0 });
    for (let i = 0; i < n; i++) {
      const ch = L.chars[i];
      if (ch === ' ') continue;
      const f = fx(i, n, ch) || {};
      if ((f.a ?? 1) <= 0.002) continue;
      const cx = x + x0 + (L.xs[i][0] + L.xs[i][1]) / 2;
      lo.alpha = (o.alpha ?? 1) * (f.a ?? 1);
      lo.sx = lo.sy = f.s ?? 1;
      if (f.sy != null) lo.sy = f.sy;
      if (f.sx != null) lo.sx = f.sx;
      lo.rot = f.r || 0;
      if (f.fill) lo.fill = f.fill; else lo.fill = o.fill;
      K.text(ctx, ch, cx + (f.x || 0), y + (f.y || 0), lo);
    }
    return L.w;
  };

  // ── shapes ──────────────────────────────────────────────────────────────
  K.rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  K.burstPath = (ctx, x, y, r0, r1, n, rot = 0, jag = 0, seed = 0) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * TAU;
      const rr = (i % 2 ? r0 : r1) * (1 + jag * (K.rnd(i, seed) - 0.5));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };

  // Speech bubble: rounded rect with a tail to (tx, ty).
  K.bubblePath = (ctx, x, y, w, h, r, tx, ty, tw = 60) => {
    const b = y + h, cx = K.clamp(tx, x + r + tw, x + w - r - tw);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, b, r);
    ctx.arcTo(x + w, b, x, b, r);
    ctx.lineTo(cx + tw / 2, b);
    ctx.lineTo(tx, ty);
    ctx.lineTo(cx - tw / 2, b);
    ctx.arcTo(x, b, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Thought cloud (union of circles) with trailing puffs toward (tx, ty).
  K.cloud = (ctx, cx, cy, rx, ry, fill, stroke, lw, tx, ty, grow = 1) => {
    const n = 14, puffs = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const pr = (0.3 + 0.08 * Math.sin(i * 2.7)) * Math.min(rx, ry) * 0.9;
      puffs.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, pr]);
    }
    const trail = [];
    if (tx != null) {
      for (let i = 0; i < 3; i++) {
        const u = 0.35 + i * 0.22;
        const px = K.lerp(cx + (tx - cx) * 0.55, tx, u), py = K.lerp(cy + ry * 0.95, ty, u);
        trail.push([px, py, (26 - i * 7) * grow]);
      }
    }
    const all = (fn) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); fn();
      for (const [px, py, pr] of puffs) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); fn(); }
    };
    ctx.save();
    if (stroke) {
      ctx.strokeStyle = stroke; ctx.lineWidth = lw * 2;
      all(() => ctx.stroke());
      for (const [px, py, pr] of trail) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = fill;
    all(() => ctx.fill());
    for (const [px, py, pr] of trail) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  K.sparkle = (ctx, x, y, r, a = 1, color = '#fff', rot = 0) => {
    if (a <= 0 || r <= 0) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha *= a;
    K.glow(ctx, 0, 0, r * 1.6, color, 0.6);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU, rr = i % 2 ? r * 0.16 : r;
      ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  K.ring = (ctx, x, y, r, lw, color, a = 1) => {
    if (a <= 0 || r <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  };

  K.check = (ctx, x, y, s, color = '#fff', lw = 0.18, p = 1) => {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = [[-0.4, 0], [-0.12, 0.3], [0.45, -0.35]];
    const segA = K.clamp(p * 2), segB = K.clamp(p * 2 - 1);
    ctx.moveTo(...pts[0]);
    ctx.lineTo(K.lerp(pts[0][0], pts[1][0], segA), K.lerp(pts[0][1], pts[1][1], segA));
    if (segB > 0) ctx.lineTo(K.lerp(pts[1][0], pts[2][0], segB), K.lerp(pts[1][1], pts[2][1], segB));
    ctx.stroke();
    ctx.restore();
  };

  // Tapered motion streak ending at (x1, y1).
  K.streak = (ctx, x0, y0, x1, y1, r, color = '#ffffff', a = 0.8) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 2 || a <= 0) return;
    const nx = -dy / L, ny = dx / L;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, K.rgba(color, 0));
    g.addColorStop(1, K.rgba(color, a));
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 + nx * r, y1 + ny * r);
    ctx.lineTo(x1 - nx * r, y1 - ny * r);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  // ── icons ───────────────────────────────────────────────────────────────
  // ODI white ball; spin = seam rotation (radians), tilt = seam axis angle.
  K.ball = (ctx, x, y, r, spin = 0, tilt = 0.5, o = {}) => {
    if (r <= 0.5) return;
    ctx.save();
    ctx.translate(x, y);
    const red = o.red;
    if (o.glow !== false) K.glow(ctx, 0, 0, r * 2.4, red ? '#ff4a4a' : '#bcd8ff', o.glowA ?? 0.45);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    if (red) { g.addColorStop(0, '#ff8a8a'); g.addColorStop(0.45, '#c8102e'); g.addColorStop(1, '#4a0010'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#eef1f6'); g.addColorStop(1, '#8e98ad'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.rotate(tilt);
    const sx = Math.sin(spin) * r, face = Math.cos(spin) >= 0;
    const seam = red ? '#f4e3c4' : '#c9ced9', stitch = red ? '#fff7e6' : '#d6283e';
    const half = (ox, lw, dash) => {
      ctx.lineWidth = lw;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.ellipse(ox, 0, Math.max(0.5, Math.abs(sx)), r * 1.02, 0, -Math.PI / 2, Math.PI / 2, !face);
      ctx.stroke();
    };
    ctx.strokeStyle = seam; half(0, r * 0.07);
    ctx.strokeStyle = stitch;
    const d = [r * 0.06, r * 0.07];
    half(r * 0.09 * (face ? -1 : 1), r * 0.035, d);
    half(-r * 0.09 * (face ? -1 : 1), r * 0.035, d);
    ctx.restore();
    const hl = ctx.createRadialGradient(-r * 0.38, -r * 0.42, 0, -r * 0.38, -r * 0.42, r * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,.95)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  };

  K.crown = (ctx, x, y, w, o = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    ctx.scale(w, w);
    if (o.glow !== false) K.glow(ctx, 0, 0, 0.9, '#ffb300', o.glowA ?? 0.55);
    const P = [[-0.44, 0.34], [-0.5, -0.26], [-0.36, -0.02], [-0.25, -0.4], [-0.12, -0.06], [0, -0.52],
      [0.12, -0.06], [0.25, -0.4], [0.36, -0.02], [0.5, -0.26], [0.44, 0.34]];
    const body = () => {
      ctx.beginPath();
      P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    };
    body();
    ctx.fillStyle = K.vgrad(ctx, -0.52, 0.34, GRADS.gold);
    ctx.fill();
    ctx.lineWidth = 0.018; ctx.strokeStyle = '#7a4b00'; ctx.lineJoin = 'round'; ctx.stroke();
    // band
    K.rr(ctx, -0.47, 0.2, 0.94, 0.2, 0.05);
    ctx.fillStyle = K.vgrad(ctx, 0.2, 0.4, [[0, '#ffe58a'], [0.5, '#c88a12'], [1, '#8a5a00']]);
    ctx.fill(); ctx.stroke();
    // jewels
    [[-0.28, '#ff2d4b'], [0, '#27c4ff'], [0.28, '#19c16b']].forEach(([jx, c]) => {
      const jg = ctx.createRadialGradient(jx - 0.02, 0.28, 0, jx, 0.3, 0.07);
      jg.addColorStop(0, '#fff'); jg.addColorStop(0.35, c); jg.addColorStop(1, K.mix(c, '#000000', 0.6));
      ctx.fillStyle = jg;
      ctx.beginPath(); ctx.ellipse(jx, 0.3, 0.06, 0.07, 0, 0, TAU); ctx.fill();
    });
    // tip pearls
    [[-0.5, -0.26], [-0.25, -0.4], [0, -0.52], [0.25, -0.4], [0.5, -0.26]].forEach(([px, py]) => {
      const pg = ctx.createRadialGradient(px - 0.015, py - 0.02, 0, px, py, 0.05);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#e0a51d');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(px, py, 0.045, 0, TAU); ctx.fill();
    });
    if (o.sheen != null) {
      body();
      ctx.rect(-0.47, 0.2, 0.94, 0.2);
      ctx.clip('nonzero');
      const sx = -0.8 + o.sheen * 1.6;
      const g = ctx.createLinearGradient(sx - 0.2, -0.5, sx + 0.2, 0.4);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-0.6, -0.6, 1.2, 1.1);
    }
    ctx.restore();
  };

  // Cricket bat; (x, y) = centre of the blade, ang = 0 handle up.
  K.bat = (ctx, x, y, len, ang = 0, o = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const bw = len * 0.13, bl = len * 0.62, hl = len * 0.34, hw = len * 0.028;
    const top = -bl / 2, bot = bl / 2;
    // handle
    const hg = ctx.createLinearGradient(-hw, 0, hw, 0);
    hg.addColorStop(0, '#0b1020'); hg.addColorStop(0.5, '#2a3350'); hg.addColorStop(1, '#070a14');
    K.rr(ctx, -hw, top - hl, hw * 2, hl + bw * 0.2, hw);
    ctx.fillStyle = hg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = K.rgba(o.grip || '#ff8c1a', 0.9); ctx.lineWidth = hw * 0.35;
    for (let i = -2; i < 16; i++) {
      const yy = top - hl + i * hw * 1.4;
      ctx.beginPath(); ctx.moveTo(-hw, yy); ctx.lineTo(hw, yy + hw * 1.2); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#0b1020';
    ctx.beginPath(); ctx.ellipse(0, top - hl, hw * 1.25, hw * 0.7, 0, 0, TAU); ctx.fill();
    // blade
    const blade = () => {
      ctx.beginPath();
      ctx.moveTo(-hw * 1.2, top);
      ctx.quadraticCurveTo(-bw / 2, top + bw * 0.05, -bw / 2, top + bw * 0.5);
      ctx.lineTo(-bw / 2, bot - bw * 0.3);
      ctx.quadraticCurveTo(-bw / 2, bot, -bw / 2 + bw * 0.28, bot);
      ctx.lineTo(bw / 2 - bw * 0.28, bot);
      ctx.quadraticCurveTo(bw / 2, bot, bw / 2, bot - bw * 0.3);
      ctx.lineTo(bw / 2, top + bw * 0.5);
      ctx.quadraticCurveTo(bw / 2, top + bw * 0.05, hw * 1.2, top);
      ctx.closePath();
    };
    blade();
    const wg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    wg.addColorStop(0, '#b27a3a'); wg.addColorStop(0.3, '#f6dfaa'); wg.addColorStop(0.62, '#e7c584'); wg.addColorStop(1, '#a8723a');
    ctx.fillStyle = wg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(120,70,20,.18)'; ctx.lineWidth = len * 0.003;
    for (let i = 0; i < 9; i++) {
      const gx = -bw / 2 + (i + 0.5) * (bw / 9);
      ctx.beginPath(); ctx.moveTo(gx, top); ctx.bezierCurveTo(gx + bw * 0.03, 0, gx - bw * 0.03, bot * 0.5, gx, bot); ctx.stroke();
    }
    // decal band
    ctx.fillStyle = '#0b2a8a'; ctx.fillRect(-bw, top + bl * 0.1, bw * 2, bl * 0.09);
    ctx.fillStyle = o.grip || '#ff8c1a'; ctx.fillRect(-bw, top + bl * 0.19, bw * 2, bl * 0.015);
    ctx.fillStyle = '#0b2a8a'; ctx.fillRect(-bw, bot - bl * 0.16, bw * 2, bl * 0.05);
    if (o.sheen != null) {
      const sy = K.lerp(top - bl * 0.3, bot + bl * 0.3, o.sheen);
      const sg = ctx.createLinearGradient(0, sy - bl * 0.18, bw * 0.4, sy + bl * 0.18);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(-bw, top, bw * 2, bl);
    }
    ctx.restore();
    blade();
    ctx.strokeStyle = 'rgba(90,50,10,.8)'; ctx.lineWidth = len * 0.005; ctx.stroke();
    ctx.restore();
  };

  // Waving Indian tricolour centred at (x, y); bands are smooth polygons.
  K.flag = (ctx, x, y, w, h, t, amp = 1) => {
    const N = 64;
    const ph = (u) => u * 6.5 - t * 5.5;
    const off = (u) => Math.sin(ph(u)) * h * 0.06 * amp * (0.25 + u);
    ctx.save();
    ctx.translate(x - w / 2, y - h / 2);
    const band = (y0, y1, color) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(u * w, y0 + off(u)); }
      for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(u * w, y1 + off(u)); }
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    };
    band(-2, h / 3 + 1, '#ff9933');
    band(h / 3, (2 * h) / 3 + 1, '#ffffff');
    band((2 * h) / 3, h + 2, '#138808');
    // fold shading depends only on x, so one horizontal gradient covers it
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, sh = Math.cos(ph(u)) * amp * (0.25 + u);
      g.addColorStop(u, sh > 0 ? `rgba(255,255,255,${0.14 * sh})` : `rgba(0,0,0,${-0.22 * sh})`);
    }
    band(-2, h + 2, g);
    const cy = h / 2 + off(0.5), cr = h * 0.14;
    ctx.translate(w / 2, cy);
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = cr * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.stroke();
    ctx.lineWidth = cr * 0.045;
    ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * cr, Math.sin(a) * cr);
    }
    ctx.stroke();
    ctx.fillStyle = '#000080';
    ctx.beginPath(); ctx.arc(0, 0, cr * 0.18, 0, TAU); ctx.fill();
    ctx.restore();
  };

  // Emoji-style faces (all original vector art). Units: face radius = 100.
  K.face = (ctx, x, y, r, type, t, o = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    ctx.scale(r / 100, r / 100);
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(8, 14, 100, 100, 0, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(-32, -40, 8, 0, 0, 104);
    g.addColorStop(0, '#fff59a'); g.addColorStop(0.5, '#ffd21f'); g.addColorStop(1, '#f29a00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 100, 0, TAU); ctx.fill();
    const dark = '#4a2a00';
    ctx.lineCap = ctx.lineJoin = 'round';
    const eyes = (ry = 18) => {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-34, -18, 12, ry, 0, 0, TAU); ctx.ellipse(34, -18, 12, ry, 0, 0, TAU); ctx.fill();
    };
    if (type === 'cool' || type === 'king') {
      ctx.strokeStyle = dark; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(-34, 44); ctx.quadraticCurveTo(10, 62, 44, 30); ctx.stroke();
      const gy = o.glassesY || 0;
      ctx.save();
      ctx.translate(0, gy);
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(-88, -38, 176, 12);
      const lens = (sx) => {
        ctx.beginPath();
        ctx.moveTo(sx * 8, -30); ctx.lineTo(sx * 84, -30);
        ctx.quadraticCurveTo(sx * 84, 16, sx * 52, 16);
        ctx.quadraticCurveTo(sx * 10, 16, sx * 8, -30);
        ctx.fill();
      };
      lens(-1); lens(1);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-70, -20); ctx.lineTo(-54, -4); ctx.moveTo(26, -20); ctx.lineTo(42, -4); ctx.stroke();
      ctx.restore();
    } else if (type === 'laugh') {
      ctx.strokeStyle = dark; ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(-58, -30); ctx.lineTo(-24, -16); ctx.lineTo(-58, -2);
      ctx.moveTo(58, -30); ctx.lineTo(24, -16); ctx.lineTo(58, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-64, 18); ctx.quadraticCurveTo(0, 30, 64, 18);
      ctx.quadraticCurveTo(56, 88, 0, 90); ctx.quadraticCurveTo(-56, 88, -64, 18);
      ctx.fillStyle = '#5b1600'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(-70, 10, 140, 24);
      ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.ellipse(0, 92, 40, 26, 0, 0, TAU); ctx.fill();
      ctx.restore();
      // tears streaming
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const ph = (t * 2.2 + k / 3) % 1;
          const tx = s * (70 + ph * 60), ty = -10 + ph * 40 + ph * ph * 60;
          ctx.fillStyle = `rgba(80,190,255,${0.95 - ph * 0.8})`;
          ctx.beginPath(); ctx.ellipse(tx, ty, 13 - ph * 5, 17 - ph * 5, s * 0.6, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#5cc8ff';
        ctx.beginPath(); ctx.ellipse(s * 62, 4, 16, 24, s * 0.4, 0, TAU); ctx.fill();
      }
    } else if (type === 'think') {
      eyes(16);
      ctx.strokeStyle = dark; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-54, -58); ctx.quadraticCurveTo(-34, -72, -14, -60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, -48); ctx.lineTo(52, -50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, 46); ctx.lineTo(30, 38); ctx.stroke();
      // hand on chin
      ctx.fillStyle = '#f7b500'; ctx.strokeStyle = '#b36b00'; ctx.lineWidth = 5;
      ctx.save(); ctx.translate(34, 84); ctx.rotate(-0.25);
      K.rr(ctx, -44, -18, 88, 42, 20); ctx.fill(); ctx.stroke();
      K.rr(ctx, 14, -70, 24, 64, 12); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (type === 'sweat') {
      ctx.strokeStyle = dark; ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-56, -12); ctx.quadraticCurveTo(-36, -36, -16, -12);
      ctx.moveTo(16, -12); ctx.quadraticCurveTo(36, -36, 56, -12);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-58, 22); ctx.quadraticCurveTo(0, 96, 58, 22); ctx.closePath();
      ctx.fillStyle = '#5b1600'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(-60, 18, 120, 20); ctx.restore();
      const sy = -64 + ((t * 0.9) % 1) * 30;
      const sg = ctx.createLinearGradient(60, sy - 30, 90, sy + 30);
      sg.addColorStop(0, '#d6f3ff'); sg.addColorStop(1, '#2fa8ff');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(74, sy - 34); ctx.quadraticCurveTo(100, sy + 4, 74, sy + 22); ctx.quadraticCurveTo(48, sy + 4, 74, sy - 34); ctx.fill();
    } else if (type === 'shock') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-34, -20, 22, 0, TAU); ctx.arc(34, -20, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(-34, -18, 8, 0, TAU); ctx.arc(34, -18, 8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 48, 20, 28, 0, 0, TAU); ctx.fill();
    } else {
      eyes();
      ctx.strokeStyle = dark; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(0, 18, 46, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    if (o.cap) {
      ctx.fillStyle = o.cap;
      ctx.beginPath(); ctx.ellipse(-4, -58, 96, 62, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      ctx.fillStyle = K.mix(o.cap, '#000000', 0.35);
      ctx.beginPath(); ctx.ellipse(-86, -60, 72, 14, -0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = K.mix(o.cap, '#ffffff', 0.25);
      ctx.beginPath(); ctx.arc(-4, -118, 8, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (o.crown) K.crown(ctx, x + (o.crownX || 0) * r, y - r * 1.12, r * 1.25, { rot: (o.rot || 0) * 0.6 + (o.crownRot || 0), glowA: 0.35 });
  };

  // Odometer-style rolling number. v may be fractional (mid-roll).
  K.roll = (ctx, v, x, y, o = {}) => {
    const size = o.size || 200, fam = o.fam || 'anton';
    const digits = o.digits || String(Math.floor(o.max ?? Math.max(1, v))).length;
    ctx.save();
    ctx.font = K.font(size, fam, o.weight || 400, !!o.italic);
    ctx.letterSpacing = '0px';
    const dw = ctx.measureText('0').width * (o.spacing ?? 1.04);
    const cw = o.commas ? ctx.measureText(',').width * 1.1 : 0;
    ctx.restore();
    const cap = K.cap(ctx, fam, o.weight || 400, !!o.italic) * size;
    const cols = [];
    for (let k = digits - 1; k >= 0; k--) {
      cols.push({ k });
      if (o.commas && k > 0 && k % 3 === 0) cols.push({ comma: true });
    }
    const suffix = o.suffix || '';
    const sw = suffix ? K.measure(ctx, suffix, { size: size * (o.suffixScale || 0.6), fam }) + size * 0.06 : 0;
    const total = cols.reduce((s, c) => s + (c.comma ? cw : dw), 0) + sw;
    let cx = x - (o.align === 'left' ? 0 : total / 2);
    const step = cap * 1.35;
    const iv = Math.floor(v + 1e-6);
    const txt = Object.assign({}, o, { size, align: 'center', track: 0 });
    for (const c of cols) {
      if (c.comma) {
        K.text(ctx, ',', cx + cw / 2, y, Object.assign({}, txt, { alpha: (o.alpha ?? 1) * (iv >= 1000 || o.dimLeading === false ? 1 : 0.2) }));
        cx += cw;
        continue;
      }
      const p = Math.pow(10, c.k);
      const base = Math.floor(v / p) % 10;
      let frac;
      if (c.k === 0) frac = v - Math.floor(v);
      else { const below = v - Math.floor(v / p) * p; frac = below > p - 1 ? below - (p - 1) : 0; }
      const lead = c.k > 0 && iv < p;
      const a = (o.alpha ?? 1) * (lead ? (o.dimLeading === false ? 0 : 0.18) : 1);
      const mx = cx + dw / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 4, y - cap * 0.62, dw + 8, cap * 1.24); ctx.clip();
      txt.alpha = a;
      // a global light band (sheenX) mapped into this digit's local sheen
      if (o.sheenX != null) txt.sheen = (o.sheenX - mx + dw / 2 + dw * 0.4) / (dw * 1.8);
      K.text(ctx, String(base), mx, y - frac * step, txt);
      if (frac > 0.001) K.text(ctx, String((base + 1) % 10), mx, y + (1 - frac) * step, txt);
      ctx.restore();
      cx += dw;
    }
    if (suffix) {
      K.text(ctx, suffix, cx + size * 0.06, y - cap * 0.2, Object.assign({}, txt, { size: size * (o.suffixScale || 0.6), align: 'left', alpha: (o.alpha ?? 1) * (o.suffixA ?? 1) }));
    }
    return { w: total, cap };
  };

  // Stadium LED board: metal frame, dark dotted face, glass reflection.
  let dotPattern = null;
  K.panel = (ctx, x, y, w, h, o = {}) => {
    const acc = o.accent || '#ffc933';
    ctx.save();
    if (o.glowA) { ctx.shadowColor = K.rgba(acc, o.glowA); ctx.shadowBlur = 60; }
    K.rr(ctx, x, y, w, h, 30);
    ctx.fillStyle = K.vgrad(ctx, y, y + h, [[0, '#3a4152'], [0.5, '#141821'], [1, '#2a303d']]);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4; ctx.strokeStyle = K.rgba(acc, 0.9); ctx.stroke();
    K.rr(ctx, x + 16, y + 16, w - 32, h - 32, 18);
    ctx.fillStyle = '#04060b'; ctx.fill();
    if (!dotPattern) {
      const c = K.canvas(14, 14), g = c.getContext('2d');
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.beginPath(); g.arc(7, 7, 2.4, 0, TAU); g.fill();
      dotPattern = ctx.createPattern(c, 'repeat');
    }
    ctx.fillStyle = dotPattern; ctx.fill();
    ctx.save(); ctx.clip();
    const gl = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(0.45, 'rgba(255,255,255,.02)'); gl.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.fillStyle = '#9aa3b5';
    for (const [rx, ry] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) {
      ctx.beginPath(); ctx.arc(rx, ry, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  // Rubber stamp text.
  K.stamp = (ctx, str, x, y, o = {}) => {
    const size = o.size || 90, color = o.color || '#ff2d4b';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot ?? -0.08);
    ctx.scale(o.s ?? 1, o.s ?? 1);
    ctx.globalAlpha *= o.alpha ?? 1;
    const w = K.measure(ctx, str, { size, fam: o.fam || 'anton', track: o.track ?? 6 }) + size * 0.7;
    const h = size * 1.25;
    ctx.lineWidth = size * 0.07; ctx.strokeStyle = color;
    K.rr(ctx, -w / 2, -h / 2, w, h, size * 0.14); ctx.stroke();
    ctx.lineWidth = size * 0.025;
    K.rr(ctx, -w / 2 + size * 0.1, -h / 2 + size * 0.1, w - size * 0.2, h - size * 0.2, size * 0.08); ctx.stroke();
    if (o.bg) { ctx.fillStyle = o.bg; ctx.fill(); }
    K.text(ctx, str, 0, 0, { size, fam: o.fam || 'anton', fill: color, track: o.track ?? 6 });
    ctx.restore();
  };

  // Caution tape band with scrolling text.
  K.tape = (ctx, x, y, len, h, ang, label, scroll, o = {}) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillStyle = o.bg || '#ffd21f';
    ctx.fillRect(-len / 2, -h / 2, len, h);
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.rect(-len / 2, -h / 2, len, h); ctx.clip();
    const unit = o.unit || 560, sh = h * 0.5;
    const start = -len / 2 - unit + (((scroll % unit) + unit) % unit);
    for (let ux = start; ux < len / 2 + unit; ux += unit) {
      ctx.fillStyle = o.ink || '#111';
      for (let s = 0; s < 4; s++) {
        const sx = ux + s * sh * 0.9;
        ctx.beginPath();
        ctx.moveTo(sx, h / 2); ctx.lineTo(sx + sh * 0.45, h / 2); ctx.lineTo(sx + sh * 0.45 + h, -h / 2); ctx.lineTo(sx + h, -h / 2);
        ctx.fill();
      }
      K.text(ctx, label, ux + unit * 0.62, 0, { size: h * 0.56, fam: 'anton', fill: o.ink || '#111', track: 4 });
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-len / 2, -h / 2, len, 5); ctx.fillRect(-len / 2, h / 2 - 5, len, 5);
    ctx.restore();
  };
})();
