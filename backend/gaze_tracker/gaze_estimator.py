import os
import cv2
import numpy as np
import base64
import requests
from dotenv import load_dotenv
from typing import Dict, Any, Tuple

class RoboflowGazeEstimator:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("ROBOFLOW_API_KEY")
        if not self.api_key:
            raise ValueError("ROBOFLOW_API_KEY not found")
        self.base_url = "http://127.0.0.1:9001"

    def process_frame(self, frame: np.ndarray) -> Tuple[Dict[str, Any], np.ndarray]:
        # Convert frame to base64
        _, buffer = cv2.imencode('.jpg', frame)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        # Get gaze prediction
        gaze = self._detect_gaze(img_base64)
        vector = self._gaze_to_vector(gaze)

        return gaze, vector

    def _detect_gaze(self, img_base64: str) -> Dict[str, Any]:
        """
        Example response:
        {
            'face': {
                'x': 657.5,
                'y': 418.5,
                'width': 231.0,
                'height': 231.0,
                'confidence': 0.943250834941864,
                'class': 'face',
                'landmarks': [...],
                ...
            },
            'yaw': -0.21625082194805145,
            'pitch': 0.11126314848661423
        }
        """
        response = requests.post(
            f"{self.base_url}/gaze/gaze_detection",
            json={
                "api_key": self.api_key,
                "image": {"type": "base64", "value": img_base64}
            }
        )
        response.raise_for_status()
        return response.json()[0]["predictions"][0]

    def _gaze_to_vector(self, gaze: Dict[str, float]) -> np.ndarray:
        yaw = gaze["yaw"]
        pitch = gaze["pitch"]
        return np.array([
            -np.sin(yaw) * np.cos(pitch),
            -np.sin(pitch),
            -np.cos(yaw) * np.cos(pitch)
        ])
