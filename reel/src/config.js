// ─────────────────────────────────────────────────────────────────────────────
//  REEL TIMELINE — edit this file to re-time the video.
//
//  • start/end are the lyric timestamps (seconds) from the song sheet.
//  • Words inside a line are spread by syllable count; when audio is loaded
//    each word snaps to the nearest detected vocal/drum onset (±snapWindow).
//  • To pin exact word times, add  times: [3.10, 3.42, ...]  (one per word).
//  • audioOffset: seconds to skip at the start of the audio file (lead-in).
// ─────────────────────────────────────────────────────────────────────────────
window.REEL_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 60,
  audioOffset: 0,
  fallbackBpm: 100, // beat grid used only when no audio is loaded
  snapWindow: 0.12, // word → onset snapping (s)
  cutSnapWindow: 0.22, // scene cut → nearest beat snapping (s), audio only
  showLyricStrip: true,

  // Pronunciation-based syllable counts for tokens the heuristic can't guess.
  syllables: {
    '295': 4, '139': 4, '15,000': 4, ODI: 3, INDIA: 3,
    score: 1, more: 1, shine: 1, line: 1, game: 1, Nine: 1, crossed: 1,
    banaye: 3, gayi: 2, khwaish: 2, aaya: 2,
  },

  lines: [
    { id: 'intro', start: 0, end: 3, text: '', theme: 'intro', cut: 'slash' },
    { id: 'wi295', start: 3, end: 9, text: 'West Indies ne banaye, 295 ka score', theme: 'wi', cut: 'ball' },
    { id: 'wantmore', start: 9, end: 14, text: 'India boli — Bhai, tension nahi… we want more!', theme: 'ind', cut: 'flash' },
    { id: 'gill', start: 14, end: 19, text: 'Gill ne century maari, batting full tight', theme: 'sky', cut: 'iris' },
    { id: 'king', start: 19, end: 24, text: 'Phir King Kohli aaya — game ki badli sight!', theme: 'king', cut: 'glitch' },
    { id: 'bowler', start: 24, end: 29, text: 'Bowler ne socha — Kohli ko rok lenge aaj', theme: 'wi', cut: 'slash' },
    { id: 'daal', start: 29, end: 33, text: 'Kohli ne bola — Pehle ball toh daal!', theme: 'ind', cut: 'flash' },
    { id: 'notout', start: 33, end: 38, text: '139 not out, bat kare shine', theme: 'king', cut: 'ball' },
    { id: 'fifteen', start: 38, end: 42, text: '15,000 ODI runs — King crossed the line!', theme: 'gold', cut: 'slash' },
    { id: 'sixes', start: 42, end: 46, text: 'Nine sixes, boundaries ki baarish', theme: 'sky', cut: 'glitch' },
    { id: 'khwaish', start: 46, end: 50, text: 'West Indies ke bowlers ki — badhti gayi khwaish!', theme: 'wi', cut: 'ball' },
    { id: 'partner', start: 50, end: 54, text: 'Gill aur Kohli — partnership zabardast', theme: 'ind', cut: 'flash' },
    { id: 'india', start: 54, end: 55, text: 'INDIA! INDIA!', theme: 'flag', cut: 'blackout' },
    { id: 'finale', start: 55, end: 60, text: '', theme: 'king' },
  ],

  // Broadcast score bug: India's chase, keyed by time (runs tick on the beat).
  chase: {
    target: 296,
    keys: [
      [9.0, 0, 0, 0.0],
      [19.0, 118, 1, 21.4],
      [33.0, 203, 1, 35.2],
      [46.0, 259, 1, 42.3],
      [54.3, 296, 1, 47.2],
    ],
  },
};
