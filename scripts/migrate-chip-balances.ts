/**
 * One-time migration: Set all existing players to 20,000 chips
 * and insert initial_grant ledger entries for those missing them.
 *
 * Run with: npx tsx scripts/migrate-chip-balances.ts
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.POSTGRES_URL!);

async function main() {
  console.log('Migrating chip balances...\n');

  // Get all players
  const players = await sql`SELECT id, chip_balance FROM players`;
  console.log(`Found ${players.length} players`);

  let updated = 0;
  let granted = 0;

  for (const player of players) {
    // Set balance to 20000
    if (player.chip_balance !== 20000) {
      await sql`UPDATE players SET chip_balance = 20000 WHERE id = ${player.id}`;
      console.log(`  Updated ${player.id}: ${player.chip_balance} -> 20000`);
      updated++;
    }

    // Check if any ledger entries exist for this player
    const existing = await sql`
      SELECT id FROM chip_transactions WHERE player_id = ${player.id} LIMIT 1
    `;

    if (existing.length === 0) {
      await sql`
        INSERT INTO chip_transactions (id, player_id, type, amount, balance_after, tournament_id, description, created_at)
        VALUES (${crypto.randomUUID()}, ${player.id}, 'initial_grant', 20000, 20000, NULL, 'Welcome bonus (migration)', ${Date.now()})
      `;
      console.log(`  Inserted initial_grant for ${player.id}`);
      granted++;
    }
  }

  console.log(`\nDone. Updated ${updated} balances, inserted ${granted} grants.`);
}

main().catch(console.error);
