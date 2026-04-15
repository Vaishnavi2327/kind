require('dotenv').config();

const { MongoClient } = require('mongodb');

function parseVolunteersNeeded(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  return Math.floor(n);
}

function computeStatus(acceptedCount, needed) {
  if (acceptedCount >= needed) return 'Full';
  if (acceptedCount > 0) return 'In Progress';
  return 'Open';
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error('Missing MONGODB_URI or MONGODB_DB');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const requests = db.collection('requests');

  let modified = 0;
  const cursor = requests.find({});
  // eslint-disable-next-line no-restricted-syntax
  for await (const r of cursor) {
    const acceptedBy = Array.isArray(r.acceptedBy) ? r.acceptedBy : (r.acceptedBy ? [String(r.acceptedBy)] : []);
    const needed = parseVolunteersNeeded(r.volunteersNeeded);

    // Normalize status only if not completed.
    const nextStatus = r.status === 'Completed'
      ? 'Completed'
      : computeStatus(acceptedBy.length, needed);

    const set = {
      acceptedBy,
      volunteersNeeded: needed,
      status: nextStatus,
    };
    if (typeof r.pincode !== 'string') set.pincode = '';

    const res = await requests.updateOne(
      { _id: r._id },
      { $set: set },
    );
    modified += res.modifiedCount;
  }

  // Ensure unique index for (requestId, helperId)
  await db.collection('tasks').createIndex({ requestId: 1, helperId: 1 }, { unique: true });

  // eslint-disable-next-line no-console
  console.log(`Migration complete. Modified ${modified} request docs.`);
  await client.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

