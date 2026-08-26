/**
 * Local development database bootstrap (no PostgreSQL installation needed).
 *
 * - First run: downloads portable PostgreSQL binaries (via the embedded-postgres
 *   package) and initialises a cluster under server/.pgdata with UTF-8/C locale.
 * - Start: uses pg_ctl.exe directly. pg_ctl is the ONLY supported launcher when
 *   running from an Administrator session on Windows, because it re-launches
 *   postgres.exe under a restricted token (postgres.exe refuses admin tokens).
 * - Creates the `hr_gov` database if missing.
 *
 * On a cloud server you do NOT need this: point DATABASE_URL at your managed PG.
 *
 * Usage: node scripts/db-start.js   (keep running in its own terminal)
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const EmbeddedPostgres = require('embedded-postgres').default;

const PORT = 5432;
const DB_NAME = 'hr_gov';
const DATA_DIR = path.join(__dirname, '..', '.pgdata');
const BIN_DIR = path.join(
  __dirname,
  '..',
  'node_modules',
  '@embedded-postgres',
  'windows-x64',
  'native',
  'bin'
);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(out || `exit ${code}`))));
    p.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Initialising embedded PostgreSQL (first run downloads binaries)...');
    const pg = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: 'postgres',
      password: 'postgres',
      port: PORT,
      persistent: true,
      // Force UTF-8 regardless of the Windows system locale (branch names contain
      // characters like the en-dash that do not exist in WIN1256)
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
    });
    await pg.initialise();
  } else {
    console.log('Cluster already initialised - skipping initdb');
  }

  console.log('Starting PostgreSQL via pg_ctl on port', PORT);
  try {
    await run(path.join(BIN_DIR, 'pg_ctl.exe'), [
      '-D', DATA_DIR,
      '-l', path.join(DATA_DIR, 'server.log'),
      '-o', `-p ${PORT}`,
      '-w',
      'start',
    ]);
  } catch (e) {
    if (!/already running|lock file/i.test(e.message)) throw e;
    console.log('PostgreSQL appears to be already running');
  }
  console.log('PostgreSQL started');

  const { Client } = require('pg');
  const client = new Client({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`Database "${DB_NAME}" created`);
  } catch (e) {
    if (e.code === '42P04') console.log(`Database "${DB_NAME}" already exists`);
    else throw e;
  }
  // All server-side defaults (now()) must be UTC regardless of host timezone
  await client.query(`ALTER DATABASE ${DB_NAME} SET timezone TO 'UTC'`);
  await client.end();

  console.log('PostgreSQL is ready. Keep this window open.');
  console.log(`DATABASE_URL=postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}?schema=public`);

  const shutdown = async () => {
    console.log('\nStopping PostgreSQL...');
    try {
      await run(path.join(BIN_DIR, 'pg_ctl.exe'), ['-D', DATA_DIR, '-m', 'fast', 'stop']);
    } catch { /* already stopped */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Failed to start PostgreSQL:', e.message || e);
  process.exit(1);
});
