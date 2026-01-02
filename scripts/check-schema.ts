import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.POSTGRES_URL!);

async function main() {
  const result = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'players'
  `;
  console.log('Players table columns:');
  console.log(result);
}

main().catch(console.error);
