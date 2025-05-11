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
      const onEnterFullScreen = (): void => {
        mainWindow.webContents.send('CALIBRATION_STARTED')
        mainWindow.removeListener('enter-full-screen', onEnterFullScreen)
        resolve()
      }

      mainWindow.on('enter-full-screen', onEnterFullScreen)
      mainWindow.setFullScreen(true)
    })
  })

  ipcMain.handle('STOP_CALIBRATION', async () => {
    return new Promise<void>((resolve) => {
      const onLeaveFullScreen = (): void => {
        mainWindow.webContents.send('CALIBRATION_STOPPED')
        mainWindow.removeListener('leave-full-screen', onLeaveFullScreen)
        resolve()
      }

      mainWindow.on('leave-full-screen', onLeaveFullScreen)
      mainWindow.setFullScreen(false)
    })
  })
}
