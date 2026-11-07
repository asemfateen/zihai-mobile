import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

let JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL CONFIG ERROR: JWT_SECRET must be set in production!')
  }
  console.warn('WARNING: No JWT_SECRET set. Using insecure development fallback. Do not run in production without setting JWT_SECRET.')
  JWT_SECRET = 'zihai-dev-insecure-secret-do-not-use-in-production'
}

const isSecure = process.env.NODE_ENV === 'production'
export const cookieOptions = {
  httpOnly: true,
  sameSite: isSecure ? 'none' : 'lax',
  secure: isSecure,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  next()
}

export function optionalAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET)
    } catch {
      // Ignored for optional auth
    }
  }
  next()
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function csrfProtection(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next()
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const headerToken = req.headers['x-csrf-token']
  const cookieToken = req.cookies?.['xsrf-token']
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  next()
}

export function setCsrfCookie(req, res, next) {
  if (!req.cookies?.['xsrf-token']) {
    const token = generateCsrfToken()
    res.cookie('xsrf-token', token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.set('x-csrf-token', token)
  } else {
    res.set('x-csrf-token', req.cookies['xsrf-token'])
  }
  next()
}

export { JWT_SECRET }
