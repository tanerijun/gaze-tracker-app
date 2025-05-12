import argparse
from pathlib import Path
import zipfile
import tempfile
import os
import sys
sys.path.append(str(Path(__file__).parent.parent))
from gaze_tracker.data_processor import process_calibration_data


def main():
    parser = argparse.ArgumentParser(description='Process calibration recording')
    parser.add_argument('zip_path', help='Path to calibration zip file')
    parser.add_argument('--output', '-o', help='Output directory', default='processed_data')
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    with tempfile.TemporaryDirectory() as temp_dir:
        with zipfile.ZipFile(args.zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        csv_path = process_calibration_data(
            video_path=os.path.join(temp_dir, "webcam-recording.webm"),
            calibration_data_path=os.path.join(temp_dir, "calibration-data.json"),
            output_dir=args.output
        )

        print(f"Dataset saved to: {csv_path}")

if __name__ == "__main__":
    main()
