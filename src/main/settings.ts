import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { UpdateChannel } from '../shared/ipc'

/** The few things the app persists outside the OS-managed updater cache. */
export interface Settings {
  updateChannel: UpdateChannel
}

const DEFAULTS: Settings = { updateChannel: 'latest' }

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function readSettings(): Settings {
  try {
    const raw = readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    const channel = parsed.updateChannel === 'beta' ? 'beta' : 'latest'
    return { ...DEFAULTS, updateChannel: channel }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(next: Settings): void {
  const path = settingsPath()
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8')
}
