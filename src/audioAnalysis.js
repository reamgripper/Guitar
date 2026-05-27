'use strict';

// ─── Radix-2 FFT ────────────────────────────────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len >> 1; j++) {
        const h = len >> 1;
        const uRe = re[i+j], uIm = im[i+j];
        const vRe = re[i+j+h]*curRe - im[i+j+h]*curIm;
        const vIm = re[i+j+h]*curIm + im[i+j+h]*curRe;
        re[i+j] = uRe+vRe; im[i+j] = uIm+vIm;
        re[i+j+h] = uRe-vRe; im[i+j+h] = uIm-vIm;
        const nr = curRe*wRe - curIm*wIm;
        curIm = curRe*wIm + curIm*wRe; curRe = nr;
      }
    }
  }
}

function hann(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5*(1 - Math.cos(2*Math.PI*i/(n-1)));
  return w;
}

// ─── Chord templates (all 12 roots × 9 qualities) ──────────────────────────────
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const TEMPLATES = (() => {
  const t = {};
  const intervals = {
    '':     [0,4,7],          // Major
    'm':    [0,3,7],          // Minor
    '7':    [0,4,7,10],       // Dom 7
    'm7':   [0,3,7,10],       // Min 7
    'maj7': [0,4,7,11],       // Maj 7
    'sus4': [0,5,7],          // Sus4
    'sus2': [0,2,7],          // Sus2
    'dim':  [0,3,6],          // Dim
    'aug':  [0,4,8],          // Aug
  };
  for (let r = 0; r < 12; r++) {
    for (const [suffix, ivs] of Object.entries(intervals)) {
      const v = new Float32Array(12);
      ivs.forEach((iv, idx) => { v[(r+iv)%12] = idx === 0 ? 1 : 0.8; });
      t[NOTES[r]+suffix] = v;
    }
  }
  return t;
})();

function cosineSim(a, b) {
  let dot=0, na=0, nb=0;
  for (let i=0;i<12;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
  return dot/(Math.sqrt(na*nb)+1e-9);
}

function matchChord(chromaVec) {
  let best=null, top=0.32; // minimum confidence threshold
  for (const [name,tmpl] of Object.entries(TEMPLATES)){
    const s=cosineSim(chromaVec,tmpl);
    if(s>top){top=s;best=name;}
  }
  return best;
}

function computeChroma(mags, sampleRate, fftSize) {
  const c = new Float32Array(12);
  for (let b=1; b<fftSize/2; b++) {
    const f = b*sampleRate/fftSize;
    if (f<55||f>8000) continue;
    const midi = 12*Math.log2(f/440)+69;
    const pc = ((Math.round(midi)%12)+12)%12;
    c[pc] += mags[b]*mags[b];
  }
  let norm=0; for(let i=0;i<12;i++) norm+=c[i]*c[i];
  norm=Math.sqrt(norm)||1;
  return c.map(v=>v/norm);
}

// ─── Beat detection via onset strength ────────────────────────────────────────
function detectBeats(mono, sampleRate) {
  const HOP = 512;
  const energies = [];
  for (let i=0; i+HOP<=mono.length; i+=HOP) {
    let e=0; for(let j=0;j<HOP;j++) e+=mono[i+j]**2;
    energies.push(e/HOP);
  }
  const onset = energies.map((e,i) => i>0 ? Math.max(0,e-energies[i-1]) : 0);

  // 70th percentile as adaptive threshold
  const sorted = [...onset].sort((a,b)=>a-b);
  const threshold = sorted[Math.floor(sorted.length*0.7)] * 1.5 || 0.001;

  const minDist = Math.round(0.2*sampleRate/HOP);
  const beats = [];
  for (let i=1; i<onset.length-1; i++) {
    if (onset[i]>=onset[i-1] && onset[i]>onset[i+1] && onset[i]>threshold) {
      if (!beats.length || i-Math.round(beats[beats.length-1]*sampleRate/HOP)>=minDist) {
        beats.push(i*HOP/sampleRate);
      }
    }
  }
  return beats;
}

// ─── LRC parser ────────────────────────────────────────────────────────────────
function parseLRC(lrcText) {
  const lines = [];
  const re = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)/g;
  let m;
  while ((m=re.exec(lrcText))!==null) {
    const time = parseInt(m[1])*60 + parseFloat(m[2]);
    const text = m[3].trim();
    if (text) lines.push({time,text});
  }
  return lines.sort((a,b)=>a.time-b.time);
}

// ─── Build sections from synced lines + chord timeline ─────────────────────────
function buildSections(syncedLines, chordTimeline) {
  // Find chord active at a given time
  function chordAt(time) {
    let best=null;
    for (const {time:t,chord} of chordTimeline) {
      if (t<=time+0.3) best=chord; else break;
    }
    return best;
  }

  // Detect section headers like [Verse], [Chorus] in lyric text
  const SECTION_RE = /^\[([^\]]+)\]$/;
  const rawSecs = [];
  let cur = {name:'Verse 1', linesData:[]};

  for (const {time,text} of syncedLines) {
    const sm = SECTION_RE.exec(text);
    if (sm) {
      if (cur.linesData.length) rawSecs.push({...cur});
      const label = sm[1].replace(/\bverse\b/i,'Verse').replace(/\bchorus\b/i,'Chorus')
        .replace(/\bbridge\b/i,'Bridge').replace(/\boutro\b/i,'Outro')
        .replace(/\bpre.?chorus\b/i,'Pre-Chorus').replace(/\bintro\b/i,'Intro');
      cur = {name:label, linesData:[]};
    } else {
      cur.linesData.push({time, text, chord: chordAt(time)});
    }
  }
  if (cur.linesData.length) rawSecs.push(cur);

  return rawSecs.map(sec => {
    const chords = [...new Set(sec.linesData.map(l=>l.chord).filter(Boolean))];
    const lines = sec.linesData.map(({chord,text}) => chord ? `[${chord}]${text}` : text);
    return {name:sec.name, chords, lines};
  }).filter(s => s.lines.length>0);
}

// ─── Main export ────────────────────────────────────────────────────────────────
async function analyzeAudio(arrayBuffer, onProgress) {
  const FFT_SIZE = 4096;
  const HOP = 1024;

  onProgress?.(5, 'Decoding audio…');
  const ac = new AudioContext();
  let buf;
  try {
    buf = await ac.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    throw new Error('Could not decode audio. Try MP3, WAV, M4A, or FLAC.');
  }
  await ac.close();

  const sr = buf.sampleRate;
  const len = buf.length;

  // Mix to mono
  const mono = new Float32Array(len);
  for (let c=0; c<buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i=0;i<len;i++) mono[i]+=ch[i]/buf.numberOfChannels;
  }

  onProgress?.(15, 'Detecting beats…');
  const beats = detectBeats(mono, sr);

  onProgress?.(25, 'Analysing harmony…');
  const win = hann(FFT_SIZE);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const frameChords = [];
  const totalFrames = Math.floor((len-FFT_SIZE)/HOP);

  for (let frame=0; frame<totalFrames; frame++) {
    const off = frame*HOP;
    for (let i=0;i<FFT_SIZE;i++){re[i]=mono[off+i]*win[i];im[i]=0;}
    fft(re,im);
    const mags = new Float32Array(FFT_SIZE/2);
    for (let i=0;i<FFT_SIZE/2;i++) mags[i]=Math.sqrt(re[i]**2+im[i]**2);
    frameChords.push({time:off/sr, chord:matchChord(computeChroma(mags,sr,FFT_SIZE))});

    if (frame%300===0) {
      onProgress?.(25+Math.round(55*frame/totalFrames), 'Analysing harmony…');
      await new Promise(r=>setTimeout(r,0));
    }
  }

  onProgress?.(80, 'Building chord timeline…');

  // Get chord for a time window by majority vote
  function chordForWindow(startT, endT) {
    const counts = {};
    for (const f of frameChords) {
      if (f.time<startT||f.time>=endT) continue;
      if (f.chord) counts[f.chord]=(counts[f.chord]||0)+1;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }

  // Use beat grid or 0.5s grid
  const timestamps = beats.length>=8 ? beats
    : Array.from({length:Math.ceil(buf.duration/0.5)},(_,i)=>i*0.5);

  const chordTimeline = [];
  let prev=null;
  for (let i=0; i<timestamps.length; i++) {
    const t = timestamps[i];
    const endT = timestamps[i+1]??t+2;
    const chord = chordForWindow(t, endT);
    if (chord) {
      chordTimeline.push({time:Math.round(t*100)/100, chord});
      prev=chord;
    }
  }

  onProgress?.(100,'Done');
  return {duration:buf.duration, beatCount:beats.length, chordTimeline};
}
