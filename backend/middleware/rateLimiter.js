import rateLimit from 'express-rate-limit'

const isProd = process.env.NODE_ENV === 'production'

export const authLimiter = isProd
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next()

export const apiLimiter = isProd
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      message: { error: 'Too many requests. Please slow down.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next()
