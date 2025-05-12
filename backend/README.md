# Gaze Tracker App Backend

uv run scripts/process_calibration.py ../temp/calibration-2025-05-11T15-21-16-503Z.zip
uv run scripts/train_mapper.py processed_data/calibration_dataset.csv -o processed_data/mapper_model.joblib
uv run scripts/process_recording.py ../temp/recordings-2025-05-11T15-22-50-101Z.zip ../temp/calibration-2025-05-11T15-21-16-503Z.zip processed_data/mapper_model.joblib -o processed_data/gaze_heatmap.webm
