'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DetectionResult } from '@/lib/ml/yoloInference';
import { ML_CONFIG } from '@/lib/ml/constants';

interface DetectionCanvasProps {
  detections: DetectionResult[];
  originalImageUrl: string;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showConfidence?: boolean;
  className?: string;
}

export function DetectionCanvas({
  detections,
  originalImageUrl,
  width = 640,
  height = 480,
  showLabels = true,
  showConfidence = true,
  className = ""
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scaleRatio, setScaleRatio] = useState({ x: 1, y: 1 });

  // Load image and calculate scaling
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);

      // Calculate scaling ratio to fit image in canvas
      const scaleX = width / img.width;
      const scaleY = height / img.height;
      const scale = Math.min(scaleX, scaleY);

      setScaleRatio({ x: scale, y: scale });
    };
    img.src = originalImageUrl;
    imageRef.current = img;
  }, [originalImageUrl, width, height]);

  // Draw detections on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = imageRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions to center the image
    const scaledWidth = img.width * scaleRatio.x;
    const scaledHeight = img.height * scaleRatio.y;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Draw image
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

    // Draw bounding boxes
    detections.forEach((detection) => {
      // Scale bounding box coordinates
      const x = detection.x * scaleRatio.x + offsetX;
      const y = detection.y * scaleRatio.y + offsetY;
      const boxWidth = detection.width * scaleRatio.x;
      const boxHeight = detection.height * scaleRatio.y;

      // Get color for this class
      const color = ML_CONFIG.CLASS_COLORS[detection.className as keyof typeof ML_CONFIG.CLASS_COLORS] || '#FF6B6B';

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, boxWidth, boxHeight);

      // Draw filled background for label
      if (showLabels) {
        const labelText = showConfidence
          ? `${detection.className} ${(detection.confidence * 100).toFixed(1)}%`
          : detection.className;

        // Measure text
        ctx.font = 'bold 14px Arial';
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 20;

        // Draw label background
        ctx.fillStyle = color;
        ctx.fillRect(x, y - textHeight, textWidth + 8, textHeight);

        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, x + 4, y - 6);
      }

      // Draw corner markers for better visibility
      const cornerLength = 15;
      const cornerWidth = 4;

      ctx.strokeStyle = color;
      ctx.lineWidth = cornerWidth;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(x + boxWidth - cornerLength, y);
      ctx.lineTo(x + boxWidth, y);
      ctx.lineTo(x + boxWidth, y + cornerLength);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + boxHeight - cornerLength);
      ctx.lineTo(x, y + boxHeight);
      ctx.lineTo(x + cornerLength, y + boxHeight);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(x + boxWidth - cornerLength, y + boxHeight);
      ctx.lineTo(x + boxWidth, y + boxHeight);
      ctx.lineTo(x + boxWidth, y + boxHeight - cornerLength);
      ctx.stroke();
    });

    // Draw statistics overlay
    if (detections.length > 0) {
      const carCount = detections.filter(d => d.className === 'car').length;
      const bikeCount = detections.filter(d => d.className === 'bike').length;
      const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

      // Draw stats background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 200, 80);

      // Draw stats text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.fillText(`Total Detections: ${detections.length}`, 20, 30);
      ctx.fillText(`Cars: ${carCount}`, 20, 50);
      ctx.fillText(`Bikes: ${bikeCount}`, 20, 70);
      ctx.fillText(`Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`, 110, 50);
    }

  }, [detections, imageLoaded, scaleRatio, showLabels, showConfidence, width, height]);

  // Download canvas as image
  const downloadImage = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `detection-${Date.now()}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {/* Canvas for drawing detections */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`w-full h-auto ${className}`}
      />

      {/* Loading state */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Controls overlay */}
      {imageLoaded && detections.length > 0 && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={downloadImage}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
            title="Download image with detections"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      )}

      {/* No detections message */}
      {imageLoaded && detections.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black bg-opacity-75 text-white px-6 py-3 rounded-lg">
            <p className="text-center">
              <span className="text-2xl mb-2 block">🚗🏍️</span>
              No vehicles detected in this image
            </p>
          </div>
        </div>
      )}

      {/* Hidden image for loading */}
      <img
        ref={imageRef}
        src={originalImageUrl}
        alt="Detection source"
        className="hidden"
        crossOrigin="anonymous"
      />
    </div>
  );
}

// Component for detection statistics
interface DetectionStatsProps {
  detections: DetectionResult[];
}

export function DetectionStats({ detections }: DetectionStatsProps) {
  if (detections.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-500">No vehicles detected</p>
      </div>
    );
  }

  const carCount = detections.filter(d => d.className === 'car').length;
  const bikeCount = detections.filter(d => d.className === 'bike').length;
  const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
  const maxConfidence = Math.max(...detections.map(d => d.confidence));
  const minConfidence = Math.min(...detections.map(d => d.confidence));

  return (
    <div className="p-4 bg-blue-50 rounded-lg">
      <h3 className="font-semibold text-blue-900 mb-3">Detection Results</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-white p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{detections.length}</div>
          <div className="text-gray-600">Total Vehicles</div>
        </div>

        <div className="bg-white p-3 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{carCount}</div>
          <div className="text-gray-600">Cars</div>
        </div>

        <div className="bg-white p-3 rounded-lg">
          <div className="text-2xl font-bold text-teal-600">{bikeCount}</div>
          <div className="text-gray-600">Bikes</div>
        </div>

        <div className="bg-white p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {(avgConfidence * 100).toFixed(1)}%
          </div>
          <div className="text-gray-600">Avg Confidence</div>
        </div>
      </div>

      {/* Confidence range */}
      <div className="mt-4 p-3 bg-white rounded-lg">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Confidence Range</span>
          <span>{(minConfidence * 100).toFixed(1)}% - {(maxConfidence * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-yellow-400 to-green-500 h-2 rounded-full"
            style={{
              width: `${avgConfidence * 100}%`
            }}
          ></div>
        </div>
      </div>

      {/* Detailed detection list */}
      <div className="mt-4 space-y-2">
        <h4 className="font-medium text-blue-900">Detected Vehicles:</h4>
        {detections.map((detection, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-white rounded text-sm"
            style={{
              borderLeft: `4px solid ${
                ML_CONFIG.CLASS_COLORS[detection.className as keyof typeof ML_CONFIG.CLASS_COLORS]
              }`
            }}
          >
            <div className="flex items-center space-x-2">
              <span className="font-medium capitalize">{detection.className}</span>
              <span className="text-gray-500">
                {Math.round(detection.width)}×{Math.round(detection.height)}px
              </span>
            </div>
            <span className="font-medium text-green-600">
              {(detection.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}