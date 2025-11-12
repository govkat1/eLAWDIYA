import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser, getUserByEmail } from '@/lib/db/users';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { checkRateLimit } from '@/lib/auth/jwt';
import { query } from '@/lib/database';

// Registration schema
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long').optional(),
  phoneNumber: z.string().regex(/^[+]?[\d\s\-\(\)]+$/, 'Invalid phone number format').optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        },
        { status: 400 }
      );
    }

    const { email, password, fullName, phoneNumber } = validationResult.data;

    // Rate limiting based on IP
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Password validation failed',
          details: passwordValidation.errors
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await createUser({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone_number: phoneNumber,
      user_type: 'citizen'
    });

    // Generate JWT token
    const token = generateToken(newUser.id, newUser.email, newUser.user_type);

    // Log registration attempt
    await query(
      `INSERT INTO admin_logs (admin_id, action, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newUser.id, // User is both admin and subject for self-registration
        'user_registered',
        JSON.stringify({
          email: newUser.email,
          user_type: newUser.user_type,
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
        message: 'Registration successful',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          userType: newUser.user_type,
          rewardPoints: newUser.reward_points,
          isVerified: newUser.is_verified,
          createdAt: newUser.created_at
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Registration error:', error);

    return NextResponse.json(
      {
        error: 'Registration failed',
        message: 'An unexpected error occurred during registration'
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