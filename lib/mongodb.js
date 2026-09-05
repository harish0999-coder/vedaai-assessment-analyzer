import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'vedaai';

if (!uri) {
  // We throw lazily (inside getDb) instead of at import time so the app can
  // still boot and show a clear setup error in the UI rather than crashing
  // the whole server on a missing .env during local exploration.
  console.warn('[mongodb] MONGODB_URI is not set. Set it in .env.local');
}

let cachedClient = global._vedaaiMongoClient;
let cachedClientPromise = global._vedaaiMongoClientPromise;

function getClientPromise() {
  if (cachedClientPromise) return cachedClientPromise;
  if (!uri) throw new Error('MONGODB_URI is not configured. Add it to your .env.local file.');
  // Short timeouts on purpose: if Atlas network access isn't configured to
  // allow Vercel's serverless IPs, the driver's 30s default would otherwise
  // eat most of the function's time budget before even reaching Gemini.
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  cachedClientPromise = client.connect().catch((err) => {
    cachedClientPromise = null; // don't cache a failure — let the next request retry
    throw err;
  });
  global._vedaaiMongoClientPromise = cachedClientPromise;
  return cachedClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function getAssessmentsCollection() {
  const db = await getDb();
  return db.collection('assessments');
}
