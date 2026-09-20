import type { SpacePixlApi } from './index'

declare global {
  interface Window {
    spacePixl: SpacePixlApi
  }
}
