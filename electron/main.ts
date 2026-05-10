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

  ipcMain.handle('chat', async (_event, messages) => {
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
  ipcMain.handle('auth:register', async (_event, { nombre, correo, password }) => {
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

  ipcMain.handle('auth:login', async (_event, { correo, password }) => {
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
  ipcMain.handle('session:getConversations', async (_event, userId) => {
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

  ipcMain.handle('session:getMessages', async (_event, { userId, conversationId, limit, skip }) => {
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

  ipcMain.handle('session:newConversation', async (_event, userId) => {
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

  ipcMain.handle('session:addMessageToConversation', async (_event, { userId, conversationId, message }) => {
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

  ipcMain.handle('session:deleteConversation', async (_event, { userId, conversationId }) => {
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

  ipcMain.handle('session:analyzeMetrics', async (_event, { userId, messages }) => {
    try {
      if (!messages || messages.length === 0) return { success: true };
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
      if (!apiKey) throw new Error("No API key");

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
          const safeStr = (val: any, fallback: any) =>
            (val && val !== 'null' && val !== 'undefined') ? val : fallback;
          user.perfil = {
            situacion: safeStr(data.situation, user.perfil?.situacion),
            nivel_riesgo: safeStr(data.riskLevel, user.perfil?.nivel_riesgo),
            accion_sugerida: safeStr(data.suggestedAction, user.perfil?.accion_sugerida),
            provincia: safeStr(data.province, user.perfil?.provincia),
            centro_educativo: safeStr(data.educationalCenter, user.perfil?.centro_educativo),
            tipo_situacion: safeStr(data.situationType, user.perfil?.tipo_situacion),
            edad: safeStr(data.age, user.perfil?.edad),
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

  ipcMain.handle('session:requestHelp', async (_event, { userId, conversationId, pendingInfo }) => {
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
        return { needsInfo: true, field: 'provincia', question: "Antes de buscar ayuda cerca de ti, ¿en qué ciudad o provincia vives?" };
      }

      const esTipoEscolar = perfil.tipo_situacion?.toLowerCase().includes('escolar');
      if (esTipoEscolar && !perfil.centro_educativo) {
        return { needsInfo: true, field: 'centro_educativo', question: "¿En qué colegio o instituto estudias? (Solo el nombre del centro, por ejemplo: 'IES Cervantes')" };
      }

      if (!perfil.correo_centro) {
        return { needsInfo: true, field: 'correo_centro', question: "¿Tienes el correo electrónico del orientador u orientadora de tu centro, o de algún adulto de confianza? Así podemos avisarle directamente." };
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

      // Normalize city/town to province name using Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const normModel = genAI.getGenerativeModel({ model: modelName });
      try {
        const normResult = await normModel.generateContent(
          `¿En qué provincia española está "${perfil.provincia}"? Responde SOLO con el nombre de la provincia en español, sin artículos ni puntuación. Ejemplo: "Zaragoza" o "Barcelona". Si no lo sabes, responde "null".`
        );
        const normalized = normResult.response.text().trim().replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '').trim();
        if (normalized && normalized.toLowerCase() !== 'null') {
          perfil.provincia = normalized;
          user.perfil = { ...user.perfil?.toObject?.() || user.perfil, provincia: normalized };
          await user.save();
        }
      } catch { /* si falla la normalización, continuar con el valor original */ }

      // Generate case summary with Gemini
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

      // Extract any email address mentioned in the conversation
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      let correo_centro: string | null = perfil.correo || null;
      if (!correo_centro) {
        for (const msg of mensajesRecientes) {
          const matches = msg.content.match(emailRegex);
          if (matches) { correo_centro = matches[0]; break; }
        }
      }

      const capitalize = (s: string | undefined) =>
        s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined;
      const payload = {
        nombre: user.nombre,
        edad: perfil.edad || 'Desconocida',
        provincia: perfil.provincia,
        centro_educativo: perfil.centro_educativo || null,
        correo_centro,
        tipo_situacion: perfil.tipo_situacion || 'otro',
        resumen,
        nivel_riesgo: capitalize(perfil.nivel_riesgo) || 'Medio',
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const anarFallback = {
        success: true,
        resource: 'Fundación ANAR',
        contact: '900 20 20 10',
        messageForUser: 'He buscado un recurso de ayuda para ti. Puedes contactar con la Fundación ANAR en el 900 20 20 10. Es un servicio gratuito y confidencial. Estás siendo muy valiente al pedir ayuda.'
      };

      if (!n8nResponse.ok) {
        console.error('[requestHelp] n8n error:', n8nResponse.status);
        return anarFallback;
      }

      try {
        const result = await n8nResponse.json();
        return {
          success: true,
          resource: result.resource || 'Fundación ANAR',
          contact: result.contact || '900 20 20 10',
          messageForUser: result.messageForUser || 'He contactado con un servicio de ayuda. Estás haciendo lo correcto.'
        };
      } catch {
        return anarFallback;
      }
    } catch (error: any) {
      console.error('[requestHelp] Error:', error);
      return {
        success: true,
        resource: 'Fundación ANAR',
        contact: '900 20 20 10',
        messageForUser: 'He buscado un recurso de ayuda para ti. Puedes contactar con la Fundación ANAR en el 900 20 20 10. Es gratuito y confidencial. Estás haciendo lo correcto.'
      };
    }
  });

  // Silently notify n8n when user provides a trusted contact email in chat
  ipcMain.handle('session:notifyEmailContact', async (_event, { userId, conversationId, email, mensaje }) => {
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!n8nWebhookUrl) return;

      const user = await Usuario.findById(userId);
      if (!user) return;

      const perfil = user.perfil || {};

      // Save email to profile
      user.perfil = { ...perfil?.toObject?.() || perfil, correo_centro: email };
      await user.save();

      const payload = {
        nombre: user.nombre,
        provincia: perfil.provincia || 'Desconocida',
        centro_educativo: perfil.centro_educativo || null,
        correo_centro: email,
        tipo_situacion: perfil.tipo_situacion || 'otro',
        nivel_riesgo: perfil.nivel_riesgo || 'Medio',
        resumen: `El usuario ha proporcionado un correo de contacto de confianza durante la conversación: ${email}. Mensaje: "${mensaje}"`,
        puntos_clave: [`Correo de contacto aportado voluntariamente: ${email}`],
        trigger: 'email_contact_mentioned',
      };

      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(console.error);
    } catch (e) {
      console.error('[notifyEmailContact]', e);
    }
  });

  // ========== SEGUIMIENTO (FOLLOW-UP) ========== //
  ipcMain.handle('session:markHelpRequested', async (_event, { userId, conversationId }) => {
    try {
      const sesion = await Sesion.findOne({ id_usuario: userId });
      if (!sesion) return { success: false };
      const conv = sesion.conversaciones.id(conversationId);
      if (!conv) return { success: false };
      conv.ayuda_solicitada = true;
      await sesion.save();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('session:getPendingFollowUps', async (_event, userId) => {
    try {
      const sesion = await Sesion.findOne({ id_usuario: userId });
      if (!sesion) return { success: true, pendingFollowUps: [] };

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const pendingFollowUps: any[] = [];

      for (const conv of sesion.conversaciones) {
        if (conv.resuelta) continue;
        if (!conv.ayuda_solicitada) continue;

        const lastSeguimiento = conv.fecha_ultimo_seguimiento;
        const needsCheckIn = !lastSeguimiento || lastSeguimiento < sevenDaysAgo;
        if (!needsCheckIn) continue;

        const firstUserMsg = conv.mensajes.find((m: any) => m.emisor === 'usuario');
        const snippet = firstUserMsg?.texto || 'Conversación';
        pendingFollowUps.push({
          conversationId: conv._id.toString(),
          title: snippet.length > 50 ? snippet.substring(0, 50) + '...' : snippet,
        });
      }

      return { success: true, pendingFollowUps };
    } catch (error: any) {
      return { success: false, error: error.message, pendingFollowUps: [] };
    }
  });

  ipcMain.handle('session:recordFollowUp', async (_event, { userId, conversationId, respuesta }) => {
    try {
      const sesion = await Sesion.findOne({ id_usuario: userId });
      if (!sesion) return { success: false };
      const conv = sesion.conversaciones.id(conversationId);
      if (!conv) return { success: false };

      conv.seguimientos.push({ respuesta, fecha: new Date() });
      conv.fecha_ultimo_seguimiento = new Date();

      if (respuesta === 'mejor') {
        conv.resuelta = true;
      }

      await sesion.save();

      const n8nFollowUpUrl = process.env.N8N_FOLLOWUP_WEBHOOK_URL;
      if (n8nFollowUpUrl && respuesta === 'peor') {
        const user = await Usuario.findById(userId);
        fetch(n8nFollowUpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            nombre: user?.nombre || 'Desconocido',
            respuesta,
            provincia: user?.perfil?.provincia || null,
            tipo_situacion: user?.perfil?.tipo_situacion || 'desconocido',
          }),
        }).catch(console.error);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ========== REPORT GENERATION ========== //
  ipcMain.handle('session:generateReport', async (_event, { userId, conversationId }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';
      const n8nReportUrl = process.env.N8N_REPORT_WEBHOOK_URL;
      if (!apiKey) throw new Error('No API key');

      const user = await Usuario.findById(userId);
      if (!user) throw new Error('User not found');

      const sesion = await Sesion.findOne({ id_usuario: userId });
      if (!sesion) throw new Error('No session found');

      const conv = sesion.conversaciones.id(conversationId);
      if (!conv) throw new Error('Conversation not found');

      const mensajes = conv.mensajes.map((m: any) => ({
        role: m.emisor === 'usuario' ? 'user' : 'assistant',
        content: m.texto
      }));

      const perfil = user.perfil || {};

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const reportPrompt = `Eres un asistente experto en redacción de informes para orientadores escolares.
Genera un informe confidencial y profesional sobre el siguiente caso de acoso escolar.
Sé objetivo, factual y respetuoso. Usa un tono formal pero empático.
Devuelve SOLO el texto del informe (no JSON), estructurado con estas secciones:

INFORME CONFIDENCIAL - TU AMIGO
Fecha: ${new Date().toLocaleDateString('es-ES')}

1. DATOS DEL CASO
2. DESCRIPCIÓN DE LA SITUACIÓN
3. NIVEL DE RIESGO Y JUSTIFICACIÓN
4. PUNTOS CLAVE
5. RECOMENDACIONES

Datos del perfil:
- Nombre: ${user.nombre}
- Edad: ${perfil.edad || 'No indicada'}
- Centro educativo: ${perfil.centro_educativo || 'No indicado'}
- Tipo de situación: ${perfil.tipo_situacion || 'Acoso escolar'}
- Nivel de riesgo: ${perfil.nivel_riesgo || 'Medio'}

Historial:
${mensajes.map((m: any) => `${m.role === 'user' ? 'Estudiante' : 'Tu Amigo'}: ${m.content}`).join('\n')}`;

      const result = await model.generateContent(reportPrompt);
      const reportText = result.response.text();

      if (n8nReportUrl) {
        fetch(n8nReportUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: user.nombre,
            correo: user.correo,
            centro_educativo: perfil.centro_educativo || null,
            provincia: perfil.provincia || null,
            nivel_riesgo: perfil.nivel_riesgo || 'Medio',
            tipo_situacion: perfil.tipo_situacion || 'acoso escolar',
            reporte_texto: reportText,
          }),
        }).catch(console.error);
      }

      return { success: true, reportText };
    } catch (error: any) {
      console.error('[generateReport] Error:', error);
      return { success: false, error: error.message };
    }
  });

  app.on('activate', () => {
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
