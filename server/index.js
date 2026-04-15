require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectMongo, closeMongo } = require('./db/mongo');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const taskRoutes = require('./routes/tasks');
const chatRoutes = require('./routes/chat');
const feedbackRoutes = require('./routes/feedback');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const seedAdminRoutes = require('./routes/seed-admin');
const complaintRoutes = require('./routes/complaints');
const chatbotRoutes = require('./routes/chatbot');
const statsRoutes = require('./routes/stats');

async function main() {
  await connectMongo();

  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  app.get('/api/chatbot-debug', (req, res) => res.json({ inline: true }));
  app.use('/api/stats', statsRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/seed-admin', seedAdminRoutes);
  app.use('/api/complaints', complaintRoutes);

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // fallback to landing page
  app.get(/.*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`kindlink running on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeMongo();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

