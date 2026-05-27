const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const OLLAMA_BASE_URL = 'http://localhost:11434/v1';
const OLLAMA_MODEL    = 'qwen2.5:7b';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    minWidth: 700,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'src', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Lyrics fetch ─────────────────────────────────────────────────────────────
// Try lrclib.net first (open-source, no key, ~3M songs), fall back to lyrics.ovh

async function fetchLyrics(artist, song) {
  // 1. lrclib.net
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(song)}`;
    const res = await fetch(url, {
      headers: { 'Lrclib-Client': 'GuitarChordGenerator/1.0 (github.com/reamgripper/Guitar)' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.plainLyrics) return { lyrics: data.plainLyrics, source: 'lrclib' };
    }
  } catch { /* fall through */ }

  // 2. lyrics.ovh fallback
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) return { lyrics: data.lyrics, source: 'lyrics.ovh' };
    }
  } catch { /* fall through */ }

  return null;
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle('check-ollama', async () => {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace('/v1', '')}/api/tags`);
    if (!res.ok) return { running: false };
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    const modelReady = models.some(m => m.startsWith('qwen2.5'));
    return { running: true, modelReady, models };
  } catch {
    return { running: false };
  }
});

ipcMain.handle('generate-chords', async (event, { song, artist }) => {
  if (!song || !artist) {
    return { error: 'Please provide both song name and artist.' };
  }

  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: 'ollama', baseURL: OLLAMA_BASE_URL });

    // Fetch real lyrics in parallel with nothing (just to not delay startup)
    const lyricsResult = await fetchLyrics(artist, song);

    const systemPrompt = `You are a guitar chord expert. Always respond with valid JSON only — no markdown, no explanation, no extra text.`;

    let userMessage;

    if (lyricsResult) {
      // Trim to ~2500 chars to stay within context window
      const trimmedLyrics = lyricsResult.lyrics.slice(0, 2500);

      userMessage = `Provide guitar chords for "${song}" by ${artist}.

Here are the REAL lyrics (do not change them):
"""
${trimmedLyrics}
"""

Instructions:
- Choose a guitar-friendly key using open chord shapes (G, C, D, E, A and their relative minors). If the song is in a difficult key, set a capo fret so the chord shapes are open.
- Identify the song sections (Verse, Chorus, Pre-Chorus, Bridge, Outro, etc.) from the lyric content. Section headers like [Verse], [Chorus] in the lyrics indicate sections.
- For each section, insert [ChordName] markers into the EXACT provided lyrics immediately before the syllable where the chord changes.
- Every lyric line must start with or contain at least one [ChordName] marker.
- Do not alter, paraphrase or omit any lyrics.

Return JSON:
{
  "key": "G",
  "capo": 0,
  "tempo": "moderate",
  "sections": [
    {
      "name": "Verse 1",
      "chords": ["G", "Em", "C", "D"],
      "lines": [
        "[G]Today is gonna be the [Em]day",
        "That they're gonna [C]throw it back to [D]you"
      ]
    }
  ]
}`;
    } else {
      // No lyrics found — ask Qwen for approximate chords only, no lyrics
      userMessage = `Provide guitar chords for "${song}" by ${artist}.

Instructions:
- Choose a guitar-friendly key using open chord shapes (G, C, D, E, A and their relative minors). If the song is in a difficult key, set a capo fret.
- List each section (Verse, Chorus, Bridge, etc.) with its chord progression.
- For lines, show the chord sequence with placeholder text showing where chords change.

Return JSON:
{
  "key": "G",
  "capo": 0,
  "tempo": "moderate",
  "lyricsUnavailable": true,
  "sections": [
    {
      "name": "Verse",
      "chords": ["G", "Em", "C", "D"],
      "lines": ["[G] / [Em] / [C] / [D]"]
    }
  ]
}`;
    }

    const completion = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      temperature: 0.2
    });

    let responseText = completion.choices[0]?.message?.content?.trim() || '';

    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let chordData;
    try {
      chordData = JSON.parse(responseText);
    } catch {
      return { error: 'Could not parse chord data. Try again — the model may need a moment to warm up.' };
    }

    if (!chordData.sections || !Array.isArray(chordData.sections)) {
      return { error: 'Invalid chord data received. Please try again.' };
    }

    // Attach lyrics source info for display
    chordData.lyricsSource = lyricsResult?.source || null;

    return { success: true, data: chordData };
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      return { error: 'Ollama is not running. Start it with: ollama serve' };
    }
    return { error: 'Error: ' + (err.message || 'Unknown error occurred') };
  }
});
