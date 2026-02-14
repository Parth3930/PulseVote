import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL || '');

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    const migrationSQL = readFileSync('./drizzle/seed.sql', 'utf-8');

    await sql.unsafe(migrationSQL);

    console.log('✅ Migrations completed successfully!');
    console.log('\nTables created:');
    console.log('  - polls');
    console.log('  - options');
    console.log('  - votes');
    console.log('\nIndexes created for performance and anti-abuse protection.');

    await sql.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
