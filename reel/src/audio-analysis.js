// Beat / onset analysis for the reel. Pure JS, no dependencies.
// Works in the browser (window.ReelAudio) and in Node (require()).
//
// analyze(samples, sampleRate) -> {
//   bpm, beats[], downbeats[], onsets[{t,s}], env:{rate, rms[], low[]}, duration
// }
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReelAudio = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TARGET_SR = 22050;
  const WIN = 1024;
  const HOP = 256;
  const ENV_RATE = 60; // envelope samples per second

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  function resample(samples, sr) {
    if (sr === TARGET_SR) return samples;
    const ratio = sr / TARGET_SR;
    const n = Math.floor(samples.length / ratio);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // box-filter average over the source span (cheap anti-alias)
      const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
      let s = 0;
      for (let j = a; j < b && j < samples.length; j++) s += samples[j];
      out[i] = s / (b - a);
    }
    return out;
  }

  function movingAverage(x, radius) {
    const out = new Float32Array(x.length);
    let acc = 0, count = 0;
    for (let i = 0; i < Math.min(radius, x.length); i++) { acc += x[i]; count++; }
    for (let i = 0; i < x.length; i++) {
      const add = i + radius, rem = i - radius - 1;
      if (add < x.length) { acc += x[add]; count++; }
      if (rem >= 0) { acc -= x[rem]; count--; }
      out[i] = acc / count;
    }
    return out;
  }

  function percentile(arr, p) {
    const s = Array.from(arr).sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 1e-9;
  }

  function analyze(input, sampleRate) {
    const x = resample(input, sampleRate);
    const sr = TARGET_SR;
    const frames = Math.max(1, Math.floor((x.length - WIN) / HOP) + 1);
    const frameRate = sr / HOP;
    const bins = WIN / 2;
    const lowBin = Math.ceil((160 * WIN) / sr);

    const hann = new Float32Array(WIN);
    for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1));

    const re = new Float32Array(WIN), im = new Float32Array(WIN);
    let prev = new Float32Array(bins), cur = new Float32Array(bins);
    const flux = new Float32Array(frames);
    const lowFlux = new Float32Array(frames);
    const rms = new Float32Array(frames);
    const lowE = new Float32Array(frames);

    for (let f = 0; f < frames; f++) {
      const off = f * HOP;
      let e = 0;
      for (let i = 0; i < WIN; i++) {
        const v = x[off + i] || 0;
        e += v * v;
        re[i] = v * hann[i];
        im[i] = 0;
      }
      rms[f] = Math.sqrt(e / WIN);
      fft(re, im);
      let fl = 0, lf = 0, le = 0;
      for (let k = 1; k < bins; k++) {
        const mag = Math.log1p(100 * Math.hypot(re[k], im[k]));
        cur[k] = mag;
        const d = mag - prev[k];
        if (d > 0) { fl += d; if (k <= lowBin) lf += d; }
        if (k <= lowBin) le += mag;
      }
      flux[f] = fl;
      lowFlux[f] = lf;
      lowE[f] = le;
      const t = prev; prev = cur; cur = t;
    }

    // Onset strength: flux minus local mean, half-wave rectified, std-normalised.
    const localMean = movingAverage(flux, Math.round(frameRate * 0.25));
    const onset = new Float32Array(frames);
    let mean = 0;
    for (let f = 0; f < frames; f++) { onset[f] = Math.max(0, flux[f] - localMean[f]); mean += onset[f]; }
    mean /= frames;
    let variance = 0;
    for (let f = 0; f < frames; f++) variance += (onset[f] - mean) ** 2;
    const std = Math.sqrt(variance / frames) || 1;
    for (let f = 0; f < frames; f++) onset[f] /= std;

    // Beat envelope: broadband onsets plus the kick band weighted up, so the
    // grid locks to the kick drum rather than off-beat hats/claps.
    const lowMean = movingAverage(lowFlux, Math.round(frameRate * 0.25));
    const lowOn = new Float32Array(frames);
    let lm = 0;
    for (let f = 0; f < frames; f++) { lowOn[f] = Math.max(0, lowFlux[f] - lowMean[f]); lm += lowOn[f]; }
    lm /= frames;
    let lv = 0;
    for (let f = 0; f < frames; f++) lv += (lowOn[f] - lm) ** 2;
    const lstd = Math.sqrt(lv / frames) || 1;
    const beatEnv = new Float32Array(frames);
    for (let f = 0; f < frames; f++) beatEnv[f] = 0.5 * onset[f] + 1.5 * (lowOn[f] / lstd);

    // Tempo: autocorrelation with a log-normal prior around 110 BPM.
    const minLag = Math.round((frameRate * 60) / 190);
    const maxLag = Math.round((frameRate * 60) / 65);
    let bestLag = Math.round((frameRate * 60) / 100), bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let f = lag; f < frames; f++) s += beatEnv[f] * beatEnv[f - lag];
      s /= frames - lag;
      const bpm = (60 * frameRate) / lag;
      const w = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
      if (s * w > bestScore) { bestScore = s * w; bestLag = lag; }
    }
    const period = bestLag;
    const bpm = (60 * frameRate) / period;

    // Dynamic-programming beat tracker (Ellis 2007).
    const tightness = 100;
    const score = new Float32Array(frames);
    const back = new Int32Array(frames).fill(-1);
    for (let f = 0; f < frames; f++) {
      let best = 0, arg = -1;
      const lo = f - 2 * period, hi = f - Math.round(period / 2);
      for (let p = Math.max(0, lo); p <= hi; p++) {
        const pen = -tightness * Math.log((f - p) / period) ** 2;
        const v = score[p] + pen;
        if (v > best || arg < 0) { best = v; arg = p; }
      }
      score[f] = beatEnv[f] + (arg >= 0 ? best : 0);
      back[f] = arg;
    }
    let end = frames - 1, endScore = -Infinity;
    for (let f = Math.max(0, frames - period); f < frames; f++) {
      if (score[f] > endScore) { endScore = score[f]; end = f; }
    }
    const beatFrames = [];
    for (let f = end; f >= 0; f = back[f]) { beatFrames.push(f); if (back[f] < 0) break; }
    beatFrames.reverse();
    const toSec = (f) => (f * HOP + WIN / 2) / sr;
    const loud = percentile(rms, 0.5) * 0.1;
    while (beatFrames.length && rms[beatFrames[0]] < loud && rms[beatFrames[0] + 4] < loud) beatFrames.shift();
    const beats = beatFrames.map(toSec);

    // Downbeat phase: the bar position (of 4) with the most low-end attack.
    const phaseScore = [0, 0, 0, 0];
    beatFrames.forEach((f, i) => { phaseScore[i % 4] += lowFlux[f] + (lowFlux[f + 1] || 0); });
    const phase = phaseScore.indexOf(Math.max(...phaseScore));
    const downbeats = beats.filter((_, i) => i % 4 === phase);

    // Strong onsets (peak picking with an adaptive threshold).
    const thrMean = movingAverage(onset, Math.round(frameRate * 0.5));
    const onsets = [];
    const minGap = Math.round(frameRate * 0.07);
    let last = -minGap;
    for (let f = 1; f < frames - 1; f++) {
      const v = onset[f];
      if (v > onset[f - 1] && v >= onset[f + 1] && v > thrMean[f] + 0.8 && f - last >= minGap) {
        onsets.push({ t: +toSec(f).toFixed(4), s: +Math.min(1, v / 6).toFixed(3) });
        last = f;
      }
    }

    // Envelopes resampled to ENV_RATE, normalised to ~[0,1].
    const duration = x.length / sr;
    const n = Math.ceil(duration * ENV_RATE);
    const rmsN = percentile(rms, 0.97), lowN = percentile(lowFlux, 0.97);
    const envRms = new Array(n), envLow = new Array(n);
    for (let i = 0; i < n; i++) {
      const f = Math.min(frames - 1, Math.round(((i / ENV_RATE) * sr - WIN / 2) / HOP));
      const fi = Math.max(0, f);
      envRms[i] = +Math.min(1, rms[fi] / rmsN).toFixed(3);
      envLow[i] = +Math.min(1, lowFlux[fi] / lowN).toFixed(3);
    }

    return {
      bpm: +bpm.toFixed(2),
      beats: beats.map((b) => +b.toFixed(4)),
      downbeats: downbeats.map((b) => +b.toFixed(4)),
      onsets,
      env: { rate: ENV_RATE, rms: envRms, low: envLow },
      duration: +duration.toFixed(3),
    };
  }

  // A metronomic fallback grid used when no audio has been supplied.
  function grid(bpm, offset, duration) {
    const step = 60 / bpm, beats = [], downbeats = [];
    for (let t = offset, i = 0; t <= duration + 1e-6; t += step, i++) {
      beats.push(+t.toFixed(4));
      if (i % 4 === 0) downbeats.push(+t.toFixed(4));
    }
    return { bpm, beats, downbeats, onsets: [], env: null, duration, synthetic: true };
  }

  // Shift every timestamp (used when the audio file has a lead-in to skip).
  function shift(a, by) {
    if (!by) return a;
    const mv = (t) => +(t - by).toFixed(4);
    const keep = (t) => t >= -0.5;
    const out = Object.assign({}, a, {
      beats: a.beats.map(mv).filter(keep),
      downbeats: a.downbeats.map(mv).filter(keep),
      onsets: a.onsets.map((o) => ({ t: mv(o.t), s: o.s })).filter((o) => keep(o.t)),
    });
    if (a.env) {
      // positive = skip a lead-in, negative = the song starts after the video does
      const skip = Math.round(by * a.env.rate);
      const move = (arr) => (skip >= 0 ? arr.slice(skip) : new Array(-skip).fill(0).concat(arr));
      out.env = { rate: a.env.rate, rms: move(a.env.rms), low: move(a.env.low) };
    }
    return out;
  }

  return { analyze, grid, shift };
});
