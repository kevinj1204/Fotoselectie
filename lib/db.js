import 'server-only';
import { Pool } from 'pg';
import { SCHEMA_SQL } from './schema';

const g = globalThis;

function getPool() {
  if (!g.__hsPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('DATABASE_URL ontbreekt. Zie LEESMIJ.md.');
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    g.__hsPool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return g.__hsPool;
}

async function ensureSchema() {
  if (!g.__hsSchemaReady) {
    g.__hsSchemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await client.query('SELECT pg_advisory_lock(424242)');
        await client.query(SCHEMA_SQL);
      } finally {
        await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
        client.release();
      }
    })().catch((e) => {
      g.__hsSchemaReady = null;
      throw e;
    });
  }
  return g.__hsSchemaReady;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getPool().query(text, params);
}

export async function tx(fn) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getExtraPrice() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'extra_photo_price'");
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}

export async function audit(action, entity, entityId, details) {
  await query('INSERT INTO audit_log (action, entity, entity_id, details) VALUES ($1,$2,$3,$4)', [
    action, entity, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null,
  ]).catch(() => {});
}
