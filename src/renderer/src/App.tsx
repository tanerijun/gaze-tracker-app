import { HashRouter, Route, Routes } from 'react-router'
import { GazeRecorder } from './components/GazeRecorder'
import { Calibration } from './components/Calibration'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GazeRecorder />} />
        <Route path="/calibration" element={<Calibration />} />
      </Routes>
    </HashRouter>
  )
}

export default App
