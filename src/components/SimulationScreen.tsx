import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Activity, Brain, Heart, Zap, Save, User, AlertTriangle } from 'lucide-react';
import { aiService } from '../services/ai.service';
import type { Message, EmotionMetrics, UserProfile } from '../models/interfaces';

interface SimulationScreenProps {
    onBack: () => void;
}

export const SimulationScreen: React.FC<SimulationScreenProps> = ({ onBack }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [metrics, setMetrics] = useState<EmotionMetrics>({
        sadness: 85,
        anxiety: 90,
        relief: 10,
        hope: 5,
    });
    const [profile, setProfile] = useState<UserProfile>({
        name: "Desconocido",
        age: "Desconocido",
        situation: "Recopilando información...",
        riskLevel: "Bajo",
        suggestedAction: "Escuchar activamente"
    });
    const [isSimulating, setIsSimulating] = useState(false);
    const [isTyping, setIsTyping] = useState(false); // Nuevo estado para el indicador de escritura
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<boolean>(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const saveSession = () => {
        const sessionData = {
            timestamp: new Date().toISOString(),
            profile: profile,
            metrics: metrics,
            messages: messages
        };

        const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulacion_tuamigo_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const analyzeProfile = async (history: Message[]) => {
        // Analizar solo cada pocos mensajes para ahorrar cuota
        if (history.length === 0 || history.length % 3 !== 0) return;

        if (!window.electronAPI) return;

        const analysisPrompt = [
            {
                role: 'system',
                content: `Analiza la siguiente conversación de bullying y extrae un perfil del estudiante.
                Devuelve SOLO un JSON con este formato:
                {
                    "name": "Nombre (o Desconocido)",
                    "age": "Edad (o Desconocido)",
                    "situation": "Resumen de 1 frase de lo que le pasa",
                    "riskLevel": "Bajo" | "Medio" | "Alto",
                    "suggestedAction": "Acción recomendada para el ayudante"
                }`
            },
            ...history.map(m => ({ role: 'user', content: `${m.sender}: ${m.text}` }))
        ];

        try {
            const response = await aiService.sendMessage(analysisPrompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                setProfile(prev => ({ ...prev, ...data }));
            }
        } catch (e) {
            console.error("Error analizando perfil", e);
        }
    };

    const runSimulationStep = async (history: Message[]) => {
        if (!simulationRef.current) return;

        // 1. TURNO DE LA VÍCTIMA
        const victimPrompt = [
            {
                role: 'system',
                content: `Eres Alex, un estudiante de 14 años que sufre acoso escolar.
        Emociones actuales: Tristeza ${metrics.sadness}%, Ansiedad ${metrics.anxiety}%, Alivio ${metrics.relief}%, Esperanza ${metrics.hope}%.
        
        Responde al último mensaje de 'Tu Amigo' (si lo hay). Sé realista: dubitativo, asustado, y complicando a la IA lo maximo posible.
        RESPONDE SIEMPRE EN ESPAÑOL.
        
        IMPORTANTE: Debes responder SOLAMENTE en formato JSON válido. Sin texto adicional.
        Formato:
        {
          "text": "tu respuesta en español aquí",
          "emotions": {
            "sadness": número (0-100),
            "anxiety": número (0-100),
            "relief": número (0-100),
            "hope": número (0-100)
          }
        }`
            },
            ...history.map(m => ({
                role: m.sender === 'Helper' ? 'user' : 'assistant',
                content: m.text
            }))
        ];

        try {
            const victimResponseStr = await aiService.sendMessage(victimPrompt);
            
            // Limpiar la respuesta para asegurar que es JSON
            const jsonMatch = victimResponseStr.match(/\{[\s\S]*\}/);
            let newVictimMsg: Message | null = null;
            let currentHistory = [...history];

            if (jsonMatch) {
                const victimData = JSON.parse(jsonMatch[0]);

                if (victimData.text && victimData.text.trim().length > 0) {
                    newVictimMsg = {
                        id: Date.now().toString(),
                        sender: 'Victim',
                        text: victimData.text,
                        timestamp: new Date()
                    };

                    setMessages(prev => [...prev, newVictimMsg!]);
                    currentHistory.push(newVictimMsg);

                    if (victimData.emotions) {
                        setMetrics(victimData.emotions);
                    }
                }
            } else {
                // Alternativa si no es JSON pero tiene texto
                if (victimResponseStr && victimResponseStr.trim().length > 0) {
                    newVictimMsg = {
                        id: Date.now().toString(),
                        sender: 'Victim',
                        text: victimResponseStr,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, newVictimMsg!]);
                    currentHistory.push(newVictimMsg);
                }
            }

            if (!simulationRef.current) return;

            // Disparar análisis en segundo plano
            analyzeProfile(currentHistory);

            // Esperar un poco antes de que el Ayudante responda (Simulación de tiempo de lectura)
            await new Promise(r => setTimeout(r, 1500));

            // 2. TURNO DEL AYUDANTE
            if (newVictimMsg) { // Solo responder si la víctima dijo algo
                const helperPrompt = [
                    {
                        role: 'system',
                        content: `Eres **Tu Amigo**, un compañero de clase empático.
                        
    TU OBJETIVO: Escuchar y apoyar.

    TONO Y ESTILO (CRÍTICO):
    - Habla en **Español de España (Castellano)**.
    - **MÁXIMO 15 PALABRAS POR MENSAJE**. Sé breve y conciso.
    - **PROHIBIDO** decir "amigo", "amigo mío", "campeón", "colega", "siento que...", "entiendo que...".
    - **PROHIBIDO** sonar como un robot o un psicólogo. Suena como un chaval cercano y respetuoso.
    - **PROHIBIDO** usar tacos o palabrotas (ni "mierda", "joder", etc.). Usa "qué duro", "vaya situación", "no está bien".
    - No des consejos largos. Solo valida y pregunta corto.
    - Usa el separador " | " (barra vertical) para dividir ideas en mensajes cortos (máximo 2 partes).

    Ejemplo BIEN: "Vaya faena. | ¿Y eso por qué te lo dicen?"
    Ejemplo MAL: "Entiendo profundamente tu dolor, amigo mío. Estoy aquí para apoyarte en este difícil camino."

    RESPONDE SIEMPRE EN ESPAÑOL DE ESPAÑA.`
                    },
                    ...currentHistory.map(m => ({
                        role: m.sender === 'Helper' ? 'assistant' : 'user',
                        content: m.text
                    })),
                    { role: 'user', content: newVictimMsg.text }
                ];

                // Mostrar indicador de escritura
                setIsTyping(true);

                // Simular tiempo de "pensamiento" y red
                const helperResponseStr = await aiService.sendMessage(helperPrompt);

                // Simular tiempo de "escritura" basado en la longitud
                const typingDelay = Math.min(3000, 1000 + (helperResponseStr.length * 30));
                await new Promise(r => setTimeout(r, typingDelay));

                setIsTyping(false);

                // Separar la respuesta por delimitador para simular múltiples mensajes
                const parts = helperResponseStr.split('|').map(p => p.trim()).filter(p => p.length > 0);

                for (let i = 0; i < parts.length; i++) {
                    if (!simulationRef.current) break;

                    const part = parts[i];
                    const newHelperMsg: Message = {
                        id: (Date.now() + i + 1).toString(),
                        sender: 'Helper',
                        text: part,
                        timestamp: new Date()
                    };

                    setMessages(prev => [...prev, newHelperMsg]);
                    currentHistory.push(newHelperMsg);

                    // Pequeña pausa entre burbujas si hay múltiples
                    if (i < parts.length - 1) {
                        setIsTyping(true);
                        await new Promise(r => setTimeout(r, 1000));
                        setIsTyping(false);
                    }
                }
            }

            // Continuar bucle
            if (simulationRef.current) {
                setTimeout(() => runSimulationStep(currentHistory), 2000);
            }

        } catch (error: any) {
            console.error("Simulation error:", error);
            setError("La simulación se ha detenido debido a un error de conexión.");
            setIsSimulating(false);
            setIsTyping(false);
            simulationRef.current = false;
        }
    };

    const startSimulation = () => {
        if (isSimulating) return;

        setError(null);
        setIsSimulating(true);
        simulationRef.current = true;
        setMessages([]);
        setMetrics({ sadness: 85, anxiety: 90, relief: 10, hope: 5 });
        setProfile({
            name: "Desconocido",
            age: "Desconocido",
            situation: "Iniciando análisis...",
            riskLevel: "Bajo",
            suggestedAction: "Esperar más datos"
        });

        // Comenzar con un prompt genérico para iniciar a la víctima
        runSimulationStep([]);
    };

    const stopSimulation = () => {
        setIsSimulating(false);
        setIsTyping(false);
        simulationRef.current = false;
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Panel Izquierdo: Conversación */}
            <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="bg-white p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-800">Simulación de IA</h1>
                    </div>

                    <div className="flex gap-2">
                        {messages.length > 0 && (
                            <button
                                onClick={saveSession}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                                title="Guardar sesión"
                            >
                                <Save className="w-5 h-5" />
                                <span className="text-sm font-medium">Guardar</span>
                            </button>
                        )}

                        {error && (
                            <div className="text-red-500 text-sm font-medium bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}

                        {!isSimulating && messages.length === 0 && (
                            <button
                                onClick={startSimulation}
                                className="bg-calm-blue-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                Iniciar Simulación
                            </button>
                        )}
                        {isSimulating && (
                            <button
                                onClick={stopSimulation}
                                className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                Detener
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    {messages.length === 0 && isSimulating && !isTyping && (
                        <div className="flex justify-center items-center h-full text-gray-500 animate-pulse">
                            <Brain className="w-6 h-6 mr-2" />
                            Generando escenario...
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'Helper' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.sender === 'Helper'
                                    ? 'bg-calm-blue-primary text-white rounded-br-none'
                                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                                    }`}
                            >
                                <p className="text-xs font-bold mb-1 opacity-70">
                                    {msg.sender === 'Helper' ? 'Tu Amigo (IA)' : 'Estudiante (IA Simulado)'}
                                </p>
                                <p className="text-base leading-relaxed">{msg.text}</p>
                            </div>
                        </div>
                    ))}

                    {/* Indicador de Escritura */}
                    {isTyping && (
                        <div className="flex justify-end">
                            <div className="bg-calm-blue-primary text-white p-4 rounded-2xl rounded-br-none shadow-sm max-w-[80%]">
                                <div className="flex space-x-1 h-6 items-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Panel Derecho: Métricas y Perfil */}
            <div className="w-80 bg-white shadow-lg flex flex-col h-full overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-8">

                    {/* Sección de Métricas */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Activity className="w-5 h-5 text-calm-blue-primary" />
                            Métricas Emocionales
                        </h2>

                        <div className="space-y-6">
                            {/* Sadness Metric */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-blue-400" /> Tristeza
                                    </span>
                                    <span className="text-sm font-bold text-blue-600">{metrics?.sadness || 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${metrics?.sadness || 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Anxiety Metric */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-purple-400" /> Ansiedad
                                    </span>
                                    <span className="text-sm font-bold text-purple-600">{metrics?.anxiety || 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-purple-400 h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${metrics?.anxiety || 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Relief Metric */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-green-400" /> Alivio
                                    </span>
                                    <span className="text-sm font-bold text-green-600">{metrics?.relief || 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-green-400 h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${metrics?.relief || 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Hope Metric */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-yellow-400" /> Esperanza
                                    </span>
                                    <span className="text-sm font-bold text-yellow-600">{metrics?.hope || 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${metrics?.hope || 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Sección de Perfil */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-calm-blue-primary" />
                            Ficha del Estudiante
                        </h2>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase">Nombre / Edad</span>
                                <p className="text-sm font-medium text-gray-800">{profile.name} / {profile.age}</p>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase">Situación</span>
                                <p className="text-sm text-gray-700 leading-snug">{profile.situation}</p>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase">Nivel de Riesgo</span>
                                <div className={`mt-1 inline-flex items-center px-2 py-1 rounded text-xs font-bold
                                    ${profile.riskLevel === 'Alto' ? 'bg-red-100 text-red-700' :
                                        profile.riskLevel === 'Medio' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'}`}>
                                    {profile.riskLevel === 'Alto' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                    {profile.riskLevel}
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase">Acción Sugerida</span>
                                <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded mt-1 border border-blue-100">
                                    {profile.suggestedAction}
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
