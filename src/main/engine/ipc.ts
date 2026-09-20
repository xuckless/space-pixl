import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { EngineClient, EngineError } from './client'

function serialiseError(err: unknown): { message: string; code: string; detail?: unknown } {
  if (err instanceof EngineError)
    return { message: err.message, code: err.code, detail: err.detail }
  return { message: err instanceof Error ? err.message : String(err), code: 'Unknown' }
}

/** Expose the engine client to the renderer over IPC. */
export function registerEngineIpc(engine: EngineClient): void {
  ipcMain.handle(IPC.engine.status, () => engine.getStatus())

  ipcMain.handle(IPC.engine.probe, async (_e, path: string) => {
    try {
      return { ok: true, info: await engine.probe(path) }
    } catch (err) {
      return { ok: false, error: serialiseError(err) }
    }
  })

  ipcMain.handle(IPC.engine.pickAndProbe, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const picked = await dialog.showOpenDialog(win as BrowserWindow, {
      title: 'Choose an image to probe',
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: [
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
            'orf'
          ]
        },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false, cancelled: true }
    const path = picked.filePaths[0]
    try {
      return { ok: true, path, info: await engine.probe(path) }
    } catch (err) {
      return { ok: false, path, error: serialiseError(err) }
    }
  })
}
