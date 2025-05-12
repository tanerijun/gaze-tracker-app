import argparse
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from gaze_tracker.mapper import GazeMapper

def main():
    parser = argparse.ArgumentParser(description='Train gaze mapping model')
    parser.add_argument('dataset', help='Path to calibration_dataset.csv')
    parser.add_argument('--output', '-o', help='Output model path', default='mapper_model.joblib')
    args = parser.parse_args()

    mapper = GazeMapper()
    r2_x, r2_y = mapper.train(args.dataset)

    print(f"Training completed:")
    print(f"R² score (x coordinate): {r2_x:.4f}")
    print(f"R² score (y coordinate): {r2_y:.4f}")

    mapper.save(args.output)
    print(f"Model saved to: {args.output}")

if __name__ == "__main__":
    main()
