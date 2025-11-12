import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmailForAuth, updateLastLogin } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { checkRateLimit } from '@/lib/auth/jwt';
import { query } from '@/lib/database';

// Login schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Rate limiting based on IP and email
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Check IP rate limiting
    const ipRateLimitResult = checkRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000); // 10 attempts per 15 minutes
    if (!ipRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts from this IP. Please try again later.' },
        { status: 429 }
      );
    }

    // Check email rate limiting (prevent email enumeration attacks)
    const emailRateLimitResult = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
    if (!emailRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts for this email. Please try again later.' },
        { status: 429 }
      );
    }

    // Get user by email (including inactive users to show proper error messages)
    const user = await getUserByEmailForAuth(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed login attempt
      await query(
        `INSERT INTO admin_logs (admin_id, action, new_value, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user.id,
          'login_failed',
          JSON.stringify({
            email: user.email,
            reason: 'invalid_password',
            timestamp: new Date().toISOString()
          }),
          ip,
          request.headers.get('user-agent') || null
        ]
      );

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Update last login timestamp
    await updateLastLogin(user.id);

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.user_type);

    // Log successful login
    await query(
      `INSERT INTO admin_logs (admin_id, action, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'login_success',
        JSON.stringify({
          email: user.email,
          user_type: user.user_type,
          timestamp: new Date().toISOString()
        }),
        ip,
        request.headers.get('user-agent') || null
      ]
    );

    // Return success response with user info and token
    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          userType: user.user_type,
          rewardPoints: user.reward_points,
          isVerified: user.is_verified,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        error: 'Login failed',
        message: 'An unexpected error occurred during login'
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