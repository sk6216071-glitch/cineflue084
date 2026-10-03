import { MongoClient, Db } from 'mongodb';
import { getEnv } from '@/lib/env';

const options = {
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 5000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getDatabase(dbName?: string): Promise<Db | null> {
  const currentUri = getEnv('MONGODB_URI');
  if (!currentUri) {
    return null;
  }
  try {
    const client = new MongoClient(currentUri, options);
    const connectedClient = await client.connect();
    const isStaging = getEnv('APP_ENV') === 'staging' || getEnv('CINEFUEL_ENV') === 'staging';
    const targetDb = dbName || getEnv('MONGODB_DB_NAME') || (isStaging ? 'cinefuel_staging' : 'cinefuel');
    return connectedClient.db(targetDb);
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    return null;
  }
}

export default clientPromise;
