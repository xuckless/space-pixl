import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
        external: ['@xuckless/pixl-engine']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
