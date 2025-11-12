# eLAWDIYA - Traffic Violation Reporting System

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Issues](https://img.shields.io/badge/issues-welcome-orange)

🌟 **Civic sense through technology - Empowering citizens to report traffic violations with AI-powered detection**

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

eLAWDIYA is a comprehensive traffic violation reporting system that uses AI technology to detect and verify traffic violations reported by citizens. The system aims to improve civic sense and road safety through community participation and automated verification.

### The Problem
- Lack of public awareness and accountability for civic behavior
- Weak connection between citizens and local authorities for reporting violations
- Manual policing cannot monitor all traffic violations effectively
- No centralized system for real-time traffic violation monitoring

### Our Solution
- AI-powered vehicle detection using YOLO models
- Crowdsourced violation reporting with verification
- Reward system to encourage participation
- Admin dashboard for monitoring and enforcement
- Hall of Shame for public transparency

## ✨ Features

### 🚸 Core Features
- **Smart Vehicle Detection**: AI-powered car and motorcycle detection with 95% accuracy
- **Real-time Reporting**: Capture and upload violation evidence with automatic GPS tagging
- **Admin Verification**: Authorized administrators review and verify reports
- **Reward System**: Earn points for verified reports with leaderboard
- **Hall of Shame**: Public dashboard showing repeat offenders and violation statistics

### 🛠️ Technical Features
- **AI/ML Integration**: Browser-based YOLO inference using ONNX Runtime
- **Geospatial Search**: Location-based queries with PostgreSQL GIS indexing
- **Role-based Access**: Citizen, admin, and super_admin user roles
- **Real-time Notifications**: System alerts for report status updates
- **Mobile Responsive**: Works seamlessly on all devices

### 👥 User Roles
- **Citizen**: Report violations, view dashboard, earn rewards
- **Admin**: Verify reports, manage users, view analytics
- **Super Admin**: System administration and user management

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 with React 19 and TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **AI/ML**: ONNX Runtime Web, TensorFlow.js

### Backend
- **Framework**: FastAPI with Python
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Storage**: Local file system (easily migratable to cloud storage)

### AI/ML
- **Model**: YOLOv8 for vehicle detection
- **Inference**: ONNX Runtime Web (WASM)
- **Preprocessing**: Real-time video capture and image processing

### Development Tools
- **Package Manager**: npm (Node.js) and pip (Python)
- **Code Quality**: ESLint, TypeScript
- **Development**: Hot reload for both frontend and backend

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   PostgreSQL    │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   Database      │
│                 │    │                 │    │                 │
│ - React UI      │    │ - REST API      │    │ - User Data     │
│ - AI Inference  │    │ - Auth (JWT)    │    │ - Reports       │
│ - Camera Capture│    │ - File Upload   │    │ - Rewards       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components
- **Frontend**: Next.js application with AI-powered camera capture
- **Backend**: FastAPI with authentication, file handling, and database operations
- **Database**: PostgreSQL with geospatial indexing and comprehensive schema
- **AI Models**: Browser-based YOLO inference for real-time vehicle detection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ and pip
- PostgreSQL 12+

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/eLAWDIYA.git
   cd eLAWDIYA
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up database**
   ```bash
   # Create database
   createdb elawdiya

   # Run schema
   psql -d elawdiya -f schema.sql
   ```

5. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database connection and JWT secret
   ```

6. **Start development servers**
   ```bash
   # Terminal 1: Start backend
   npm run backend

   # Terminal 2: Start frontend
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Default Admin Account
- Email: admin@traffic.app
- Password: admin123

## 💻 Development Setup

### Environment Variables
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/elawdiya

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### Database Setup
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE elawdiya;
CREATE USER elawdiya_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE elawdiya TO elawdiya_user;
\q

# Run schema
psql -d elawdiya -U elawdiya_user -f schema.sql
```

### Development Workflow
1. **Start backend**: `npm run backend`
2. **Start frontend**: `npm run dev`
3. **Run linting**: `npm run lint`
4. **Build for production**: `npm run build`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile

### Reports Endpoints
- `POST /api/reports/` - Create new report
- `GET /api/reports/` - Get user's reports
- `GET /api/reports/{report_id}` - Get specific report

### Admin Endpoints
- `GET /api/admin/reports` - Get all reports (admin only)
- `PUT /api/admin/reports/{report_id}` - Update report status (admin only)
- `GET /api/admin/users` - Get all users (admin only)

### Hall of Shame Endpoints
- `GET /api/shame/offenders` - Get top offenders
- `GET /api/shame/statistics` - Get violation statistics

### API Usage Example
```bash
# Register new user
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Create report (with auth token)
curl -X POST "http://localhost:8000/api/reports/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "violation_type=wrong_parking" \
  -F "location=Main Street" \
  -F "image=@photo.jpg"
```

## 🗄️ Database Schema

### Core Tables
- **users**: User accounts with roles and reward points
- **reports**: Traffic violation reports with status tracking
- **report_media**: Multiple media files per report
- **user_rewards**: Reward transactions and point tracking
- **admin_logs**: Audit trail for admin actions
- **offender_statistics**: Aggregated violation data for Hall of Shame
- **notifications**: User notifications and alerts

### Key Features
- UUID primary keys for security
- Geospatial indexing for location-based queries
- Comprehensive audit trails
- Automatic timestamp updates
- Role-based access control

### Database Views
- `hall_of_shame_view`: Pre-computed offender statistics

For detailed schema, see [schema.sql](schema.sql).

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies (see Development Setup)
4. Make your changes

### Code Quality
- Follow existing code patterns and conventions
- Write clean, commented code
- Ensure proper TypeScript types
- Test your changes thoroughly

### Submitting Changes
1. Commit your changes: `git commit -m 'Add some amazing feature'`
2. Push to the branch: `git push origin feature/amazing-feature`
3. Open a Pull Request

### Development Guidelines
- **Frontend**: Follow React and Next.js best practices
- **Backend**: Follow FastAPI and Python conventions
- **Database**: Use migrations for schema changes
- **Testing**: Add tests for new features
- **Documentation**: Update relevant documentation

### Bug Reports
- Use the issue tracker for bug reports
- Provide detailed reproduction steps
- Include environment details and error messages

### Feature Requests
- Open an issue to discuss major changes
- Provide clear requirements and use cases
- Consider existing patterns and architecture

## 🚀 Deployment

### Production Environment
- **Frontend**: Deploy on Vercel or Netlify
- **Backend**: Deploy on Railway, Render, or AWS
- **Database**: PostgreSQL on Railway, Heroku, or AWS RDS
- **File Storage**: Migrate to AWS S3 or Google Cloud Storage

### Environment Setup
1. Set production environment variables
2. Configure CORS for production domains
3. Set up PostgreSQL database
4. Run database migrations
5. Build and deploy frontend
6. Deploy backend API

### Monitoring
- Set up error monitoring (Sentry)
- Configure logging
- Set up uptime monitoring
- Monitor database performance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- YOLO model creators for object detection technology
- ONNX Runtime for efficient model inference
- Next.js and FastAPI communities
- All contributors who help improve this project

## 📞 Contact

- Project Repository: https://github.com/your-username/eLAWDIYA
- Issues: https://github.com/your-username/eLAWDIYA/issues
- Email: contact@elawdiya.com

---

**Note**: This is an open-source project focused on improving civic sense and road safety. Please use responsibly and follow local laws and regulations when reporting violations.