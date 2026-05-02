# Diseño: Botón de Pedir Ayuda + Integración n8n

**Fecha:** 2026-05-01  
**Estado:** Aprobado

---

## Resumen

Añadir un flujo completo de solicitud de ayuda a la app TuAmigo. Incluye un botón siempre visible en el chat, detección natural por parte del asistente de IA de cuándo sugerirlo, y una integración con n8n que determina el recurso adecuado (centro escolar, servicio autonómico, recurso nacional) y envía un email al mismo con una plantilla de la app.

---

## 1. Botón "Pedir Ayuda"

- **Ubicación:** barra superior de `ChatScreen`, siempre visible independientemente del estado de autenticación
- **Icono:** `LifeBuoy` o `Phone` de lucide-react, color cálido (naranja/rojo suave)
- **Estado desactivado:** mientras el flujo de ayuda está procesando, para evitar dobles envíos

### Flujo de autenticación

- **No autenticado:** al pulsar se muestra un modal ligero sobre el chat con opciones de Login/Registro. Tras autenticarse, el modal cierra y el flujo de ayuda arranca automáticamente sin que el usuario repita la acción.
- **Autenticado:** el flujo arranca directamente.

En ningún momento se navega fuera del chat ni se interrumpe la conversación.

---

## 2. Detección natural por el asistente

El system prompt del asistente se enriquece con una directriz: cuando detecte señales de alarma (desesperanza, escalada emocional, sensación de no tener salida, menciones directas o indirectas de hacerse daño), introduce la sugerencia del botón de forma orgánica en su respuesta. Solo cuando el contexto lo justifica, no de forma mecánica.

Ejemplo de sugerencia natural:
> "No tienes que pasar por esto solo/a. Si quieres, puedo ponerme en contacto con alguien que te ayude de verdad — tienes el botón de ayuda arriba si en algún momento lo necesitas."

El asistente también recoge de forma conversacional la información que falta en el perfil:
- **Provincia/ciudad:** si no ha surgido, pregunta de forma natural ("¿De dónde eres?", "¿Estás cerca de tu ciudad?")
- **Centro educativo:** si la situación es acoso en clase, pregunta el nombre del centro
- **Tipo de situación:** se infiere del contexto (acoso escolar, ciberacoso, etc.)

Ninguna de estas preguntas aparece como formulario. Salen integradas en el diálogo.

El análisis de métricas existente (`session:analyzeMetrics`) se amplía para extraer también `provincia`, `centro_educativo` y `tipo_situacion` cuando aparezcan en la conversación, guardándolos en el perfil. Así cuando el usuario pulse el botón de ayuda, la información ya estará disponible sin necesidad de preguntarla. El usuario nunca ve métricas ni porcentajes.

---

## 3. Flujo completo al pulsar el botón

### 3.1 Inicio
El asistente envía inmediatamente un mensaje en el chat:
> "Un momento, voy a ver quién te puede ayudar mejor. No te vayas 💙"

El botón queda desactivado mientras procesa.

### 3.2 Verificación de información (Electron main.ts)

El nuevo handler IPC `session:requestHelp` comprueba el perfil del usuario en MongoDB:

- Si **falta la provincia** → devuelve `{ needsInfo: true, question: "Para buscar quien está más cerca de ti, ¿me dices en qué provincia o ciudad estás?" }`
- Si el caso es **acoso escolar y falta el centro** → devuelve `{ needsInfo: true, question: "¿Sabes el nombre del colegio o instituto?" }`
- El frontend recibe esto, entra en modo `awaitingHelpInfo`, el asistente hace la pregunta en el chat, y el siguiente mensaje del usuario se intercepta: en lugar de ir al flujo normal de chat, actualiza el perfil en MongoDB y reintenta `requestHelp` automáticamente. Una vez obtenida la info, vuelve al flujo normal.

### 3.3 Generación del resumen (Gemini)

Con toda la info disponible, Gemini genera un resumen estructurado del caso (no visible al usuario).

### 3.4 Llamada a n8n

POST al webhook de n8n con el payload del caso. N8n procesa de forma síncrona y responde.

### 3.5 Comunicación del resultado

El asistente traduce la respuesta de n8n en lenguaje natural:
> "He contactado con la Fundación ANAR. Alguien se pondrá en contacto contigo en breve. Mientras tanto, aquí estoy."

Si n8n no encuentra recurso específico, usa ANAR como fallback garantizado.

---

## 4. Payload hacia n8n

```json
{
  "nombre": "string | Desconocido",
  "edad": "string | Desconocido",
  "provincia": "string | Desconocido",
  "centro_educativo": "string | null",
  "tipo_situacion": "acoso escolar | ciberacoso | acoso laboral | otro",
  "resumen": "Descripción breve generada por Gemini",
  "nivel_riesgo": "Alto | Medio | Bajo",
  "puntos_clave": ["string"]
}
```

---

## 5. Workflow n8n

### Nodos

| # | Nodo | Función |
|---|------|---------|
| 1 | **Webhook** | Recibe POST de la app |
| 2 | **AI Agent (Gemini)** | Analiza el caso y decide tipo de recurso. Si falta info crítica devuelve `{needsInfo: true, question: "..."}` |
| 3 | **Switch/Router** | Ramifica por tipo de recurso: centro escolar / servicio autonómico / recurso nacional / emergencia |
| 4 | **Send Email** | Envía email al recurso con plantilla de app |
| 5 | **Respond to Webhook** | Devuelve a la app: recurso, teléfono/web, confirmación email, mensaje para el usuario |

### Ramas del router

- **Acoso en centro educativo:** email al centro + notificación a ANAR/orientador
- **Riesgo Alto inmediato:** Teléfono de la Esperanza (717 003 717) o servicios de emergencia
- **Caso general:** ANAR (900 20 20 10) o fundación autonómica según provincia
- **Fallback:** ANAR siempre disponible si ninguna rama encaja

### Plantilla del email

```
Asunto: [TuAmigo App] Solicitud de ayuda - Caso #<id>

Este mensaje ha sido generado automáticamente desde la aplicación TuAmigo,
una herramienta de apoyo para víctimas de acoso escolar.

RESUMEN DEL CASO:
- Nombre: <nombre>
- Edad: <edad>
- Ubicación: <provincia>
- Centro educativo: <centro_educativo>
- Tipo de situación: <tipo_situacion>
- Nivel de riesgo: <nivel_riesgo>

DESCRIPCIÓN:
<resumen>

PUNTOS CLAVE:
<puntos_clave>

Se solicita que se pongan en contacto con el usuario o tomen las medidas
oportunas según su protocolo habitual.

— TuAmigo App
```

### Respuesta de n8n a la app

```json
{
  "resource": "ANAR",
  "contact": "900 20 20 10",
  "web": "https://www.anar.org",
  "emailSent": true,
  "messageForUser": "He contactado con ANAR. Son especialistas en ayudar a personas en tu situación y alguien se pondrá en contacto contigo. Su teléfono es gratuito: 900 20 20 10."
}
```

---

## 6. Cambios en el modelo de datos

### Usuario (MongoDB)

Añadir campos al `PerfilSchema`:
```
provincia: String
centro_educativo: String
tipo_situacion: String
```

### Preload / electronAPI

Nuevo método expuesto: `window.electronAPI.session.requestHelp({ userId, conversationId })`

---

## 7. Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `electron/database/models.ts` | Añadir campos al PerfilSchema |
| `electron/main.ts` | Nuevo handler `session:requestHelp` |
| `electron/preload.ts` | Exponer `requestHelp` |
| `src/electron.d.ts` | Tipado del nuevo método |
| `src/components/ChatScreen.tsx` | Botón, modal auth, lógica del flujo |
| `src/components/LoginScreen.tsx` | Soporte para modo modal |
| `src/components/RegisterScreen.tsx` | Soporte para modo modal |
| `n8n/tuamigo-help-workflow.json` | Workflow exportable para n8n (escritorio) |

---

## 8. Fuera de alcance

- Panel de administración para ver solicitudes de ayuda enviadas
- Historial de ayudas solicitadas por el usuario
- Seguimiento del estado del caso tras el envío
