import { NavLink } from 'react-router'

export function Nav(): React.JSX.Element {
  return (
    <div className="p-4 bg-base-200 rounded-md">
      <NavLink className="transition-colors hover:underline" to="/">
        Gaze Recorder
      </NavLink>
      <span className="mx-2">|</span>
      <NavLink className="transition-colors hover:underline" to="/calibration">
        Calibration
      </NavLink>
    </div>
  )
}
