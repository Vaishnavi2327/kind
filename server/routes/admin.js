/**
 * Extended admin routes — broadcast, CSV, pin, flagged requests
 */
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Existing endpoints ───────────────────────────────────────────────────────

router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const [totalUsers, totalRequests, completedTasks, totalTasks, openRequests, flaggedCount] = await Promise.all([
    db.collection('users').countDocuments({}),
    db.collection('requests').countDocuments({}),
    db.collection('tasks').countDocuments({ status: 'Completed' }),
    db.collection('tasks').countDocuments({}),
    db.collection('requests').countDocuments({ status: 'Open' }),
    db.collection('requests').countDocuments({ flagged: true }),
  ]);
  const completionRate = totalTasks ? Number(((completedTasks / totalTasks) * 100).toFixed(2)) : 0;

  // Requests by category for chart
  const byCat = await db.collection('requests').aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  // Tasks by status
  const byStatus = await db.collection('tasks').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).toArray();

  // New requests per day (last 14 days)
  const since = new Date(Date.now() - 14 * 86400000);
  const dailyRaw = await db.collection('requests').aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  return res.json({
    totalUsers, totalRequests, totalTasks, completedTasks, completionRate,
    openRequests, flaggedCount,
    byCat: byCat.map(x => ({ category: x._id || 'Unknown', count: x.count })),
    byStatus: byStatus.map(x => ({ status: x._id || 'Unknown', count: x.count })),
    daily: dailyRaw.map(x => ({ date: x._id, count: x.count })),
  });
});

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const users = await db.collection('users')
    .find({})
    .project({ password: 0, resetTokenHash: 0, resetTokenExpiresAt: 0 })
    .sort({ createdAt: -1 }).limit(500).toArray();
  return res.json({ users: users.map(u => ({ ...u, _id: String(u._id) })) });
});

router.post('/users/:id/ban', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  await db.collection('users').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { isBanned: Boolean(req.body?.banned) } },
  );
  return res.json({ ok: true });
});

router.get('/requests', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const requests = await db.collection('requests')
    .find({}).sort({ pinned: -1, createdAt: -1 }).limit(500).toArray();
  return res.json({ requests });
});

router.get('/feedback', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const feedback = await db.collection('feedback').find({}).sort({ createdAt: -1 }).limit(500).toArray();
  const agg = await db.collection('feedback').aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).toArray();

  // Populate user details for both givenBy and againstUser
  const userIds = [...new Set(feedback.map(f => [f.givenBy, f.againstUser]).flat())];
  const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }).toArray();
  const userMap = users.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const enriched = feedback.map(f => ({
    ...f,
    givenByUser: userMap[f.givenBy] || { name: 'Unknown', email: 'Unknown' },
    againstUserUser: userMap[f.againstUser] || { name: 'Unknown', email: 'Unknown' }
  }));

  return res.json({
    feedback: enriched,
    summary: { count: agg[0]?.count || 0, avg: agg[0]?.avg ? Number(agg[0].avg.toFixed(2)) : 0 },
  });
});

// ── New endpoints ────────────────────────────────────────────────────────────

// GET /api/admin/complaints/all
router.get('/complaints/all', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const [task, general] = await Promise.all([
    db.collection('complaints').find({}).sort({ createdAt: -1 }).limit(200).toArray(),
    db.collection('general_complaints').find({}).sort({ createdAt: -1 }).limit(200).toArray(),
  ]);

  // Populate user details for task complaints
  const taskUserIds = [...new Set(task.map(c => [c.complainBy, c.againstUser]).flat())];
  const taskUsers = await db.collection('users').find({ _id: { $in: taskUserIds.map(id => new ObjectId(id)) } }).toArray();
  const taskUserMap = taskUsers.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const enrichedTask = task.map(c => ({
    ...c,
    complainByUser: taskUserMap[c.complainBy] || { name: 'Unknown', email: 'Unknown' },
    againstUserUser: taskUserMap[c.againstUser] || { name: 'Unknown', email: 'Unknown' }
  }));

  // Populate user details for general complaints
  const generalUserIds = [...new Set(general.map(c => c.complainBy))];
  const generalUsers = await db.collection('users').find({ _id: { $in: generalUserIds.map(id => new ObjectId(id)) } }).toArray();
  const generalUserMap = generalUsers.reduce((acc, user) => {
    acc[String(user._id)] = { name: user.name, email: user.email };
    return acc;
  }, {});
  
  const enrichedGeneral = general.map(c => ({
    ...c,
    complainByUser: generalUserMap[c.complainBy] || { name: 'Unknown', email: 'Unknown' }
  }));

  return res.json({ complaints: enrichedTask, generalComplaints: enrichedGeneral });
});

// POST /api/admin/requests/:id/pin — toggle pin
router.post('/requests/:id/pin', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const existing = await db.collection('requests').findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.collection('requests').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { pinned: !existing.pinned } },
  );
  return res.json({ pinned: !existing.pinned });
});

// GET /api/admin/flagged — flagged requests
router.get('/flagged', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const requests = await db.collection('requests')
    .find({ flagged: true }).sort({ createdAt: -1 }).toArray();
  return res.json({ requests });
});

// POST /api/admin/broadcast — notify all users
router.post('/broadcast', requireAuth, requireAdmin, async (req, res) => {
  const { message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message required' });
  const db = getDb();
  const users = await db.collection('users').find({}, { projection: { _id: 1 } }).toArray();
  const now = new Date();
  const notifications = users.map(u => ({
    userId: String(u._id),
    message: String(message).trim(),
    read: false,
    isBroadcast: true,
    createdAt: now,
  }));
  if (notifications.length) await db.collection('notifications').insertMany(notifications);
  return res.json({ sent: notifications.length });
});

// GET /api/admin/export/users - CSV download
router.get('/export/users', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
  const header = 'ID,Name,Email,Pincode,Location,Rating,IsAdmin,IsBanned,CreatedAt';
  const rows = users.map(u =>
    [
      String(u._id), `"${(u.name||'').replace(/"/g,'""')}"`, `"${(u.email||'').replace(/"/g,'""')}"`,
      u.pincode || '', `"${(u.location||'').replace(/"/g,'""')}"`,
      u.rating || 0, u.isAdmin ? 'Yes' : 'No', u.isBanned ? 'Yes' : 'No',
      u.createdAt ? new Date(u.createdAt).toISOString() : '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-users.csv"');
  return res.send(csv);
});

// GET /api/admin/export/requests - CSV download
router.get('/export/requests', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const requests = await db.collection('requests').find({}).sort({ createdAt: -1 }).toArray();
  const header = 'ID,Title,Category,Urgency,Status,Pincode,Location,VolunteersNeeded,AcceptedCount,PostedBy,CreatedAt,Deadline';
  const rows = requests.map(r =>
    [
      String(r._id), `"${(r.title||'').replace(/"/g,'""')}"`,
      r.category, r.urgency, r.status,
      r.pincode, `"${(r.location||'').replace(/"/g,'""')}"`,
      r.volunteersNeeded || 1,
      Array.isArray(r.acceptedBy) ? r.acceptedBy.length : 0,
      r.postedBy || '',
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
      r.deadline ? new Date(r.deadline).toISOString() : '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-requests.csv"');
  return res.send(csv);
});

// GET /api/admin/export/tasks - CSV download
router.get('/export/tasks', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
  const header = 'ID,RequestID,RequesterID,HelperID,Status,AcceptedAt,CompletedAt,CreatedAt';
  const rows = tasks.map(t =>
    [
      String(t._id), t.requestId || '', t.requesterId || '', t.helperId || '',
      t.status, t.acceptedAt ? new Date(t.acceptedAt).toISOString() : '',
      t.completedAt ? new Date(t.completedAt).toISOString() : '',
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-tasks.csv"');
  return res.send(csv);
});

// GET /api/admin/export/feedback - CSV download
router.get('/export/feedback', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const feedback = await db.collection('feedback').find({}).sort({ createdAt: -1 }).toArray();
  const header = 'ID,TaskID,Rating,Comment,GivenBy,AgainstUser,CreatedAt';
  const rows = feedback.map(f =>
    [
      String(f._id), f.taskId || '', f.rating || '',
      `"${(f.comment||'').replace(/"/g,'""')}"`, f.givenBy || '', f.againstUser || '',
      f.createdAt ? new Date(f.createdAt).toISOString() : '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-feedback.csv"');
  return res.send(csv);
});

// GET /api/admin/export/complaints - CSV download
router.get('/export/complaints', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const [taskComplaints, generalComplaints] = await Promise.all([
    db.collection('complaints').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('general_complaints').find({}).sort({ createdAt: -1 }).toArray(),
  ]);
  
  // Task complaints
  const taskHeader = 'ID,TaskID,ComplainBy,AgainstUser,Reason,Status,CreatedAt,ResolvedAt';
  const taskRows = taskComplaints.map(c =>
    [
      String(c._id), c.taskId || '', c.complainBy || '', c.againstUser || '',
      `"${(c.reason||'').replace(/"/g,'""')}"`, c.status || '',
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.resolvedAt ? new Date(c.resolvedAt).toISOString() : '',
    ].join(',')
  );
  
  // General complaints
  const generalHeader = 'ID,ComplainBy,Reason,Status,CreatedAt,ResolvedAt';
  const generalRows = generalComplaints.map(c =>
    [
      String(c._id), c.complainBy || '',
      `"${(c.reason||'').replace(/"/g,'""')}"`, c.status || '',
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.resolvedAt ? new Date(c.resolvedAt).toISOString() : '',
    ].join(',')
  );
  
  const csv = [
    'TASK COMPLAINTS',
    taskHeader,
    ...taskRows,
    '',
    'GENERAL COMPLAINTS',
    generalHeader,
    ...generalRows
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-complaints.csv"');
  return res.send(csv);
});

// GET /api/admin/export/analytics - CSV download
router.get('/export/analytics', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  
  // Get analytics data
  const [
    totalUsers, totalRequests, totalTasks, completedTasks,
    openRequests, requestsByCategory, tasksByStatus,
    feedbackStats, recentActivity
  ] = await Promise.all([
    db.collection('users').countDocuments({}),
    db.collection('requests').countDocuments({}),
    db.collection('tasks').countDocuments({}),
    db.collection('tasks').countDocuments({ status: 'Completed' }),
    db.collection('requests').countDocuments({ status: 'Open' }),
    db.collection('requests').aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray(),
    db.collection('tasks').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray(),
    db.collection('feedback').aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]).toArray(),
    db.collection('requests').aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray()
  ]);
  
  const csv = [
    'KINDLINK ANALYTICS REPORT',
    `Generated: ${new Date().toISOString()}`,
    '',
    'OVERVIEW',
    'Metric,Count',
    `Total Users,${totalUsers}`,
    `Total Requests,${totalRequests}`,
    `Total Tasks,${totalTasks}`,
    `Completed Tasks,${completedTasks}`,
    `Open Requests,${openRequests}`,
    `Completion Rate,${totalTasks ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0}%`,
    '',
    'REQUESTS BY CATEGORY',
    'Category,Count',
    ...requestsByCategory.map(r => `"${r._id || 'Unknown'}",${r.count}`),
    '',
    'TASKS BY STATUS',
    'Status,Count',
    ...tasksByStatus.map(r => `"${r._id || 'Unknown'}",${r.count}`),
    '',
    'FEEDBACK STATISTICS',
    'Metric,Value',
    `Total Feedback,${feedbackStats[0]?.count || 0}`,
    `Average Rating,${feedbackStats[0]?.avgRating ? feedbackStats[0].avgRating.toFixed(2) : 0}`,
    '',
    'RECENT ACTIVITY (LAST 30 DAYS)',
    'Date,New Requests',
    ...recentActivity.map(r => `${r._id},${r.count}`)
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kindlink-analytics.csv"');
  return res.send(csv);
});

module.exports = router;
