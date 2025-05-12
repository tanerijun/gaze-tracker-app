import cv2
import numpy as np
from pathlib import Path
import os
import json
from datetime import datetime
from .gaze_estimator import RoboflowGazeEstimator
from .mapper import GazeMapper

class GazeVideoProcessor:
    def __init__(self, mapper_path: str):
        self.gaze_estimator = RoboflowGazeEstimator()
        self.mapper = GazeMapper.load(mapper_path)

    def save_debug_frame(self,
                        frame: np.ndarray,
                        frame_num: int,
                        debug_dir: str,
                        data: dict,
                        prefix: str = "") -> None:
        """Save a frame with debug information overlaid."""
        debug_frame = frame.copy()

        # Add text with debug info
        y_offset = 30
        for key, value in data.items():
            text = f"{key}: {value}"
            cv2.putText(debug_frame, text, (10, y_offset),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y_offset += 30

        # Save frame
        filename = f"{prefix}frame_{frame_num:04d}.jpg"
        cv2.imwrite(os.path.join(debug_dir, filename), debug_frame)

    def process_videos(
        self,
        webcam_path: str,
        screen_path: str,
        calibration_data_path: str,
        output_path: str,
        heatmap_sigma: float = 50,
        alpha: float = 0.6,
        debug: bool = False,
        save_interval: int = 30,
        debug_dir: str = "debug_frames",
    ) -> None:
        """
        Process webcam and screen recording to create gaze heatmap video.

        Args:
            webcam_path: Path to webcam recording
            screen_path: Path to screen recording
            output_path: Path for output video
            heatmap_sigma: Gaussian blur sigma for heatmap
            alpha: Heatmap overlay opacity
        """

        if debug:
            os.makedirs(debug_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            debug_dir = os.path.join(debug_dir, timestamp)
            os.makedirs(debug_dir, exist_ok=True)

        with open(calibration_data_path) as f:
            calib_data = json.load(f)

        target_width = calib_data['screenSize']['width']
        target_height = calib_data['screenSize']['height']

        webcam = cv2.VideoCapture(webcam_path)
        screen = cv2.VideoCapture(screen_path)

        # Get video properties
        frame_width = int(screen.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(screen.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(screen.get(cv2.CAP_PROP_FPS))

        if debug:
            print(f"Screen dimensions: {frame_width}x{frame_height}")
            print(f"FPS: {fps}")

        scale_x = frame_width / target_width
        scale_y = frame_height / target_height

        if debug:
            print(f"Scaling factors: x={scale_x:.3f}, y={scale_y:.3f}")

        # Setup output video
        fourcc = cv2.VideoWriter.fourcc(*'VP90')
        out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

        # Initialize heatmap
        heatmap = np.zeros((frame_height, frame_width), dtype=np.float32)
        frame_count = 0

        while True:
            ret_webcam, webcam_frame = webcam.read()
            ret_screen, screen_frame = screen.read()

            if not ret_webcam or not ret_screen:
                break

            try:
                # Get gaze vector
                gaze_result, gaze_vector = self.gaze_estimator.process_frame(webcam_frame)

                # Map to screen coordinates
                screen_coords = self.mapper.predict(gaze_vector)
                x, y = int(screen_coords[0] * scale_x), int(screen_coords[1] * scale_y)

                if debug and frame_count % save_interval == 0:
                    webcam_debug = {
                        "gaze_vector": [f"{v:.3f}" for v in gaze_vector],
                        "yaw": f"{gaze_result['yaw']:.3f}",
                        "pitch": f"{gaze_result['pitch']:.3f}"
                    }
                    self.save_debug_frame(webcam_frame, frame_count, debug_dir,
                                        webcam_debug, "webcam_")

                    # Save screen frame with mapped coordinates
                    screen_debug = {
                        "mapped_coords": f"({x}, {y})",
                        "screen_size": f"{frame_width}x{frame_height}"
                    }
                    # Draw gaze point
                    debug_screen = screen_frame.copy()
                    cv2.circle(debug_screen, (x, y), 10, (0, 0, 255), -1)
                    self.save_debug_frame(debug_screen, frame_count, debug_dir,
                                        screen_debug, "screen_")

                # Update heatmap
                if 0 <= x < frame_width and 0 <= y < frame_height:
                    heatmap[y, x] += 1

                    # Save heatmap periodically
                    if debug and frame_count % save_interval == 0:
                        normalized = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX) # type: ignore
                        heatmap_colored = cv2.applyColorMap(
                            normalized.astype(np.uint8),
                            cv2.COLORMAP_JET
                        )
                        cv2.imwrite(
                            os.path.join(debug_dir, f"heatmap_{frame_count:04d}.jpg"),
                            heatmap_colored
                        )
                else:
                    if debug and frame_count % 30 == 0:
                        print(f"Warning: Coordinates ({x}, {y}) out of bounds")

                # Apply Gaussian blur
                blurred = cv2.GaussianBlur(heatmap, (0, 0), heatmap_sigma)

                # Normalize heatmap
                normalized = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX) # type: ignore
                heatmap_colored = cv2.applyColorMap(normalized.astype(np.uint8), cv2.COLORMAP_JET)

                if debug:
                    cv2.circle(screen_frame, (x, y), 10, (0, 0, 255), -1)

                # Overlay heatmap on screen recording
                overlay = cv2.addWeighted(screen_frame, 1-alpha, heatmap_colored, alpha, 0)

                # Write frame
                out.write(overlay)

            except Exception as e:
                print(f"Error processing frame: {e}")
                # Write original frame if processing fails
                out.write(screen_frame)

            frame_count += 1

        # Cleanup
        webcam.release()
        screen.release()
        out.release()

        if debug:
            print("\nProcessing completed:")
            print(f"Total frames processed: {frame_count}")
            print(f"Heatmap stats:")
            print(f"  Min value: {np.min(heatmap)}")
            print(f"  Max value: {np.max(heatmap)}")
            print(f"  Mean value: {np.mean(heatmap)}")
            print(f"  Non-zero points: {np.count_nonzero(heatmap)}")
