const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');

const router = express.Router();

// Dev helper: set a user's role to Admin by email.
// Disable in production by not setting SEED_ADMIN_KEY.
router.post('/', async (req, res) => {
  if (!process.env.SEED_ADMIN_KEY) return res.status(404).json({ error: 'Not found' });
  if (req.headers['x-seed-key'] !== process.env.SEED_ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const db = getDb();
  const user = await db.collection('users').findOne({ email: String(email).trim().toLowerCase() });
  if (!user) return res.status(404).json({ error: 'User not found' });

  await db.collection('users').updateOne({ _id: new ObjectId(user._id) }, { $set: { isAdmin: true } });
  const updated = await db.collection('users').findOne({ _id: new ObjectId(user._id) });
  const { password, ...safe } = updated;
  return res.json({ user: { ...safe, _id: String(updated._id) } });
});

module.exports = router;

