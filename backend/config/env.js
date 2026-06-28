const requiredInProduction = ['JWT_SECRET'];

export function validateEnvironment() {
  const missing = requiredInProduction.filter((name) => !process.env[name]);

  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production' && getAllowedOrigins().length === 0) {
    throw new Error('CORS_ORIGIN must be set in production.');
  }

  if (!process.env.JWT_SECRET) {
    console.warn('JWT_SECRET is not set. Development fallback is active; set JWT_SECRET before deployment.');
  }
}

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'development-only-change-me';
}

export function getAllowedOrigins() {
  return (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
