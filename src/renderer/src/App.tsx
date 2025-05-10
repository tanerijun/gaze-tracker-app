import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { GazeRecorder } from './components/GazeRecorder'
import { Calibration } from './components/Calibration'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="container mx-auto p-4">
        <NavLink to="/">Gaze Recorder</NavLink>
        <span className="mx-2">|</span>
        <NavLink to="/calibration">Calibration</NavLink>
      </div>
      <Routes>
        <Route path="/" element={<GazeRecorder />} />
        <Route path="/calibration" element={<Calibration />} />
      </Routes>
    </HashRouter>
  )
}

export default App
