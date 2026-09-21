/** Every renderer-facing handler. Results are `{ ok: true, ... }` or `{ ok: false, error }`; nothing throws across the bridge. */
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { cpus } from 'os'
import log from 'electron-log/main'
import {
  IPC,
  type ConvertResult,
  type InspectResult,
  type PickResult,
  type PreviewResult,
  type StatsSummary
} from '../shared/ipc'
import type { Plan } from '../shared/plan'
import type { EngineClient } from './engine/client'
import { Pipeline, toAppError } from './pipeline'
import type { Store } from './db'

const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'heic',
  'heif',
  'avif',
  'jxl',
  'tif',
  'tiff',
  'webp',
  'cr2',
  'cr3',
  'arw',
  'nef',
  'dng',
  'raf',
  'rw2',
  'orf',
  'pef',
  'srw'
]

export function registerIpc(engine: EngineClient, pipeline: Pipeline, store: Store): void {
  ipcMain.handle(IPC.engine.status, () => engine.getStatus())
  ipcMain.handle(IPC.app.cpus, () => cpus().length)

  ipcMain.handle(IPC.files.pick, async (e): Promise<PickResult> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const picked = await dialog.showOpenDialog(win as BrowserWindow, {
      title: 'Choose an image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) {
      return { ok: false, cancelled: true, error: { message: 'cancelled', code: 'Cancelled' } }
    }
    return { ok: true, path: picked.filePaths[0] }
  })

  ipcMain.handle(IPC.files.reveal, (_e, path: string) => shell.showItemInFolder(path))

  ipcMain.handle(IPC.engine.inspect, async (_e, path: string): Promise<InspectResult> => {
    try {
      return { ok: true, ...(await pipeline.inspect(path)) }
    } catch (err) {
      log.warn('inspect failed', path, err)
      return { ok: false, error: toAppError(err) }
    }
  })

  ipcMain.handle(
    IPC.engine.preview,
    async (_e, path: string, plan: Plan): Promise<PreviewResult> => {
      try {
        return { ok: true, ...(await pipeline.preview(path, plan)) }
      } catch (err) {
        return { ok: false, error: toAppError(err) }
      }
    }
  )

  ipcMain.handle(
    IPC.engine.convert,
    async (_e, path: string, plan: Plan): Promise<ConvertResult> => {
      try {
        return { ok: true, ...(await pipeline.convert(path, plan)) }
      } catch (err) {
        log.warn('convert failed', path, err)
        return { ok: false, error: toAppError(err) }
      }
    }
  )

  ipcMain.handle(IPC.stats.summary, (): StatsSummary => store.summary())
  ipcMain.handle(IPC.stats.clear, (): StatsSummary => {
    store.clear()
    return store.summary()
  })
}
