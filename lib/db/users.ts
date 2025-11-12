import { query, transaction } from '@/lib/database';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name?: string;
  phone_number?: string;
  user_type: 'citizen' | 'admin' | 'super_admin';
  reward_points: number;
  is_active: boolean;
  is_verified: boolean;
  verification_token?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  full_name?: string;
  phone_number?: string;
  user_type?: 'citizen' | 'admin' | 'super_admin';
}

export interface UpdateUserData {
  full_name?: string;
  phone_number?: string;
  user_type?: 'citizen' | 'admin' | 'super_admin';
  reward_points?: number;
  is_active?: boolean;
  is_verified?: boolean;
}

// Create a new user
export async function createUser(userData: CreateUserData): Promise<User> {
  const {
    email,
    password_hash,
    full_name,
    phone_number,
    user_type = 'citizen'
  } = userData;

  const result = await query<User>(
    `INSERT INTO users (
      email, password_hash, full_name, phone_number, user_type
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [email, password_hash, full_name, phone_number, user_type]
  );

  return result[0];
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE id = $1 AND is_active = true',
    [id]
  );

  return result[0] || null;
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  return result[0] || null;
}

// Get user by email (including inactive users for login attempts)
export async function getUserByEmailForAuth(email: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result[0] || null;
}

// Update user
export async function updateUser(id: string, userData: UpdateUserData): Promise<User | null> {
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  // Build dynamic update query
  for (const [key, value] of Object.entries(userData)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramIndex}`);
      updateValues.push(value);
      paramIndex++;
    }
  }

  if (updateFields.length === 0) {
    return await getUserById(id);
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(id);

  const result = await query<User>(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}
     RETURNING *`,
    updateValues
  );

  return result[0] || null;
}

// Delete user (soft delete)
export async function deleteUser(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
    [id]
  );

  return result.rowCount > 0;
}

// Verify user email
export async function verifyUserEmail(token: string): Promise<User | null> {
  const result = await query<User>(
    `UPDATE users
     SET is_verified = true, verification_token = NULL, updated_at = NOW()
     WHERE verification_token = $1 AND is_active = true
     RETURNING *`,
    [token]
  );

  return result[0] || null;
}

// Set verification token for user
export async function setVerificationToken(email: string, token: string): Promise<boolean> {
  const result = await query(
    `UPDATE users
     SET verification_token = $1, updated_at = NOW()
     WHERE email = $2`,
    [token, email]
  );

  return result.rowCount > 0;
}

// Update password
export async function updateUserPassword(id: string, newPasswordHash: string): Promise<boolean> {
  const result = await query(
    `UPDATE users
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2`,
    [newPasswordHash, id]
  );

  return result.rowCount > 0;
}

// Add reward points to user
export async function addRewardPoints(userId: string, points: number): Promise<User | null> {
  const result = await query<User>(
    `UPDATE users
     SET reward_points = reward_points + $1, updated_at = NOW()
     WHERE id = $2 AND is_active = true
     RETURNING *`,
    [points, userId]
  );

  return result[0] || null;
}

// Get user statistics
export async function getUserStats(userId: string): Promise<{
  totalReports: number;
  verifiedReports: number;
  rejectedReports: number;
  totalPointsEarned: number;
  currentPoints: number;
}> {
  const result = await query(
    `SELECT
       COUNT(*) as total_reports,
       COUNT(*) FILTER (WHERE status = 'verified') as verified_reports,
       COUNT(*) FILTER (WHERE status = 'rejected') as rejected_reports,
       COALESCE(SUM(ur.points_earned), 0) as total_points_earned
     FROM users u
     LEFT JOIN reports r ON u.id = r.user_id
     LEFT JOIN user_rewards ur ON u.id = ur.user_id
     WHERE u.id = $1`,
    [userId]
  );

  const user = await getUserById(userId);
  const stats = result[0];

  return {
    totalReports: parseInt(stats.total_reports) || 0,
    verifiedReports: parseInt(stats.verified_reports) || 0,
    rejectedReports: parseInt(stats.rejected_reports) || 0,
    totalPointsEarned: parseInt(stats.total_points_earned) || 0,
    currentPoints: user?.reward_points || 0
  };
}

// Get top users by points (leaderboard)
export async function getTopUsers(limit: number = 10): Promise<Array<{
  id: string;
  full_name?: string;
  reward_points: number;
  verified_reports: number;
}>> {
  const result = await query(
    `SELECT
       u.id,
       u.full_name,
       u.reward_points,
       COUNT(r.id) FILTER (WHERE r.status = 'verified') as verified_reports
     FROM users u
     LEFT JOIN reports r ON u.id = r.user_id
     WHERE u.is_active = true AND u.user_type = 'citizen'
     GROUP BY u.id, u.full_name, u.reward_points
     ORDER BY u.reward_points DESC
     LIMIT $1`,
    [limit]
  );

  return result.map(row => ({
    ...row,
    verified_reports: parseInt(row.verified_reports) || 0
  }));
}

// Search users (for admin)
export async function searchUsers(
  searchTerm: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  users: User[];
  total: number;
}> {
  const searchPattern = `%${searchTerm}%`;

  const [usersResult, countResult] = await Promise.all([
    query<User>(
      `SELECT * FROM users
       WHERE (email ILIKE $1 OR full_name ILIKE $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchPattern, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM users
       WHERE email ILIKE $1 OR full_name ILIKE $1`,
      [searchPattern]
    )
  ]);

  return {
    users: usersResult,
    total: parseInt(countResult[0].total) || 0
  };
}

// Get users by type
export async function getUsersByType(
  userType: 'citizen' | 'admin' | 'super_admin',
  limit: number = 20,
  offset: number = 0
): Promise<{
  users: User[];
  total: number;
}> {
  const [usersResult, countResult] = await Promise.all([
    query<User>(
      `SELECT * FROM users
       WHERE user_type = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userType, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total FROM users
       WHERE user_type = $1 AND is_active = true`,
      [userType]
    )
  ]);

  return {
    users: usersResult,
    total: parseInt(countResult[0].total) || 0
  };
}

// Update last login timestamp
export async function updateLastLogin(id: string): Promise<boolean> {
  // Note: This would require adding a last_login column to the users table
  // For now, we'll just update the updated_at timestamp
  const result = await query(
    'UPDATE users SET updated_at = NOW() WHERE id = $1',
    [id]
  );

  return result.rowCount > 0;
}

// Get user activity summary
export async function getUserActivitySummary(userId: string, days: number = 30): Promise<{
  reportsSubmitted: number;
  pointsEarned: number;
  loginDays: number;
}> {
  const result = await query(
    `SELECT
       COUNT(DISTINCT DATE(r.created_at)) as report_days,
       COUNT(r.id) as reports_submitted,
       COALESCE(SUM(ur.points_earned), 0) as points_earned
     FROM users u
     LEFT JOIN reports r ON u.id = r.user_id AND r.created_at >= NOW() - INTERVAL '${days} days'
     LEFT JOIN user_rewards ur ON u.id = ur.user_id AND ur.created_at >= NOW() - INTERVAL '${days} days'
     WHERE u.id = $1`,
    [userId]
  );

  const data = result[0];
  return {
    reportsSubmitted: parseInt(data.reports_submitted) || 0,
    pointsEarned: parseInt(data.points_earned) || 0,
    loginDays: parseInt(data.report_days) || 0
  };
}