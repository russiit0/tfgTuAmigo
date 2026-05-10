export interface ElectronAPI {
    ping: () => Promise<void>;
    chat: (messages: { role: string; content: string }[]) => Promise<string>;
    auth: {
        login: (credentials: any) => Promise<{ success: boolean; user?: any; error?: string }>;
        register: (userData: any) => Promise<{ success: boolean; user?: any; error?: string }>;
    };
    session: {
        getConversations: (userId: string) => Promise<{ success: boolean; conversaciones?: any[]; error?: string }>;
        newConversation: (userId: string) => Promise<{ success: boolean; conversationId?: string; error?: string }>;
        addMessageToConversation: (data: { userId: string, conversationId: string, message: any }) => Promise<{ success: boolean; error?: string }>;
        getMessages: (data: { userId: string, conversationId: string, limit: number, skip: number }) => Promise<{ success: boolean; mensajes?: any[]; hasMore?: boolean; error?: string }>;
        analyzeMetrics: (data: { userId: string; messages: any[] }) => Promise<{ success: boolean }>;
        deleteConversation: (data: { userId: string, conversationId: string }) => Promise<{ success: boolean; error?: string }>;
        requestHelp: (data: { userId: string; conversationId: string; pendingInfo?: Record<string, string> }) => Promise<{ success?: boolean; needsInfo?: boolean; field?: string; question?: string; messageForUser?: string; resource?: string; contact?: string; error?: string }>;
        markHelpRequested: (data: { userId: string; conversationId: string }) => Promise<{ success: boolean }>;
        getPendingFollowUps: (userId: string) => Promise<{ success: boolean; pendingFollowUps: { conversationId: string; title: string }[] }>;
        recordFollowUp: (data: { userId: string; conversationId: string; respuesta: 'mejor' | 'igual' | 'peor' }) => Promise<{ success: boolean }>;
        generateReport: (data: { userId: string; conversationId: string }) => Promise<{ success: boolean; reportText?: string; error?: string }>;
    };
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
