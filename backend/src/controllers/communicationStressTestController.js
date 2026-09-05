/**
 * Communication Stress-Test — REST Controller
 *
 * Phase 1: capabilities endpoint + create endpoint (validation only, no AI call).
 * Phase 3: Will wire in the AI provider for actual stress-test execution.
 *
 * All endpoints are tenant-scoped via auth middleware.
 */

const {
  checkFeatureEnabled,
  resolveIdempotency,
  computeContentFingerprint,
  getCapabilities,
} = require('../services/communicationStressTestService');

const {
  createStressTestSchema,
  recordEventSchema,
  validateIdempotencyKey,
} = require('../validators/communicationStressTest');

const prisma = require('../config/db');

// ── GET /capabilities ────────────────────────────────────────────────────
// Returns server-computed permissions so the frontend doesn't guess.

const capabilities = async (req, res) => {
  try {
    const { enabled } = await checkFeatureEnabled(req.user.tenantId);
    const caps = getCapabilities(req.user, enabled);
    return res.json(caps);
  } catch (err) {
    console.error('[CommunicationStressTest] capabilities error:', err);
    return res.status(500).json({ error: 'Failed to retrieve capabilities.' });
  }
};

// ── POST / ───────────────────────────────────────────────────────────────
// Run a stress-test on a draft message.

const create = async (req, res) => {
  try {
    // 1. Feature-flag check (fail closed)
    const { enabled, reason } = await checkFeatureEnabled(req.user.tenantId);
    if (!enabled) {
      return res.status(503).json({
        error: reason,
        code: 'FEATURE_DISABLED',
      });
    }

    // 2. Idempotency-Key header validation
    const idempResult = validateIdempotencyKey(req.headers['idempotency-key']);
    if (!idempResult.valid) {
      return res.status(400).json({ error: idempResult.error });
    }

    // 3. Request body validation (Zod)
    const parseResult = createStressTestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const { sourceType, title, message, category } = parseResult.data;

    // 4. Content fingerprint for idempotency
    const contentFingerprint = computeContentFingerprint(title, message);

    // 5. Idempotency resolution
    const { existing, conflict } = await resolveIdempotency(
      req.user.tenantId,
      req.user.id,
      idempResult.key,
      contentFingerprint
    );

    if (conflict) {
      return res.status(409).json({
        error: 'Idempotency conflict: the same key was used with different content.',
        code: 'IDEMPOTENCY_CONFLICT',
      });
    }

    if (existing) {
      // Return cached result (idempotent replay)
      return res.status(200).json(formatTestResponse(existing));
    }

    // 6. Execute Stress-Test Pipeline via Service
    const { runStressTest } = require('../services/communicationStressTestService');
    const result = await runStressTest({
      tenantId: req.user.tenantId,
      createdById: req.user.id,
      idempotencyKey: idempResult.key,
      sourceType,
      title,
      message,
      category,
      contentFingerprint,
    });

    return res.status(201).json(formatTestResponse(result));
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[CommunicationStressTest] create error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during stress-test creation.' });
  }
};

// ── GET /:id ─────────────────────────────────────────────────────────────
// Read a single test result. Creator or view_all permission required.

const getById = async (req, res) => {
  try {
    const { enabled, reason } = await checkFeatureEnabled(req.user.tenantId);
    if (!enabled) {
      return res.status(503).json({ error: reason, code: 'FEATURE_DISABLED' });
    }

    const test = await prisma.basePrisma.communicationStressTest.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId, // Cross-tenant guard
      },
      include: {
        reactions: true,
      },
    });

    if (!test) {
      return res.status(404).json({ error: 'Stress test not found.' });
    }

    // Access check: creator or view_all permission
    const { canViewAll } = getCapabilities(req.user, true);
    if (test.createdById !== req.user.id && !canViewAll) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own stress tests.' });
    }

    return res.json(formatTestResponse(test));
  } catch (err) {
    console.error('[CommunicationStressTest] getById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve stress test.' });
  }
};

// ── POST /:id/retest ────────────────────────────────────────────────────
// Create an immutable re-test (linked via parentTestId).

const retest = async (req, res) => {
  try {
    const { enabled, reason } = await checkFeatureEnabled(req.user.tenantId);
    if (!enabled) {
      return res.status(503).json({ error: reason, code: 'FEATURE_DISABLED' });
    }

    const parentTest = await prisma.basePrisma.communicationStressTest.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
        createdById: req.user.id, // Only creator can retest
      },
    });

    if (!parentTest) {
      return res.status(404).json({ error: 'Parent stress test not found or access denied.' });
    }

    if (parentTest.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Only completed tests can be re-tested.' });
    }

    // ─── Phase 3 will add the actual AI provider call here ───
    return res.status(501).json({
      error: 'Retest execution is not yet implemented.',
      code: 'NOT_IMPLEMENTED',
      parentTestId: parentTest.id,
    });
  } catch (err) {
    console.error('[CommunicationStressTest] retest error:', err);
    return res.status(500).json({ error: 'Failed to create re-test.' });
  }
};

// ── POST /:id/events ────────────────────────────────────────────────────
// Record an interaction event (VIEWED, REWRITE_COPIED, etc.)

const recordEvent = async (req, res) => {
  try {
    const { enabled, reason } = await checkFeatureEnabled(req.user.tenantId);
    if (!enabled) {
      return res.status(503).json({ error: reason, code: 'FEATURE_DISABLED' });
    }

    // Validate body
    const parseResult = recordEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    // Verify test ownership
    const test = await prisma.basePrisma.communicationStressTest.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
        createdById: req.user.id,
      },
      select: { id: true },
    });

    if (!test) {
      return res.status(404).json({ error: 'Stress test not found or access denied.' });
    }

    const { eventType, metadata } = parseResult.data;

    const event = await prisma.basePrisma.communicationStressTestEvent.create({
      data: {
        tenantId: req.user.tenantId,
        stressTestId: test.id,
        actorId: req.user.id,
        eventType,
        metadata: metadata || undefined,
      },
    });

    return res.status(201).json({ id: event.id, eventType: event.eventType });
  } catch (err) {
    console.error('[CommunicationStressTest] recordEvent error:', err);
    return res.status(500).json({ error: 'Failed to record event.' });
  }
};

// ── Response Formatter ───────────────────────────────────────────────────
// Normalises DB records into the API contract shape.

const formatTestResponse = (test) => {
  const response = {
    id: test.id,
    status: test.status,
    sourceType: test.sourceType,
    overallFrictionScore: test.overallFrictionScore,
    frictionBand: test.frictionBand,
    dimensionScores: test.dimensionScores,
    personas: (test.reactions || []).map((r) => ({
      key: r.personaKey,
      name: r.personaName,
      summary: r.summary,
      concerns: r.concerns || [],
      mitigations: r.mitigations || [],
    })),
    rewrite: test.rewriteMessage
      ? {
          message: test.rewriteMessage,
          ...(test.rewriteMetadata || {}),
        }
      : null,
    expiresAt: test.expiresAt,
    scoringVersion: test.scoringVersion,
    parentTestId: test.parentTestId || null,
    createdAt: test.createdAt,
  };
  return response;
};

const analyzeAnnouncement = async (req, res) => {
  try {
    const { title, message, category } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required for analysis.' });
    }

    const { analyzeAnnouncementForEmployees } = require('../services/communicationReviewProvider');
    const result = await analyzeAnnouncementForEmployees({ title, message, category });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[CommunicationStressTest] analyzeAnnouncement error:', err.message);
    return res.status(500).json({ error: err.message || 'Iris AI analysis failed.' });
  }
};

module.exports = {
  capabilities,
  create,
  getById,
  retest,
  recordEvent,
  analyzeAnnouncement,
};
