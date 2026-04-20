import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Servicio para manejar la comunicación con la API de Google Gemini.
 * Utiliza un patrón singleton para reutilizar la instancia del cliente.
 */

// Instancia única del cliente de Gemini (singleton)
let genAIInstance: GoogleGenerativeAI | null = null;
let cachedApiKey: string = '';

/**
 * Obtiene o crea la instancia singleton del cliente de GoogleGenerativeAI.
 * Si la API key cambia, se recrea la instancia.
 */
function getGenAIClient(apiKey: string): GoogleGenerativeAI {
  if (!genAIInstance || cachedApiKey !== apiKey) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
  }
  return genAIInstance;
}

export class GeminiService {
  /**
   * Procesa un chat completo con historial y envía el último mensaje a Gemini.
   * @param apiKey Clave de acceso a la API de Gemini.
   * @param messages Lista de mensajes con formato {role, content}.
   * @returns La respuesta de texto generada por Gemini.
   */
  static async handleChat(apiKey: string, messages: any[]): Promise<string> {
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      return "Error: Falta la clave API de Gemini. Por favor añádela al archivo .env.";
    }

    const systemMessage = messages.find((m: any) => m.role === 'system');
    const systemInstruction = systemMessage ? systemMessage.content : undefined;

    // Reutilizar la instancia singleton del cliente
    const genAI = getGenAIClient(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: systemInstruction
    });

    // Filtramos el mensaje del sistema y el último (que es el prompt actual)
    // Necesitamos separar el historial del prompt actual
    const validMessages = messages.filter((m: any) => m.role !== 'system');
    const currentPromptMessage = validMessages[validMessages.length - 1];
    const historyRaw = validMessages.slice(0, -1);

    // Normalizar Historial:
    // 1. Mapear roles
    // 2. Fusionar mensajes consecutivos
    // 3. Asegurar que empiece por un 'user'
    let normalizedHistory: any[] = [];

    // Mapeo inicial
    let mappedHistory = historyRaw.map((m: any) => ({
      role: (m.role === 'model' || m.role === 'assistant') ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Fusionar roles consecutivos (Gemini requiere alternancia user-model)
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

    // Asegurar que el historial empieza siempre por 'user'
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

    try {
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Error de Gemini:", error);
      if (error.message?.includes('429')) {
        return "ERROR_RATE_LIMIT: El límite de peticiones se ha agotado. Por favor, espera un minuto e inténtalo de nuevo.";
      }
      return `Error desde Gemini: ${error.message}`;
    }
  }
}
