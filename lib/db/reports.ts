import { query, transaction } from '@/lib/database';

export interface Report {
  id: string;
  user_id: string;
  violation_type?: string;
  status: 'pending' | 'verified' | 'rejected';
  description?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  captured_at?: Date;
  vehicle_detected: boolean;
  detection_confidence?: number;
  media_file_path?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  verified_at?: Date;
  verified_by?: string;
  rejection_reason?: string;
  updated_at: Date;
}

export interface ReportMedia {
  id: string;
  report_id: string;
  media_type: 'image' | 'video';
  file_path: string;
  file_size?: number;
  duration?: number;
  uploaded_at: Date;
}

export interface CreateReportData {
  user_id: string;
  violation_type?: string;
  description?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  captured_at: Date;
  vehicle_detected: boolean;
  detection_confidence?: number;
  media_file_path?: string;
  metadata?: Record<string, any>;
}

export interface UpdateReportData {
  status?: 'pending' | 'verified' | 'rejected';
  description?: string;
  verified_by?: string;
  rejection_reason?: string;
}

// Create a new report
export async function createReport(reportData: CreateReportData): Promise<Report> {
  const {
    user_id,
    violation_type,
    description,
    location_lat,
    location_lng,
    location_address,
    captured_at,
    vehicle_detected,
    detection_confidence,
    media_file_path,
    metadata
  } = reportData;

  const result = await query<Report>(
    `INSERT INTO reports (
      user_id, violation_type, status, description, location_lat, location_lng,
      location_address, captured_at, vehicle_detected, detection_confidence,
      media_file_path, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      user_id,
      violation_type,
      'pending',
      description,
      location_lat,
      location_lng,
      location_address,
      captured_at,
      vehicle_detected,
      detection_confidence,
      media_file_path,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result[0];
}

// Get report by ID
export async function getReportById(id: string): Promise<Report | null> {
  const result = await query<Report>(
    `SELECT r.*, u.full_name, u.email as user_email
     FROM reports r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`,
    [id]
  );

  const report = result[0];
  if (report) {
    // Parse metadata if it exists
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
  }

  return report || null;
}

// Get reports by user ID
export async function getReportsByUserId(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  reports: Report[];
  total: number;
}> {
  const [reportsResult, countResult] = await Promise.all([
    query<Report>(
      `SELECT * FROM reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total FROM reports WHERE user_id = $1`,
      [userId]
    )
  ]);

  // Parse metadata for each report
  const reports = reportsResult.map(report => {
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
    return report;
  });

  return {
    reports,
    total: parseInt(countResult[0].total) || 0
  };
}

// Get pending reports (for admin)
export async function getPendingReports(
  limit: number = 20,
  offset: number = 0
): Promise<{
  reports: Array<Report & { user_name: string; user_email: string }>;
  total: number;
}> {
  const [reportsResult, countResult] = await Promise.all([
    query<Report & { user_name: string; user_email: string }>(
      `SELECT r.*, u.full_name as user_name, u.email as user_email
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.status = 'pending'
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total FROM reports WHERE status = 'pending'`,
      []
    )
  ]);

  // Parse metadata for each report
  const reports = reportsResult.map(report => {
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
    return report;
  });

  return {
    reports,
    total: parseInt(countResult[0].total) || 0
  };
}

// Update report status (for admin verification)
export async function updateReportStatus(
  id: string,
  updateData: UpdateReportData
): Promise<Report | null> {
  const { status, verified_by, rejection_reason } = updateData;

  let verifiedAt = null;
  if (status === 'verified' || status === 'rejected') {
    verifiedAt = new Date();
  }

  const result = await query<Report>(
    `UPDATE reports
     SET status = $1, verified_at = $2, verified_by = $3, rejection_reason = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [status, verifiedAt, verified_by, rejection_reason, id]
  );

  const report = result[0];
  if (report) {
    // Parse metadata if it exists
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
  }

  return report || null;
}

// Get reports by status
export async function getReportsByStatus(
  status: 'pending' | 'verified' | 'rejected',
  limit: number = 20,
  offset: number = 0
): Promise<{
  reports: Array<Report & { user_name: string; user_email: string }>;
  total: number;
}> {
  const [reportsResult, countResult] = await Promise.all([
    query<Report & { user_name: string; user_email: string }>(
      `SELECT r.*, u.full_name as user_name, u.email as user_email
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total FROM reports WHERE status = $1`,
      [status]
    )
  ]);

  // Parse metadata for each report
  const reports = reportsResult.map(report => {
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
    return report;
  });

  return {
    reports,
    total: parseInt(countResult[0].total) || 0
  };
}

// Get report statistics
export async function getReportStatistics(userId?: string): Promise<{
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  withVehicles: number;
  avgConfidence: number;
}> {
  const whereClause = userId ? 'WHERE user_id = $1' : '';
  const params = userId ? [userId] : [];

  const result = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'verified') as verified,
       COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
       COUNT(*) FILTER (WHERE vehicle_detected = true) as with_vehicles,
       COALESCE(AVG(detection_confidence), 0) as avg_confidence
     FROM reports ${whereClause}`,
    params
  );

  const stats = result[0];
  return {
    total: parseInt(stats.total) || 0,
    pending: parseInt(stats.pending) || 0,
    verified: parseInt(stats.verified) || 0,
    rejected: parseInt(stats.rejected) || 0,
    withVehicles: parseInt(stats.with_vehicles) || 0,
    avgConfidence: parseFloat(stats.avg_confidence) || 0
  };
}

// Get recent reports with location data
export async function getRecentReports(
  limit: number = 10,
  lat?: number,
  lng?: number,
  radiusKm: number = 10
): Promise<Report[]> {
  let whereClause = 'WHERE status = $1';
  let queryParams: any[] = ['verified'];
  let paramIndex = 2;

  // If location coordinates are provided, filter by radius
  if (lat !== undefined && lng !== undefined) {
    whereClause += ` AND (
      6371 * acos(
        cos(radians($${paramIndex})) * cos(radians(location_lat)) *
        cos(radians(location_lng) - radians($${paramIndex + 1})) +
        sin(radians($${paramIndex})) * sin(radians(location_lat))
      ) <= $${paramIndex + 2}
    )`;
    queryParams.push(lat, lng, radiusKm);
  }

  const result = await query<Report>(
    `SELECT * FROM reports
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex + (lat ? 3 : 0)}`,
    queryParams
  );

  // Parse metadata for each report
  return result.map(report => {
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
    return report;
  });
}

// Search reports
export async function searchReports(
  searchTerm: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  reports: Array<Report & { user_name: string; user_email: string }>;
  total: number;
}> {
  const searchPattern = `%${searchTerm}%`;

  const [reportsResult, countResult] = await Promise.all([
    query<Report & { user_name: string; user_email: string }>(
      `SELECT r.*, u.full_name as user_name, u.email as user_email
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE (
         r.description ILIKE $1 OR
         r.location_address ILIKE $1 OR
         r.violation_type ILIKE $1 OR
         u.full_name ILIKE $1 OR
         u.email ILIKE $1
       )
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchPattern, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE (
         r.description ILIKE $1 OR
         r.location_address ILIKE $1 OR
         r.violation_type ILIKE $1 OR
         u.full_name ILIKE $1 OR
         u.email ILIKE $1
       )`,
      [searchPattern]
    )
  ]);

  // Parse metadata for each report
  const reports = reportsResult.map(report => {
    if (report.metadata && typeof report.metadata === 'string') {
      report.metadata = JSON.parse(report.metadata);
    }
    return report;
  });

  return {
    reports,
    total: parseInt(countResult[0].total) || 0
  };
}

// Delete report (soft delete by updating status)
export async function deleteReport(id: string, deletedBy: string): Promise<boolean> {
  const result = await query(
    `UPDATE reports
     SET status = 'rejected', rejection_reason = 'Deleted by admin', updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  if (result.rowCount > 0) {
    // Log the deletion
    await query(
      `INSERT INTO admin_logs (admin_id, action, new_value)
       VALUES ($1, $2, $3)`,
      [
        deletedBy,
        'report_deleted',
        JSON.stringify({
          report_id: id,
          timestamp: new Date().toISOString()
        })
      ]
    );
    return true;
  }

  return false;
}