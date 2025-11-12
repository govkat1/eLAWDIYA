import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const vehicleType = searchParams.get('vehicleType') as 'car' | 'bike' | null;
    const timeRange = searchParams.get('timeRange') || '30'; // days

    // Validate limit
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      );
    }

    // Build query conditions
    let whereClause = `WHERE r.status = 'verified' AND r.vehicle_detected = true`;
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Add time range filter
    if (timeRange && timeRange !== 'all') {
      whereClause += ` AND r.created_at >= NOW() - INTERVAL '${timeRange} days'`;
    }

    // Add vehicle type filter
    if (vehicleType) {
      whereClause += ` AND r.violation_type ILIKE $${paramIndex}`;
      queryParams.push(`%${vehicleType}%`);
      paramIndex++;
    }

    // Get top offenders by location
    const offendersResult = await query(
      `SELECT
         r.violation_type,
         r.location_address,
         r.location_lat,
         r.location_lng,
         COUNT(*) as total_violations,
         MAX(r.created_at) as latest_violation,
         AVG(r.detection_confidence) as avg_confidence,
         COUNT(DISTINCT r.user_id) as unique_reporters,
         -- Calculate points awarded for these violations
         COALESCE(SUM(ur.points_earned), 0) as total_points_awarded
       FROM reports r
       LEFT JOIN user_rewards ur ON r.id = ur.report_id
       ${whereClause}
       AND r.location_address IS NOT NULL
       GROUP BY r.violation_type, r.location_address, r.location_lat, r.location_lng
       HAVING COUNT(*) >= 2  -- Only show locations with 2+ violations
       ORDER BY total_violations DESC, latest_violation DESC
       LIMIT $${paramIndex}`,
      [...queryParams, limit]
    );

    // Get overall statistics
    const statsResult = await query(
      `SELECT
         COUNT(*) as total_verified_reports,
         COUNT(DISTINCT r.location_address) as unique_locations,
         COUNT(DISTINCT r.user_id) as unique_reporters,
         COUNT(*) FILTER (WHERE r.violation_type ILIKE '%car%') as car_violations,
         COUNT(*) FILTER (WHERE r.violation_type ILIKE '%bike%') as bike_violations,
         AVG(r.detection_confidence) as avg_detection_confidence,
         COALESCE(SUM(ur.points_earned), 0) as total_points_awarded
       FROM reports r
       LEFT JOIN user_rewards ur ON r.id = ur.report_id
       ${whereClause}`,
      queryParams
    );

    // Get recent activity
    const recentActivityResult = await query(
      `SELECT
         r.id,
         r.violation_type,
         r.location_address,
         r.location_lat,
         r.location_lng,
         r.created_at,
         r.detection_confidence,
         u.full_name as reporter_name
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT 10`,
      queryParams
    );

    // Format the results
    const offenders = offendersResult.map(row => ({
      violationType: row.violation_type,
      location: {
        address: row.location_address,
        latitude: parseFloat(row.location_lat),
        longitude: parseFloat(row.location_lng)
      },
      statistics: {
        totalViolations: parseInt(row.total_violations),
        latestViolation: row.latest_violation,
        averageConfidence: parseFloat(parseFloat(row.avg_confidence).toFixed(2)),
        uniqueReporters: parseInt(row.unique_reporters),
        totalPointsAwarded: parseInt(row.total_points_awarded)
      },
      // Determine risk level based on violation count
      riskLevel: getRiskLevel(parseInt(row.total_violations))
    }));

    const stats = statsResult[0];
    const overallStats = {
      totalVerifiedReports: parseInt(stats.total_verified_reports),
      uniqueLocations: parseInt(stats.unique_locations),
      uniqueReporters: parseInt(stats.unique_reporters),
      violationsByType: {
        car: parseInt(stats.car_violations),
        bike: parseInt(stats.bike_violations)
      },
      averageDetectionConfidence: parseFloat(parseFloat(stats.avg_detection_confidence).toFixed(2)),
      totalPointsAwarded: parseInt(stats.total_points_awarded)
    };

    const recentActivity = recentActivityResult.map(row => ({
      id: row.id,
      violationType: row.violation_type,
      location: {
        address: row.location_address,
        latitude: parseFloat(row.location_lat),
        longitude: parseFloat(row.location_lng)
      },
      timestamp: row.created_at,
      detectionConfidence: parseFloat(row.detection_confidence),
      reporterName: row.reporter_name
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          offenders,
          overallStats,
          recentActivity,
          filters: {
            limit,
            vehicleType,
            timeRange
          }
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Hall of Shame API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch Hall of Shame data',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// Helper function to determine risk level
function getRiskLevel(violationCount: number): 'low' | 'medium' | 'high' | 'critical' {
  if (violationCount >= 10) return 'critical';
  if (violationCount >= 7) return 'high';
  if (violationCount >= 4) return 'medium';
  return 'low';
}

// Handle other HTTP methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}