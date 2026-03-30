const TEMPLATE_API_KEY = process.env.TEMPLATE_API_KEY || '';

export function authMiddleware(req, res, next) {
  if (!TEMPLATE_API_KEY) return next();

  // Allow same-origin requests from the built-in editor (no auth header)
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (!req.headers.authorization && origin.includes(host)) return next();

  const key = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (key !== TEMPLATE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
