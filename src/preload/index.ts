import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AboutTab,
  type ConvertResult,
  type EngineStatus,
  type InspectResult,
  type Notices,
  type PickResult,
  type PreviewResult,
  type StatsSummary,
  type UpdateChannel,
  type UpdateState
} from '../shared/ipc'
import type { Plan } from '../shared/plan'

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke(IPC.app.version),
    cpus: (): Promise<number> => ipcRenderer.invoke(IPC.app.cpus),
    notices: (): Promise<Notices | null> => ipcRenderer.invoke(IPC.app.notices),
    /** The app menu asks for the About dialog. Returns an unsubscribe function. */
    onOpenAbout: (cb: (tab: AboutTab) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, tab: AboutTab): void => cb(tab)
      ipcRenderer.on(IPC.app.openAbout, listener)
      return () => ipcRenderer.removeListener(IPC.app.openAbout, listener)
    },
    /** The app menu asks for Settings. Returns an unsubscribe function. */
    onOpenSettings: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.app.openSettings, listener)
      return () => ipcRenderer.removeListener(IPC.app.openSettings, listener)
    }
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
  files: {
    pick: (): Promise<PickResult> => ipcRenderer.invoke(IPC.files.pick),
    reveal: (path: string): Promise<void> => ipcRenderer.invoke(IPC.files.reveal, path)
  },
  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke(IPC.engine.status),
    inspect: (path: string): Promise<InspectResult> => ipcRenderer.invoke(IPC.engine.inspect, path),
    preview: (path: string, plan: Plan): Promise<PreviewResult> =>
      ipcRenderer.invoke(IPC.engine.preview, path, plan),
    convert: (path: string, plan: Plan): Promise<ConvertResult> =>
      ipcRenderer.invoke(IPC.engine.convert, path, plan)
  },
  stats: {
    summary: (): Promise<StatsSummary> => ipcRenderer.invoke(IPC.stats.summary),
    clear: (): Promise<StatsSummary> => ipcRenderer.invoke(IPC.stats.clear)
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
