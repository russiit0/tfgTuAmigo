import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Shield } from 'lucide-react';

interface ChatScreenProps {
    onBack: () => void;
}

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onBack }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hola. Siento que estés pasando por un momento difícil. ¿Qué es lo que más te preocupa hoy?',
            isUser: false,
            timestamp: new Date()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Call real AI via Electron IPC
            const messagesHistory = [
                { role: 'system', content: 'Eres "Tu Amigo", un asistente de IA empático y cálido diseñado para ayudar a estudiantes que sufren acoso escolar. Tu objetivo es escuchar, validar sus sentimientos y ofrecer apoyo emocional. No juzgues. Si detectas riesgo grave, sugiere buscar ayuda de un adulto.' },
                ...messages.map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text })),
                { role: 'user', content: inputText }
            ];

            const responseText = await window.electronAPI.chat(messagesHistory);

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Lo siento, tuve un problema al conectar con mi cerebro. ¿Está Ollama encendido?",
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm p-4 flex items-center justify-between z-10">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-semibold text-gray-700">Tu Amigo (IA)</span>
                </div>
                <div className="p-2" title="Chat Seguro y Anónimo">
                    <Shield className="w-6 h-6 text-calm-blue-primary" />
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.isUser
                                ? 'bg-calm-blue-primary text-white rounded-br-none'
                                : 'bg-white text-gray-800 rounded-bl-none'
                                }`}
                        >
                            <p className="text-base leading-relaxed">{msg.text}</p>
                            <span className={`text-xs mt-1 block opacity-70 ${msg.isUser ? 'text-blue-100' : 'text-gray-400'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-200">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe aquí lo que sientes..."
                        className="flex-1 p-4 bg-gray-50 border-transparent focus:bg-white focus:border-calm-blue-primary rounded-xl transition-all outline-none border-2"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="p-4 bg-calm-blue-primary text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};
