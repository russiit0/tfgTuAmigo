// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    chat: (messages: any[]) => ipcRenderer.invoke('chat', messages),
    auth: {
      login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
      register: (userData: any) => ipcRenderer.invoke('auth:register', userData)
    },
    session: {
      getConversations: (userId: string) => ipcRenderer.invoke('session:getConversations', userId),
      newConversation: (userId: string) => ipcRenderer.invoke('session:newConversation', userId),
      addMessageToConversation: (data: any) => ipcRenderer.invoke('session:addMessageToConversation', data),
      getMessages: (data: any) => ipcRenderer.invoke('session:getMessages', data),
      analyzeMetrics: (data: any) => ipcRenderer.invoke('session:analyzeMetrics', data),
      deleteConversation: (data: any) => ipcRenderer.invoke('session:deleteConversation', data)
    }
});
