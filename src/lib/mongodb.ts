import { MongoClient, Db } from 'mongodb';
import { getEnv } from '@/lib/env';

const options = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 10000,
};

let cachedClientPromise: Promise<MongoClient> | null = null;
let cachedUri: string | null = null;

export async function getDatabase(dbName?: string): Promise<Db | null> {
  const currentUri = getEnv('MONGODB_URI');
  if (!currentUri) {
    return null;
  }
  try {
    if (!cachedClientPromise || cachedUri !== currentUri) {
      cachedUri = currentUri;
      const clientInstance = new MongoClient(currentUri, options);
      cachedClientPromise = clientInstance.connect().catch((err) => {
        cachedClientPromise = null;
        throw err;
      });
    }
    const connectedClient = await cachedClientPromise;
    const isStaging = getEnv('APP_ENV') === 'staging' || getEnv('CINEFUEL_ENV') === 'staging';
    const targetDb = dbName || getEnv('MONGODB_DB_NAME') || (isStaging ? 'cinefuel_staging' : 'cinefuel');
    return connectedClient.db(targetDb);
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    cachedClientPromise = null;
    return null;
  }
}

export default cachedClientPromise;
