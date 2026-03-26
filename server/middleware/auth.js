const TEMPLATE_API_KEY = process.env.TEMPLATE_API_KEY || '';

export function authMiddleware(req, res, next) {
  if (!TEMPLATE_API_KEY) return next(); // skip if not configured
  const key = req.headers.authorization?.replace('Bearer ', '');
  if (key !== TEMPLATE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
