// Consulta la documentación de Electron para ver detalles sobre cómo usar los scripts de preload:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    chat: (messages: any[]) => ipcRenderer.invoke('chat', messages),
});
