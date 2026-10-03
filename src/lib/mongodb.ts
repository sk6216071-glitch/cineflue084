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
    if (!clientPromise) {
      if (process.env.NODE_ENV === 'development') {
        if (!global._mongoClientPromise) {
          client = new MongoClient(currentUri, options);
          global._mongoClientPromise = client.connect();
        }
        clientPromise = global._mongoClientPromise;
      } else {
        client = new MongoClient(currentUri, options);
        clientPromise = client.connect();
      }
    }
    const connectedClient = await clientPromise;
    const isStaging = getEnv('APP_ENV') === 'staging' || getEnv('CINEFUEL_ENV') === 'staging';
    const targetDb = dbName || getEnv('MONGODB_DB_NAME') || (isStaging ? 'cinefuel_staging' : 'cinefuel');
    return connectedClient.db(targetDb);
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    clientPromise = null;
    return null;
  }
}

export default clientPromise;
