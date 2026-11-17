// Maakt de tabellen aan (gebeurt ook automatisch bij het eerste gebruik van de app).
import pg from 'pg';
import { SCHEMA_SQL } from '../lib/schema.js';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error('DATABASE_URL ontbreekt'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(SCHEMA_SQL);
await client.end();
console.log('Database is klaar.');
