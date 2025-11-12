import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '123456789', '12345678', '12345',
    '1234567', '1234567890', 'qwerty', 'abc123', 'password123'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // Check for at least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one letter and one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one character from each category
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export function checkPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
  color: string;
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (!/[a-z]/.test(password)) feedback.push('Include lowercase letters');
  if (!/[A-Z]/.test(password)) feedback.push('Include uppercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Include numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Include special characters');

  // Determine color based on score
  let color = 'red';
  if (score >= 5) color = 'green';
  else if (score >= 4) color = 'yellow';
  else if (score >= 3) color = 'orange';

  return {
    score: Math.min(4, Math.floor(score / 1.5)),
    feedback,
    color
  };
}