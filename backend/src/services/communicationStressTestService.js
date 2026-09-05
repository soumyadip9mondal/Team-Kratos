/**
 * Communication Stress-Test — Service Layer
 *
 * Handles business logic: feature-flag checks, idempotency resolution,
 * and orchestration of the stress-test workflow.
 *
 * Phase 1: Feature-flag + idempotency checks only — no AI provider call yet.
 * Phase 3: Will add communicationReviewProvider integration.
 */

const prisma = require('../config/db');
const { isFeatureGloballyEnabled } = require('../config/communicationReviewPolicy');

/**
 * Check whether the stress-test feature is fully enabled for a tenant.
 * Both the global env flag AND the per-tenant DB flag must be truthy.
 *
 * @param {string} tenantId
 * @returns {Promise<{ enabled: boolean, reason?: string }>}
 */
const checkFeatureEnabled = async (tenantId) => {
  // Gate 1: Global env flag
  if (!isFeatureGloballyEnabled()) {
    return { enabled: false, reason: 'Communication stress-testing is not enabled on this instance.' };
  }

  // Gate 2: Per-tenant DB config
  try {
    const config = await prisma.basePrisma.communicationReviewConfig.findUnique({
      where: { tenantId },
      select: { enabled: true },
    });

    if (!config || !config.enabled) {
      return { enabled: false, reason: 'Communication stress-testing is not enabled for your organization.' };
    }
  } catch (err) {
    // If the table doesn't exist yet (pre-migration), fail closed
    console.error('[CommunicationStressTest] Config lookup failed:', err.message);
    return { enabled: false, reason: 'Message review is temporarily unavailable.' };
  }

  return { enabled: true };
};

/**
 * Resolve idempotency: check if a test with the same key already exists.
 *
 * @param {string} tenantId
 * @param {string} createdById
 * @param {string} idempotencyKey
 * @param {string} contentFingerprint
 * @returns {Promise<{ existing: object|null, conflict: boolean }>}
 */
const resolveIdempotency = async (tenantId, createdById, idempotencyKey, contentFingerprint) => {
  try {
    const existing = await prisma.basePrisma.communicationStressTest.findUnique({
      where: {
        tenantId_createdById_idempotencyKey: {
          tenantId,
          createdById,
          idempotencyKey,
        },
      },
      include: {
        reactions: true,
      },
    });

    if (!existing) {
      return { existing: null, conflict: false };
    }

    // Same key but different content → idempotency conflict
    if (existing.contentFingerprint !== contentFingerprint) {
      return { existing: null, conflict: true };
    }

    // Same key + same content → return cached result
    return { existing, conflict: false };
  } catch (err) {
    // If the table doesn't exist yet (pre-migration), treat as no existing
    console.error('[CommunicationStressTest] Idempotency lookup failed:', err.message);
    return { existing: null, conflict: false };
  }
};

/**
 * Compute a deterministic content fingerprint for idempotency comparison.
 * Uses HMAC-SHA256 with a server-side secret key.
 *
 * @param {string} title
 * @param {string} message
 * @returns {string}
 */
const computeContentFingerprint = (title, message) => {
  const crypto = require('crypto');
  const hashKey = process.env.COMMUNICATION_STRESS_TEST_HASH_KEY || 'dev-fallback-key';
  return crypto
    .createHmac('sha256', hashKey)
    .update(`${title}||${message}`)
    .digest('hex');
};

/**
 * Get server-computed capabilities for the current user.
 *
 * @param {object} user - req.user with roleDefinition
 * @param {boolean} featureEnabled - result of checkFeatureEnabled
 * @returns {object}
 */
const getCapabilities = (user, featureEnabled) => {
  const { PERMISSION_DEFAULTS } = require('../config/communicationReviewPolicy');
  const roleDef = user.roleDefinition;

  const hasPermission = (key) => {
    if (!roleDef) return false;
    if (roleDef.level === 0) return true;

    const perms = roleDef.permissions;
    if (perms !== null && perms !== undefined && typeof perms === 'object') {
      return perms[key] === true;
    }

    const rule = PERMISSION_DEFAULTS[key];
    return rule ? roleDef.level <= rule.maxLevel : false;
  };

  return {
    canStressTest: featureEnabled && hasPermission('communication_stress_test'),
    canViewAll: featureEnabled && hasPermission('view_all_communication_stress_tests'),
    canManagePersonas: featureEnabled && hasPermission('manage_communication_personas'),
    canViewTrends: featureEnabled && hasPermission('view_communication_trends'),
    canPublishAnnouncements: roleDef ? roleDef.level <= 1 : false,
    featureEnabled,
  };
};

/**
 * Execute a complete stress-test workflow on a draft message.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.createdById
 * @param {string} params.idempotencyKey
 * @param {string} params.sourceType
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.category]
 * @param {string} params.contentFingerprint
 * @returns {Promise<object>} Saved CommunicationStressTest database record with reactions
 */
const runStressTest = async ({
  tenantId,
  createdById,
  idempotencyKey,
  sourceType,
  title,
  message,
  category,
  contentFingerprint,
}) => {
  const { inspectInput } = require('../utils/communicationReviewInputGuard');
  const { analyzeDraft } = require('./communicationReviewProvider');
  const prisma = require('../config/db');

  // 1. DLP & Input Safety Inspection
  const guardResult = inspectInput(title, message);
  if (!guardResult.safe) {
    throw {
      statusCode: 400,
      message: `Safety check failed: ${guardResult.reason}`,
      code: 'INPUT_SAFETY_VIOLATION',
    };
  }

  // 2. Fetch Active System Personas for Tenant
  let personas = await prisma.basePrisma.communicationPersona.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, key: true, name: true, roleFamily: true, focusAreas: true },
  });

  // Fallback: If no personas found (e.g. newly created tenant before seeder ran), run seeder dynamically
  if (personas.length === 0) {
    const { seed } = require('./communicationPersonaSeeder');
    await seed(prisma.basePrisma, tenantId);
    personas = await prisma.basePrisma.communicationPersona.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, key: true, name: true, roleFamily: true, focusAreas: true },
    });
  }

  // 3. Create Pending StressTest DB Record
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days retention

  const testRecord = await prisma.basePrisma.communicationStressTest.create({
    data: {
      tenantId,
      createdById,
      idempotencyKey,
      sourceType,
      title,
      message,
      category: category || null,
      contentFingerprint,
      status: 'RUNNING',
      expiresAt,
    },
  });

  // 4. Call AI Provider for Analysis & Scoring
  try {
    const aiResult = await analyzeDraft({
      title,
      message,
      category,
      personas,
    });

    // 5. Save Completed Result & Reactions in Transaction
    const updatedTest = await prisma.basePrisma.$transaction(async (tx) => {
      // Update stress test record
      const completed = await tx.communicationStressTest.update({
        where: { id: testRecord.id },
        data: {
          status: 'COMPLETED',
          overallFrictionScore: aiResult.overallFrictionScore,
          frictionBand: aiResult.frictionBand,
          dimensionScores: aiResult.dimensionScores,
          rewriteMessage: aiResult.rewriteMessage,
          rewriteMetadata: aiResult.rewriteMetadata,
          modelVersion: aiResult.modelVersion,
          promptVersion: aiResult.promptVersion,
          scoringVersion: aiResult.scoringVersion,
        },
      });

      // Create persona reactions
      for (const reaction of aiResult.reactions) {
        await tx.communicationPersonaReaction.create({
          data: {
            tenantId,
            stressTestId: testRecord.id,
            personaKey: reaction.personaKey,
            personaName: reaction.personaName,
            summary: reaction.summary,
            concernTypes: reaction.concernTypes,
            maxSeverity: reaction.maxSeverity,
            concerns: reaction.concerns,
            mitigations: reaction.mitigations,
          },
        });
      }

      // Record CREATED event
      await tx.communicationStressTestEvent.create({
        data: {
          tenantId,
          stressTestId: testRecord.id,
          actorId: createdById,
          eventType: 'CREATED',
          metadata: {
            overallFrictionScore: aiResult.overallFrictionScore,
            frictionBand: aiResult.frictionBand,
          },
        },
      });

      return tx.communicationStressTest.findUnique({
        where: { id: testRecord.id },
        include: { reactions: true },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    return updatedTest;
  } catch (err) {
    // Mark record FAILED on execution failure
    await prisma.basePrisma.communicationStressTest.update({
      where: { id: testRecord.id },
      data: { status: 'FAILED' },
    });
    throw err;
  }
};

module.exports = {
  checkFeatureEnabled,
  resolveIdempotency,
  computeContentFingerprint,
  getCapabilities,
  runStressTest,
};

