/**
 * Servicio para interactuar con la API de IA a través del puente de Electron (IPC).
 * Incluye validación y sanitización de los mensajes antes de enviarlos.
 */

// Longitud máxima permitida por mensaje (en caracteres)
const MAX_MESSAGE_LENGTH = 5000;

/**
 * Sanitiza el texto del usuario eliminando caracteres potencialmente peligrosos
 * y limitando la longitud del mensaje.
 * @param text Texto sin procesar del usuario.
 * @returns Texto limpio y seguro para enviar a la API.
 */
function sanitizeInput(text: string): string {
    // Eliminar etiquetas HTML/scripts para prevenir inyección
    let sanitized = text.replace(/<[^>]*>/g, '');

    // Limitar la longitud del mensaje
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    }

    return sanitized.trim();
}

export const aiService = {
    /**
     * Envía un historial de mensajes a la IA y obtiene una respuesta.
     * Valida y sanitiza los mensajes del usuario antes de enviarlos.
     * @param messagesHistory Historial de mensajes incluyendo el prompt del sistema.
     * @returns La respuesta de texto de la IA.
     */
    async sendMessage(messagesHistory: { role: string; content: string }[]): Promise<string> {
        if (!window.electronAPI) {
            throw new Error("Esta funcionalidad solo está disponible en la aplicación de escritorio. Por favor, asegúrate de no estar usando el navegador (Chrome/Edge/etc).");
        }

        // Sanitizar todos los mensajes del usuario antes de enviarlos
        const sanitizedMessages = messagesHistory.map(msg => ({
            role: msg.role,
            content: msg.role === 'user' ? sanitizeInput(msg.content) : msg.content
        }));

        const responseText = await window.electronAPI.chat(sanitizedMessages);

        if (responseText.startsWith("ERROR_RATE_LIMIT:")) {
            throw new Error(responseText.replace("ERROR_RATE_LIMIT:", "").trim());
        }

        return responseText;
    }
};
