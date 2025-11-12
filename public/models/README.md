# YOLOv8 Model Setup

## Required File

You need to download the YOLOv8n (nano) ONNX model file and place it in this directory as `yolov8n.onnx`.

## How to Get the Model

### Option 1: Export from Python (Recommended)

1. Install required Python packages:
```bash
pip install ultralytics onnx onnxruntime
```

2. Export YOLOv8n to ONNX format:
```python
from ultralytics import YOLO

# Load the pretrained YOLOv8n model
model = YOLO('yolov8n.pt')

# Export to ONNX format (opset=12 for browser compatibility)
model.export(format='onnx', opset=12, imgsz=640)

# The output file will be 'yolov8n.onnx'
```

3. Move the generated file to this directory:
```bash
mv yolov8n.onnx public/models/
```

### Option 2: Download Pre-trained Model

You can download pre-converted ONNX models from:
- https://github.com/ultralytics/ultralytics/releases
- https://onnxzoo.github.io/

Make sure to get the YOLOv8n (nano) version for best browser performance.

## Model Information

- **File**: `yolov8n.onnx`
- **Size**: ~27MB
- **Input**: 640x640 RGB image
- **Output**: Bounding boxes with confidence scores
- **Classes**: Only 'car' and 'bike' (filtered from COCO dataset)
- **Performance**: ~50+ FPS on modern devices

## Browser Compatibility

The ONNX Runtime Web supports:
- Chrome 84+
- Firefox 90+
- Safari 14+
- Edge 84+

The model uses WebAssembly (WASM) backend for optimal performance.

## Troubleshooting

### Model Won't Load

1. **Check file path**: Ensure `yolov8n.onnx` exists in `public/models/`
2. **File size**: Verify the file is ~27MB (not empty or corrupted)
3. **CORS**: If hosting on CDN, ensure proper CORS headers are set
4. **Browser console**: Check for WASM or loading errors

### Performance Issues

1. **Use smaller model**: YOLOv8n is optimized for browser inference
2. **Reduce input size**: Current setting is 640x640 (can be reduced to 416x416)
3. **Increase confidence threshold**: Filter out low-confidence detections
4. **Apply NMS**: Remove overlapping detections (implemented)

## Model Customization

If you want to train a custom model for specific vehicle types:

1. Collect training data
2. Fine-tune YOLOv8 on your dataset
3. Export to ONNX format
4. Update `CLASS_NAMES` in `lib/ml/yoloInference.ts`
5. Retest detection accuracy

## Security Notes

- The model file is publicly accessible
- Consider adding integrity checks
- Model should be served over HTTPS in production
- Consider using Service Workers for caching the model