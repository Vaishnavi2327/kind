require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('kindlink');
  const users = db.collection('users');

  // Users to add/reset
  const toAdd = [
    { name: 'Pranjal Mishra', email: 'pranjal.mishra@gmail.com', password: 'Pranjal', location: 'Hyderabad', pincode: '500001', isAdmin: true },
    { name: 'Student User', email: 'student7@gmail.com', password: '123456', location: 'Delhi', pincode: '110001', isAdmin: false },
    { name: 'Ramesh Gupta', email: 'ramesh.gupta@demo.com', password: 'demo1234', location: 'Connaught Place, Delhi', pincode: '110001', isAdmin: false },
    { name: 'Kavya Naidu', email: 'kavya.naidu@demo.com', password: 'demo1234', location: 'Gachibowli, Hyderabad', pincode: '500032', isAdmin: false },
    { name: 'Mohit Tyagi', email: 'mohit.tyagi@demo.com', password: 'demo1234', location: 'Noida Sector 18', pincode: '201301', isAdmin: false },
  ];

  for (const u of toAdd) {
    const existing = await users.findOne({ email: u.email });
    const hashed = await bcrypt.hash(u.password, 10);
    if (existing) {
      await users.updateOne({ email: u.email }, { $set: { password: hashed, isAdmin: u.isAdmin ?? false } });
      console.log(`Updated: ${u.email}`);
    } else {
      await users.insertOne({
        name: u.name, email: u.email, password: hashed,
        location: u.location, pincode: u.pincode,
        rating: 4.0 + Math.random(), ratingCount: Math.floor(Math.random() * 8),
        isAdmin: u.isAdmin ?? false, isBanned: false,
        skills: [], badges: [], karma: 0,
        createdAt: new Date(),
      });
      console.log(`Created: ${u.email}`);
    }
  }

  await client.close();
  console.log('\nDone! Credentials:');
  for (const u of toAdd) {
    console.log(`  ${u.email} / ${u.password}${u.isAdmin ? '  (Admin)' : ''}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
