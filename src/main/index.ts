import { app, shell, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log/main'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipc'
import type { EngineMode } from '../shared/engine-types'
import { EngineClient } from './engine/client'
import { registerIpc } from './ipc'
import { Pipeline } from './pipeline'
import { Store } from './db'
import { setupUpdater } from './updater'

log.initialize()
log.transports.file.level = 'info'

const engine = new EngineClient()
let store: Store | undefined

/**
 * Which engine the host may use. A packaged app only ever runs the native
 * addon; in development the placeholder stands in when the addon is missing
 * for this platform (Linux has no binary), and SPACE_PIXL_ENGINE overrides.
 */
function engineMode(): EngineMode {
  const env = process.env['SPACE_PIXL_ENGINE']
  if (env === 'native' || env === 'mock' || env === 'auto') return env
  return app.isPackaged ? 'native' : 'auto'
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.xuckless.spacepixl')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle(IPC.app.version, () => app.getVersion())

  store = Store.open(join(app.getPath('userData'), 'space-pixl.db'))
  store.reconcile()

  engine.start(engineMode())
  registerIpc(engine, new Pipeline(engine, store), store)
  setupUpdater()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  engine.stop()
  store?.close()
})
