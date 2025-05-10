import { ElectronAPI } from '@electron-toolkit/preload'
import { CustomAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
