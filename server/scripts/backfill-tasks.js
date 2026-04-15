require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

function toIdString(v) {
  if (v == null) return '';
  return String(v);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error('Missing MONGODB_URI or MONGODB_DB');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const requests = db.collection('requests');
  const tasks = db.collection('tasks');

  let created = 0;
  let scanned = 0;

  // eslint-disable-next-line no-restricted-syntax
  for await (const req of requests.find({})) {
    scanned += 1;
    const requestId = toIdString(req._id);
    const requesterId = toIdString(req.postedBy);
    const acceptedBy = Array.isArray(req.acceptedBy) ? req.acceptedBy.map(toIdString) : [];

    // eslint-disable-next-line no-restricted-syntax
    for (const helperId of acceptedBy) {
      if (!helperId) continue;
      let helperObjId = null;
      try { helperObjId = new ObjectId(helperId); } catch { helperObjId = null; }

      const existing = await tasks.findOne({
        requestId,
        $or: [
          { helperId },
          ...(helperObjId ? [{ helperId: helperObjId }] : []),
        ],
      });
      if (existing) continue;

      const status = String(req.status).toLowerCase() === 'completed' ? 'Completed' : 'In Progress';
      const doc = {
        requestId,
        requesterId,
        helperId,
        status,
        acceptedAt: req.createdAt || new Date(),
        completedAt: status === 'Completed' ? (req.updatedAt || new Date()) : null,
      };

      await tasks.insertOne(doc);
      created += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill done. Scanned requests: ${scanned}, tasks created: ${created}`);
  await client.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

