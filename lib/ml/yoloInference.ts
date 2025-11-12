import * as ort from 'onnxruntime-web';

const MODEL_PATH = process.env.NEXT_PUBLIC_MODEL_PATH || '/models/yolov8n.onnx';
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5');

// Only car and bike detection classes
const CLASS_NAMES = ['car', 'bike'];

let session: ort.InferenceSession | null = null;

export interface DetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  className: string;
  classId: number;
}

// Initialize ONNX session
export async function initializeModel(): Promise<boolean> {
  try {
    // Create ONNX inference session with WASM backend
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    console.log('YOLOv8 model loaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to load YOLOv8 model:', error);
    return false;
  }
}

// Preprocess image for YOLOv8
function preprocessImage(canvas: HTMLCanvasElement): {
  tensor: ort.Tensor;
  scale: number;
  originalWidth: number;
  originalHeight: number;
} {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // YOLOv8 input size
  const targetSize = 640;
  const scale = Math.max(canvas.width, canvas.height) / targetSize;

  // Calculate padding
  const scaledWidth = Math.floor(canvas.width / scale);
  const scaledHeight = Math.floor(canvas.height / scale);
  const padX = (targetSize - scaledWidth) / 2;
  const padY = (targetSize - scaledHeight) / 2;

  // Create tensor data
  const data = new Float32Array(3 * targetSize * targetSize);

  // Fill with padding (black)
  data.fill(0);

  // Process image data
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      // Corresponding coordinates in original image
      const srcX = Math.floor(x * scale);
      const srcY = Math.floor(y * scale);
      const srcIdx = (srcY * canvas.width + srcX) * 4;

      // Target coordinates in tensor
      const dstX = Math.floor(x + padX);
      const dstY = Math.floor(y + padY);
      const dstIdx = (dstY * targetSize + dstX) * 3;

      // Normalize pixel values and convert RGB to tensor format
      data[dstIdx] = imageData.data[srcIdx] / 255.0; // R
      data[dstIdx + 1] = imageData.data[srcIdx + 1] / 255.0; // G
      data[dstIdx + 2] = imageData.data[srcIdx + 2] / 255.0; // B
    }
  }

  const tensor = new ort.Tensor('float32', data, [1, 3, targetSize, targetSize]);

  return {
    tensor,
    scale,
    originalWidth: canvas.width,
    originalHeight: canvas.height
  };
}

// Process YOLOv8 output to get detections
function processYOLOOutput(
  output: Float32Array,
  scale: number,
  originalWidth: number,
  originalHeight: number
): DetectionResult[] {
  const detections: DetectionResult[] = [];

  // YOLOv8 output format: [batch, 84, 8400] where 84 = 4 bbox + 80 classes
  // For our 2-class model, it should be [batch, 6, 8400] where 6 = 4 bbox + 2 classes
  const numClasses = CLASS_NAMES.length;
  const numDetections = output.length / (4 + numClasses);

  for (let i = 0; i < numDetections; i++) {
    const baseIdx = i * (4 + numClasses);

    // Extract bounding box (center_x, center_y, width, height)
    const centerX = output[baseIdx] * scale;
    const centerY = output[baseIdx + 1] * scale;
    const width = output[baseIdx + 2] * scale;
    const height = output[baseIdx + 3] * scale;

    // Find class with highest confidence
    let maxConfidence = 0;
    let classId = -1;

    for (let j = 0; j < numClasses; j++) {
      const confidence = output[baseIdx + 4 + j];
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        classId = j;
      }
    }

    // Apply confidence threshold
    if (maxConfidence > CONFIDENCE_THRESHOLD && classId < CLASS_NAMES.length) {
      // Convert center format to top-left format
      const x = centerX - width / 2;
      const y = centerY - height / 2;

      // Ensure bounding box is within image bounds
      const clampedX = Math.max(0, Math.min(x, originalWidth - width));
      const clampedY = Math.max(0, Math.min(y, originalHeight - height));
      const clampedWidth = Math.min(width, originalWidth - clampedX);
      const clampedHeight = Math.min(height, originalHeight - clampedY);

      // Only add if bounding box has valid dimensions
      if (clampedWidth > 10 && clampedHeight > 10) {
        detections.push({
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          height: clampedHeight,
          confidence: maxConfidence,
          className: CLASS_NAMES[classId],
          classId
        });
      }
    }
  }

  return detections;
}

// Apply Non-Maximum Suppression to remove overlapping detections
function applyNMS(detections: DetectionResult[], iouThreshold: number = 0.45): DetectionResult[] {
  // Sort by confidence (highest first)
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const selected: DetectionResult[] = [];

  while (sorted.length > 0) {
    // Select the detection with highest confidence
    const best = sorted.shift()!;
    selected.push(best);

    // Remove remaining detections that overlap significantly
    const remaining: DetectionResult[] = [];
    for (const detection of sorted) {
      const iou = calculateIoU(best, detection);
      if (iou < iouThreshold) {
        remaining.push(detection);
      }
    }
    sorted.splice(0, sorted.length, ...remaining);
  }

  return selected;
}

// Calculate Intersection over Union (IoU) between two bounding boxes
function calculateIoU(box1: DetectionResult, box2: DetectionResult): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return intersection / union;
}

// Main function to detect vehicles in an image
export async function detectVehicles(canvas: HTMLCanvasElement): Promise<DetectionResult[]> {
  if (!session) {
    throw new Error('YOLO model not initialized. Call initializeModel() first.');
  }

  try {
    // Preprocess image
    const { tensor, scale, originalWidth, originalHeight } = preprocessImage(canvas);

    // Run inference
    const results = await session.run({
      'images': tensor
    });

    // Get output tensor (YOLOv8 typically outputs 'output0')
    const outputName = Object.keys(results)[0];
    if (!outputName) {
      throw new Error('No output tensor found from model inference');
    }

    const outputTensor = results[outputName] as ort.Tensor;
    const outputData = await outputTensor.getData() as Float32Array;

    // Process output to get raw detections
    const rawDetections = processYOLOOutput(outputData, scale, originalWidth, originalHeight);

    // Apply Non-Maximum Suppression
    const finalDetections = applyNMS(rawDetections);

    // Clean up tensor memory
    tensor.dispose();
    outputTensor.dispose();

    return finalDetections;

  } catch (error) {
    console.error('Error during vehicle detection:', error);
    throw new Error(`Vehicle detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check if model is loaded
export function isModelLoaded(): boolean {
  return session !== null;
}

// Get model information
export function getModelInfo() {
  return {
    modelPath: MODEL_PATH,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    classes: CLASS_NAMES,
    isLoaded: isModelLoaded()
  };
}

// Helper function to convert canvas to blob with optimization
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number = 0.8,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<Blob> {
  // Create a temporary canvas for resizing
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;

  // Calculate new dimensions
  let width = canvas.width;
  let height = canvas.height;

  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;
    if (width > height) {
      width = maxWidth;
      height = Math.floor(width / aspectRatio);
    } else {
      height = maxHeight;
      width = Math.floor(height * aspectRatio);
    }
  }

  tempCanvas.width = width;
  tempCanvas.height = height;

  // Draw and resize image
  tempCtx.drawImage(canvas, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    tempCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/jpeg', quality);
  });
}