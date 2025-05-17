import cv2
import numpy as np
from pathlib import Path
import os
import json
from datetime import datetime
from .gaze_estimator import RoboflowGazeEstimator
from .mapper import GazeMapper

class GazeTracker:
    """
    GazeTracker processes webcam and screen recordings to generate a heatmap video of gaze data.
    """
    def __init__(self, mapper: GazeMapper):
        self.gaze_estimator = RoboflowGazeEstimator()
        self.mapper = mapper

    def process_videos(
        self,
        webcam_path: str,
        screen_path: str,
        output_path: str,
        heatmap_sigma: float = 40,
        alpha: float = 0.5,
    ) -> None:
        if self.mapper.screen_size is None:
            raise ValueError("Screen size must be set in the mapper before processing videos.")

        target_width = self.mapper.screen_size["width"]
        target_height = self.mapper.screen_size["height"]

        webcam = cv2.VideoCapture(webcam_path)
        screen = cv2.VideoCapture(screen_path)

        frame_width = int(screen.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(screen.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(screen.get(cv2.CAP_PROP_FPS))
        fpsWebcam = int(webcam.get(cv2.CAP_PROP_FPS))
        scale_x = frame_width / target_width
        scale_y = frame_height / target_height

        print(f"Screen dimensions: {frame_width}x{frame_height}")
        print(f"FPS: {fps}, {fpsWebcam}")
        print(f"Scaling factors: x={scale_x:.3f}, y={scale_y:.3f}")

        fourcc = cv2.VideoWriter.fourcc(*'VP90')
        out = cv2.VideoWriter(output_path, fourcc, max(fps, fpsWebcam), (frame_width, frame_height))

        heatmap = np.zeros((frame_height, frame_width), dtype=np.float32)
        frame_count = 0

        webcam_frames = int(webcam.get(cv2.CAP_PROP_FRAME_COUNT))
        screen_frames = int(screen.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Webcam frames: {webcam_frames}, Screen frames: {screen_frames}")
        print(f"Webcam duration: {webcam_frames/fpsWebcam:.2f}s, Screen duration: {screen_frames/fps:.2f}s")

        while True:
            ret_webcam, webcam_frame = webcam.read()
            ret_screen, screen_frame = screen.read()

            if not ret_webcam or not ret_screen:
                if not ret_webcam:
                    print(f"Webcam stream ended at frame {frame_count}")
                if not ret_screen:
                    print(f"Screen stream ended at frame {frame_count}")
                print(f"Stopping processing - one stream has ended")
                break

            try:
                gaze_result, gaze_vector = self.gaze_estimator.process_frame(webcam_frame)

                screen_coords = self.mapper.predict(gaze_vector)
                x, y = int(screen_coords[0] * scale_x), int(screen_coords[1] * scale_y)

                if 0 <= x < frame_width and 0 <= y < frame_height:
                    heatmap[y, x] += 1

                blurred = cv2.GaussianBlur(heatmap, (0, 0), heatmap_sigma)
                normalized = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX) # type: ignore
                heatmap_colored = cv2.applyColorMap(normalized.astype(np.uint8), cv2.COLORMAP_JET)

                cv2.circle(screen_frame, (x, y), 10, (0, 0, 255), -1)

                overlay = cv2.addWeighted(screen_frame, 1-alpha, heatmap_colored, alpha, 0)

                out.write(overlay)

            except Exception as e:
                print(f"Error processing frame: {e}")
                # Write original frame if processing fails
                out.write(screen_frame)

            frame_count += 1

            if frame_count % 10 == 0:
                print(f"Processed {frame_count}/{min(webcam_frames, screen_frames)} frames")

        webcam.release()
        screen.release()
        out.release()
