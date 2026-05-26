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
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Check whether Ollama is reachable and the model is pulled
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
    const client = new OpenAI({
      apiKey: 'ollama',          // Ollama ignores the key but the SDK requires a value
      baseURL: OLLAMA_BASE_URL
    });

    const systemPrompt = `You are a guitar chord expert. When given a song name and artist, provide accurate guitar chord progressions. Always respond with valid JSON only, no markdown, no explanation.`;

    const userMessage = `Provide guitar chords for "${song}" by ${artist}. Return JSON with: key (string), tempo (string like "slow/moderate/fast/120bpm"), capo (integer, 0 if none), sections (array of {name, chords (unique chords array), pattern (chord names in order showing repetition)}). Include all song sections you know.`;

    const completion = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      temperature: 0.2
    });

    let responseText = completion.choices[0]?.message?.content?.trim() || '';

    // Strip markdown code fences if present
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

    return { success: true, data: chordData };
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      return { error: 'Ollama is not running. Start it with: ollama serve' };
    }
    return { error: 'Error: ' + (err.message || 'Unknown error occurred') };
  }
});
