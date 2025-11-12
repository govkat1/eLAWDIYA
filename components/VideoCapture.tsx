'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DetectionResult } from '@/lib/ml/yoloInference';
import { ML_CONFIG, ML_ERRORS, ML_SUCCESS_MESSAGES } from '@/lib/ml/constants';

interface VideoCaptureProps {
  onDetectionComplete: (results: DetectionResult[], imageData: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function VideoCapture({ onDetectionComplete, onError, disabled = false }: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Initialize camera and get location permissions
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Check camera permissions
        const cameraPermissionResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(cameraPermissionResult.state as 'prompt' | 'granted' | 'denied');

        // Check location permissions
        if ('geolocation' in navigator) {
          const locationPermissionResult = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          setLocationPermission(locationPermissionResult.state as 'prompt' | 'granted' | 'denied');
        }

        // Get GPS location
        await getCurrentLocation();

        // Start camera stream
        await startCamera();

        setIsLoading(false);
      } catch (error) {
        console.error('Initialization error:', error);
        onError(ML_ERRORS.CAMERA_ACCESS_DENIED);
        setIsLoading(false);
      }
    };

    initializeCamera();

    // Cleanup function
    return () => {
      stopCamera();
    };
  }, []);

  // Get current GPS location
  const getCurrentLocation = useCallback(() => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error(ML_ERRORS.GPS_ACCESS_DENIED));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setGpsLocation(location);
          resolve(location);
        },
        (error) => {
          console.error('GPS error:', error);
          setLocationPermission('denied');
          reject(new Error(ML_ERRORS.GPS_ACCESS_DENIED));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
    });
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment', // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setCameraPermission('granted');
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraPermission('denied');
      throw new Error(ML_ERRORS.CAMERA_ACCESS_DENIED);
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, []);

  // Capture frame from video
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error('Video or canvas not available');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
  }, []);

  // Handle capture and detection
  const handleCapture = useCallback(async () => {
    if (disabled || !cameraActive || isDetecting) return;

    try {
      setIsDetecting(true);

      // Capture frame
      const canvas = captureFrame();

      // Get image data for display
      const imageData = canvas.toDataURL('image/jpeg', ML_CONFIG.IMAGE_QUALITY);

      // Reset GPS location if needed
      let location = gpsLocation;
      if (!location && locationPermission !== 'denied') {
        try {
          location = await getCurrentLocation();
        } catch (error) {
          console.warn('Failed to get GPS location:', error);
        }
      }

      // Store additional metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        location: location,
        deviceInfo: navigator.userAgent,
        canvasSize: {
          width: canvas.width,
          height: canvas.height
        }
      };

      // Store metadata in canvas for later use
      (canvas as any).__metadata = metadata;

      // Trigger detection (this will be handled by parent component)
      onDetectionComplete([], imageData);

    } catch (error) {
      console.error('Capture error:', error);
      onError(error instanceof Error ? error.message : ML_ERRORS.INVALID_IMAGE);
    } finally {
      setIsDetecting(false);
    }
  }, [disabled, cameraActive, isDetecting, gpsLocation, locationPermission, captureFrame, onDetectionComplete, onError]);

  // Request camera permission
  const requestCameraPermission = useCallback(async () => {
    try {
      await startCamera();
    } catch (error) {
      onError(ML_ERRORS.CAMERA_ACCESS_DENIED);
    }
  }, [startCamera, onError]);

  // Request location permission
  const requestLocationPermission = useCallback(async () => {
    try {
      await getCurrentLocation();
    } catch (error) {
      onError(ML_ERRORS.GPS_ACCESS_DENIED);
    }
  }, [getCurrentLocation, onError]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Initializing camera and location services...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-lg">
      {/* Video Display */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto max-h-[480px] object-cover"
          style={{ display: cameraActive ? 'block' : 'none' }}
        />

        {!cameraActive && (
          <div className="flex flex-col items-center justify-center p-8 min-h-[300px] bg-gray-900">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-center mb-4">Camera access required</p>
            {cameraPermission === 'denied' ? (
              <p className="text-red-400 text-sm">Camera permission denied. Please enable in browser settings.</p>
            ) : (
              <button
                onClick={requestCameraPermission}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Enable Camera
              </button>
            )}
          </div>
        )}

        {/* Hidden canvas for image capture */}
        <canvas
          ref={canvasRef}
          className="hidden"
          width={640}
          height={480}
        />
      </div>

      {/* Capture Button */}
      <button
        onClick={handleCapture}
        disabled={!cameraActive || isDetecting || disabled}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isDetecting ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          '📸 Capture & Detect Vehicles'
        )}
      </button>

      {/* Status Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Camera Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${cameraActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-gray-600">
            Camera: {cameraActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* GPS Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${gpsLocation ? 'bg-green-500' : locationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className="text-gray-600">
            GPS: {gpsLocation ? `Active (${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)})` :
                  locationPermission === 'denied' ? 'Denied' : 'Acquiring...'}
          </span>
        </div>
      </div>

      {/* Permission Request Buttons */}
      {locationPermission === 'denied' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm mb-2">
            Location access is recommended for accurate reporting.
          </p>
          <button
            onClick={requestLocationPermission}
            className="text-sm px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            Enable Location
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-1">How to use:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Point camera at vehicles (cars or bikes)</li>
          <li>• Ensure good lighting and clear view</li>
          <li>• Tap "Capture & Detect Vehicles" to analyze</li>
          <li>• Location will be automatically included</li>
        </ul>
      </div>
    </div>
  );
}