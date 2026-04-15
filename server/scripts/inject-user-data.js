/**
 * Inject dummy tasks/requests/history for ALL non-seed users.
 * Safe to re-run - won't double-add if tasks already exist.
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('kindlink');

  // Grab a seeded "priya" as requester and "sneha" as a requester to use as task base
  const priya = await db.collection('users').findOne({ email: 'priya@demo.com' });
  const sneha = await db.collection('users').findOne({ email: 'sneha@demo.com' });
  const rahul = await db.collection('users').findOne({ email: 'rahul@demo.com' });

  if (!priya || !sneha || !rahul) {
    console.log('Seed users not found. Please run seed.js first.');
    await client.close();
    return;
  }

  // Find a completed seed request to use as demo history
  let completedReq = await db.collection('requests').findOne({ status: 'Completed', isSeedData: true });
  if (!completedReq) completedReq = await db.collection('requests').findOne({ isSeedData: true });

  // Find open seeds request to act as "accepted task" base
  let openReq = await db.collection('requests').findOne({ status: { $in: ['Open', 'In Progress'] }, isSeedData: true });

  // Non-seed user ids
  const NON_SEED_EMAILS = [
    'pranjal.mishra@gmail.com',
    'student7@gmail.com',
    'ramesh.gupta@demo.com',
    'kavya.naidu@demo.com',
    'mohit.tyagi@demo.com',
  ];

  const targetUsers = await db.collection('users').find({ email: { $in: NON_SEED_EMAILS } }).toArray();

  for (const user of targetUsers) {
    const uid = String(user._id);
    console.log(`Processing: ${user.email}...`);

    const existingTasks = await db.collection('tasks').countDocuments({
      $or: [{ helperId: uid }, { requesterId: uid }],
    });

    if (existingTasks > 0) {
      console.log(`  -> Already has ${existingTasks} tasks, skipping.`);
      continue;
    }

    // 1. A request they posted
    const myReq = await db.collection('requests').insertOne({
      title: 'Help Organizing Neighborhood Cleanup Drive',
      description: 'Looking for 3 volunteers to help clean up the local park this Sunday morning. Garbage bags and gloves will be provided.',
      category: 'Community', location: user.location || 'Local Area', pincode: user.pincode || '110001',
      urgency: 'Low', volunteersNeeded: 3, deadline: new Date(Date.now() + 2 * 86400000),
      status: 'Open', postedBy: uid, acceptedBy: [],
      isSeedData: false, createdAt: new Date(Date.now() - 86400000),
    });

    // 2. An active task (they are the helper)
    if (openReq) {
      const t1 = await db.collection('tasks').insertOne({
        requestId: String(openReq._id), requesterId: String(priya._id), helperId: uid,
        status: 'In Progress', acceptedAt: new Date(Date.now() - 2 * 86400000), completedAt: null,
      });
      await db.collection('requests').updateOne({ _id: openReq._id }, {
        $addToSet: { acceptedBy: uid },
        $set: { status: 'In Progress' },
      });
      // Chat message in this task
      await db.collection('chat').insertOne({
        taskId: String(t1.insertedId), senderId: String(priya._id), senderName: priya.name,
        message: `Hi! Thanks for accepting this task. When are you available?`,
        timestamp: new Date(),
      });
    }

    // 3. A completed task in history (they were the helper)
    if (completedReq) {
      const t2 = await db.collection('tasks').insertOne({
        requestId: String(completedReq._id), requesterId: String(priya._id), helperId: uid,
        status: 'Completed', acceptedAt: new Date(Date.now() - 18 * 86400000), completedAt: new Date(Date.now() - 15 * 86400000),
      });
      // Feedback on that completed task
      await db.collection('feedback').insertOne({
        taskId: String(t2.insertedId), givenBy: String(priya._id), rating: 5,
        comment: 'Wonderful helper! Very punctual and kind.',
        createdAt: new Date(Date.now() - 15 * 86400000),
      });
    }

    // 4. A notification
    await db.collection('notifications').insertOne({
      userId: uid,
      message: `Welcome to kindlink! You have an active task waiting. Check "My Tasks" to begin.`,
      read: false, createdAt: new Date(),
    });

    console.log(`  -> Done (request + active task + history + notification)`);
  }

  await client.close();
  console.log('\nAll done!');
}

main().catch(e => { console.error(e); process.exit(1); });
