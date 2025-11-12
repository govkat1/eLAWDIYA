// ML Configuration Constants
export const ML_CONFIG = {
  // Model Configuration
  MODEL_PATH: process.env.NEXT_PUBLIC_MODEL_PATH || '/models/yolov8n.onnx',
  CONFIDENCE_THRESHOLD: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5'),
  NMS_IOU_THRESHOLD: 0.45, // Non-Maximum Suppression threshold

  // Detection Classes (we only support car and bike)
  DETECTION_CLASSES: {
    0: 'car',
    1: 'bike'
  } as const,

  CLASS_NAMES: ['car', 'bike'],
  CLASS_COLORS: {
    car: '#FF6B6B', // Red
    bike: '#4ECDC4'  // Teal
  },

  // Image Processing
  MAX_IMAGE_WIDTH: 1920,
  MAX_IMAGE_HEIGHT: 1080,
  IMAGE_QUALITY: 0.8,

  // Model Input Configuration
  MODEL_INPUT_SIZE: 640,
  MODEL_CHANNELS: 3,

  // File Upload Configuration
  MAX_UPLOAD_SIZE: parseInt(process.env.MAX_UPLOAD_SIZE || '52428800'), // 50MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],

  // Performance Settings
  INFERENCE_TIMEOUT: 30000, // 30 seconds
  MODEL_LOAD_TIMEOUT: 60000, // 60 seconds

  // Debug Settings
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  LOG_INFERENCE_TIME: true
};

// Detection result interface
export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  className: string;
  classId: number;
  color?: string;
}

// Report submission interface
export interface ReportData {
  image: Blob;
  detections: DetectionBox[];
  latitude: number;
  longitude: number;
  locationAddress?: string;
  description?: string;
  capturedAt: Date;
  deviceInfo?: string;
}

// Error messages
export const ML_ERRORS = {
  MODEL_NOT_LOADED: 'Model not initialized. Please try again.',
  INFERENCE_FAILED: 'Vehicle detection failed. Please try again.',
  CAMERA_ACCESS_DENIED: 'Camera access denied. Please allow camera permissions.',
  GPS_ACCESS_DENIED: 'Location access denied. Please enable location services.',
  INVALID_IMAGE: 'Invalid image format. Please try again.',
  MODEL_LOAD_TIMEOUT: 'Model loading timeout. Please refresh and try again.',
  INFERENCE_TIMEOUT: 'Detection timeout. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.'
};

// Success messages
export const ML_SUCCESS_MESSAGES = {
  VEHICLE_DETECTED: 'Vehicle detected successfully!',
  NO_VEHICLE_DETECTED: 'No vehicles detected in the image.',
  MODEL_LOADED: 'Model loaded successfully.',
  REPORT_SUBMITTED: 'Report submitted successfully!'
};