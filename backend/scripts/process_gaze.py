import argparse
import tempfile
import zipfile
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from gaze_tracker.mapper import GazeMapper
from gaze_tracker.tracker import GazeTracker

def process_gaze_data(
    recording_zip: str,
    calibration_zip: str,
    output_path: str,
    heatmap_sigma: float = 25,
    heatmap_alpha: float = 0.4
) -> None:
    """
    End-to-end gaze data processing pipeline.

    Args:
        recording_zip: Path to recording session zip file
        calibration_zip: Path to calibration session zip file
        output_path: Path for output heatmap video
        heatmap_sigma: Gaussian blur sigma for heatmap
        heatmap_alpha: Opacity of heatmap overlay
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        with zipfile.ZipFile(calibration_zip, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        mapper = GazeMapper()

        print("Processing calibration data...")
        mapper.load_calibration_data(
            video_path=f"{temp_dir}/webcam-recording.webm",
            calibration_data_path=f"{temp_dir}/calibration-data.json",
        )

        print("Training gaze mapper...")
        r2_x, r2_y = mapper.train()
        print(f"Mapper training complete - R² scores: x={r2_x:.4f}, y={r2_y:.4f}")

        print("Generating gaze heatmap video...")
        with zipfile.ZipFile(recording_zip, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        gaze_tracker = GazeTracker(mapper)
        gaze_tracker.process_videos(
            webcam_path=f"{temp_dir}/webcam-recording.webm",
            screen_path=f"{temp_dir}/screen-recording.webm",
            output_path=output_path,
            heatmap_sigma=heatmap_sigma,
            alpha=heatmap_alpha
        )

    print(f"\nProcessing complete! Heatmap video saved to: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Process gaze tracking data end-to-end")
    parser.add_argument("recording_zip", help="Path to recording session zip file")
    parser.add_argument("calibration_zip", help="Path to calibration session zip file")
    parser.add_argument("--output", "-o", default="gaze_heatmap.mp4", help="Output video path")
    parser.add_argument("--heatmap-sigma", type=float, default=25, help="Heatmap blur sigma")
    parser.add_argument("--heatmap-alpha", type=float, default=0.4, help="Heatmap opacity")

    args = parser.parse_args()

    process_gaze_data(
        args.recording_zip,
        args.calibration_zip,
        args.output,
        args.heatmap_sigma,
        args.heatmap_alpha
    )

if __name__ == "__main__":
    main()
