import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { connectDB } from './database/db';
import { Usuario, Sesion } from './database/models';
import { GeminiService } from './services/gemini.service';

dotenv.config();

// Manejar la creación/eliminación de accesos directos en Windows al instalar/desinstalar.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  // Crear la ventana del navegador.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Tu Amigo",
    backgroundColor: '#E3F2FD', // azul claro relajante
  });

  // En producción, cargar el index.html de la aplicación.
  // En desarrollo, cargar el servidor de desarrollo local.
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
      const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
      
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return "Error: Gemini API Key is missing. Please add it to the .env file.";
      }

      const systemMessage = messages.find((m: any) => m.role === 'system');
      const systemInstruction = systemMessage ? systemMessage.content : undefined;

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
      return "ERROR_API";
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
        rol: "usuario",
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
        user: { id: newUser._id.toString(), nombre: newUser.nombre, correo: newUser.correo, rol: newUser.rol }
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
        user: { id: user._id.toString(), nombre: user.nombre, correo: user.correo, rol: user.rol }
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

  ipcMain.handle('session:deleteConversation', async (event, { userId, conversationId }) => {
    try {
      const session = await Sesion.findOne({ id_usuario: userId });
      if (!session) throw new Error("No session found");

      // Pull the conversation out of the array
      session.conversaciones.pull(conversationId);
      await session.save();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('session:analyzeMetrics', async (event, { userId, messages }) => {
    try {
      if (!messages || messages.length === 0) return { success: true };
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
      if (!apiKey) throw new Error("No API root");

      const systemPrompt = `Analiza el historial provisto de una sesión de chat sobre acoso escolar. Devuelve SOLO un JSON con este formato exacto, sin explicaciones ni texto adicional:
      {
        "name": "Nombre del usuario si lo mencionó (o Desconocido)",
        "age": "Edad si la mencionó (o Desconocido)",
        "province": "Provincia o ciudad si la mencionó (o null)",
        "educationalCenter": "Nombre del colegio o instituto si lo mencionó (o null)",
        "situationType": "acoso escolar | ciberacoso | acoso laboral | otro",
        "situation": "Resumen de 1 frase del problema",
        "riskLevel": "Bajo | Medio | Alto",
        "suggestedAction": "1 acción recomendada rápida",
        "emotions": {
          "tristeza": número (0-100),
          "ansiedad": número (0-100),
          "alivio": número (0-100),
          "esperanza": número (0-100)
        }
      }`;

      // Enviar historial como user messages
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });

      const chatInput = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const result = await model.generateContent(chatInput);
      const responseText = await result.response.text();
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        const user = await Usuario.findById(userId);
        if (user) {
          user.perfil = {
            situacion: data.situation || user.perfil?.situacion,
            nivel_riesgo: data.riskLevel?.toLowerCase() || user.perfil?.nivel_riesgo,
            accion_sugerida: data.suggestedAction || user.perfil?.accion_sugerida,
            provincia: data.province || user.perfil?.provincia,
            centro_educativo: data.educationalCenter || user.perfil?.centro_educativo,
            tipo_situacion: data.situationType || user.perfil?.tipo_situacion,
          };
          if (data.emotions) {
            user.metricas = data.emotions;
          }
          await user.save();
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  });

  ipcMain.handle('session:requestHelp', async (event, { userId, conversationId, pendingInfo }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!apiKey) throw new Error("No API key");

      const user = await Usuario.findById(userId);
      if (!user) throw new Error("User not found");

      // Apply any pending info from chat (province, center, etc.)
      if (pendingInfo) {
        user.perfil = { ...user.perfil?.toObject?.() || user.perfil, ...pendingInfo };
        await user.save();
      }

      const perfil = user.perfil || {};

      // Check if we need more info before calling n8n
      if (!perfil.provincia) {
        return { needsInfo: true, field: 'provincia', question: "Para buscar quien está más cerca de ti, ¿me puedes decir en qué provincia o ciudad estás?" };
      }

      const esTipoEscolar = perfil.tipo_situacion?.toLowerCase().includes('escolar');
      if (esTipoEscolar && !perfil.centro_educativo) {
        return { needsInfo: true, field: 'centro_educativo', question: "¿Me puedes decir el nombre del colegio o instituto donde está pasando esto?" };
      }

      // Get last 20 messages for summary
      const sesion = await Sesion.findOne({ id_usuario: userId });
      let mensajesRecientes: any[] = [];
      if (sesion) {
        const conv = sesion.conversaciones.id(conversationId);
        if (conv) {
          mensajesRecientes = conv.mensajes.slice(-20).map((m: any) => ({
            role: m.emisor === 'usuario' ? 'user' : 'assistant',
            content: m.texto
          }));
        }
      }

      // Generate case summary with Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const summaryModel = genAI.getGenerativeModel({ model: modelName });
      const summaryPrompt = `Eres un asistente que genera resúmenes de casos de acoso para servicios de ayuda.
Genera un resumen conciso y objetivo del siguiente caso. Devuelve SOLO un JSON con este formato:
{
  "resumen": "Descripción del caso en 2-3 frases",
  "puntos_clave": ["punto 1", "punto 2", "punto 3"]
}

Datos del perfil:
- Nombre: ${user.nombre || 'Desconocido'}
- Situación: ${perfil.situacion || 'No especificada'}
- Tipo: ${perfil.tipo_situacion || 'No especificado'}

Historial de la conversación:
${mensajesRecientes.map((m: any) => `${m.role}: ${m.content}`).join('\n')}`;

      const summaryResult = await summaryModel.generateContent(summaryPrompt);
      const summaryText = summaryResult.response.text();
      const summaryMatch = summaryText.match(/\{[\s\S]*\}/);
      let resumen = 'Sin descripción disponible';
      let puntos_clave: string[] = [];
      if (summaryMatch) {
        const summaryData = JSON.parse(summaryMatch[0]);
        resumen = summaryData.resumen || resumen;
        puntos_clave = summaryData.puntos_clave || [];
      }

      const payload = {
        nombre: user.nombre,
        edad: perfil.age || 'Desconocida',
        provincia: perfil.provincia,
        centro_educativo: perfil.centro_educativo || null,
        tipo_situacion: perfil.tipo_situacion || 'otro',
        resumen,
        nivel_riesgo: perfil.nivel_riesgo || 'Medio',
        puntos_clave,
      };

      if (!n8nWebhookUrl) {
        // If no n8n configured, return ANAR as fallback
        return {
          success: true,
          resource: 'ANAR',
          contact: '900 20 20 10',
          messageForUser: 'He buscado recursos de ayuda para ti. La Fundación ANAR (900 20 20 10) es un servicio gratuito especializado en ayudar a personas en tu situación. Están disponibles las 24 horas. Estás haciendo muy bien en pedir ayuda.'
        };
      }

      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!n8nResponse.ok) throw new Error(`n8n responded with ${n8nResponse.status}`);

      const result = await n8nResponse.json();
      return {
        success: true,
        resource: result.resource,
        contact: result.contact,
        messageForUser: result.messageForUser || 'He contactado con un servicio de ayuda. Alguien se pondrá en contacto contigo pronto. Estás haciendo lo correcto.'
      };
    } catch (error: any) {
      console.error('[requestHelp] Error:', error);
      return {
        success: false,
        error: error.message,
        messageForUser: 'Ha ocurrido un problema al intentar contactar. Por favor, llama directamente al ANAR: 900 20 20 10 (gratuito, disponible 24h).'
      };
    }
  });

  app.on('activate', () => {
    // En macOS es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el icono del dock y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS. 
// Allí, es común que las aplicaciones y su barra de menú permanezcan 
// activas hasta que el usuario salga explícitamente con Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
