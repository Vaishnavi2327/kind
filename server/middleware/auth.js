const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');

function getTokenFromHeader(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, isAdmin? }

    const db = getDb();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(String(payload.userId)) });
    if (!userDoc) return res.status(401).json({ error: 'User not found' });
    if (userDoc.isBanned) return res.status(403).json({ error: 'You are banned from the platform' });
    req.userDoc = userDoc;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  return next();
}

// Backwards-compat shim (older code may still import requireRole)
function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes('Admin')) return requireAdmin(req, res, next);
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { requireAuth, requireAdmin, requireRole };
