#!/usr/bin/env node
// Frame-accurate renderer: headless Chromium draws every frame, ffmpeg encodes
// an Instagram-ready H.264/AAC MP4 (1080x1920, 30 fps, yuv420p, faststart).
//
//   node render.mjs --audio audio/song.mp3            # full reel with sound
//   node render.mjs                                   # silent preview
//   node render.mjs --from 18 --to 25 --out out/king.mp4
//   node render.mjs --stills 3.5,19.8,56.8            # PNG stills into out/
//
// Options: --audio --offset --out --fps --workers --from --to --crf --quality --stills
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const DURATION = 60;
const fps = +(args.fps || 30);
const from = +(args.from || 0);
const to = Math.min(DURATION, +(args.to || DURATION));
const offset = +(args.offset || 0);
const out = path.resolve(args.out || path.join(ROOT, 'out', args.audio ? 'king-of-the-chase-reel.mp4' : 'king-of-the-chase-preview.mp4'));
const workers = Math.max(1, +(args.workers || Math.max(1, Math.min(4, os.cpus().length - 1))));
const crf = +(args.crf || 18);
const quality = +(args.quality || 0.93);

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  try { return require('ffmpeg-static'); } catch { /* optional */ }
  throw new Error('ffmpeg not found: install it, set FFMPEG_PATH, or `npm i ffmpeg-static`.');
}
const FFMPEG = findFfmpeg();

function run(argv, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, argv, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    const chunks = [], errs = [];
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => errs.push(d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(Buffer.concat(errs).toString().slice(-2000)))));
    if (input) input(p.stdin);
  });
}

async function analyseAudio(file) {
  const ReelAudio = require('./src/audio-analysis.js');
  const pcm = await run(['-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-']);
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
  const a = ReelAudio.analyze(samples, 22050);
  console.log(`audio: ${a.duration.toFixed(1)} s, ${a.bpm} BPM, ${a.beats.length} beats, ${a.onsets.length} onsets`);
  return ReelAudio.shift(a, offset);
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const server = createServer(async (req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !existsSync(p) || p.includes(`${path.sep}audio${path.sep}`)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

async function openPage(browser, port, analysis) {
  const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.evaluate(async (a) => { await window.REEL.ready; if (a) window.REEL.setAnalysis(a); }, analysis);
  return page;
}

async function main() {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { ({ chromium } = require(path.join(execRoot(), 'playwright'))); }
  const analysis = args.audio ? await analyseAudio(path.resolve(args.audio)) : null;
  const server = await serve();
  const port = server.address().port;
  const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu', '--force-color-profile=srgb'] });
  await mkdir(path.dirname(out), { recursive: true });

  if (args.stills) {
    const page = await openPage(browser, port, analysis);
    for (const t of String(args.stills).split(',').map(Number)) {
      const url = await page.evaluate((tt) => window.REEL.frameJPEG(tt, 0.95), t);
      const f = path.join(path.dirname(out), `still-${t.toFixed(2)}.jpg`);
      await writeFile(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', f);
    }
    await browser.close(); server.close();
    return;
  }

  const first = Math.round(from * fps), last = Math.round(to * fps);
  const total = last - first;
  const per = Math.ceil(total / workers);
  const tmp = path.join(os.tmpdir(), `reel-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  let done = 0;
  const started = Date.now();
  const progress = setInterval(() => {
    const el = (Date.now() - started) / 1000;
    process.stdout.write(`\rframes ${done}/${total}  ${(done / el).toFixed(1)} fps  eta ${Math.max(0, (total - done) / Math.max(1e-3, done / el)).toFixed(0)} s   `);
  }, 1000);

  const parts = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = first + w * per, b = Math.min(last, a + per);
    if (a >= b) return;
    const file = path.join(tmp, `part-${String(w).padStart(2, '0')}.mp4`);
    parts[w] = file;
    const page = await openPage(browser, port, analysis);
    await run(['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-maxrate', '12M', '-bufsize', '24M', '-g', String(fps * 2), '-r', String(fps), file], async (stdin) => {
      for (let f = a; f < b; f++) {
        const url = await page.evaluate(([t, q]) => window.REEL.frameJPEG(t, q), [f / fps, quality]);
        const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
        done++;
      }
      stdin.end();
    });
    await page.close();
  }));
  clearInterval(progress);
  process.stdout.write(`\rframes ${total}/${total} in ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
  await browser.close();
  server.close();

  const list = path.join(tmp, 'parts.txt');
  await writeFile(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
  const len = (to - from).toFixed(3);
  const audioIn = args.audio
    ? ['-ss', String(Math.max(0, from + offset)), '-i', path.resolve(args.audio)]
    : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
  const delay = args.audio && from + offset < 0 ? ['-af', `adelay=${Math.round(-(from + offset) * 1000)}:all=1`] : [];
  await run(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...audioIn,
    '-map', '0:v:0', '-map', '1:a:0', ...delay, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-t', len, '-movflags', '+faststart', out]);
  await rm(tmp, { recursive: true, force: true });
  console.log('wrote', out);
}

function execRoot() {
  // global npm modules (e.g. a globally installed playwright)
  return spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim();
}

main().catch((e) => { console.error(e); process.exit(1); });
