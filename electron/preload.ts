// Consulta la documentación de Electron para ver detalles sobre cómo usar los scripts de preload:
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
      deleteConversation: (data: any) => ipcRenderer.invoke('session:deleteConversation', data),
      requestHelp: (data: any) => ipcRenderer.invoke('session:requestHelp', data),
      markHelpRequested: (data: any) => ipcRenderer.invoke('session:markHelpRequested', data),
      getPendingFollowUps: (userId: string) => ipcRenderer.invoke('session:getPendingFollowUps', userId),
      recordFollowUp: (data: any) => ipcRenderer.invoke('session:recordFollowUp', data),
      generateReport: (data: any) => ipcRenderer.invoke('session:generateReport', data),
      notifyEmailContact: (data: any) => ipcRenderer.invoke('session:notifyEmailContact', data),
    }
});
