import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { net } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from './database/db';
import { Usuario, Sesion } from './database/models';

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
app.whenReady().then(async () => {
  await connectDB();
  createWindow();

  /**
   * Helper function to call Gemini with retries and exponential backoff
   */
  async function callGeminiWithRetry(
    apiKey: string,
    modelName: string,
    systemInstruction: string | undefined,
    history: any[],
    prompt: string,
    retries: number = 3,
    initialDelay: number = 2000
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
    });

    const chat = model.startChat({
      history: history,
    });

    let lastError: any;
    let delay = initialDelay;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('429') || error.message?.includes('Resource exhausted');
        
        if (isRateLimit && i < retries - 1) {
          console.warn(`[Gemini] Error 429 (Rate Limit). Reintentando en ${delay}ms... (Intento ${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        break; // Non-retryable error or last attempt
      }
    }
    throw lastError;
  }

  ipcMain.handle('chat', async (event, messages) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      
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

      const prompt = currentPromptMessage ? currentPromptMessage.content : "Inicio.";

      const responseText = await callGeminiWithRetry(
        apiKey,
        modelName,
        systemInstruction,
        normalizedHistory,
        prompt
      );

      return responseText;

    } catch (error: any) {
      console.error("Gemini Error:", error);
      return `Error from Gemini: ${error.message}`;
    }
  });

  // ========== AUTHENTICATION ========== //
  ipcMain.handle('auth:register', async (event, { nombre, correo, password }) => {
    try {
      const existingUser = await Usuario.findOne({ correo });
      if (existingUser) return { success: false, error: "El correo ya está registrado." };

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = new Usuario({
        nombre,
        correo,
        password_hash,
        salt,
        perfil: { situacion: "", nivel_riesgo: "bajo", accion_sugerida: "" },
        metricas: { tristeza: 0, ansiedad: 0, alivio: 0, esperanza: 0 }
      });
      await newUser.save();

      // Create empty session
      const newSesion = new Sesion({
        id_usuario: newUser._id,
        conversaciones: []
      });
      await newSesion.save();

      return {
        success: true,
        user: { id: newUser._id.toString(), nombre: newUser.nombre, correo: newUser.correo }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:login', async (event, { correo, password }) => {
    try {
      const user = await Usuario.findOne({ correo });
      if (!user) return { success: false, error: "Usuario o contraseña incorrectos." };

      const pMatch = await bcrypt.compare(password, user.password_hash);
      if (!pMatch) return { success: false, error: "Usuario o contraseña incorrectos." };

      return {
        success: true,
        user: { id: user._id.toString(), nombre: user.nombre, correo: user.correo }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ========== SESSIONS & CHAT HISTORY ========== //
  ipcMain.handle('session:getConversations', async (event, userId) => {
    try {
      let session = await Sesion.findOne({ id_usuario: userId });
      if (!session) {
        session = new Sesion({ id_usuario: userId, conversaciones: [] });
        await session.save();
      }
      
      // Return metadata only: id, first message snippet for title, and date
      const metadata = session.conversaciones.map((conv: any) => {
        const firstUserMessage = conv.mensajes.find((m: any) => m.emisor === 'usuario');
        const snippet = firstUserMessage ? firstUserMessage.texto : (conv.mensajes[0]?.texto || "Nueva conversación");
        return {
          id: conv._id.toString(),
          title: snippet.length > 40 ? snippet.substring(0, 40) + "..." : snippet,
          date: conv.mensajes[0]?.fecha_envio ? conv.mensajes[0].fecha_envio.toISOString() : session.date_creation.toISOString()
        };
      }).reverse(); // Latest ones first

      return { success: true, conversaciones: metadata };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('session:getMessages', async (event, { userId, conversationId, limit, skip }) => {
    try {
      const session = await Sesion.findOne({ id_usuario: userId });
      if (!session) throw new Error("No session found");

      const conversation = session.conversaciones.id(conversationId);
      if (!conversation) throw new Error("Conversation not found");

      const allMessages = conversation.mensajes;
      const total = allMessages.length;
      
      // Get chunk from the end (since lazy loading usually goes backwards in time)
      const start = Math.max(0, total - skip - limit);
      const end = total - skip;
      const messagesChunk = allMessages.slice(start, end).map((m: any) => ({
        _id: m._id.toString(),
        texto: m.texto,
        emisor: m.emisor,
        fecha_envio: m.fecha_envio.toISOString()
      }));

      return { 
        success: true, 
        mensajes: messagesChunk, 
        hasMore: start > 0 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('session:newConversation', async (event, userId) => {
    try {
      let session = await Sesion.findOne({ id_usuario: userId });
      if (!session) throw new Error("No session found");
      
      session.conversaciones.push({ mensajes: [] });
      await session.save();
      
      const newConversation = session.conversaciones[session.conversaciones.length - 1];
      return { success: true, conversationId: newConversation._id.toString() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('session:addMessageToConversation', async (event, { userId, conversationId, message }) => {
    try {
      const session = await Sesion.findOne({ id_usuario: userId });
      if (!session) throw new Error("No session found");

      const conversation = session.conversaciones.id(conversationId);
      if (!conversation) throw new Error("Conversation not found");

      conversation.mensajes.push(message); // message format: { texto, emisor, fecha_envio }
      session.date_last_save = new Date();
      await session.save();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
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
