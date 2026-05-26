const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function writeConfig(data) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}

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

// IPC handlers
ipcMain.handle('save-api-key', async (event, apiKey) => {
  const config = readConfig();
  config.apiKey = apiKey;
  writeConfig(config);
  return { success: true };
});

ipcMain.handle('get-api-key', async () => {
  const config = readConfig();
  return { apiKey: config.apiKey || '' };
});

ipcMain.handle('generate-chords', async (event, { song, artist, apiKey }) => {
  if (!apiKey) {
    return { error: 'No API key provided. Please enter your Anthropic API key.' };
  }

  if (!song || !artist) {
    return { error: 'Please provide both song name and artist.' };
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a guitar chord expert. When given a song name and artist, provide accurate guitar chord progressions. Always respond with valid JSON only, no markdown.`;

    const userMessage = `Provide guitar chords for "${song}" by ${artist}. Return JSON with: key (string), tempo (string like "slow/moderate/fast/120bpm"), capo (integer, 0 if none), sections (array of {name, chords (unique chords array), pattern (chord names in order showing repetition)}). Include all song sections you know.`;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const responseText = message.content[0].text.trim();

    // Strip markdown code blocks if present
    let jsonText = responseText;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let chordData;
    try {
      chordData = JSON.parse(jsonText);
    } catch (parseError) {
      return { error: 'Could not parse chord data from API response. Please try again.' };
    }

    // Validate structure
    if (!chordData.sections || !Array.isArray(chordData.sections)) {
      return { error: 'Invalid chord data received. Please try again.' };
    }

    return { success: true, data: chordData };
  } catch (err) {
    if (err.status === 401) {
      return { error: 'Invalid API key. Please check your Anthropic API key.' };
    } else if (err.status === 429) {
      return { error: 'Rate limit exceeded. Please wait a moment and try again.' };
    } else if (err.status === 400) {
      return { error: 'Bad request: ' + (err.message || 'Unknown error') };
    }
    return { error: 'API error: ' + (err.message || 'Unknown error occurred') };
  }
});
