import type { CustomAPI } from '../../../preload'

declare global {
  interface Window {
    api: CustomAPI
  }
}
