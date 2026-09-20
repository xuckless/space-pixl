import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type EngineStatus, type UpdateChannel, type UpdateState } from '../shared/ipc'
import type { SourceInfo } from '../shared/engine-types'

export interface ProbeFailure {
  ok: false
  cancelled?: boolean
  path?: string
  error?: { message: string; code: string; detail?: unknown }
}
export interface ProbeSuccess {
  ok: true
  path?: string
  info: SourceInfo
}
export type ProbeResult = ProbeSuccess | ProbeFailure

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke(IPC.app.version)
  },
  updates: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.updates.getState),
    check: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.updates.check),
    install: (): Promise<void> => ipcRenderer.invoke(IPC.updates.install),
    setChannel: (channel: UpdateChannel): Promise<UpdateState> =>
      ipcRenderer.invoke(IPC.updates.setChannel, channel),
    /** Subscribe to state changes. Returns an unsubscribe function. */
    onEvent: (cb: (state: UpdateState) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, state: UpdateState): void => cb(state)
      ipcRenderer.on(IPC.updates.event, listener)
      return () => ipcRenderer.removeListener(IPC.updates.event, listener)
    }
  },
  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke(IPC.engine.status),
    probe: (path: string): Promise<ProbeResult> => ipcRenderer.invoke(IPC.engine.probe, path),
    pickAndProbe: (): Promise<ProbeResult> => ipcRenderer.invoke(IPC.engine.pickAndProbe)
  }
}

export type SpacePixlApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('spacePixl', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.spacePixl = api
}
