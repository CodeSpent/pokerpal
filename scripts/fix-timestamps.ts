import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.POSTGRES_URL!);

async function main() {
  console.log('Altering timestamp columns from integer to bigint...\n');

  const alterStatements = [
    'ALTER TABLE players ALTER COLUMN created_at TYPE bigint',
    'ALTER TABLE tournaments ALTER COLUMN level_started_at TYPE bigint',
    'ALTER TABLE tournaments ALTER COLUMN created_at TYPE bigint',
    'ALTER TABLE tournaments ALTER COLUMN started_at TYPE bigint',
    'ALTER TABLE tournaments ALTER COLUMN ended_at TYPE bigint',
    'ALTER TABLE tournament_registrations ALTER COLUMN registered_at TYPE bigint',
    'ALTER TABLE early_start_votes ALTER COLUMN voted_at TYPE bigint',
    'ALTER TABLE tables ALTER COLUMN created_at TYPE bigint',
    'ALTER TABLE hands ALTER COLUMN action_deadline TYPE bigint',
    'ALTER TABLE hands ALTER COLUMN showdown_started_at TYPE bigint',
    'ALTER TABLE hands ALTER COLUMN started_at TYPE bigint',
    'ALTER TABLE hands ALTER COLUMN ended_at TYPE bigint',
    'ALTER TABLE actions ALTER COLUMN created_at TYPE bigint',
    'ALTER TABLE events ALTER COLUMN created_at TYPE bigint',
    'ALTER TABLE migrations ALTER COLUMN applied_at TYPE bigint',
  ];

  for (const statement of alterStatements) {
    try {
      await sql.query(statement);
      console.log(`✓ ${statement}`);
    } catch (error: any) {
      console.log(`✗ ${statement}: ${error.message}`);
    }
  }

  console.log('\nDone! Verifying players table...');
  const result = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'players'
  `;
  console.log(result);
}

main().catch(console.error);
