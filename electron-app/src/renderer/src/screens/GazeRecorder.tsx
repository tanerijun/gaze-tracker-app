import { useEffect, useRef, useState } from 'react'
import type { DesktopCapturerSource } from 'electron'
import { Nav } from '../components/Nav'
import { Muxer, ArrayBufferTarget } from 'webm-muxer'
import JSZip from 'jszip'

export function GazeRecorder(): React.JSX.Element {
  const [isRecording, setIsRecording] = useState(false)
  const [sources, setSources] = useState<DesktopCapturerSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const screenStreamRef = useRef<MediaStream>(null)
  const webcamStreamRef = useRef<MediaStream>(null)
  const screenEncoderRef = useRef<VideoEncoder>(null)
  const webcamEncoderRef = useRef<VideoEncoder>(null)
  const screenMuxerRef = useRef<Muxer<ArrayBufferTarget>>(null)
  const webcamMuxerRef = useRef<Muxer<ArrayBufferTarget>>(null)

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
            chromeMediaSourceId: selectedSource,
            minFrameRate: 30,
            maxFrameRate: 30
          }
        }
      })

      const webcamStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          frameRate: {
            ideal: 30,
            min: 30
          }
        }
      })

      const screenMuxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width: screenStream.getVideoTracks()[0].getSettings().width!,
          height: screenStream.getVideoTracks()[0].getSettings().height!,
          frameRate: 30
        },
        firstTimestampBehavior: 'offset'
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

      const screenEncoder = new VideoEncoder({
        output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => {
          screenMuxer.addVideoChunk(chunk, metadata)
        },
        error: (e: Error) => {
          console.error(e)
        }
      })

      const webcamEncoder = new VideoEncoder({
        output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => {
          webcamMuxer.addVideoChunk(chunk, metadata)
        },
        error: (e: Error) => {
          console.error(e)
        }
      })

      screenEncoder.configure({
        codec: 'vp09.00.10.08',
        width: screenStream.getVideoTracks()[0].getSettings().width!,
        height: screenStream.getVideoTracks()[0].getSettings().height!,
        bitrate: 2500000
      })

      webcamEncoder.configure({
        codec: 'vp09.00.10.08',
        width: webcamStream.getVideoTracks()[0].getSettings().width!,
        height: webcamStream.getVideoTracks()[0].getSettings().height!,
        bitrate: 2500000
      })

      screenEncoderRef.current = screenEncoder
      webcamEncoderRef.current = webcamEncoder
      screenMuxerRef.current = screenMuxer
      webcamMuxerRef.current = webcamMuxer
      screenStreamRef.current = screenStream
      webcamStreamRef.current = webcamStream

      processVideoFrames(screenStream, screenEncoder)
      processVideoFrames(webcamStream, webcamEncoder)

      setIsRecording(true)
      window.api.startRecording()
    } catch (error) {
      console.error('Failed to start recording', error)
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

  const stopRecording = async (): Promise<void> => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      const screenMuxer = screenMuxerRef.current
      const webcamMuxer = webcamMuxerRef.current
      const screenEncoder = screenEncoderRef.current
      const webcamEncoder = webcamEncoderRef.current

      if (!screenMuxer || !webcamMuxer || !screenEncoder || !webcamEncoder) {
        return
      }

      await screenEncoder.flush()
      screenEncoderRef.current = null
      await webcamEncoder.flush()
      webcamEncoderRef.current = null

      screenMuxer.finalize()
      webcamMuxer.finalize()

      const screenBuffer = screenMuxer.target.buffer
      const webcamBuffer = webcamMuxer.target.buffer

      const zip = new JSZip()
      zip.file('screen-recording.webm', screenBuffer)
      zip.file('webcam-recording.webm', webcamBuffer)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.href = zipUrl
      link.download = `recordings-${timestamp}.zip`
      link.click()
      URL.revokeObjectURL(zipUrl)

      setIsRecording(false)
      window.api.stopRecording()
    } catch (error) {
      console.error('Error creating recording zip:', error)
    }
  }

  return (
    <div className="p-4">
      <Nav />

      <h1 className="text-2xl font-bold my-4">Gaze Tracker</h1>

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
