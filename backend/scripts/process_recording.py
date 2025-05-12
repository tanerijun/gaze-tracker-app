import argparse
import zipfile
import tempfile
import os
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from gaze_tracker.video_processor import GazeVideoProcessor

def main():
    parser = argparse.ArgumentParser(description='Process gaze recording')
    parser.add_argument('zip_path', help='Path to recording zip file')
    parser.add_argument('calibration_zip', help='Path to calibration zip file')
    parser.add_argument('mapper_path', help='Path to trained mapper model')
    parser.add_argument('--output', '-o', help='Output video path', default='gaze_heatmap.webm')
    parser.add_argument('--sigma', type=float, default=50, help='Heatmap blur sigma')
    parser.add_argument('--alpha', type=float, default=0.6, help='Heatmap opacity')
    args = parser.parse_args()

    # Extract zip to temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        with zipfile.ZipFile(args.zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        calib_temp = os.path.join(temp_dir, 'calibration')
        os.makedirs(calib_temp)
        with zipfile.ZipFile(args.calibration_zip, 'r') as zip_ref:
            zip_ref.extractall(calib_temp)

        processor = GazeVideoProcessor(args.mapper_path)
        processor.process_videos(
            webcam_path=os.path.join(temp_dir, "webcam-recording.webm"),
            screen_path=os.path.join(temp_dir, "screen-recording.webm"),
            calibration_data_path=os.path.join(calib_temp, "calibration-data.json"),
            output_path=args.output,
            heatmap_sigma=args.sigma,
            alpha=args.alpha,
            save_interval=30
        )

        print(f"Processed video saved to: {args.output}")

if __name__ == "__main__":
    main()
