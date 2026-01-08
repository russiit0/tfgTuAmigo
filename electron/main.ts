import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { net } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Tu Amigo",
    backgroundColor: '#E3F2FD', // calm_blue_light
  });

  // In production, load the index.html of the app.
  // In development, load the local dev server.
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('chat', async (event, messages) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return "Error: Gemini API Key is missing. Please add it to the .env file.";
      }

      const systemMessage = messages.find((m: any) => m.role === 'system');
      const systemInstruction = systemMessage ? systemMessage.content : undefined;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction
      });

      // Filter out system message and the last message (which is the current prompt)
      // We need to separate the history from the current prompt
      const validMessages = messages.filter((m: any) => m.role !== 'system');
      const currentPromptMessage = validMessages[validMessages.length - 1];
      const historyRaw = validMessages.slice(0, -1);

      // Normalize History:
      // 1. Map roles
      // 2. Merge consecutive messages
      // 3. Ensure starts with user
      let normalizedHistory: any[] = [];

      // Map and initial format
      let mappedHistory = historyRaw.map((m: any) => ({
        role: (m.role === 'model' || m.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      // Merge consecutive
      if (mappedHistory.length > 0) {
        normalizedHistory.push(mappedHistory[0]);
        for (let i = 1; i < mappedHistory.length; i++) {
          const prev = normalizedHistory[normalizedHistory.length - 1];
          const curr = mappedHistory[i];
          if (prev.role === curr.role) {
            prev.parts[0].text += "\n" + curr.parts[0].text;
          } else {
            normalizedHistory.push(curr);
          }
        }
      }

      // Ensure starts with user
      if (normalizedHistory.length > 0 && normalizedHistory[0].role === 'model') {
        normalizedHistory.unshift({
          role: 'user',
          parts: [{ text: "Inicio de la simulación." }]
        });
      }

      const chat = model.startChat({
        history: normalizedHistory,
      });

      const prompt = currentPromptMessage ? currentPromptMessage.content : "Inicio.";

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      return text;

    } catch (error: any) {
      console.error("Gemini Error:", error);
      return `Error from Gemini: ${error.message}`;
    }
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
