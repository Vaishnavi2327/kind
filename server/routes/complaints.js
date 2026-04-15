const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/mine', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = String(req.user.userId);
  const complaints = await db
    .collection('complaints')
    .find({ complainBy: userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  
  // Populate user details
  const userIds = [...new Set(complaints.map(c => [c.complainBy, c.againstUser]).flat())];
  const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }).toArray();
  const userMap = users.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const complaintsWithUsers = complaints.map(complaint => ({
    ...complaint,
    complainByUser: userMap[complaint.complainBy] || { name: 'Unknown', email: 'Unknown' },
    againstUserUser: userMap[complaint.againstUser] || { name: 'Unknown', email: 'Unknown' }
  }));
  
  return res.json({ complaints: complaintsWithUsers });
});

router.post('/', requireAuth, async (req, res) => {
  const { taskId, reason } = req.body || {};
  if (!taskId || !reason || !String(reason).trim()) return res.status(400).json({ error: 'Missing fields' });

  const db = getDb();
  const task = await db.collection('tasks').findOne({ _id: new ObjectId(taskId) });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const me = String(req.user.userId);
  const requesterId = String(task.requesterId);
  const helperId = String(task.helperId);
  const isParticipant = [requesterId, helperId].includes(me);
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

  const againstUser = me === requesterId ? helperId : requesterId;
  const doc = {
    taskId: String(taskId),
    complainBy: me,
    againstUser,
    reason: String(reason).trim(),
    status: 'Open',
    createdAt: new Date(),
  };

  try {
    const ins = await db.collection('complaints').insertOne(doc);
    const saved = await db.collection('complaints').findOne({ _id: ins.insertedId });
    return res.json({ complaint: saved });
  } catch (e) {
    if (String(e?.code) === '11000') return res.status(409).json({ error: 'Complaint already submitted for this task' });
    return res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// General complaint: not tied to a task. Visible only to admin.
router.post('/general', requireAuth, async (req, res) => {
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Reason is required' });

  const db = getDb();
  const doc = {
    complainBy: String(req.user.userId),
    reason: String(reason).trim(),
    status: 'Open',
    createdAt: new Date(),
  };
  const ins = await db.collection('general_complaints').insertOne(doc);
  const saved = await db.collection('general_complaints').findOne({ _id: ins.insertedId });
  return res.json({ complaint: saved });
});

router.get('/general/all', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const complaints = await db
    .collection('general_complaints')
    .find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  
  // Populate user details
  const userIds = [...new Set(complaints.map(c => c.complainBy))];
  const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }).toArray();
  const userMap = users.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const complaintsWithUsers = complaints.map(complaint => ({
    ...complaint,
    complainByUser: userMap[complaint.complainBy] || { name: 'Unknown', email: 'Unknown' }
  }));
  
  return res.json({ complaints: complaintsWithUsers });
});

router.post('/general/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  await db.collection('general_complaints').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'Resolved', resolvedAt: new Date() } },
  );
  return res.json({ ok: true });
});

// Admin: list all complaints
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const complaints = await db
    .collection('complaints')
    .find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  
  // Populate user details
  const userIds = [...new Set(complaints.map(c => [c.complainBy, c.againstUser]).flat())];
  const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }).toArray();
  const userMap = users.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const complaintsWithUsers = complaints.map(complaint => ({
    ...complaint,
    complainByUser: userMap[complaint.complainBy] || { name: 'Unknown', email: 'Unknown' },
    againstUserUser: userMap[complaint.againstUser] || { name: 'Unknown', email: 'Unknown' }
  }));
  
  return res.json({ complaints: complaintsWithUsers });
});

router.post('/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  await db.collection('complaints').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'Resolved', resolvedAt: new Date() } },
  );
  return res.json({ ok: true });
});

module.exports = router;

