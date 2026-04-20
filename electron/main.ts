import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { GeminiService } from './services/gemini.service';

dotenv.config();

// Manejar la creación/eliminación de accesos directos en Windows al instalar/desinstalar.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  // Crear la ventana del navegador.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Tu Amigo",
    backgroundColor: '#E3F2FD', // azul claro relajante
  });

  // En producción, cargar el index.html de la aplicación.
  // En desarrollo, cargar el servidor de desarrollo local.
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Este método se llamará cuando Electron haya finalizado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('chat', async (event, messages) => {
    const apiKey = process.env.GEMINI_API_KEY || '';
    return await GeminiService.handleChat(apiKey, messages);
  });

  app.on('activate', () => {
    // En macOS es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el icono del dock y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS. 
// Allí, es común que las aplicaciones y su barra de menú permanezcan 
// activas hasta que el usuario salga explícitamente con Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
