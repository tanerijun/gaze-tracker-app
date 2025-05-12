import pandas as pd
import matplotlib.pyplot as plt
import argparse

def analyze_calibration(csv_path):
    df = pd.read_csv(csv_path)

    print("Calibration Data Stats:")
    print("\nGaze Vector Range:")
    print(f"gaze_x: {df['gaze_x'].min():.3f} to {df['gaze_x'].max():.3f}")
    print(f"gaze_y: {df['gaze_y'].min():.3f} to {df['gaze_y'].max():.3f}")
    print(f"gaze_z: {df['gaze_z'].min():.3f} to {df['gaze_z'].max():.3f}")

    print("\nScreen Coordinates Range:")
    print(f"point_x: {df['point_x'].min():.0f} to {df['point_x'].max():.0f}")
    print(f"point_y: {df['point_y'].min():.0f} to {df['point_y'].max():.0f}")

    # Plot calibration points
    plt.figure(figsize=(10, 6))
    plt.scatter(df['point_x'], df['point_y'], alpha=0.5)
    plt.title('Calibration Points')
    plt.xlabel('Screen X')
    plt.ylabel('Screen Y')
    plt.savefig('calibration_points.png')
    plt.close()

    # Plot gaze vectors
    plt.figure(figsize=(10, 6))
    plt.scatter(df['gaze_x'], df['gaze_y'], alpha=0.5)
    plt.title('Gaze Vectors (X-Y Projection)')
    plt.xlabel('Gaze X')
    plt.ylabel('Gaze Y')
    plt.savefig('gaze_vectors.png')
    plt.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_path', help='Path to calibration dataset CSV')
    args = parser.parse_args()

    analyze_calibration(args.csv_path)
