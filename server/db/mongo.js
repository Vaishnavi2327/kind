const { MongoClient } = require('mongodb');

let client;
let db;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function connectMongo() {
  if (db) return db;
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB');

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  // Allow both requester and helper to submit feedback for same task.
  try {
    await db.collection('feedback').dropIndex('taskId_1');
  } catch {}

  // Drop old complaints index that may have a conflicting partialFilterExpression.
  try {
    await db.collection('complaints').dropIndex('taskId_1_complainBy_1');
  } catch {}

  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ pincode: 1 }),
    db.collection('users').createIndex({ isBanned: 1 }),
    db.collection('users').createIndex({ isAdmin: 1 }),
    db.collection('requests').createIndex({ status: 1, createdAt: -1 }),
    db.collection('requests').createIndex({ postedBy: 1, createdAt: -1 }),
    db.collection('requests').createIndex({ pincode: 1, status: 1, createdAt: -1 }),
    db.collection('tasks').createIndex({ requesterId: 1, status: 1, acceptedAt: -1 }),
    db.collection('tasks').createIndex({ helperId: 1, status: 1, acceptedAt: -1 }),
    db.collection('tasks').createIndex({ requestId: 1, helperId: 1 }, { unique: true }),
    db.collection('feedback').createIndex({ taskId: 1, givenBy: 1 }, { unique: true }),
    db.collection('chat').createIndex({ taskId: 1, timestamp: 1 }),
    db.collection('chat').createIndex({ requestId: 1, timestamp: 1 }),
    db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('complaints').createIndex({ complainBy: 1, createdAt: -1 }),
    db.collection('complaints').createIndex({ status: 1, createdAt: -1 }),
    db.collection('complaints').createIndex({ taskId: 1, complainBy: 1 }, { unique: true }),
    db.collection('general_complaints').createIndex({ status: 1, createdAt: -1 }),
    db.collection('general_complaints').createIndex({ complainBy: 1, createdAt: -1 }),
  ]);

  return db;
}

function getDb() {
  if (!db) throw new Error('Mongo not connected. Call connectMongo() first.');
  return db;
}

async function closeMongo() {
  try {
    await client?.close();
  } finally {
    client = undefined;
    db = undefined;
  }
}

module.exports = { connectMongo, getDb, closeMongo };
