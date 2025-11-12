import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/jwt';
import { query } from '@/lib/database';

export async function POST(request: NextRequest) {
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

    // Log logout
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    await query(
      `INSERT INTO admin_logs (admin_id, action, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.sub,
        'logout',
        JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString()
        }),
        ip,
        request.headers.get('user-agent') || null
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Logout successful'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Logout error:', error);

    return NextResponse.json(
      {
        error: 'Logout failed',
        message: 'An unexpected error occurred during logout'
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