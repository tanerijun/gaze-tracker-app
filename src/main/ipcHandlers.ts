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

  ipcMain.handle('START_CALIBRATION', async () => {
    return new Promise<void>((resolve) => {
      mainWindow.setFullScreen(true)
      mainWindow.webContents.send('CALIBRATION_STARTED')
      resolve()
    })
  })

  ipcMain.handle('STOP_CALIBRATION', async () => {
    return new Promise<void>((resolve) => {
      mainWindow.setFullScreen(false)
      mainWindow.webContents.send('CALIBRATION_STOPPED')
      resolve()
    })
  })
}
