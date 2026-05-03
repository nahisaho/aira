/**
 * AIRA Electron Main Process
 *
 * Embeds the Hono backend and serves the frontend from the same HTTP origin.
 * Uses app.getPath('userData') for all data storage.
 */
import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const isPackaged = app.isPackaged;
const userDataPath = app.getPath('userData');

function getBaseDir(): string {
  return isPackaged ? userDataPath : process.cwd();
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not find free port')));
      }
    });
    server.on('error', reject);
  });
}

let mainWindow: BrowserWindow | null = null;
let activePort: number | null = null;

async function createWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'AIRA - AI Research Administrator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  if (isPackaged) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function main(): Promise<void> {
  try {
    const baseDir = getBaseDir();

    // Set paths before importing backend
    const { setBaseDir } = await import('../backend/dist/config/paths.js');
    setBaseDir(baseDir);

    // Copy skills to userData if packaged
    if (isPackaged) {
      const skillsSrc = path.join(process.resourcesPath!, 'skills');
      const skillsDest = path.join(baseDir, 'skills');
      if (fs.existsSync(skillsSrc) && !fs.existsSync(skillsDest)) {
        fs.cpSync(skillsSrc, skillsDest, { recursive: true });
      }
    }

    // Find free port & start backend
    activePort = await findFreePort();
    console.log(`[AIRA Electron] Using port ${activePort}`);

    const { startServer, enableStaticServing } = await import('../backend/dist/lifecycle.js');

    // Enable frontend static file serving
    const frontendDir = isPackaged
      ? path.join(process.resourcesPath!, 'frontend')
      : path.join(__dirname, '..', 'frontend', 'dist');
    enableStaticServing(frontendDir);

    await startServer(activePort);
    await createWindow(activePort);
  } catch (err) {
    console.error('[AIRA Electron] Startup failed:', err);
    app.quit();
  }
}

app.whenReady().then(main);

app.on('window-all-closed', async () => {
  try {
    const { stopServer } = await import('../backend/dist/lifecycle.js');
    stopServer();
  } catch { /* ignore */ }
  app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0 && activePort) {
    await createWindow(activePort);
  }
});

