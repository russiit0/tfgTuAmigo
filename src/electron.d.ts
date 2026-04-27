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
    };
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
