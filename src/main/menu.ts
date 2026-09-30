/**
 * The menu bar: Electron's default menus, with Settings… (⌘, / Ctrl+,), an
 * About Space Pixl that opens the app's own About dialog rather than the
 * native panel, and Help's legal pages, which open the same dialog on the
 * matching tab so they read offline.
 */
import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { IPC, type AboutTab } from '../shared/ipc'

const SITE = 'https://space.pixlfoundation.com'

function send(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send(channel, ...args)
}

const about =
  (tab: AboutTab): (() => void) =>
  () =>
    send(IPC.app.openAbout, tab)

const settings: MenuItemConstructorOptions = {
  label: 'Settings…',
  accelerator: 'CmdOrCtrl+,',
  click: () => send(IPC.app.openSettings)
}

const help: MenuItemConstructorOptions[] = [
  { label: 'Space Pixl Website', click: () => void shell.openExternal(SITE) },
  { type: 'separator' },
  { label: 'Licence Agreement', click: about('licence') },
  { label: 'Privacy Policy', click: about('privacy') },
  { label: 'Third-Party Notices', click: about('third-party') }
]

export function buildMenu(): void {
  const mac = process.platform === 'darwin'
  const aboutItem: MenuItemConstructorOptions = {
    label: `About ${app.name}`,
    click: about('licence')
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(mac
        ? [
            {
              label: app.name,
              submenu: [
                aboutItem,
                { type: 'separator' },
                settings,
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
              ] satisfies MenuItemConstructorOptions[]
            }
          ]
        : []),
      mac
        ? { role: 'fileMenu' }
        : { label: 'File', submenu: [settings, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: mac ? help : [...help, { type: 'separator' }, aboutItem]
      }
    ])
  )
}
