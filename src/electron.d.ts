export interface ElectronAPI {
    ping: () => Promise<void>;
    chat: (messages: { role: string; content: string }[]) => Promise<string>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
