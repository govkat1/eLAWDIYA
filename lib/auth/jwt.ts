import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  userType: 'citizen' | 'admin' | 'super_admin';
  iat: number;
  exp: number;
}

export function generateToken(userId: string, email: string, userType: string = 'citizen'): string {
  const payload = {
    sub: userId,
    email,
    userType,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256'
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    }) as JWTPayload;

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

export async function verifyAuth(authHeader: string | null): Promise<JWTPayload | null> {
  try {
    if (!authHeader) {
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    return payload;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Extract token from Next.js request
export function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// Check if user has admin privileges
export function isAdmin(user: JWTPayload): boolean {
  return user.userType === 'admin' || user.userType === 'super_admin';
}

// Check if user has super admin privileges
export function isSuperAdmin(user: JWTPayload): boolean {
  return user.userType === 'super_admin';
}

// Create a refresh token (longer lasting)
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Verify refresh token
export function verifyRefreshToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== 'refresh') {
      return null;
    }
    return payload.sub;
  } catch (error) {
    return null;
  }
}

// Create password reset token
export function generatePasswordResetToken(email: string): string {
  return jwt.sign(
    { email, type: 'password_reset' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Verify password reset token
export function verifyPasswordResetToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== 'password_reset') {
      return null;
    }
    return payload.email;
  } catch (error) {
    return null;
  }
}

// Middleware for protecting API routes
export function withAuth(handler: (req: NextRequest, user: JWTPayload) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, user);
  };
}

// Middleware for admin-only routes
export function withAdminAuth(handler: (req: NextRequest, user: JWTPayload) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: JWTPayload): Promise<Response> => {
    if (!isAdmin(user)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, user);
  });
}

// Middleware for super admin-only routes
export function withSuperAdminAuth(handler: (req: NextRequest, user: JWTPayload) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: JWTPayload): Promise<Response> => {
    if (!isSuperAdmin(user)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, user);
  });
}

// Rate limiting helper
export const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now - record.lastReset > windowMs) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

// Clean up old rate limit records (call this periodically)
export function cleanupRateLimits(): void {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes

  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.lastReset > windowMs) {
      rateLimitMap.delete(key);
    }
  }
}

// Sanitize user data for client responses
export function sanitizeUser(user: any) {
  const { password_hash, verification_token, ...sanitized } = user;
  return sanitized;
}