import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth/jwt';
import { createReport, getReportStatistics } from '@/lib/db/reports';
import { query } from '@/lib/database';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Report submission schema
const reportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().optional(),
  description: z.string().max(1000).optional(),
  detections: z.array(z.object({
    className: z.enum(['car', 'bike']),
    confidence: z.number().min(0).max(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    classId: z.number()
  })).optional(),
  deviceInfo: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const user = await verifyAuth(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to submit reports.' },
        { status: 401 }
      );
    }

    // Parse form data (for file upload)
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const jsonData = formData.get('data') as string;

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Validate JSON data
    let data;
    try {
      data = JSON.parse(jsonData || '{}');
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON data format' },
        { status: 400 }
      );
    }

    const validationResult = reportSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        },
        { status: 400 }
      );
    }

    const {
      latitude,
      longitude,
      locationAddress,
      description,
      detections,
      deviceInfo,
      capturedAt
    } = validationResult.data;

    // Check rate limiting
    const userId = user.sub;
    const stats = await getReportStatistics(userId);

    // Allow max 10 reports per user per day
    if (stats.total >= 10) {
      const todayReports = await query(
        `SELECT COUNT(*) as count FROM reports
         WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [userId]
      );

      if (parseInt(todayReports[0].count) >= 10) {
        return NextResponse.json(
          { error: 'Daily report limit reached. You can submit up to 10 reports per day.' },
          { status: 429 }
        );
      }
    }

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (image.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Process detections
    const vehicleDetected = detections && detections.length > 0;
    let detectionConfidence = 0;
    let violationType = 'unknown';

    if (vehicleDetected && detections) {
      // Calculate average confidence
      const totalConfidence = detections.reduce((sum, d) => sum + d.confidence, 0);
      detectionConfidence = totalConfidence / detections.length;

      // Determine violation type based on detected vehicles
      const hasCar = detections.some(d => d.className === 'car');
      const hasBike = detections.some(d => d.className === 'bike');

      if (hasCar && hasBike) {
        violationType = 'mixed_vehicle_violation';
      } else if (hasCar) {
        violationType = 'car_detected';
      } else if (hasBike) {
        violationType = 'bike_detected';
      }
    }

    // Save uploaded file
    const timestamp = Date.now();
    const fileName = `report_${userId}_${timestamp}.jpg`;
    const uploadsDir = join(process.cwd(), 'public', 'uploads');

    // Ensure uploads directory exists
    try {
      mkdirSync(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filePath = join(uploadsDir, fileName);
    const fileBuffer = Buffer.from(await image.arrayBuffer());

    try {
      writeFileSync(filePath, fileBuffer);
    } catch (error) {
      console.error('Failed to save file:', error);
      return NextResponse.json(
        { error: 'Failed to save uploaded image' },
        { status: 500 }
      );
    }

    // Create report record
    const reportData = {
      user_id: userId,
      violation_type: vehicleDetected ? violationType : null,
      description,
      location_lat: latitude,
      location_lng: longitude,
      location_address: locationAddress,
      captured_at: capturedAt ? new Date(capturedAt) : new Date(),
      vehicle_detected: vehicleDetected,
      detection_confidence: detectionConfidence,
      media_file_path: `/uploads/${fileName}`,
      metadata: {
        detections: detections || [],
        device_info: deviceInfo || request.headers.get('user-agent'),
        ip_address: request.ip || request.headers.get('x-forwarded-for'),
        file_size: image.size,
        file_type: image.type,
        gps_accuracy: 'unknown' // This could be extracted from GPS data
      }
    };

    const report = await createReport(reportData);

    // Log report submission
    await query(
      `INSERT INTO admin_logs (admin_id, action, new_value)
       VALUES ($1, $2, $3)`,
      [
        userId,
        'report_submitted',
        JSON.stringify({
          report_id: report.id,
          vehicle_detected: vehicleDetected,
          detection_count: detections?.length || 0,
          location: { latitude, longitude },
          timestamp: new Date().toISOString()
        })
      ]
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Report submitted successfully',
        report: {
          id: report.id,
          status: report.status,
          vehicleDetected: report.vehicle_detected,
          detectionConfidence: report.detection_confidence,
          violationType: report.violation_type,
          location: {
            latitude: report.location_lat,
            longitude: report.location_lng,
            address: report.location_address
          },
          createdAt: report.created_at,
          mediaPath: report.media_file_path
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Report submission error:', error);

    return NextResponse.json(
      {
        error: 'Failed to submit report',
        message: 'An unexpected error occurred while processing your report'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const user = await verifyAuth(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') as 'pending' | 'verified' | 'rejected' | null;

    const offset = (page - 1) * limit;

    // Get user's reports
    let reports;
    if (status) {
      const result = await getReportsByStatus(status, limit, offset);
      reports = result.reports.filter(report => report.user_id === user.sub);
    } else {
      const result = await query(
        `SELECT * FROM reports
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [user.sub, limit, offset]
      );
      reports = result.map(report => {
        if (report.metadata && typeof report.metadata === 'string') {
          report.metadata = JSON.parse(report.metadata);
        }
        return report;
      });
    }

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM reports WHERE user_id = $1',
      [user.sub]
    );
    const total = parseInt(countResult[0].total) || 0;

    return NextResponse.json(
      {
        success: true,
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Get reports error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch reports',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}