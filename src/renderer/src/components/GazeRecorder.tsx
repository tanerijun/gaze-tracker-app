import { useEffect, useRef, useState } from 'react'
import type { DesktopCapturerSource } from 'electron'
import JSZip from 'jszip'

export function GazeRecorder(): React.JSX.Element {
  const [isRecording, setIsRecording] = useState(false)
  const [sources, setSources] = useState<DesktopCapturerSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const screenMediaRecorderRef = useRef<MediaRecorder>(null)
  const webcamMediaRecorderRef = useRef<MediaRecorder>(null)
  const streamRef = useRef<MediaStream>(null)
  const webcamStreamRef = useRef<MediaStream>(null)
  const screenChunks = useRef<Blob[]>([])
  const webcamChunks = useRef<Blob[]>([])

  useEffect(() => {
    const getSources = async (): Promise<void> => {
      try {
        const availableSources = await window.api.getSources()
        setSources(availableSources)
      } catch (error) {
        console.error('Failed to get sources', error)
      }
    }

    getSources()

    window.api.onRecordingStarted(() => {
      console.log('Recording started')
    })

    window.api.onRecordingStopped(() => {
      console.log('Recording stopped')
      stopRecording()
    })

    return () => {
      window.api.removeListeners()
      stopRecording()
    }
  }, [])

  const startRecording = async (): Promise<void> => {
    try {
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore Electron-Chrome API mismatch - https://github.com/electron/electron/issues/27139
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource
          }
        }
      })

      const webcamStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      })

      const screenMediaRecorder = new MediaRecorder(screenStream)
      const webcamMediaRecorder = new MediaRecorder(webcamStream)

      screenChunks.current = []
      webcamChunks.current = []

      screenMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          screenChunks.current.push(event.data)
        }
      }

      webcamMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          webcamChunks.current.push(event.data)
        }
      }

      screenMediaRecorder.start()
      webcamMediaRecorder.start()

      screenMediaRecorderRef.current = screenMediaRecorder
      webcamMediaRecorderRef.current = webcamMediaRecorder
      streamRef.current = screenStream
      webcamStreamRef.current = webcamStream

      setIsRecording(true)
      window.api.startRecording()
    } catch (error) {
      console.error('Failed to start recording', error)
    }
  }

  const stopRecording = async (): Promise<void> => {
    const screenRecordingPromise = new Promise<Blob>((resolve) => {
      if (screenMediaRecorderRef.current) {
        screenMediaRecorderRef.current.onstop = () => {
          const screenBlob = new Blob(screenChunks.current, { type: 'video/webm' })
          resolve(screenBlob)
        }
        screenMediaRecorderRef.current.stop()
      }
    })

    const webcamRecordingPromise = new Promise<Blob>((resolve) => {
      if (webcamMediaRecorderRef.current) {
        webcamMediaRecorderRef.current.onstop = () => {
          const webcamBlob = new Blob(webcamChunks.current, { type: 'video/webm' })
          resolve(webcamBlob)
        }
        webcamMediaRecorderRef.current.stop()
      }
    })

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    const [screenBlob, webcamBlob] = await Promise.all([
      screenRecordingPromise,
      webcamRecordingPromise
    ])

    try {
      const zip = new JSZip()

      zip.file('screen-recording.webm', screenBlob)
      zip.file('webcam-recording.webm', webcamBlob)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.href = zipUrl
      link.download = `recordings-${timestamp}.zip`
      link.click()
      URL.revokeObjectURL(zipUrl)

      setIsRecording(false)
      screenChunks.current = []
      webcamChunks.current = []
      window.api.stopRecording()
    } catch (error) {
      console.error('Error creating recording zip:', error)
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gaze Tracker</h1>

      <div className="mb-4">
        <select
          className="select select-bordered w-full max-w-xs"
          onChange={(e) => setSelectedSource(e.target.value)}
          disabled={isRecording}
        >
          <option value="">Select a source</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <button
          className={`btn ${isRecording ? 'btn-error' : 'btn-primary'}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!selectedSource && !isRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {isRecording && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">Recording in progress...</div>
      )}
    </div>
  )
}
