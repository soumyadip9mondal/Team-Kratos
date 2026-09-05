/**
 * Daily Retention Job: Redact Expired Communication Stress Tests
 *
 * Runs daily at 3:00 AM via cronJobs.js.
 * Enforces 90-day detail retention policy:
 *   - Redacts draft message and rewrite text for tests older than detailRetentionDays (default 90)
 *   - Sets status to REDACTED and records redactedAt timestamp
 *   - Retains aggregated numeric scores and friction band for 365-day analytics
 */

const redactExpiredTests = async (basePrisma) => {
  console.log('[RETENTION] Starting expired communication stress-tests redaction...');

  try {
    const tenants = await basePrisma.tenant.findMany({ select: { id: true } });
    let totalRedacted = 0;

    for (const tenant of tenants) {
      // Get tenant retention config
      const config = await basePrisma.communicationReviewConfig.findUnique({
        where: { tenantId: tenant.id },
        select: { detailRetentionDays: true },
      });

      const retentionDays = config?.detailRetentionDays || 90;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Find tests past retention cutoff that are not yet redacted
      const expiredTests = await basePrisma.communicationStressTest.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { lt: cutoffDate },
          status: { not: 'REDACTED' },
        },
        select: { id: true },
      });

      if (expiredTests.length === 0) continue;

      const expiredIds = expiredTests.map((t) => t.id);

      // Redact in bulk
      const updateResult = await basePrisma.communicationStressTest.updateMany({
        where: { id: { in: expiredIds } },
        data: {
          status: 'REDACTED',
          message: '[REDACTED]',
          title: '[REDACTED]',
          category: null,
          rewriteMessage: null,
          rewriteMetadata: null,
          redactedAt: new Date(),
        },
      });

      // Clear detailed persona summaries/concerns for redacted tests
      await basePrisma.communicationPersonaReaction.updateMany({
        where: { stressTestId: { in: expiredIds } },
        data: {
          summary: '[REDACTED]',
          concerns: [],
          mitigations: null,
        },
      });

      totalRedacted += updateResult.count;
      console.log(`[RETENTION] Tenant ${tenant.id}: redacted ${updateResult.count} expired tests.`);
    }

    console.log(`[RETENTION] Completed. Total redacted across all tenants: ${totalRedacted}.`);
  } catch (err) {
    console.error('[RETENTION] Error in redactExpiredTests job:', err);
  }
};

module.exports = { redactExpiredTests };
