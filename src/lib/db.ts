import { Pool } from 'pg';

const connectionString =
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_Lam6rY5FyMnj@ep-aged-fire-afak14yi-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

// pg Pool with settings tuned for Neon Serverless (which suspends after ~5min idle).
// Key insight: DO NOT keep a persistent pool across requests in Next.js dev mode
// because Next.js hot-reloads route modules frequently, leaving stale TCP connections
// in the pool that Neon has already closed on its side.
//
// Solution: short idleTimeoutMillis (5s) so dead connections are evicted quickly,
// plus aggressive retry logic in query().
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 5000,           // evict idle connections after 5s (before Neon closes them)
  connectionTimeoutMillis: 20000,    // up to 20s for Neon cold-start
  keepAlive: true,
  keepAliveInitialDelayMillis: 1000,
});

pool.on('error', (err: Error) => {
  // Expected when Neon suspends the compute — pool will create new connections on demand.
  console.warn('Neon pool idle error (non-fatal):', err.message);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const MAX_RETRIES = 4;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let client;
    try {
      // Always acquire a fresh client from pool, not reuse a cached query connection
      client = await pool.connect();
      const res = await client.query(text, params);
      const duration = Date.now() - start;
      console.log('Neon SQL Query', { text: text.substring(0, 80), duration, rows: res.rowCount });
      return res;
    } catch (error: any) {
      const isRetryable =
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01' ||    // admin_shutdown (Neon suspend)
        error?.code === '08006' ||    // connection_failure
        error?.code === '08003' ||    // connection_does_not_exist
        error?.code === '08000' ||    // connection_exception
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('Connection terminated') ||
        error?.message?.includes('socket hang up') ||
        error?.message?.includes('connection timeout') ||
        error?.message?.includes('connection refused');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = Math.min(attempt * 1500, 5000); // 1.5s, 3s, 4.5s
        console.warn(`Neon attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms... (${error?.code || error?.message?.substring(0, 60)})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error('Neon SQL Query Error:', error.message || error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  throw new Error('Neon SQL query failed after all retries.');
}

export default pool;
