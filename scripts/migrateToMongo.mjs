import path from 'path';

// Load from .env.local if available
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ MONGODB_URI is not set in environment or .env.local');
  process.exit(1);
}
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('cinefuel');
  const collection = db.collection('links');

  // Create indexes on movieId, url, id
  await collection.createIndex({ movieId: 1 });
  await collection.createIndex({ id: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ url: 1 });
  console.log('⚡ Created indexes on links collection');

  // Load from serverLinks.json
  const dataPath = './src/data/serverLinks.json';
  if (fs.existsSync(dataPath)) {
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8') || '{}');
    const ops = [];
    for (const [movieId, links] of Object.entries(raw)) {
      if (Array.isArray(links)) {
        for (const l of links) {
          ops.push({
            updateOne: {
              filter: { movieId: String(movieId), url: l.url },
              update: { $set: { ...l, movieId: String(movieId), updatedAt: new Date() } },
              upsert: true
            }
          });
        }
      }
    }
    if (ops.length > 0) {
      const res = await collection.bulkWrite(ops);
      console.log('📦 Migrated links to MongoDB:', ops.length, 'links. Upserted:', res.upsertedCount, 'Modified:', res.modifiedCount);
    }
  }

  const count = await collection.countDocuments();
  console.log('📊 Total links in MongoDB Atlas:', count);
  await client.close();
}

run().catch(console.error);
