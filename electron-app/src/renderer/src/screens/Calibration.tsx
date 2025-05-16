import { useRef, useState } from 'react'
import { Nav } from '../components/Nav'
import { Muxer, ArrayBufferTarget } from 'webm-muxer'
import JSZip from 'jszip'

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
  const [isPointClicked, setIsPointClicked] = useState(false)
  const clickedPointsRef = useRef<CalibrationPoint[]>([])
  const webcamStreamRef = useRef<MediaStream>(null)
  const webcamMuxerRef = useRef<Muxer<ArrayBufferTarget>>(null)
  const webcamEncoderRef = useRef<VideoEncoder>(null)
  const startTimeRef = useRef<number>(0)

  const startCalibration = async (): Promise<void> => {
    try {
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      const webcamMuxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width: webcamStream.getVideoTracks()[0].getSettings().width!,
          height: webcamStream.getVideoTracks()[0].getSettings().height!,
          frameRate: 30
        },
        firstTimestampBehavior: 'offset'
      })

      const webcamEncoder = new VideoEncoder({
        output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) =>
          webcamMuxer.addVideoChunk(chunk, metadata),
        error: (e: Error) => console.error(e)
      })

      webcamEncoder.configure({
        codec: 'vp09.00.10.08',
        width: webcamStream.getVideoTracks()[0].getSettings().width!,
        height: webcamStream.getVideoTracks()[0].getSettings().height!,
        bitrate: 2500000
      })

      webcamEncoderRef.current = webcamEncoder
      webcamMuxerRef.current = webcamMuxer
      webcamStreamRef.current = webcamStream

      processVideoFrames(webcamStream, webcamEncoder)
      startTimeRef.current = Date.now()
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

  const processVideoFrames = (stream: MediaStream, encoder: VideoEncoder): void => {
    const track = stream.getVideoTracks()[0]
    const processor = new MediaStreamTrackProcessor({ track })
    const reader = processor.readable.getReader()

    const readChunk = async (): Promise<void> => {
      try {
        const { done, value } = await reader.read()
        if (done) return

        if (value) {
          encoder.encode(value, { keyFrame: false })
          value.close()
        }
        readChunk()
      } catch (error) {
        console.error('Error reading video chunk:', error)
      }
    }

    readChunk()
  }

  const stopCalibration = async (): Promise<void> => {
    const screenSize = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    await window.api.stopCalibration()

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    const webcamEncoder = webcamEncoderRef.current
    const webcamMuxer = webcamMuxerRef.current

    if (!webcamEncoder || !webcamMuxer) {
      return
    }

    await webcamEncoder.flush()
    webcamMuxer.finalize()

    const webcamBuffer = webcamMuxer.target.buffer

    try {
      const zip = new JSZip()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      zip.file('webcam-recording.webm', webcamBuffer)

      const calibrationData = {
        screenSize,
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
      webcamEncoderRef.current = null
      webcamMuxerRef.current = null
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
