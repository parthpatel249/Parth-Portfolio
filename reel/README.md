# King of the Chase: cricket kinetic-typography reel

A 60-second **1080×1920** Instagram Reel built for the song *"West Indies ne banaye, 295 ka score…"*.
Everything is drawn in code on an HTML canvas: vector cricket ball, crown, bat, flag, emoji
reactions, LED scoreboard, stadium lights and crowd. There are no player faces, photos or match footage.

## Quick start

| I want to… | Do this |
| --- | --- |
| Preview with my song | Open `index.html` (or `/reel/` on the deployed site), drag the song onto the video, press **Play**. |
| Export in the browser | Load the song, then **Export video (real-time)**. Chrome records a 60 s MP4/WebM. Keep the tab visible. |
| Render the final MP4 (frame-accurate, best quality) | `cd reel && npm install && node render.mjs --audio path/to/song.mp3` → `out/king-of-the-chase-reel.mp4` |

`render.mjs` needs Node 18+ and ffmpeg. It finds ffmpeg on your `PATH`, through `FFMPEG_PATH`, or via the
`ffmpeg-static` package that `npm install` adds. It launches headless Chromium via Playwright
(run `npx playwright install chromium` once if Playwright asks for a browser).

Useful flags: `--offset 0.35` (skip a lead-in in the audio file), `--from 18 --to 25` (render a slice),
`--stills 3.5,19.8,56.8` (PNG-quality JPEG stills), `--workers 4`, `--crf 18`.

Output: H.264 High, yuv420p, 30 fps, AAC 48 kHz stereo, `+faststart`, the format Instagram expects.

## How the sync works

1. **Lyric timestamps** from the song sheet live in [`src/config.js`](src/config.js). Each line owns a scene.
2. Inside a line, **words are spread by syllable count**. Numbers use spoken syllables, so "295" counts
   as 4 ("two ninety-five").
3. When audio is loaded, [`src/audio-analysis.js`](src/audio-analysis.js) runs spectral-flux onset detection,
   tempo estimation and a dynamic-programming beat tracker. The kick band is weighted up so the grid
   locks to the kick drum.
   * every **scene cut snaps** to the nearest beat (±0.22 s),
   * every **word snaps** to the nearest vocal/drum onset (±0.12 s),
   * camera breathing, glows, equalizer bars and the crowd follow the kick and loudness envelopes.
4. Without audio, a 100 BPM guide grid drives the pulses so the preview still moves on a beat.

To hand-tune a line, add exact word times: `{ id: 'daal', …, times: [29.1, 29.4, 29.7, 30.6, 31.0, 31.3, 31.7] }`.

## Scene map

| Time | Lyric | Visual |
| --- | --- | --- |
| 0:00 | *(intro)* | Floodlights power on, a ball flies into the lens and cracks the glass, **KING OF THE CHASE** |
| 0:03 | West Indies ne banaye, 295 ka score | LED scoreboard drops in, odometer rolls **0 → 295**, "KA SCORE!" stamp, target chip |
| 0:09 | India boli — Bhai, tension nahi… we want more! | Chat-message meme, "deal with it" shades drop, giant **MORE!** with beat echoes |
| 0:14 | Gill ne century maari, batting full tight | #77 jersey, **100** ring burst, celebration balls, "FULL TIGHT" squeezes shut |
| 0:19 | Phir King Kohli aaya — game ki badli sight! | Spotlight, crown drops with a shockwave, gold **KING**, 3D flip into "BADLI SIGHT!" (RGB split) |
| 0:24 | Bowler ne socha — Kohli ko rok lenge aaj | Thinking-face bowler, thought-cloud tactics board, "ROK LO" caution tape |
| 0:29 | Kohli ne bola — Pehle ball toh daal! 😂 | Crowned reply, comic starburst punchline, laughing-emoji rain |
| 0:33 | 139 not out, bat kare shine | Rolling **139\***, NOT OUT badge, bat swing with light sweep and sparkles |
| 0:38 | 15,000 ODI runs — King crossed the line! | **15,000** odometer with carries, milestone bar, crown breaks the finish tape, confetti |
| 0:42 | Nine sixes, boundaries ki baarish | Nine-ball tally (each launches a six), rain of balls and 4s/6s, dripping **BAARISH!** |
| 0:46 | West Indies ke bowlers ki — badhti gayi khwaish! | Sweating bowler and a wishlist that keeps growing |
| 0:50 | Gill aur Kohli — partnership zabardast | Split-screen 77 / 18, crossed bats clash, **ZABARDAST!** |
| 0:54 | INDIA! INDIA! | Full-bleed waving tricolour, double slam |
| 0:55 | *(finale)* | Dark stadium, crown descends, **KING** letter reveal, stat chips 139\* · 15,000 · 296 ✓, fireworks |

A broadcast score bug (LIVE · IND runs/overs · NEED) ticks on the beat through the chase, and a
karaoke lyric strip highlights each word as it's sung. All text stays inside Instagram's safe zones
(top ≈ 200 px and bottom ≈ 450 px are kept clear of critical content).

## Files

```
reel/
  index.html              player: preview, drag-and-drop audio, real-time export
  render.mjs              headless frame-accurate renderer → MP4
  src/config.js           timeline (edit me)
  src/audio-analysis.js   beat / onset / envelope analysis (browser + Node)
  src/engine.js           word timing, beat helpers, frame composition
  src/world.js            stadium, HUD, lyric strip, transitions, grain/vignette
  src/scenes.js           per-lyric choreography
  src/kit.js              typography + vector icons
  src/fonts.js            embedded fonts (tools/build-fonts.mjs)
```

Fonts: Anton, Barlow Condensed and Bangers, all under the SIL Open Font License 1.1 via Google Fonts.
