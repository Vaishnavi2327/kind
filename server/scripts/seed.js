/**
 * kindlink Seed Script
 * Creates demo users, requests, tasks, chat messages, notifications, and feedback.
 * Run: node server/scripts/seed.js
 *
 * Demo credentials after running:
 *   Requester : priya@demo.com  / demo1234
 *   Volunteer : rahul@demo.com  / demo1234
 *   Volunteer : sneha@demo.com  / demo1234
 *   Admin     : admin@demo.com  / admin1234
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'kindlink');

  // Guard: drop all existing tracking if replacing
  console.log('[0/6] Cleaning up old data...');
  // We'll KEEP users so the user's manual account remains!
  await db.collection('users').deleteMany({ isSeedData: true });
  await db.collection('requests').deleteMany({});
  await db.collection('tasks').deleteMany({});
  await db.collection('chat').deleteMany({});
  await db.collection('feedback').deleteMany({});
  await db.collection('notifications').deleteMany({});
  await db.collection('complaints').deleteMany({});

  const hash = (p) => bcrypt.hash(p, 10);
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
  const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

  // ── Users ────────────────────────────────────────────────────────────────
  console.log('[1/6] Creating users...');
  const userDocs = [
    {
      name: 'Priya Sharma',
      email: 'priya@demo.com',
      password: await hash('demo1234'),
      location: 'Banjara Hills, Hyderabad',
      pincode: '500034',
      rating: 4.6, ratingCount: 7,
      isAdmin: false, isBanned: false, isSeedData: true,
      createdAt: daysAgo(30),
    },
    {
      name: 'Rahul Kumar',
      email: 'rahul@demo.com',
      password: await hash('demo1234'),
      location: 'Jubilee Hills, Hyderabad',
      pincode: '500033',
      rating: 4.8, ratingCount: 12,
      isAdmin: false, isBanned: false, isSeedData: true,
      createdAt: daysAgo(25),
    },
    {
      name: 'Sneha Reddy',
      email: 'sneha@demo.com',
      password: await hash('demo1234'),
      location: 'Madhapur, Hyderabad',
      pincode: '500081',
      rating: 4.3, ratingCount: 5,
      isAdmin: false, isBanned: false, isSeedData: true,
      createdAt: daysAgo(20),
    },
    {
      name: 'Arjun Singh',
      email: 'arjun@demo.com',
      password: await hash('demo1234'),
      location: 'Kurnool',
      pincode: '518001',
      rating: 4.0, ratingCount: 3,
      isAdmin: false, isBanned: false, isSeedData: true,
      createdAt: daysAgo(15),
    },
    {
      name: 'Demo Admin',
      email: 'admin@demo.com',
      password: await hash('admin1234'),
      location: 'Hyderabad',
      pincode: '500001',
      rating: 5.0, ratingCount: 1,
      isAdmin: true, isBanned: false, isSeedData: true,
      createdAt: daysAgo(60),
    },
  ];
  const { insertedIds: uIds } = await db.collection('users').insertMany(userDocs);
  const [priyaId, rahulId, snehaId, arjunId] = Object.values(uIds).map(String);

  // ── Requests ─────────────────────────────────────────────────────────────
  console.log('[2/6] Creating requests...');
  const requestDocs = [
    {
      title: 'Math Tutor Needed for Class 10 Board Exam',
      description: 'My daughter is appearing for Class 10 boards in 3 weeks and needs urgent help with Algebra and Geometry. Looking for someone who can teach 2 hours daily. She is a quick learner — just needs guidance on problem-solving techniques.',
      category: 'Education', location: 'Banjara Hills, Hyderabad', pincode: '500034',
      urgency: 'High', volunteersNeeded: 1, deadline: daysFromNow(14),
      status: 'In Progress', postedBy: priyaId, acceptedBy: [rahulId],
      isSeedData: true, createdAt: daysAgo(5),
    },
    {
      title: 'Weekly Grocery Run for Elderly Father',
      description: 'My 78-year-old father lives alone in Jubilee Hills. He needs a weekly grocery run to the nearby supermarket — maybe 45 minutes of help. He can provide the list and money. The building has no elevator so a bit of heavy lifting is involved.',
      category: 'Groceries', location: 'Jubilee Hills, Hyderabad', pincode: '500033',
      urgency: 'Medium', volunteersNeeded: 1, deadline: null,
      status: 'Open', postedBy: snehaId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(3),
    },
    {
      title: 'Transport Needed: Dialysis 3x Per Week',
      description: 'My uncle requires dialysis treatment every Monday, Wednesday, and Friday at Apollo Hospital, Jubilee Hills. We do not own a vehicle and cannot afford an auto every time. Need someone with a car who can help for at least 2-3 weeks.',
      category: 'Transport', location: 'Madhapur, Hyderabad', pincode: '500081',
      urgency: 'High', volunteersNeeded: 1, deadline: null,
      status: 'Open', postedBy: priyaId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(2),
    },
    {
      title: 'Home Tuition for Science (Class 8)',
      description: 'Looking for a volunteer to tutor my son in Physics and Chemistry, twice a week for about an hour each session. He is in Class 8 and needs conceptual clarity, not just rote learning. Any engineering or science background preferred.',
      category: 'Education', location: 'Kurnool', pincode: '518001',
      urgency: 'Low', volunteersNeeded: 1, deadline: null,
      status: 'Open', postedBy: arjunId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(7),
    },
    {
      title: 'Childcare Help for 3 Hours (Saturday Mornings)',
      description: 'I am a single working mother with an important weekly work call every Saturday morning from 9 AM to 12 PM. I need a reliable person to watch my 4-year-old son during this time. Toys, snacks, and lunch provided. Located in Banjara Hills.',
      category: 'Children', location: 'Banjara Hills, Hyderabad', pincode: '500034',
      urgency: 'Medium', volunteersNeeded: 1, deadline: daysFromNow(4),
      status: 'Open', postedBy: priyaId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(1),
    },
    {
      title: 'Urgent: Blood Donors or Coordinator Needed (O+)',
      description: 'My neighbour\'s father underwent emergency surgery at KIMS Hospital, Kurnool and urgently needs O+ blood. We need help reaching out to blood banks and potential donors. Even 1-2 hours of calling and coordination would make a life-saving difference.',
      category: 'Medical', location: 'Kurnool', pincode: '518001',
      urgency: 'High', volunteersNeeded: 2, deadline: daysFromNow(1),
      status: 'In Progress', postedBy: arjunId, acceptedBy: [rahulId],
      isSeedData: true, createdAt: daysAgo(1),
    },
    {
      title: 'Help Elderly Neighbour Move Furniture (2 hrs)',
      description: 'My elderly neighbour (age 72) is downsizing to a smaller flat on the same floor. She needs help moving a sofa, a bookshelf, and two chairs. Should take 2 hours with 2-3 people. She will provide refreshments.',
      category: 'Elderly Care', location: 'Jubilee Hills, Hyderabad', pincode: '500033',
      urgency: 'Low', volunteersNeeded: 3, deadline: daysFromNow(5),
      status: 'Open', postedBy: snehaId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(2),
    },
    {
      title: 'Disability Support: Wheelchair Ramp Assistance',
      description: 'My cousin who uses a wheelchair visits my house every week. The ramp access needs a helper to guide the wheelchair safely. Looking for someone physically able who can help every Sunday for about 30 minutes.',
      category: 'Disability Support', location: 'Madhapur, Hyderabad', pincode: '500081',
      urgency: 'Medium', volunteersNeeded: 1, deadline: null,
      status: 'Open', postedBy: priyaId, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(4),
    },
    // Completed request for history/feedback demo
    {
      title: 'Grocery Shopping Assistance (Last Month)',
      description: 'Weekly grocery shopping help needed.',
      category: 'Groceries', location: 'Banjara Hills, Hyderabad', pincode: '500034',
      urgency: 'Low', volunteersNeeded: 1, deadline: null,
      status: 'Completed', postedBy: priyaId, acceptedBy: [snehaId],
      isSeedData: true, createdAt: daysAgo(20),
    },
  ];
  const { insertedIds: rIds } = await db.collection('requests').insertMany(requestDocs);
  const reqIdArr = Object.values(rIds).map(String);
  const [mathId, , , , , bloodId, , , completedId] = reqIdArr;

  // ── Tasks ─────────────────────────────────────────────────────────────────
  console.log('[3/6] Creating tasks...');
  // Priya has Math task handled by Rahul
  const t1 = await db.collection('tasks').insertOne({
    requestId: mathId, requesterId: priyaId, helperId: rahulId,
    status: 'In Progress', isSeedData: true, acceptedAt: daysAgo(4), completedAt: null,
  });
  // Arjun has Blood task handled by Rahul
  await db.collection('tasks').insertOne({
    requestId: bloodId, requesterId: arjunId, helperId: rahulId,
    status: 'In Progress', isSeedData: true, acceptedAt: daysAgo(1), completedAt: null,
  });
  // Admin testing dummy - let's make admin help Priya with Childcare
  await db.collection('tasks').insertOne({
    requestId: String(rIds['4']), requesterId: priyaId, helperId: String(uIds['4']),
    status: 'In Progress', isSeedData: true, acceptedAt: daysAgo(1), completedAt: null,
  });
  // Add another testing dummy - Sneha's Grocery task is handled by Admin
  await db.collection('tasks').insertOne({
    requestId: String(rIds['1']), requesterId: snehaId, helperId: String(uIds['4']),
    status: 'In Progress', isSeedData: true, acceptedAt: daysAgo(2), completedAt: null,
  });
  // Completed Task History for User (Admin helper history)
  await db.collection('tasks').insertOne({
    requestId: completedId, requesterId: priyaId, helperId: String(uIds['4']),
    status: 'Completed', isSeedData: true, acceptedAt: daysAgo(18), completedAt: daysAgo(15),
  });
  // Completed Task by Sneha
  await db.collection('tasks').insertOne({
    requestId: completedId, requesterId: arjunId, helperId: snehaId,
    status: 'Completed', isSeedData: true, acceptedAt: daysAgo(20), completedAt: daysAgo(18),
  });
  
  // Make sure requests map acceptedBy to admin ID for matching seeded tasks
  await db.collection('requests').updateOne({ _id: rIds['4'] }, { $push: { acceptedBy: String(uIds['4']) }, $set: { status: 'In Progress' } });
  await db.collection('requests').updateOne({ _id: rIds['1'] }, { $push: { acceptedBy: String(uIds['4']) }, $set: { status: 'In Progress' } });
  await db.collection('requests').updateOne({ _id: rIds['8'] }, { $addToSet: { acceptedBy: String(uIds['4']) } });


  // ── Feedback ──────────────────────────────────────────────────────────────
  console.log('[4/6] Creating feedback...');
  await db.collection('feedback').insertMany([
    {
      taskId: completedId, givenBy: priyaId, rating: 5,
      comment: 'Sneha was absolutely fantastic — prompt, cheerful, and very careful with my father\'s items. Would recommend to anyone!',
      isSeedData: true, createdAt: daysAgo(15),
    },
    {
      taskId: completedId, givenBy: snehaId, rating: 5,
      comment: 'Priya was very clear with the list and made the task easy. Great experience volunteering for her.',
      isSeedData: true, createdAt: daysAgo(14),
    },
  ]);

  // ── Chat messages ─────────────────────────────────────────────────────────
  console.log('[5/6] Creating chat messages...');
  const taskId = String(t1.insertedId);
  const base = daysAgo(4).getTime();
  await db.collection('chat').insertMany([
    {
      taskId, senderId: rahulId, senderName: 'Rahul Kumar',
      message: 'Hi Priya! I am Rahul. I just accepted your tutoring request. I have a B.Sc. in Mathematics and 2 years of teaching experience. When is the best time to start?',
      isSeedData: true, timestamp: new Date(base),
    },
    {
      taskId, senderId: priyaId, senderName: 'Priya Sharma',
      message: 'Hi Rahul! Thank you so much for accepting. Evening sessions work best — 5 PM to 7 PM. Can you start tomorrow?',
      isSeedData: true, timestamp: new Date(base + 18 * 60_000),
    },
    {
      taskId, senderId: rahulId, senderName: 'Rahul Kumar',
      message: 'Absolutely! I\'ll be there by 5 PM sharp. Could you please share the address and the chapters to focus on first?',
      isSeedData: true, timestamp: new Date(base + 35 * 60_000),
    },
    {
      taskId, senderId: priyaId, senderName: 'Priya Sharma',
      message: 'Flat 302, Galaxy Apartments, Road No. 12, Banjara Hills. Please focus on Quadratic Equations and Properties of Triangles first. She has her unit test in 10 days!',
      isSeedData: true, timestamp: new Date(base + 52 * 60_000),
    },
    {
      taskId, senderId: rahulId, senderName: 'Rahul Kumar',
      message: 'Perfect, I\'ll prepare a focused study plan tonight. See you tomorrow at 5 PM!',
      isSeedData: true, timestamp: new Date(base + 65 * 60_000),
    },
  ]);

  // ── Notifications ─────────────────────────────────────────────────────────
  console.log('[6/6] Creating notifications...');
  await db.collection('notifications').insertMany([
    {
      userId: priyaId,
      message: 'Rahul Kumar accepted your request "Math Tutor Needed for Class 10 Board Exam". Chat is now open!',
      read: true, isSeedData: true, createdAt: daysAgo(4),
    },
    {
      userId: rahulId,
      message: 'You successfully accepted the task "Math Tutor Needed for Class 10 Board Exam".',
      read: true, isSeedData: true, createdAt: daysAgo(4),
    },
    {
      userId: priyaId,
      message: 'Sneha Reddy completed your task "Grocery Shopping Assistance". Please leave feedback!',
      read: false, isSeedData: true, createdAt: daysAgo(15),
    },
    {
      userId: arjunId,
      message: 'Rahul Kumar accepted your request "Urgent: Blood Donors or Coordinator Needed (O+)". Chat is now open!',
      read: false, isSeedData: true, createdAt: daysAgo(1),
    },
    {
      userId: snehaId,
      message: 'You received a 5-star rating from Priya Sharma. Thank you for volunteering!',
      read: false, isSeedData: true, createdAt: daysAgo(14),
    },
  ]);

  console.log('[7/7] Injecting dummy tasks into ALL existing users manually so no dashboard is empty...');
  const allUsers = await db.collection('users').find({}).toArray();
  for (const user of allUsers) {
    const uid = String(user._id);
    if ([priyaId, rahulId, snehaId, arjunId, String(uIds['4'])].includes(uid)) continue;

    // 1. Give them a posted request
    const mockRequest = await db.collection('requests').insertOne({
      title: 'Help Organizing Neighborhood Cleanup',
      description: 'Looking for 3 volunteers to help clean up the local park this Sunday morning. Garbage bags and gloves provided.',
      category: 'Community', location: user.location || 'Local Area', pincode: user.pincode || '000000',
      urgency: 'Low', volunteersNeeded: 3, deadline: daysFromNow(2),
      status: 'Open', postedBy: uid, acceptedBy: [],
      isSeedData: true, createdAt: daysAgo(1),
    });

    // 2. Assign them to an "In Progress" task
    const t = await db.collection('tasks').insertOne({
      requestId: String(rIds['1']), requesterId: snehaId, helperId: uid,
      status: 'In Progress', isSeedData: true, acceptedAt: daysAgo(2), completedAt: null,
    });
    await db.collection('requests').updateOne({ _id: rIds['1'] }, { $addToSet: { acceptedBy: uid }, $set: { status: 'In Progress' } });
    
    // Give them a welcome message from sneha in that task's chat
    await db.collection('chat').insertOne({
      taskId: String(t.insertedId), senderId: snehaId, senderName: 'Sneha Reddy',
      message: 'Thanks for offering to help with the groceries! Let me know when you are free.',
      isSeedData: true, timestamp: new Date(),
    });

    // 3. Give them a completed task in history
    const t2 = await db.collection('tasks').insertOne({
      requestId: completedId, requesterId: priyaId, helperId: uid,
      status: 'Completed', isSeedData: true, acceptedAt: daysAgo(18), completedAt: daysAgo(15),
    });
    
    // Give them some feedback for it
    await db.collection('feedback').insertOne({
      taskId: String(t2.insertedId), givenBy: priyaId, rating: 5,
      comment: 'Absolutely wonderful helper. Arrived on time and was very polite!',
      isSeedData: true, createdAt: daysAgo(15),
    });
  }

  console.log('\n✅  Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  priya@demo.com   /  demo1234   (Requester — Hyderabad)');
  console.log('  rahul@demo.com   /  demo1234   (Volunteer — Hyderabad)');
  console.log('  sneha@demo.com   /  demo1234   (Volunteer — Hyderabad)');
  console.log('  arjun@demo.com   /  demo1234   (Requester — Kurnool)');
  console.log('  admin@demo.com   /  admin1234  (Admin)');
  console.log('\nOpen http://localhost:3000 and log in to explore.\n');

  await client.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
