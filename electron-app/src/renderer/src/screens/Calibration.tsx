import { useRef, useState } from 'react'
import JSZip from 'jszip'
import fixWebmDuration from 'fix-webm-duration'
import { Nav } from '../components/Nav'

interface Point {
  x: number
  y: number
}

interface CalibrationPoint extends Point {
  timestamp: number
}

function generatePoints(screenWidth: number, screenHeight: number): Point[] {
  const padding = 80 // pixels from edge
  const width = screenWidth - padding * 2
  const height = screenHeight - padding * 2
  const cols = 4
  const rows = 3

  const points: Point[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      points.push({
        x: padding + Math.floor((width * col) / (cols - 1)),
        y: padding + Math.floor((height * row) / (rows - 1))
      })
    }
  }

  return points
}

export function Calibration(): React.JSX.Element {
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [currentPointIndex, setCurrentPointIndex] = useState(-1)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const clickedPointsRef = useRef<CalibrationPoint[]>([])
  const [isPointClicked, setIsPointClicked] = useState(false)
  const webcamMediaRecorderRef = useRef<MediaRecorder>(null)
  const webcamStreamRef = useRef<MediaStream>(null)
  const webcamChunks = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  const startCalibration = async (): Promise<void> => {
    try {
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      const webcamMediaRecorder = new MediaRecorder(webcamStream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      webcamChunks.current = []

      webcamMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          webcamChunks.current.push(event.data)
        }
      }

      webcamMediaRecorder.start(1000)
      startTimeRef.current = Date.now()

      webcamMediaRecorderRef.current = webcamMediaRecorder
      webcamStreamRef.current = webcamStream

      setIsCalibrating(true)
      await window.api.startCalibration()

      setTimeout(() => {
        setPoints(generatePoints(window.innerWidth, window.innerHeight))
        setCurrentPointIndex(0)
      }, 100)
    } catch (error) {
      console.error('Failed to start calibration:', error)
    }
  }

  const stopCalibration = async (): Promise<void> => {
    await window.api.stopCalibration()

    const recordingDuration = Date.now() - startTimeRef.current

    const webcamRecordingPromise = new Promise<Blob>((resolve) => {
      if (webcamMediaRecorderRef.current) {
        webcamMediaRecorderRef.current.onstop = () => {
          const webcamBlob = new Blob(webcamChunks.current, { type: 'video/webm;codecs=vp9' })
          fixWebmDuration(webcamBlob, recordingDuration, (fixedBlob) => {
            resolve(fixedBlob)
          })
        }
        webcamMediaRecorderRef.current.stop()
      }
    })

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    const webcamBlob = await webcamRecordingPromise

    try {
      const zip = new JSZip()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      zip.file('webcam-recording.webm', webcamBlob)

      const calibrationData = {
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        points: clickedPointsRef.current
      }
      zip.file('calibration-data.json', JSON.stringify(calibrationData, null, 2))

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = zipUrl
      link.download = `calibration-${timestamp}.zip`
      link.click()
      URL.revokeObjectURL(zipUrl)

      setIsCalibrating(false)
      setCurrentPointIndex(-1)
      clickedPointsRef.current = []
      webcamChunks.current = []
    } catch (error) {
      console.error('Error creating calibration zip:', error)
    }
  }

  const handlePointClick = (point: { x: number; y: number }): void => {
    if (isCalibrating) {
      const timestamp = Date.now() - startTimeRef.current
      setIsPointClicked(true)
      clickedPointsRef.current.push({ ...point, timestamp })

      setTimeout(() => {
        setIsPointClicked(false)
        if (currentPointIndex + 1 < points.length) {
          setCurrentPointIndex(currentPointIndex + 1)
        } else {
          stopCalibration()
        }
      }, 1000)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      {!isCalibrating ? (
        <div className="p-4 flex flex-col w-full h-full">
          <Nav />
          <div className="flex-1 flex items-center justify-center">
            <button onClick={startCalibration} className="btn btn-primary w-fit">
              Start Calibration
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">
          {currentPointIndex >= 0 && currentPointIndex < points.length && (
            <div
              key={currentPointIndex}
              className={`cursor-pointer absolute w-6 h-6 rounded-full bg-red-500
                        ${isPointClicked && 'animate-pulse'}`}
              style={{
                left: `${points[currentPointIndex].x}px`,
                top: `${points[currentPointIndex].y}px`,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={() => !isPointClicked && handlePointClick(points[currentPointIndex])}
            />
          )}
        </div>
      )}
    </div>
  )
}
