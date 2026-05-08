import jwt from 'jsonwebtoken';

const JWT_EXPIRY = '7d';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-jwt-secret-change-this';
}

export function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

