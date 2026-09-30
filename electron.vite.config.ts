import { resolve, sep } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Records the npm packages a bundle actually contains (bundled-packages.json
 * beside it), so scripts/third-party-notices.mjs credits exactly what ships:
 * dev dependencies bundled into the renderer (React, the fonts) included,
 * build tooling not.
 */
function bundledPackages(): Plugin {
  return {
    name: 'space-pixl:bundled-packages',
    apply: 'build',
    generateBundle() {
      const dirs = new Set<string>()
      const marker = `${sep}node_modules${sep}`
      for (const id of this.getModuleIds()) {
        const file = id.replace(/^\0/, '').split('?')[0]
        const at = file.lastIndexOf(marker)
        if (at < 0) continue
        const rest = file.slice(at + marker.length).split(sep)
        const n = rest[0].startsWith('@') ? 2 : 1
        dirs.add(file.slice(0, at + marker.length) + rest.slice(0, n).join(sep))
      }
      this.emitFile({
        type: 'asset',
        fileName: 'bundled-packages.json',
        source: JSON.stringify([...dirs].sort(), null, 2) + '\n'
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bundledPackages()],
    build: {
      rollupOptions: {
        input: {
          // the app
          index: resolve('src/main/index.ts'),
          // the engine host, forked as an Electron utilityProcess
          'engine-host': resolve('src/main/engine/host.ts')
        },
        // The native binding is required by name at runtime inside the
        // utility process; it must never be bundled.
        external: ['@xuckless/pixl-engine', 'node:sqlite']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bundledPackages()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), bundledPackages()]
  }
})
