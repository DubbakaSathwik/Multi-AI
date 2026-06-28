import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export function getOptionalUserId(request) {
  const auth = request.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(auth.split(' ')[1], getJwtSecret());
    return decoded.id || null;
  } catch {
    return null;
  }
}

export function ownerQuery(request) {
  const userId = getOptionalUserId(request);
  const clientId = request.body?.clientId || request.query?.clientId;
  return userId ? { userId } : { clientId };
}
