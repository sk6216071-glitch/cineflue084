const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envFile, 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function test() {
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db('cinefuel');
  const collection = db.collection('links');

  console.log('--- Testing Query ---');
  const matchStage = {
    $or: [
      { mediaType: 'movie' },
      {
        mediaType: { $ne: 'tv' },
        seasonNumber: { $in: [null, 0] },
        linkType: { $nin: ['zip_pack', 'single_episode'] },
        category: { $nin: ['ZipPack', 'SingleEpisode'] },
      },
    ]
  };

  console.time('distinct');
  const d = await collection.distinct('movieId', matchStage);
  console.timeEnd('distinct');
  console.log('distinct count:', d.length);

  console.time('aggregate');
  const p = [
    { $match: matchStage },
    { $sort: { createdAt: -1, updatedAt: -1, movieId: 1 } },
    { $project: { movieId: 1, title: 1, createdAt: 1 } },
    { $group: { _id: '$movieId', latestDoc: { $first: '$$ROOT' }, sortDate: { $first: '$createdAt' } } },
    { $sort: { sortDate: -1, _id: 1 } },
    { $limit: 16 }
  ];
  const agg = await collection.aggregate(p).toArray();
  console.timeEnd('aggregate');
  console.log('agg items:', agg.length);

  await client.close();
}
test().catch(console.error);
