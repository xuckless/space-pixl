import { app } from 'electron'
import { join } from 'path'

/**
 * Files electron-builder copies beside the app (`extraResources`), which live
 * in `build/` while developing.
 */
export const paths = {
  notices: (file: 'THIRD_PARTY_NOTICES.txt' | 'third-party-notices.json'): string =>
    app.isPackaged ? join(process.resourcesPath, file) : join(app.getAppPath(), 'build', file)
}
