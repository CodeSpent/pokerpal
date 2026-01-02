import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      return NextResponse.json({ error: 'No POSTGRES_URL' });
    }

    const sql = neon(connectionString);

    const schema = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      postgresUrlHost: new URL(connectionString).host,
      databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : 'not set',
      allDbEnvs: Object.keys(process.env).filter(k =>
        k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('NEON')
      ),
      schema,
    });
  } catch (error) {
    return NextResponse.json({
      error: (error as Error).message,
    });
  }
}
