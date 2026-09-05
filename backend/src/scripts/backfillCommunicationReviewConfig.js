/**
 * Backfill Script: Seed CommunicationReviewConfig and System Personas for Existing Tenants
 *
 * Usage: node src/scripts/backfillCommunicationReviewConfig.js
 * NPM script: npm run backfill:stress-test
 */

const prisma = require('../config/db');
const { seed } = require('../services/communicationPersonaSeeder');

async function main() {
  console.log('[BACKFILL] Starting Communication Review seeding for existing tenants...');

  const tenants = await prisma.basePrisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`[BACKFILL] Found ${tenants.length} tenants.`);

  let successCount = 0;
  let failCount = 0;

  for (const tenant of tenants) {
    try {
      await seed(prisma.basePrisma, tenant.id);
      console.log(`[BACKFILL] Seeded tenant: ${tenant.name} (${tenant.id})`);
      successCount++;
    } catch (err) {
      console.error(`[BACKFILL] Failed for tenant ${tenant.name} (${tenant.id}):`, err.message);
      failCount++;
    }
  }

  console.log(`[BACKFILL] Complete. ${successCount} succeeded, ${failCount} failed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[BACKFILL] Unhandled error:', err);
  process.exit(1);
});
