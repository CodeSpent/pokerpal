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
      connectionHost: new URL(connectionString).host,
      schema,
    });
  } catch (error) {
    return NextResponse.json({
      error: (error as Error).message,
    });
  }
}
