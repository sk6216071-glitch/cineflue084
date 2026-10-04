/**
 * CineFuel Production Index Creation Script (Cutover Runbook Step 3)
 *
 * CRITICAL SAFETY RULES:
 * 1. This script MUST NOT be executed without explicit operator confirmation.
 * 2. It requires the CLI flag: --confirm-production
 * 3. It creates ONLY non-blocking, non-destructive secondary indexes on MongoDB Atlas.
 * 4. It performs ZERO deletions, updates, or table drops.
 */

const { MongoClient } = require('mongodb');

const PROD_URI = process.env.PROD_MONGODB_URI || process.env.MONGODB_URI || 'mongodb+srv://shyam:shyam081@cluster0.fiwla4n.mongodb.net/cinefuel?retryWrites=true&w=majority';

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--confirm-production')) {
    console.error('================================================================');
    console.error('CRITICAL ABORT: Explicit confirmation flag is required!');
    console.error('Usage: node scripts/create-production-indexes.js --confirm-production');
    console.error('Do NOT run this script without explicit authorization.');
    console.error('================================================================');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('       CINEFUEL PRODUCTION INDEX PROVISIONING SCRIPT            ');
  console.log('================================================================\n');

  console.log('Connecting to MongoDB Atlas Production database...');
  const client = new MongoClient(PROD_URI);
  await client.connect();

  const db = client.db('cinefuel');
  if (db.databaseName !== 'cinefuel') {
    throw new Error(`SAFETY ABORT: Target database resolved to '${db.databaseName}' instead of 'cinefuel'!`);
  }

  const collection = db.collection('links');
  const count = await collection.countDocuments();
  console.log(`Connected to target: ${db.databaseName}.links (${count} documents)\n`);

  console.log('1. Creating Index 1: catalog_created_updated_movieId...');
  const idx1 = await collection.createIndex(
    { createdAt: -1, updatedAt: -1, movieId: 1 },
    { name: 'catalog_created_updated_movieId', background: true }
  );
  console.log(`   -> Created: ${idx1}`);

  console.log('\n2. Creating Index 2: catalog_mediaType_created_movieId...');
  const idx2 = await collection.createIndex(
    { mediaType: 1, createdAt: -1, movieId: 1 },
    { name: 'catalog_mediaType_created_movieId', background: true }
  );
  console.log(`   -> Created: ${idx2}`);

  console.log('\n3. Verifying all active indexes on cinefuel.links:');
  const activeIndexes = await collection.indexes();
  for (const idx of activeIndexes) {
    console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
  }

  await client.close();
  console.log('\n================================================================');
  console.log('INDEX PROVISIONING COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Failed to create indexes:', err);
  process.exit(1);
});
