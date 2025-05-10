import { contextBridge, DesktopCapturerSource, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface CustomAPI {
  getSources: () => Promise<DesktopCapturerSource[]>
  startRecording: () => void
  stopRecording: () => void
  onRecordingStarted: (callback: () => void) => void
  onRecordingStopped: (callback: () => void) => void
  removeListeners: () => void
}

// Custom APIs for renderer
const api: CustomAPI = {
  getSources: () => ipcRenderer.invoke('GET_SOURCES'),
  startRecording: () => ipcRenderer.send('START_RECORDING'),
  stopRecording: () => ipcRenderer.send('STOP_RECORDING'),

  onRecordingStarted: (callback: () => void) => ipcRenderer.on('RECORDING_STARTED', callback),
  onRecordingStopped: (callback: () => void) => ipcRenderer.on('RECORDING_STOPPED', callback),

  removeListeners: () => {
    ipcRenderer.removeAllListeners('RECORDING_STARTED')
    ipcRenderer.removeAllListeners('RECORDING_STOPPED')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
