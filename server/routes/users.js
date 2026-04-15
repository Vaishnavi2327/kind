/**
 * Extended users route — public profile, skill tags
 */
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function safeUser(u) {
  if (!u) return null;
  const { password, resetTokenHash, resetTokenExpiresAt, ...rest } = u;
  return rest;
}

function computeTier(completedCount = 0) {
  if (completedCount >= 25) return { tier: 'Gold', minTasks: 25 };
  if (completedCount >= 10) return { tier: 'Silver', minTasks: 10 };
  if (completedCount >= 1)  return { tier: 'Bronze', minTasks: 1 };
  return { tier: null, minTasks: 0 };
}

function computeBadges(completedCount = 0, rating = 0, hasEmergency = false) {
  const badges = [];
  if (completedCount >= 1)  badges.push({ id: 'first-help', label: 'First Help', desc: 'Completed first task' });
  if (completedCount >= 10) badges.push({ id: 'community-hero', label: 'Community Hero', desc: '10 tasks completed' });
  if (completedCount >= 25) badges.push({ id: 'super-volunteer', label: 'Super Volunteer', desc: '25 tasks completed' });
  if (rating >= 4.8 && completedCount >= 3) badges.push({ id: 'top-rated', label: 'Top Rated', desc: 'Rating 4.8+' });
  if (hasEmergency) badges.push({ id: 'emergency-responder', label: 'Emergency Responder', desc: 'Helped in High-urgency task' });
  return badges;
}

// GET /api/users/leaderboard — top volunteers (public)
router.get('/leaderboard', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.collection('tasks').aggregate([
      { $match: { status: 'Completed', helperId: { $exists: true } } },
      { $group: { _id: '$helperId', completedCount: { $sum: 1 } } },
      { $sort: { completedCount: -1 } },
      { $limit: 8 },
    ]).toArray();

    const enriched = await Promise.all(rows.map(async (row) => {
      try {
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(String(row._id)) },
          { projection: { name: 1, rating: 1, location: 1, skills: 1 } },
        );
        if (!user) return null;
        const { tier } = computeTier(row.completedCount);
        return {
          userId: String(row._id),
          name: user.name,
          rating: user.rating || 0,
          location: user.location || '',
          skills: (user.skills || []).slice(0, 3),
          completedCount: row.completedCount,
          tier,
        };
      } catch { return null; }
    }));

    return res.json({ leaderboard: enriched.filter(Boolean) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/public — public volunteer profile
router.get('/:id/public', async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0, resetTokenHash: 0, resetTokenExpiresAt: 0, email: 0 } },
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Task stats
    const completedTasks = await db.collection('tasks').countDocuments({
      helperId: String(user._id), status: 'Completed',
    });
    const hasEmergency = await db.collection('tasks').findOne({
      helperId: String(user._id),
      status: 'Completed',
    }).then(async (t) => {
      if (!t) return false;
      const req = await db.collection('requests').findOne({ _id: new ObjectId(String(t.requestId)) });
      return req?.urgency === 'High';
    }).catch(() => false);

    // Recent reviews about this person as helper
    const recentTasks = await db.collection('tasks')
      .find({ helperId: String(user._id), status: 'Completed' })
      .project({ _id: 1 }).limit(20).toArray();
    const taskIds = recentTasks.map(t => String(t._id));
    const reviews = await db.collection('feedback')
      .find({ taskId: { $in: taskIds } })
      .sort({ createdAt: -1 }).limit(5).toArray();

    const { tier } = computeTier(completedTasks);
    const badges = computeBadges(completedTasks, user.rating || 0, hasEmergency);
    const karma = completedTasks * 10 + Math.round((user.rating || 0) * 5);

    return res.json({
      user: safeUser(user),
      completedTasks,
      tier,
      badges,
      karma,
      skills: user.skills || [],
      reviews,
    });
  } catch {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
});

// GET /api/users/:id — existing (private)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const completedTasks = await db.collection('tasks').countDocuments({
      helperId: String(user._id), status: 'Completed',
    });
    const { tier } = computeTier(completedTasks);
    const badges = computeBadges(completedTasks, user.rating || 0);
    const karma = completedTasks * 10 + Math.round((user.rating || 0) * 5);

    return res.json({ user: { ...safeUser(user), completedTasks, tier, badges, karma } });
  } catch {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
});

module.exports = router;
