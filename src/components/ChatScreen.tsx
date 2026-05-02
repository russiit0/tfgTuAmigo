import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Shield, Menu, X, MessageSquare, Plus, Clock, Trash2, AlertTriangle, LifeBuoy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChatScreenProps {
    onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onBack }) => {
    const { user, login } = useAuth();
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [conversations, setConversations] = useState<any[]>([]);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [skip, setSkip] = useState(0);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [convToDelete, setConvToDelete] = useState<string | null>(null);
    const limit = 20;

    // Help flow state
    const [isHelpRequesting, setIsHelpRequesting] = useState(false);
    const [awaitingHelpInfo, setAwaitingHelpInfo] = useState<{ field: string } | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authForm, setAuthForm] = useState({ nombre: '', correo: '', password: '' });
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [triggerHelpOnAuth, setTriggerHelpOnAuth] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Initial load: Fetch conversation list
    useEffect(() => {
        if (user) {
            fetchConversations();
        }
    }, [user]);

    const fetchConversations = async () => {
        if (!user) return;
        const res = await window.electronAPI.session.getConversations(user.id);
        if (res.success) {
            setConversations(res.conversaciones);
        }
    };

    const startNewChat = async () => {
        if (!user) return;
        setIsSidebarOpen(false);
        setMessages([]);
        setSkip(0);
        setHasMore(false);
        setAwaitingHelpInfo(null);
        setIsHelpRequesting(false);
        
        const res = await window.electronAPI.session.newConversation(user.id);
        if (res.success && res.conversationId) {
            setConversationId(res.conversationId);
            const initialMsgText = 'Hola. Siento que estés pasando por un momento difícil. ¿Qué es lo que más te preocupa hoy?';
            
            // Initial AI message
            const initialMsg: Message = {
                id: 'init-' + Date.now(),
                text: initialMsgText,
                isUser: false,
                timestamp: new Date()
            };
            setMessages([initialMsg]);
            
            await window.electronAPI.session.addMessageToConversation({
                userId: user.id,
                conversationId: res.conversationId,
                message: { texto: initialMsgText, emisor: 'modelo', fecha_envio: initialMsg.timestamp }
            });
            fetchConversations();
        }
    };

    const loadConversation = async (id: string) => {
        if (!user) return;
        setIsSidebarOpen(false);
        setConversationId(id);
        setMessages([]);
        setSkip(0);
        setIsHistoryLoading(true);
        setAwaitingHelpInfo(null);
        setIsHelpRequesting(false);

        const res = await window.electronAPI.session.getMessages({
            userId: user.id,
            conversationId: id,
            limit,
            skip: 0
        });

        if (res.success) {
            const mappedMessages: Message[] = res.mensajes.map((m: any) => ({
                id: m._id,
                text: m.texto,
                isUser: m.emisor === 'usuario',
                timestamp: new Date(m.fecha_envio)
            }));
            setMessages(mappedMessages);
            setHasMore(res.hasMore);
            setSkip(limit);
            setTimeout(scrollToBottom, 100);
        }
        setIsHistoryLoading(false);
    };

    const loadMoreMessages = async () => {
        if (!user || !conversationId || !hasMore || isHistoryLoading) return;

        setIsHistoryLoading(true);
        const container = scrollContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;

        const res = await window.electronAPI.session.getMessages({
            userId: user.id,
            conversationId,
            limit,
            skip
        });

        if (res.success) {
            const olderMessages: Message[] = res.mensajes.map((m: any) => ({
                id: m._id,
                text: m.texto,
                isUser: m.emisor === 'usuario',
                timestamp: new Date(m.fecha_envio)
            }));
            setMessages(prev => [...olderMessages, ...prev]);
            setHasMore(res.hasMore);
            setSkip(prev => prev + limit);

            // Maintain scroll position
            setTimeout(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight - prevHeight;
                }
            }, 0);
        }
        setIsHistoryLoading(false);
    };

    const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConvToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!user || !convToDelete) return;
        
        const id = convToDelete;
        const res = await window.electronAPI.session.deleteConversation({ userId: user.id, conversationId: id });
        if (res.success) {
            setConversations(prev => prev.filter(c => c.id !== id));
            if (conversationId === id) {
                setConversationId(null);
                setMessages([]);
            }
            setShowDeleteModal(false);
            setConvToDelete(null);
        } else {
            setToastMsg("No se pudo eliminar la conversación.");
            setShowDeleteModal(false);
            setConvToDelete(null);
            setTimeout(() => setToastMsg(null), 3000);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop === 0 && hasMore) {
            loadMoreMessages();
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const addAIMessage = async (text: string, convId: string) => {
        const aiMsg: Message = { id: 'ai-' + Date.now(), text, isUser: false, timestamp: new Date() };
        setMessages(prev => [...prev, aiMsg]);
        if (user) {
            await window.electronAPI.session.addMessageToConversation({
                userId: user.id, conversationId: convId,
                message: { texto: text, emisor: 'modelo', fecha_envio: aiMsg.timestamp }
            });
        }
        setTimeout(scrollToBottom, 50);
    };

    const triggerHelpRequest = async (convId: string, pendingInfo?: Record<string, string>) => {
        try {
            const res = await window.electronAPI.session.requestHelp({ userId: user!.id, conversationId: convId, pendingInfo });
            if (res.needsInfo && res.question && res.field) {
                setAwaitingHelpInfo({ field: res.field });
                await addAIMessage(res.question, convId);
            } else if (res.success && res.messageForUser) {
                setAwaitingHelpInfo(null);
                await addAIMessage(res.messageForUser, convId);
            } else {
                setAwaitingHelpInfo(null);
                const fallback = res.messageForUser || 'Lo siento, ha habido un problema. Puedes llamar directamente al ANAR: 900 20 20 10 (gratuito, 24h).';
                await addAIMessage(fallback, convId);
            }
        } catch {
            setAwaitingHelpInfo(null);
            await addAIMessage('Ha ocurrido un error. Si necesitas ayuda urgente, llama al ANAR: 900 20 20 10.', convId);
        } finally {
            setIsHelpRequesting(false);
        }
    };

    const handleRequestHelp = async () => {
        if (!user) {
            setTriggerHelpOnAuth(true);
            setShowAuthModal(true);
            return;
        }
        if (isHelpRequesting || awaitingHelpInfo) return;

        let convId = conversationId;
        if (!convId) {
            const res = await window.electronAPI.session.newConversation(user.id);
            if (!res.success || !res.conversationId) return;
            convId = res.conversationId!;
            setConversationId(convId);
            fetchConversations();
        }

        setIsHelpRequesting(true);
        await addAIMessage('Un momento, voy a ver quién te puede ayudar mejor. No te vayas 💙', convId);
        await triggerHelpRequest(convId);
    };

    const handleAuthSubmit = async () => {
        setAuthError('');
        setAuthLoading(true);
        try {
            let res;
            if (authMode === 'login') {
                res = await window.electronAPI.auth.login({ correo: authForm.correo, password: authForm.password });
            } else {
                res = await window.electronAPI.auth.register({ nombre: authForm.nombre, correo: authForm.correo, password: authForm.password });
            }
            if (res.success && res.user) {
                login(res.user);
                setShowAuthModal(false);
                setAuthForm({ nombre: '', correo: '', password: '' });
            } else {
                setAuthError(res.error || 'Ha ocurrido un error');
            }
        } catch {
            setAuthError('Error de conexión');
        } finally {
            setAuthLoading(false);
        }
    };

    // After login via modal, trigger help if pending
    React.useEffect(() => {
        if (user && triggerHelpOnAuth) {
            setTriggerHelpOnAuth(false);
            handleRequestHelp();
        }
    }, [user, triggerHelpOnAuth]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        // Intercept: user is answering a help-info question
        if (awaitingHelpInfo) {
            const answer = inputText.trim();
            setInputText('');
            const userMsg: Message = { id: Date.now().toString(), text: answer, isUser: true, timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);
            const convId = conversationId;
            if (!convId || !user) return;
            await window.electronAPI.session.addMessageToConversation({
                userId: user.id, conversationId: convId,
                message: { texto: answer, emisor: 'usuario', fecha_envio: userMsg.timestamp }
            });
            setIsHelpRequesting(true);
            await triggerHelpRequest(convId, { [awaitingHelpInfo.field]: answer });
            return;
        }

        let currentConvId = conversationId;
        if (!currentConvId && user) {
            // Auto-start if no conversation is active
            const res = await window.electronAPI.session.newConversation(user.id);
            if (res.success) {
                currentConvId = res.conversationId;
                setConversationId(currentConvId);
            } else return;
        }

        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        setIsLoading(true);

        if (user && currentConvId) {
            await window.electronAPI.session.addMessageToConversation({
                userId: user.id,
                conversationId: currentConvId,
                message: { texto: inputText, emisor: 'usuario', fecha_envio: newMessage.timestamp }
            });
        }

        try {
            // Send full history for context
            const historyForAI = messages.map(m => ({
                role: m.isUser ? 'user' : 'assistant',
                content: m.text
            }));
            
            const messagesHistory = [
                { role: 'system', content: `Eres "Tu Amigo", un asistente empático y cálido diseñado para ayudar a personas que sufren acoso escolar. Escucha activamente, valida sus sentimientos y ofrece apoyo emocional genuino. Nunca juzgues.

IMPORTANTE: Cuando detectes señales de alarma en el lenguaje del usuario (desesperanza, frases como "no puedo más", "nadie me ayuda", escalada emocional intensa, o cualquier mención directa o indirecta de hacerse daño), introduce de forma natural y cálida la mención al botón de ayuda. Hazlo como lo haría una persona real, integrado en tu respuesta, sin brusquedad. Ejemplo: "No tienes que pasar por esto solo/a. Si en algún momento sientes que necesitas hablar con alguien más, tienes el botón de ayuda arriba — puedo ponerme en contacto con quien te pueda apoyar de verdad."

Si en la conversación surge de forma natural la oportunidad de preguntar por la provincia o ciudad del usuario, o el nombre de su centro educativo (especialmente si hay acoso en clase), pregúntalo de forma conversacional y natural, nunca como un formulario.

No menciones métricas, porcentajes, ni niveles de riesgo al usuario. Todo debe sentirse como una conversación humana y real.` },
                ...historyForAI,
                { role: 'user', content: inputText }
            ];

            const responseText = await window.electronAPI.chat(messagesHistory);

            if (responseText === "ERROR_API") {
                throw new Error("No puedo responder en este momento. Inténtalo de nuevo más tarde.");
            }

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiResponse]);

            if (user && currentConvId) {
                await window.electronAPI.session.addMessageToConversation({
                    userId: user.id,
                    conversationId: currentConvId,
                    message: { texto: responseText, emisor: 'modelo', fecha_envio: aiResponse.timestamp }
                });
                fetchConversations(); // Update snippet if it's the first message
                
                // Trigger background metrics analysis asynchronously (exclude system prompt)
                const fullHistory = [...messagesHistory, { role: 'model', content: responseText }]
                    .filter(m => m.role !== 'system');
                window.electronAPI.session.analyzeMetrics({ userId: user.id, messages: fullHistory }).catch(console.error);
            }
        } catch (error: any) {
            setToastMsg(error.message || "Lo siento, tuve un problema al procesar tu mensaje.");
            setTimeout(() => setToastMsg(null), 5000);
        } finally {
            setIsLoading(false);
            setTimeout(scrollToBottom, 50);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowAuthModal(false); setTriggerHelpOnAuth(false); setAuthError(''); }} />
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="bg-orange-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LifeBuoy className="w-7 h-7 text-orange-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 text-center mb-1">Para pedir ayuda</h3>
                        <p className="text-gray-500 text-center text-sm mb-5">Necesitas iniciar sesión para que podamos contactar con el recurso adecuado.</p>

                        {/* Tabs */}
                        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                            <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === 'login' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Entrar</button>
                            <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === 'register' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Registrarse</button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {authMode === 'register' && (
                                <input
                                    type="text"
                                    placeholder="Tu nombre"
                                    value={authForm.nombre}
                                    onChange={e => setAuthForm(f => ({ ...f, nombre: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-300 rounded-xl outline-none text-sm transition-all"
                                />
                            )}
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                value={authForm.correo}
                                onChange={e => setAuthForm(f => ({ ...f, correo: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-300 rounded-xl outline-none text-sm transition-all"
                            />
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={authForm.password}
                                onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-300 rounded-xl outline-none text-sm transition-all"
                            />
                            {authError && <p className="text-red-500 text-xs text-center">{authError}</p>}
                            <button
                                onClick={handleAuthSubmit}
                                disabled={authLoading}
                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-bold transition-all active:scale-95"
                            >
                                {authLoading ? 'Un momento...' : authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" 
                        onClick={() => setShowDeleteModal(false)}
                    />
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">¿Eliminar chat?</h3>
                        <p className="text-gray-500 text-center mb-8">Esta acción no se puede deshacer y perderás todo el historial de esta charla.</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={confirmDelete}
                                className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
                            >
                                Sí, eliminar permanentemente
                            </button>
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && user && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {user && (
            <aside className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-gray-100 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                             <MessageSquare className="w-5 h-5 text-calm-blue-primary" />
                             Mis Charlas
                        </h2>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <button 
                        onClick={startNewChat}
                        className="m-4 flex items-center justify-center gap-2 p-3 bg-calm-blue-primary text-white rounded-xl hover:bg-blue-600 transition-all shadow-md active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Conversación
                    </button>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {conversations.length === 0 ? (
                            <div className="text-center py-10 opacity-40">
                                <Clock className="w-10 h-10 mx-auto mb-2" />
                                <p className="text-sm">No hay chats anteriores</p>
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <div key={conv.id} className="relative group">
                                    <button
                                        onClick={() => loadConversation(conv.id)}
                                        className={`w-full text-left p-4 pr-10 rounded-xl transition-all border ${conversationId === conv.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-gray-50'}`}
                                    >
                                        <p className="font-semibold text-sm text-gray-800 truncate mb-1">
                                            {conv.title}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(conv.date).toLocaleDateString()} · {new Date(conv.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                        title="Eliminar conversación"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </aside>
            )}

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col h-full relative">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-gray-50 p-4 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        {user && (
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
                        >
                            <Menu className="w-6 h-6 text-gray-600" />
                        </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="font-bold text-gray-800">Tu Amigo</span>
                            </div>
                            <p className="text-xs text-gray-500">Siempre dispuesto a escucharte</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRequestHelp}
                            disabled={isHelpRequesting}
                            title="Pedir ayuda"
                            className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-md shadow-orange-200"
                        >
                            <LifeBuoy className={`w-4 h-4 ${isHelpRequesting ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Pedir ayuda</span>
                        </button>
                        <Shield className="w-5 h-5 text-calm-blue-primary opacity-60" />
                    </div>
                </header>

                {/* Toast Notification */}
                {toastMsg && (
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <Shield className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{toastMsg}</span>
                        <button onClick={() => setToastMsg(null)} className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Messages Container */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 scroll-smooth"
                >
                    {isHistoryLoading && (
                        <div className="flex justify-center py-4">
                            <div className="w-6 h-6 border-2 border-calm-blue-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {messages.length === 0 && !isHistoryLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-10">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-10 h-10 text-calm-blue-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Empieza a hablar</h3>
                            <p className="text-gray-500 max-w-xs">Escribe algo abajo para comenzar una conversación nueva con Tu Amigo.</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div
                            key={msg.id || index}
                            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div
                                className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl shadow-sm relative ${msg.isUser
                                    ? 'bg-calm-blue-primary text-white rounded-br-none'
                                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-50'
                                    }`}
                            >
                                <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <span className={`text-[10px] mt-2 block opacity-60 ${msg.isUser ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start animate-in fade-in duration-300">
                            <div className="bg-white p-5 rounded-2xl rounded-bl-none shadow-sm border border-gray-100">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-calm-blue-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-calm-blue-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-calm-blue-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Section */}
                <div className="p-4 lg:p-6 bg-white border-t border-gray-50">
                    <div className="flex gap-3 max-w-5xl mx-auto items-end">
                        <div className="flex-1 relative">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                rows={1}
                                placeholder="Escribe aquí lo que sientes..."
                                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-calm-blue-primary/30 rounded-2xl transition-all outline-none resize-none max-h-32"
                                style={{ height: 'auto' }}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim() || isLoading}
                            className="p-4 bg-calm-blue-primary text-white rounded-2xl hover:bg-blue-600 transition-all disabled:opacity-40 shadow-lg shadow-blue-200 active:scale-95"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-[10px] text-center text-gray-400 mt-3">
                        Tu Amigo está aquí para apoyarte. No olvides que puedes hablar con un adulto de confianza.
                    </p>
                </div>
            </main>
        </div>
    );
};
