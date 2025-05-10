import { desktopCapturer, ipcMain, type BrowserWindow } from 'electron'

export function setupIPCHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('GET_SOURCES', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 150, height: 150 }
      })
      return sources
    } catch (error) {
      console.error(`Error getting sources:`, error)
      throw error
    }
  })

  ipcMain.on('START_RECORDING', () => {
    mainWindow.webContents.send('RECORDING_STARTED')
  })

  ipcMain.on('STOP_RECORDING', () => {
    mainWindow.webContents.send('RECORDING_STOPPED')
  })
}
