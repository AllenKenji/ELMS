require('dotenv').config();

const pool = require('../db');
const sessionService = require('../services/sessionService');

async function resolveBackfillUserId() {
  const envUserId = Number(process.env.BACKFILL_USER_ID);
  if (Number.isInteger(envUserId) && envUserId > 0) {
    return envUserId;
  }

  const adminResult = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(r.role_name) = 'admin'
     ORDER BY u.id ASC
     LIMIT 1`
  );

  if (!adminResult.rows.length) {
    throw new Error('No admin user found. Set BACKFILL_USER_ID to a valid user id.');
  }

  return Number(adminResult.rows[0].id);
}

async function run() {
  const userId = await resolveBackfillUserId();
  const result = await sessionService.backfillCouncilorsForExistingSessions(userId);

  console.log('Councilor participant backfill completed.');
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((err) => {
    console.error('Councilor participant backfill failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
