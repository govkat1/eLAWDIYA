-- Traffic Violation Reporting System Database Schema
-- PostgreSQL Schema

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  user_type VARCHAR(20) DEFAULT 'citizen' CHECK (user_type IN ('citizen', 'admin', 'super_admin')),
  reward_points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reports Table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  violation_type VARCHAR(50), -- e.g., "car_detected", "bike_detected"
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  description TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_address TEXT,
  captured_at TIMESTAMP,
  vehicle_detected BOOLEAN,
  detection_confidence DECIMAL(3, 2), -- Confidence score from YOLO
  media_file_path VARCHAR(500), -- Local path or S3 URL
  metadata JSONB, -- GPS accuracy, device info, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Report Media Table (for storing multiple images/videos per report)
CREATE TABLE report_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  media_type VARCHAR(20) CHECK (media_type IN ('image', 'video')),
  file_path VARCHAR(500),
  file_size INTEGER, -- in bytes
  duration INTEGER, -- for videos, in seconds
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- User Rewards Table
CREATE TABLE user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  points_earned INTEGER,
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('verified_report', 'bonus', 'redeemed')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin Logs (Audit Trail)
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  action VARCHAR(100) CHECK (action IN ('verified', 'rejected', 'user_banned', 'user_updated', 'report_updated')),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Offender Statistics (for Hall of Shame)
CREATE TABLE offender_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_object_type VARCHAR(50) CHECK (detected_object_type IN ('car', 'bike')),
  detected_at_location TEXT,
  total_violations_from_location INTEGER DEFAULT 1,
  most_recent_violation_date TIMESTAMP,
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) CHECK (type IN ('report_verified', 'report_rejected', 'points_awarded', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_violation_type ON reports(violation_type);
CREATE INDEX idx_reports_location ON reports USING GIST (
  CASE
    WHEN location_lat IS NOT NULL AND location_lng IS NOT NULL
    THEN point(location_lng, location_lat)
  END
);

CREATE INDEX idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_created_at ON user_rewards(created_at DESC);
CREATE INDEX idx_report_media_report_id ON report_media(report_id);
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_offender_statistics_location ON offender_statistics(detected_at_location);
CREATE INDEX idx_offender_statistics_type ON offender_statistics(detected_object_type);
CREATE INDEX idx_offender_statistics_updated_at ON offender_statistics(updated_at DESC);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offender_statistics_updated_at BEFORE UPDATE ON offender_statistics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, user_type, is_verified)
VALUES (
  'admin@traffic.app',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.pmqrG.', -- admin123
  'System Administrator',
  'super_admin',
  true
);

-- Create view for Hall of Shame top offenders
CREATE VIEW hall_of_shame_view AS
SELECT
  os.detected_object_type,
  os.detected_at_location,
  os.location_lat,
  os.location_lng,
  os.total_violations_from_location,
  os.most_recent_violation_date,
  os.is_flagged,
  os.flag_reason,
  COUNT(r.id) as verified_reports_count
FROM offender_statistics os
LEFT JOIN reports r ON os.detected_at_location = r.location_address
  AND r.status = 'verified'
  AND r.vehicle_detected = true
GROUP BY os.id, os.detected_object_type, os.detected_at_location,
         os.location_lat, os.location_lng, os.total_violations_from_location,
         os.most_recent_violation_date, os.is_flagged, os.flag_reason
ORDER BY os.total_violations_from_location DESC, os.most_recent_violation_date DESC;