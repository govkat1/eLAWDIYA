import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth, isAdmin } from '@/lib/auth/jwt';
import { updateReportStatus, getReportById } from '@/lib/db/reports';
import { addRewardPoints } from '@/lib/db/users';
import { query, transaction } from '@/lib/database';

// Admin verification schema
const verificationSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(['verify', 'reject']),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin privileges
    const authHeader = request.headers.get('authorization');
    const user = await verifyAuth(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = verificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        },
        { status: 400 }
      );
    }

    const { reportId, action, reason } = validationResult.data;
    const adminId = user.sub;

    // Get the report to verify
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (report.status !== 'pending') {
      return NextResponse.json(
        { error: 'Report has already been processed' },
        { status: 400 }
      );
    }

    // Process verification in a transaction
    const result = await transaction(async (client) => {
      let updatedReport;
      let pointsAwarded = 0;

      if (action === 'verify') {
        // Update report status to verified
        const updateResult = await client.query(
          `UPDATE reports
           SET status = 'verified', verified_at = NOW(), verified_by = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [adminId, reportId]
        );

        updatedReport = updateResult.rows[0];

        // Award points to reporter if vehicle was detected
        if (report.vehicle_detected && report.user_id) {
          const pointsPerReport = parseInt(process.env.POINTS_PER_VERIFIED_REPORT || '100');
          pointsAwarded = pointsPerReport;

          // Add to user rewards table
          await client.query(
            `INSERT INTO user_rewards (user_id, report_id, points_earned, transaction_type, description)
             VALUES ($1, $2, $3, 'verified_report', 'Points for verified report')`,
            [report.user_id, reportId, pointsAwarded]
          );

          // Update user's total points
          await client.query(
            `UPDATE users
             SET reward_points = reward_points + $1, updated_at = NOW()
             WHERE id = $2`,
            [pointsAwarded, report.user_id]
          );
        }

        // Update offender statistics if vehicle was detected
        if (report.vehicle_detected && report.location_address) {
          const detectedObjectType = report.violation_type?.includes('car') ? 'car' : 'bike';

          // Check if location already exists in offender statistics
          const existingStats = await client.query(
            `SELECT id, total_violations_from_location
             FROM offender_statistics
             WHERE detected_at_location = $1 AND detected_object_type = $2`,
            [report.location_address, detectedObjectType]
          );

          if (existingStats.rows.length > 0) {
            // Update existing record
            await client.query(
              `UPDATE offender_statistics
               SET total_violations_from_location = total_violations_from_location + 1,
                   most_recent_violation_date = NOW(),
                   location_lat = $1,
                   location_lng = $2,
                   updated_at = NOW()
               WHERE id = $3`,
              [report.location_lat, report.location_lng, existingStats.rows[0].id]
            );
          } else {
            // Create new record
            await client.query(
              `INSERT INTO offender_statistics
               (detected_object_type, detected_at_location, total_violations_from_location,
                most_recent_violation_date, location_lat, location_lng)
               VALUES ($1, $2, 1, NOW(), $3, $4)`,
              [detectedObjectType, report.location_address, report.location_lat, report.location_lng]
            );
          }
        }

      } else if (action === 'reject') {
        // Update report status to rejected
        const updateResult = await client.query(
          `UPDATE reports
           SET status = 'rejected', verified_at = NOW(), verified_by = $1,
               rejection_reason = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [adminId, reason || 'Rejected by admin', reportId]
        );

        updatedReport = updateResult.rows[0];
      }

      return { updatedReport, pointsAwarded };
    });

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, report_id, action, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminId,
        reportId,
        action,
        JSON.stringify({
          old_status: report.status,
          vehicle_detected: report.vehicle_detected
        }),
        JSON.stringify({
          new_status: action === 'verify' ? 'verified' : 'rejected',
          points_awarded: result.pointsAwarded,
          reason: reason || null,
          timestamp: new Date().toISOString()
        }),
        request.ip || request.headers.get('x-forwarded-for'),
        request.headers.get('user-agent')
      ]
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: `Report ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
        report: {
          id: result.updatedReport.id,
          status: result.updatedReport.status,
          verifiedAt: result.updatedReport.verified_at,
          verifiedBy: adminId,
          rejectionReason: result.updatedReport.rejection_reason,
          pointsAwarded: result.pointsAwarded
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Report verification error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process verification',
        message: 'An unexpected error occurred while processing the verification'
      },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}