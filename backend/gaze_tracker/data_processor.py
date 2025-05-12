import cv2
import json
import os
import pandas as pd
from pathlib import Path
from typing import List, Dict
from .gaze_estimator import RoboflowGazeEstimator

def process_calibration_data(
    video_path: str,
    calibration_data_path: str,
    output_dir: str,
    frame_window: int = 5
):
    """
    Extract frames around each calibration point click.

    Args:
        video_path: Path to webcam recording
        calibration_data_path: Path to calibration JSON data
        output_dir: Where to save extracted frames
        frame_window: Number of frames to extract before/after click
    """
    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS)
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

    with open(calibration_data_path) as f:
        calib_data = json.load(f)

    os.makedirs(output_dir, exist_ok=True)

    dataset = []
    gaze_estimator = RoboflowGazeEstimator()

    for point in calib_data['points']:
        timestamp_sec = point['timestamp'] / 1000.0
        click_frame = int(timestamp_sec * fps)

        # Calculate frame range
        start_frame = max(0, click_frame - frame_window)
        end_frame = min(frame_count - 1, click_frame + frame_window)

        video.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        for frame_idx in range(start_frame, end_frame + 1):
            ret, frame = video.read()
            if not ret:
                break

            _, gaze_vector = gaze_estimator.process_frame(frame)

            dataset.append({
                'frame': frame_idx,
                'point_x': point['x'],
                'point_y': point['y'],
                'gaze_x': gaze_vector[0],
                'gaze_y': gaze_vector[1],
                'gaze_z': gaze_vector[2]
            })

    video.release()

    df = pd.DataFrame(dataset)
    csv_path = os.path.join(output_dir, 'calibration_dataset.csv')
    df.to_csv(csv_path, index=False)

    return csv_path
