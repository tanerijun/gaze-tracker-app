from sklearn.linear_model import LinearRegression
import pandas as pd
import numpy as np
from pathlib import Path
import joblib
from typing import Tuple

class GazeMapper:
    def __init__(self):
        self.model_x = LinearRegression()
        self.model_y = LinearRegression()

    def train(self, dataset_path: str) -> Tuple[float, float]:
        """
        Train the mapping model using calibration dataset.

        Args:
            dataset_path: Path to calibration_dataset.csv

        Returns:
            Tuple[float, float]: R² scores for x and y predictions
        """
        # Load dataset
        df = pd.read_csv(dataset_path)

        # Prepare features (gaze vectors) and labels (screen coordinates)
        X = df[['gaze_x', 'gaze_y', 'gaze_z']].values
        y = df[['point_x', 'point_y']].values

        y_x = df['point_x'].values
        y_y = df['point_y'].values

        self.model_x.fit(X, y_x)
        self.model_y.fit(X, y_y)

        # Return R² scores
        return (
            float(self.model_x.score(X, y_x)),
            float(self.model_y.score(X, y_y))
        )

    def predict(self, gaze_vector: np.ndarray) -> np.ndarray:
            """
            Predict screen coordinates from gaze vector.

            Args:
                gaze_vector: 3D gaze vector [x, y, z]

            Returns:
                np.ndarray: Predicted screen coordinates [x, y]
            """
            X = gaze_vector.reshape(1, -1)
            return np.array([
                self.model_x.predict(X)[0],
                self.model_y.predict(X)[0]
            ])

    def save(self, path: str) -> None:
        """Save the trained models."""
        joblib.dump((self.model_x, self.model_y), path)

    @classmethod
    def load(cls, path: str) -> 'GazeMapper':
        """Load trained models."""
        mapper = cls()
        mapper.model_x, mapper.model_y = joblib.load(path)
        return mapper
