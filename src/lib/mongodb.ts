import { MongoClient, Db } from 'mongodb';
import { getEnv } from '@/lib/env';

const options = {
  maxPoolSize: 3,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 6000,
};

let cachedClientPromise: Promise<MongoClient> | null = null;
let cachedUri: string | null = null;

export function resetMongoClient(): void {
  cachedClientPromise = null;
  cachedUri = null;
}

export async function getDatabase(dbName?: string): Promise<Db | null> {
  const currentUri = getEnv('MONGODB_URI');
  if (!currentUri) {
    return null;
  }
  // Cloudflare Workers runtime guard:
  // Node.js official MongoClient hangs indefinitely inside workerd due to missing TCP DNS SRV resolution
  if (typeof (globalThis as any).WebSocketPair !== 'undefined' || getEnv('WORKER_NAME')) {
    return null;
  }
  try {
    if (!cachedClientPromise || cachedUri !== currentUri) {
      cachedUri = currentUri;
      const clientInstance = new MongoClient(currentUri, options);
      cachedClientPromise = clientInstance.connect().catch((err) => {
        resetMongoClient();
        throw err;
      });
    }
    const connectedClient = await cachedClientPromise;
    const isStaging = getEnv('APP_ENV') === 'staging' || getEnv('CINEFUEL_ENV') === 'staging';
    const targetDb = dbName || getEnv('MONGODB_DATABASE') || getEnv('MONGODB_DB_NAME') || (isStaging ? 'cinefuel_staging' : 'cinefuel');
    return connectedClient.db(targetDb);
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    resetMongoClient();
    return null;
  }
}

export default cachedClientPromise;
