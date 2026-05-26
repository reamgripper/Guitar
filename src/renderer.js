/* =============================================
   Guitar Chord Generator — Renderer Process
   ============================================= */

'use strict';

// ─── Chord Dictionary ────────────────────────────────────────────────────────
// fingers: array of [stringNum (1=high E, 6=low E), fretNum]
// open:    string numbers that are played open
// mute:    string numbers that are muted (X)
// startFret: lowest fret shown (1 means nut at top)
// barre:   { fret, strings: [lowestStr, highestStr] } (both inclusive, 1-indexed)

const CHORD_DICT = {
  // ── Open / basic chords ──────────────────────────────────────
  'C':     { fingers: [[2,1],[4,2],[5,3]], open: [1,3], mute: [6], startFret: 1 },
  'D':     { fingers: [[1,2],[2,3],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'E':     { fingers: [[3,1],[4,2],[5,2]], open: [1,2,6], mute: [], startFret: 1 },
  'F':     { fingers: [[1,1],[2,1],[3,2],[4,3],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} },
  'G':     { fingers: [[1,3],[5,2],[6,3]], open: [2,3,4], mute: [], startFret: 1 },
  'A':     { fingers: [[2,2],[3,2],[4,2]], open: [1,5], mute: [6], startFret: 1 },
  'B':     { fingers: [[1,2],[2,2],[3,4],[4,4],[5,4],[6,2]], open: [], mute: [], startFret: 1, barre: {fret:2, strings:[1,6]} },
  'Am':    { fingers: [[2,1],[3,2],[4,2]], open: [1,5], mute: [6], startFret: 1 },
  'Em':    { fingers: [[4,2],[5,2]], open: [1,2,3,6], mute: [], startFret: 1 },
  'Dm':    { fingers: [[1,1],[2,3],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'Fm':    { fingers: [[1,1],[2,1],[3,1],[4,3],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} },
  'Gm':    { fingers: [[1,3],[2,3],[3,5],[4,5],[5,5],[6,3]], open: [], mute: [], startFret: 3, barre: {fret:3, strings:[1,6]} },
  'Bm':    { fingers: [[1,2],[2,3],[3,4],[4,4],[5,2],[6,2]], open: [], mute: [], startFret: 2, barre: {fret:2, strings:[1,5]} },
  // ── 7th chords ──────────────────────────────────────────────
  'G7':    { fingers: [[1,1],[5,2],[6,3]], open: [2,3,4], mute: [], startFret: 1 },
  'C7':    { fingers: [[2,1],[3,3],[4,2]], open: [1,5], mute: [6], startFret: 1 },
  'D7':    { fingers: [[1,2],[2,1],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'E7':    { fingers: [[3,1],[4,2],[5,2]], open: [1,2,4,6], mute: [], startFret: 1 },
  'A7':    { fingers: [[2,2],[4,2]], open: [1,3,5], mute: [6], startFret: 1 },
  'B7':    { fingers: [[1,2],[2,1],[3,2],[4,2],[6,2]], open: [5], mute: [], startFret: 1 },
  'F7':    { fingers: [[1,1],[2,1],[3,2],[4,2],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} },
  'Am7':   { fingers: [[2,1],[3,2],[4,2]], open: [1,4,5], mute: [6], startFret: 1 },
  'Em7':   { fingers: [[4,2],[5,2]], open: [1,2,3,5,6], mute: [], startFret: 1 },
  'Dm7':   { fingers: [[1,1],[2,3]], open: [3,4], mute: [5,6], startFret: 1 },
  'Bm7':   { fingers: [[1,2],[2,3],[4,4],[5,2],[6,2]], open: [], mute: [], startFret: 2, barre: {fret:2, strings:[1,5]} },
  'Cm7':   { fingers: [[1,3],[2,4],[3,5],[4,5],[5,3],[6,3]], open: [], mute: [], startFret: 3, barre: {fret:3, strings:[1,6]} },
  'Fm7':   { fingers: [[1,1],[2,1],[3,1],[4,3],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} },
  'Gm7':   { fingers: [[1,3],[2,3],[3,5],[4,5],[5,3],[6,3]], open: [], mute: [], startFret: 3, barre: {fret:3, strings:[1,6]} },
  // ── Major 7th ────────────────────────────────────────────────
  'Fmaj7': { fingers: [[2,1],[3,2],[4,3],[6,1]], open: [1], mute: [5], startFret: 1 },
  'Gmaj7': { fingers: [[5,2],[6,3]], open: [1,2,3,4], mute: [], startFret: 1 },
  'Cmaj7': { fingers: [[2,1],[4,2],[5,3]], open: [1,3], mute: [6], startFret: 1 },
  'Amaj7': { fingers: [[2,2],[3,2],[4,2]], open: [1,5], mute: [6], startFret: 1 },
  'Dmaj7': { fingers: [[1,2],[2,2],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'Emaj7': { fingers: [[3,1],[4,1],[5,2]], open: [1,2,6], mute: [], startFret: 1 },
  'Bmaj7': { fingers: [[1,2],[2,4],[3,4],[4,4],[6,2]], open: [], mute: [5], startFret: 2 },
  // ── Suspended ────────────────────────────────────────────────
  'Dsus2': { fingers: [[1,2],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'Dsus4': { fingers: [[1,3],[2,3],[3,2]], open: [4], mute: [5,6], startFret: 1 },
  'Asus2': { fingers: [[3,2],[4,2]], open: [1,2,5], mute: [6], startFret: 1 },
  'Asus4': { fingers: [[2,2],[3,2],[4,2]], open: [1], mute: [6], startFret: 1 },
  'Esus4': { fingers: [[3,2],[4,2],[5,2]], open: [1,2,6], mute: [], startFret: 1 },
  'Esus2': { fingers: [[3,2],[4,2]], open: [1,2,4,6], mute: [], startFret: 1 },
  'Gsus4': { fingers: [[1,3],[4,1],[5,2],[6,3]], open: [2,3], mute: [], startFret: 1 },
  'Gsus2': { fingers: [[1,3],[5,2],[6,3]], open: [2,4], mute: [3], startFret: 1 },
  // ── Power chords ─────────────────────────────────────────────
  'E5':    { fingers: [[4,2],[5,2]], open: [6], mute: [1,2,3], startFret: 1 },
  'A5':    { fingers: [[3,2],[4,2]], open: [5], mute: [1,2,6], startFret: 1 },
  'D5':    { fingers: [[2,2],[3,2]], open: [4], mute: [1,5,6], startFret: 1 },
  'G5':    { fingers: [[4,2],[5,3]], open: [6], mute: [1,2,3], startFret: 1 },
  // ── dim / aug / add9 ─────────────────────────────────────────
  'Edim':  { fingers: [[3,1],[4,2],[5,2]], open: [1,2], mute: [6], startFret: 1 },
  'Adim':  { fingers: [[2,1],[3,2],[4,2]], open: [], mute: [1,5,6], startFret: 1 },
  'Bdim':  { fingers: [[1,2],[2,3],[3,3],[4,1],[5,2],[6,2]], open: [], mute: [], startFret: 1 },
  'Dadd9': { fingers: [[1,2],[2,3],[3,2]], open: [3,4], mute: [5,6], startFret: 1 },
  'Gadd9': { fingers: [[1,3],[5,2],[6,3]], open: [2,3,4], mute: [], startFret: 1 },
  'Cadd9': { fingers: [[1,3],[2,1],[4,2],[5,3]], open: [3], mute: [6], startFret: 1 },
  // ── 6th chords ───────────────────────────────────────────────
  'A6':    { fingers: [[2,2],[3,2],[4,2]], open: [1,3,5], mute: [6], startFret: 1 },
  'E6':    { fingers: [[2,2],[3,1],[4,2],[5,2]], open: [1,6], mute: [], startFret: 1 },
  'Am6':   { fingers: [[2,1],[3,2],[4,2]], open: [1,3,5], mute: [6], startFret: 1 },
  // ── 9th chords ───────────────────────────────────────────────
  'G9':    { fingers: [[1,1],[4,2],[5,2],[6,3]], open: [2,3], mute: [], startFret: 1 },
  'C9':    { fingers: [[2,1],[3,3],[4,2],[6,3]], open: [1,5], mute: [], startFret: 1 },
  'D9':    { fingers: [[1,2],[2,1],[3,2],[4,2]], open: [4], mute: [5,6], startFret: 1 },
  // ── Slash / bass-note chords ─────────────────────────────────
  'G/B':   { fingers: [[1,3],[5,2],[6,2]], open: [2,3,4], mute: [], startFret: 1 },
  'D/F#':  { fingers: [[1,2],[2,3],[3,2],[6,2]], open: [4], mute: [5], startFret: 1 },
  'C/G':   { fingers: [[2,1],[4,2],[5,3],[6,3]], open: [1,3], mute: [], startFret: 1 },
  'Am/E':  { fingers: [[2,1],[3,2],[4,2]], open: [1,5,6], mute: [], startFret: 1 },
  'E/G#':  { fingers: [[3,1],[4,2],[5,2],[6,4]], open: [1,2], mute: [], startFret: 1 },
  'F/C':   { fingers: [[1,1],[2,1],[3,2],[4,3],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} },
};

// Aliases / enharmonic equivalents
CHORD_DICT['Db']    = CHORD_DICT['C#']   = { fingers: [[2,2],[3,1],[4,1],[5,4],[6,4]], open: [], mute: [1], startFret: 1 };
CHORD_DICT['Eb']    = CHORD_DICT['D#']   = { fingers: [[1,3],[2,4],[3,5],[4,5],[5,3],[6,3]], open: [], mute: [], startFret: 3, barre: {fret:3, strings:[1,6]} };
CHORD_DICT['F#']    = CHORD_DICT['Gb']   = { fingers: [[1,2],[2,2],[3,4],[4,4],[5,4],[6,2]], open: [], mute: [], startFret: 2, barre: {fret:2, strings:[1,6]} };
CHORD_DICT['G#']    = CHORD_DICT['Ab']   = { fingers: [[1,4],[2,4],[3,6],[4,6],[5,6],[6,4]], open: [], mute: [], startFret: 4, barre: {fret:4, strings:[1,6]} };
CHORD_DICT['A#']    = CHORD_DICT['Bb']   = { fingers: [[1,1],[2,3],[3,3],[4,3],[5,1],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} };
CHORD_DICT['C#m']   = CHORD_DICT['Dbm']  = { fingers: [[1,4],[2,5],[3,6],[4,6],[5,4],[6,4]], open: [], mute: [], startFret: 4, barre: {fret:4, strings:[1,6]} };
CHORD_DICT['D#m']   = CHORD_DICT['Ebm']  = { fingers: [[1,6],[2,7],[3,8],[4,8],[5,6],[6,6]], open: [], mute: [], startFret: 6, barre: {fret:6, strings:[1,6]} };
CHORD_DICT['F#m']   = CHORD_DICT['Gbm']  = { fingers: [[1,2],[2,2],[3,4],[4,4],[5,2],[6,2]], open: [], mute: [], startFret: 2, barre: {fret:2, strings:[1,5]} };
CHORD_DICT['G#m']   = CHORD_DICT['Abm']  = { fingers: [[1,4],[2,4],[3,6],[4,6],[5,4],[6,4]], open: [], mute: [], startFret: 4, barre: {fret:4, strings:[1,5]} };
CHORD_DICT['A#m']   = CHORD_DICT['Bbm']  = { fingers: [[1,1],[2,2],[3,3],[4,3],[5,1],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,5]} };
CHORD_DICT['C#7']   = CHORD_DICT['Db7']  = { fingers: [[1,4],[2,4],[3,4],[4,4],[5,3],[6,4]], open: [], mute: [], startFret: 4, barre: {fret:4, strings:[1,6]} };
CHORD_DICT['Eb7']   = CHORD_DICT['D#7']  = { fingers: [[1,3],[2,3],[3,3],[4,3],[5,4],[6,3]], open: [], mute: [], startFret: 3, barre: {fret:3, strings:[1,6]} };
CHORD_DICT['F#7']   = CHORD_DICT['Gb7']  = { fingers: [[1,2],[2,2],[3,2],[4,2],[5,4],[6,2]], open: [], mute: [], startFret: 2, barre: {fret:2, strings:[1,6]} };
CHORD_DICT['Ab7']   = CHORD_DICT['G#7']  = { fingers: [[1,4],[2,4],[3,4],[4,4],[5,6],[6,4]], open: [], mute: [], startFret: 4, barre: {fret:4, strings:[1,6]} };
CHORD_DICT['Bb7']   = CHORD_DICT['A#7']  = { fingers: [[1,1],[2,1],[3,1],[4,1],[5,3],[6,1]], open: [], mute: [], startFret: 1, barre: {fret:1, strings:[1,6]} };

// ─── Chromatic helpers ────────────────────────────────────────────────────────

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_TO_SHARP = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };

function normalizeNote(note) {
  if (FLAT_TO_SHARP[note]) return FLAT_TO_SHARP[note];
  return note;
}

function transposeNote(note, semitones) {
  const normalized = normalizeNote(note);
  const idx = CHROMATIC.indexOf(normalized);
  if (idx === -1) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return CHROMATIC[newIdx];
}

/**
 * Transpose a full chord symbol (root + quality + optional bass).
 * Handles: Cm, Cmaj7, C7, Csus4, Csus2, Cdim, Caug, Cadd9,
 *          C/E (slash chords), C#, Bb, etc.
 */
function transposeChord(chordName, semitones) {
  if (!chordName || semitones === 0) return chordName;

  // Match: root (1-2 chars) + quality suffix + optional /bass
  const match = chordName.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
  if (!match) return chordName;

  const [, root, quality, bass] = match;
  const newRoot = transposeNote(root, semitones);
  const newBass = bass ? transposeNote(bass, semitones) : null;

  return newRoot + quality + (newBass ? '/' + newBass : '');
}

// ─── SVG Chord Diagram Generator ─────────────────────────────────────────────

const SVG_W = 110;
const SVG_H = 140;
const FRET_COUNT = 5;
const STRING_COUNT = 6;
const NUT_X = 18;          // left edge of string area
const STRING_AREA_W = 74;  // total width for 5 gaps (6 strings)
const TOP_Y = 28;          // top of nut / fret 0
const FRET_H = 18;         // height of one fret cell
const STRING_SPACING = STRING_AREA_W / (STRING_COUNT - 1);

function stringX(stringNum) {
  // stringNum 1=high e, 6=low E  (left-to-right: 6..1)
  return NUT_X + (STRING_COUNT - stringNum) * STRING_SPACING;
}

function fretY(fret) {
  // fret 0 = nut line, fret 1 = first fret line
  return TOP_Y + fret * FRET_H;
}

function fingerY(fretNum, startFret) {
  // dot goes in the middle of the fret cell
  const relativeFret = fretNum - startFret + 1;
  return TOP_Y + (relativeFret - 0.5) * FRET_H;
}

function createChordSVG(chordName) {
  const def = CHORD_DICT[chordName];

  if (!def) {
    return createUnknownChordSVG(chordName);
  }

  const { fingers, open = [], mute = [], startFret = 1, barre } = def;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}">`;

  // Background
  svg += `<rect width="${SVG_W}" height="${SVG_H}" fill="transparent"/>`;

  // ── Fret-position indicator (if not starting at fret 1) ──────────────────
  if (startFret > 1) {
    svg += `<text x="${NUT_X + STRING_AREA_W + 6}" y="${TOP_Y + FRET_H * 0.7}" font-size="9" font-family="system-ui,-apple-system,sans-serif" fill="#94a3b8" dominant-baseline="middle">${startFret}fr</text>`;
  }

  // ── Nut or top fret line ──────────────────────────────────────────────────
  if (startFret === 1) {
    // Thick nut
    svg += `<rect x="${NUT_X - 1}" y="${TOP_Y - 4}" width="${STRING_AREA_W + 2}" height="4" rx="1" fill="#f1f5f9"/>`;
  } else {
    // Thin line
    svg += `<line x1="${NUT_X}" y1="${TOP_Y}" x2="${NUT_X + STRING_AREA_W}" y2="${TOP_Y}" stroke="#475569" stroke-width="1.5"/>`;
  }

  // ── Fret lines ────────────────────────────────────────────────────────────
  for (let f = 1; f <= FRET_COUNT; f++) {
    const y = fretY(f);
    svg += `<line x1="${NUT_X}" y1="${y}" x2="${NUT_X + STRING_AREA_W}" y2="${y}" stroke="#334155" stroke-width="1"/>`;
  }

  // ── String lines ─────────────────────────────────────────────────────────
  for (let s = 1; s <= STRING_COUNT; s++) {
    const x = stringX(s);
    svg += `<line x1="${x}" y1="${TOP_Y}" x2="${x}" y2="${fretY(FRET_COUNT)}" stroke="#64748b" stroke-width="1"/>`;
  }

  // ── Barre ─────────────────────────────────────────────────────────────────
  if (barre) {
    const barreX1 = stringX(barre.strings[1]);  // high string (lower num)
    const barreX2 = stringX(barre.strings[0]);  // low string (higher num)
    const barreY = fingerY(barre.fret, startFret);
    svg += `<rect x="${Math.min(barreX1, barreX2) - 5}" y="${barreY - 6}" width="${Math.abs(barreX2 - barreX1) + 10}" height="12" rx="6" fill="#7c3aed"/>`;
  }

  // ── Finger dots ───────────────────────────────────────────────────────────
  for (const [strNum, fretNum] of fingers) {
    if (barre && fretNum === barre.fret) continue; // drawn as barre
    const cx = stringX(strNum);
    const cy = fingerY(fretNum, startFret);
    svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="#7c3aed"/>`;
  }

  // ── Open / Mute indicators above nut ─────────────────────────────────────
  const indicatorY = TOP_Y - 10;

  for (const strNum of open) {
    const cx = stringX(strNum);
    svg += `<circle cx="${cx}" cy="${indicatorY}" r="4" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`;
  }

  for (const strNum of mute) {
    const cx = stringX(strNum);
    // X mark
    svg += `<line x1="${cx - 4}" y1="${indicatorY - 4}" x2="${cx + 4}" y2="${indicatorY + 4}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`;
    svg += `<line x1="${cx + 4}" y1="${indicatorY - 4}" x2="${cx - 4}" y2="${indicatorY + 4}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  svg += `</svg>`;
  return svg;
}

function createUnknownChordSVG(chordName) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}">`;
  svg += `<rect width="${SVG_W}" height="${SVG_H}" fill="transparent"/>`;

  // Thick nut
  svg += `<rect x="${NUT_X - 1}" y="${TOP_Y - 4}" width="${STRING_AREA_W + 2}" height="4" rx="1" fill="#f1f5f9"/>`;

  // Fret lines
  for (let f = 1; f <= FRET_COUNT; f++) {
    svg += `<line x1="${NUT_X}" y1="${fretY(f)}" x2="${NUT_X + STRING_AREA_W}" y2="${fretY(f)}" stroke="#334155" stroke-width="1"/>`;
  }

  // String lines
  for (let s = 1; s <= STRING_COUNT; s++) {
    svg += `<line x1="${stringX(s)}" y1="${TOP_Y}" x2="${stringX(s)}" y2="${fretY(FRET_COUNT)}" stroke="#64748b" stroke-width="1"/>`;
  }

  // Center question mark
  const cx = NUT_X + STRING_AREA_W / 2;
  const cy = TOP_Y + (FRET_COUNT * FRET_H) / 2;
  svg += `<text x="${cx}" y="${cy}" font-size="22" font-family="system-ui,-apple-system,sans-serif" fill="#64748b" text-anchor="middle" dominant-baseline="middle" font-weight="700">?</text>`;

  svg += `</svg>`;
  return svg;
}

// ─── Application State ────────────────────────────────────────────────────────

let currentChordData = null;
let transposeOffset = 0;

// ─── DOM References ───────────────────────────────────────────────────────────

const apiPanel        = document.getElementById('apiPanel');
const apiKeyInput     = document.getElementById('apiKeyInput');
const saveKeyBtn      = document.getElementById('saveKeyBtn');
const apiStatus       = document.getElementById('apiStatus');
const settingsBtn     = document.getElementById('settingsBtn');
const songInput       = document.getElementById('songInput');
const artistInput     = document.getElementById('artistInput');
const generateBtn     = document.getElementById('generateBtn');
const loadingContainer = document.getElementById('loadingContainer');
const errorContainer  = document.getElementById('errorContainer');
const errorMessage    = document.getElementById('errorMessage');
const retryBtn        = document.getElementById('retryBtn');
const resultsContainer = document.getElementById('resultsContainer');
const sectionsContainer = document.getElementById('sectionsContainer');
const songKey         = document.getElementById('songKey');
const songTempo       = document.getElementById('songTempo');
const songCapo        = document.getElementById('songCapo');
const transposeDown   = document.getElementById('transposeDown');
const transposeUp     = document.getElementById('transposeUp');
const transposeReset  = document.getElementById('transposeReset');
const transposeValue  = document.getElementById('transposeValue');

// ─── UI State Helpers ─────────────────────────────────────────────────────────

function showPanel(panel) {
  [loadingContainer, errorContainer, resultsContainer].forEach(el => {
    if (el !== panel) el.style.display = 'none';
  });
  if (panel) panel.style.display = 'flex';
}

function showResults() {
  loadingContainer.style.display = 'none';
  errorContainer.style.display = 'none';
  resultsContainer.style.display = 'block';
}

function showError(msg) {
  loadingContainer.style.display = 'none';
  resultsContainer.style.display = 'none';
  errorMessage.textContent = msg;
  errorContainer.style.display = 'flex';
}

function showLoading() {
  errorContainer.style.display = 'none';
  resultsContainer.style.display = 'none';
  loadingContainer.style.display = 'flex';
}

function hideAllStates() {
  loadingContainer.style.display = 'none';
  errorContainer.style.display = 'none';
  resultsContainer.style.display = 'none';
}

// ─── API Key Management ───────────────────────────────────────────────────────

async function initApiKey() {
  try {
    const result = await window.electronAPI.getApiKey();
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      collapseApiPanel();
    } else {
      expandApiPanel();
    }
  } catch (e) {
    expandApiPanel();
  }
}

function collapseApiPanel() {
  apiPanel.classList.add('collapsed');
}

function expandApiPanel() {
  apiPanel.classList.remove('collapsed');
  setTimeout(() => apiKeyInput.focus(), 100);
}

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setApiStatus('Please enter an API key.', 'error');
    return;
  }
  try {
    await window.electronAPI.saveApiKey(key);
    setApiStatus('API key saved!', 'success');
    setTimeout(collapseApiPanel, 1200);
  } catch (e) {
    setApiStatus('Failed to save key.', 'error');
  }
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveKeyBtn.click();
});

function setApiStatus(msg, type) {
  apiStatus.textContent = msg;
  apiStatus.className = 'api-status ' + type;
  if (type === 'success') {
    setTimeout(() => { apiStatus.textContent = ''; apiStatus.className = 'api-status'; }, 3000);
  }
}

settingsBtn.addEventListener('click', () => {
  if (apiPanel.classList.contains('collapsed')) {
    expandApiPanel();
  } else {
    collapseApiPanel();
  }
});

// ─── Chord Generation ─────────────────────────────────────────────────────────

generateBtn.addEventListener('click', generateChords);

songInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') generateChords(); });
artistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') generateChords(); });

retryBtn.addEventListener('click', () => {
  hideAllStates();
  songInput.focus();
});

async function generateChords() {
  const song = songInput.value.trim();
  const artist = artistInput.value.trim();

  if (!song || !artist) {
    songInput.classList.toggle('shake', true);
    artistInput.classList.toggle('shake', true);
    setTimeout(() => {
      songInput.classList.remove('shake');
      artistInput.classList.remove('shake');
    }, 500);
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    expandApiPanel();
    setApiStatus('Please enter your Anthropic API key first.', 'error');
    return;
  }

  generateBtn.disabled = true;
  showLoading();
  transposeOffset = 0;
  transposeValue.textContent = '0';
  currentChordData = null;

  try {
    const result = await window.electronAPI.generateChords({ song, artist, apiKey });

    if (result.error) {
      showError(result.error);
      return;
    }

    if (!result.data || !result.data.sections) {
      showError('Could not find chords for this song. Try checking the song name and artist.');
      return;
    }

    currentChordData = result.data;
    renderResults(currentChordData);
    showResults();
  } catch (e) {
    showError('An unexpected error occurred. Please try again.');
  } finally {
    generateBtn.disabled = false;
  }
}

// ─── Results Rendering ────────────────────────────────────────────────────────

function renderResults(data) {
  // Song info bar
  const key = data.key || '—';
  const transposedKey = transposeOffset !== 0 ? transposeChord(key, transposeOffset) : key;
  songKey.textContent = transposedKey + (transposeOffset !== 0 ? ` (${transposeOffset > 0 ? '+' : ''}${transposeOffset})` : '');
  songTempo.textContent = data.tempo || '—';
  songCapo.textContent = data.capo > 0 ? `Fret ${data.capo}` : 'None';

  // Sections
  sectionsContainer.innerHTML = '';

  data.sections.forEach((section, idx) => {
    const block = document.createElement('div');
    block.className = 'section-block';
    block.style.animationDelay = `${idx * 0.08}s`;

    // Transpose chords
    const transposedChords = (section.chords || []).map(c => transposeChord(c, transposeOffset));
    const transposedPattern = transposePattern(section.pattern || '', transposeOffset);

    // Section header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-name">${escapeHTML(section.name)}</span>
      <span class="section-pattern">${escapeHTML(transposedPattern)}</span>
    `;

    // Chord cards row
    const chordsRow = document.createElement('div');
    chordsRow.className = 'section-chords';

    transposedChords.forEach(chord => {
      if (!chord) return;
      const card = document.createElement('div');
      card.className = 'chord-card';

      const nameEl = document.createElement('div');
      nameEl.className = 'chord-name-label';
      nameEl.textContent = chord;

      const diagramEl = document.createElement('div');
      diagramEl.className = 'chord-svg-container';
      diagramEl.innerHTML = createChordSVG(chord);

      card.appendChild(nameEl);
      card.appendChild(diagramEl);
      chordsRow.appendChild(card);
    });

    block.appendChild(header);
    block.appendChild(chordsRow);
    sectionsContainer.appendChild(block);
  });
}

function transposePattern(pattern, semitones) {
  if (!pattern || semitones === 0) return pattern;
  // Replace chord tokens in pattern string
  // Match chord names (root + optional quality + optional /bass)
  return pattern.replace(/[A-G][#b]?(?:maj7|maj6|maj9|min7|min|m7|m6|m9|sus[24]|dim7|dim|aug|add9|add11|add13|[679]|7sus[24]|11|13|m)?(?:\/[A-G][#b]?)?/g, (match) => {
    return transposeChord(match, semitones);
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Transpose Controls ───────────────────────────────────────────────────────

transposeDown.addEventListener('click', () => {
  if (transposeOffset > -6) {
    transposeOffset--;
    updateTranspose();
  }
});

transposeUp.addEventListener('click', () => {
  if (transposeOffset < 6) {
    transposeOffset++;
    updateTranspose();
  }
});

transposeReset.addEventListener('click', () => {
  transposeOffset = 0;
  updateTranspose();
});

function updateTranspose() {
  transposeValue.textContent = transposeOffset > 0 ? `+${transposeOffset}` : String(transposeOffset);
  if (currentChordData) {
    renderResults(currentChordData);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  await initApiKey();
  songInput.focus();
})();
