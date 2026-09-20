import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log/main'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { IPC, type UpdateChannel, type UpdateState } from '../shared/ipc'
import { readSettings, writeSettings } from './settings'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

let state: UpdateState = {
  phase: 'idle',
  channel: readSettings().updateChannel,
  currentVersion: app.getVersion()
}

let timer: NodeJS.Timeout | undefined

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.updates.event, state)
  }
}

function setState(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch }
  broadcast()
}

function applyChannel(channel: UpdateChannel): void {
  // A beta build (0.2.0-beta.1) is published to the `beta` channel by
  // electron-builder; a stable build to `latest`. Following beta means reading
  // the beta manifest and accepting prerelease versions.
  autoUpdater.channel = channel
  autoUpdater.allowPrerelease = channel === 'beta'
  autoUpdater.allowDowngrade = false
}

async function check(): Promise<void> {
  if (state.phase === 'downloading') return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    // checkForUpdates rejects on network errors; the 'error' event also fires.
    log.warn('update check failed', err)
  }
}

/** Wire electron-updater. Call once, after `app.whenReady()`. */
export function setupUpdater(): void {
  ipcMain.handle(IPC.updates.getState, () => state)

  if (!app.isPackaged && !process.env.SPACE_PIXL_FORCE_UPDATER) {
    // In development there is nothing to update against. Set
    // SPACE_PIXL_FORCE_UPDATER=1 and point dev-app-update.yml at the bucket to
    // exercise the flow from `pnpm dev`.
    state = { ...state, phase: 'disabled' }
    ipcMain.handle(IPC.updates.check, () => state)
    ipcMain.handle(IPC.updates.install, () => undefined)
    ipcMain.handle(IPC.updates.setChannel, (_e, channel: UpdateChannel) => {
      writeSettings({ ...readSettings(), updateChannel: channel })
      setState({ channel })
      return state
    })
    return
  }

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  applyChannel(state.channel)

  autoUpdater.on('checking-for-update', () => {
    setState({ phase: 'checking', error: undefined, lastCheckedAt: new Date().toISOString() })
  })
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({ phase: 'available', version: info.version, releaseDate: info.releaseDate })
  })
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setState({ phase: 'not-available', version: info.version, progress: undefined })
  })
  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    setState({
      phase: 'downloading',
      progress: {
        percent: p.percent,
        transferred: p.transferred,
        total: p.total,
        bytesPerSecond: p.bytesPerSecond
      }
    })
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({ phase: 'downloaded', version: info.version, progress: undefined })
  })
  autoUpdater.on('error', (err: Error) => {
    setState({ phase: 'error', error: err.message })
  })

  ipcMain.handle(IPC.updates.check, async () => {
    await check()
    return state
  })
  ipcMain.handle(IPC.updates.install, () => {
    if (state.phase === 'downloaded') {
      setImmediate(() => autoUpdater.quitAndInstall())
    }
  })
  ipcMain.handle(IPC.updates.setChannel, async (_e, channel: UpdateChannel) => {
    if (channel !== 'latest' && channel !== 'beta') return state
    writeSettings({ ...readSettings(), updateChannel: channel })
    applyChannel(channel)
    setState({ channel, phase: 'idle', version: undefined, error: undefined })
    await check()
    return state
  })

  void check()
  timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
  app.on('before-quit', () => {
    if (timer) clearInterval(timer)
  })
}
