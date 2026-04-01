import type { ShowtimeAPI } from '../preload/index'

declare module '*.mp3' {
  const src: string
  export default src
}

declare global {
  const __APP_VERSION__: string
  interface Window {
    showtime: ShowtimeAPI
  }
}
